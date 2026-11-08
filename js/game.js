// Core simulation: setup, population, economy, institutions, rulers, unrest, history.
import { ctx, log, clamp, dateStr } from './ctx.js';
import { PT, PT_NAMES } from './mapgen.js';
import {
  TERRAIN, TECH_YEARS, MAX_TECH, TECH_GATES, TECH_MAX_AHEAD, techCost, INSTITUTIONS, INST_IDS, UNITS, UNIT_SIZE,
  BUILDINGS, MAX_FORT, LAWS, RANKS, OUTSIDER_RANKS, POLITIES, OUTSIDERS, WAVES, OUTSIDER_SUPPORT, ERAS, eraOf,
  GAELIC_NAMES, GAELIC_SURNAMES, NORSE_NAMES, NORMAN_FIRST, NORMAN_SUR, ENGLISH_FIRST, ENGLISH_SUR, END_YEAR, WINTER,
} from './data.js';

const S_ = () => ctx.S, M_ = () => ctx.M, R = () => ctx.rng;

// ---------- Setup ----------
export function createGame(M, playerTag, seed = Date.now() % 1e9) {
  ctx.M = M; ctx.rng.s = seed >>> 0 || 7;
  const S = {
    version: 1, seed, year: 1, month: 2, rngS: 0, player: -1,
    provinces: [], countries: [], wars: [], armies: [], truces: {}, log: [], pending: [],
    nextArmy: 1, nextWar: 1, flags: {}, instOn: {}, ardRi: -1, era: 'iron', over: null,
  };
  ctx.S = S;
  // Provinces
  for (const p of M.provinces) {
    const P = {
      id: p.id, owner: -1, controller: -1, cores: [], claims: [], pop: 0, cattle: 0, forest: 1,
      culture: 'gaelic', religion: 'pagan', inst: Object.fromEntries(INST_IDS.map(k => [k, 0])), bld: [],
      unrest: 0, devast: 0, boost: 0, siege: null, plague: 0, immune: 0,
    };
    S.provinces.push(P);
  }
  for (const P of S.provinces) {
    P.pop = Math.round(capacity(P.id, true) * R().range(0.6, 0.8));
    P.cattle = Math.round(cattleCap(P.id) * R().range(0.6, 0.9));
  }
  // Polities grown out from capitals along easy ground
  const caps = [];
  for (const pol of POLITIES) {
    const cap = M.byKey[pol.cap]; if (cap === undefined) continue;
    const c = makeCountry({ tag: pol.tag, name: pol.name, color: pol.color, culture: 'gaelic', desc: pol.desc });
    c.capital = cap; caps.push([c.id, cap]);
  }
  const dist = new Float64Array(M.provinces.length).fill(Infinity);
  const heap = [];
  for (const [cid, pid] of caps) { dist[pid] = 0; S.provinces[pid].owner = cid; heap.push([0, pid, cid]); }
  while (heap.length) {
    heap.sort((a, b) => b[0] - a[0]);
    const [d, id, cid] = heap.pop();
    if (d > dist[id] || S.provinces[id].owner !== cid) continue;
    for (const e of M.provinces[id].adj) {
      const nd = d + TERRAIN[M.provinces[e.to].baseTerrain].move + (e.river ? 1.5 : 0) + R().next() * 0.3;
      if (nd < dist[e.to]) { dist[e.to] = nd; S.provinces[e.to].owner = cid; heap.push([nd, e.to, cid]); }
    }
  }
  for (const P of S.provinces) { P.controller = P.owner; if (P.owner >= 0) P.cores = [P.owner]; }
  for (const c of S.countries) {
    refreshCountry(c);
    c.manpower = Math.round(c.maxMP * 0.7);
    c.gold = 40;
    // starting warband
    const men = Math.max(200, Math.round(c.maxMP * 0.35 / 100) * 100);
    addArmy(c.id, c.capital, { levy: Math.round(men * 0.5), kern: Math.round(men * 0.35), horse: Math.round(men * 0.15) });
  }
  const pl = S.countries.find(c => c.tag === playerTag) || S.countries[0];
  pl.ai = false; S.player = pl.id;
  initRelations();
  log(`It is the Iron Age. You rule ${pl.name} from ${M.provinces[pl.capital].name}.`, 'era');
  return S;
}

function initRelations() {
  const S = S_();
  for (const a of S.countries) for (const b of S.countries) if (a !== b && a.rel[b.id] === undefined) a.rel[b.id] = 0;
}

export function makeCountry(o) {
  const S = S_();
  const c = {
    id: S.countries.length, tag: o.tag, name: o.name, color: o.color, culture: o.culture, desc: o.desc || '',
    religion: o.culture === 'gaelic' || o.culture === 'norse' ? 'pagan' : 'christian',
    outsider: !!o.outsider, ai: true, alive: true, capital: -1,
    adm: 50, dip: 50, mil: 50, gold: 50, manpower: 0, maxMP: 0,
    tech: { adm: 0, dip: 0, mil: 0 }, inst: Object.fromEntries(INST_IDS.map(k => [k, false])),
    stability: 1, prestige: 0, we: 0, oe: 0, backlash: 0, dispute: 0,
    laws: { succession: o.culture === 'gaelic' ? 'tanistry' : o.culture === 'norse' ? 'thing' : 'primogeniture',
            law: o.culture === 'english' ? 'common' : o.culture === 'norse' ? 'norse' : 'brehon', army: 'risingout' },
    rel: {}, allies: [], overlord: -1, subjects: [], subjSince: {}, fostered: [],
    dynasty: o.culture === 'norman' ? R().pick(NORMAN_SUR) : R().pick(GAELIC_SURNAMES),
    ruler: null, tanist: null, heir: null, cands: null,
    provs: [], pop: 0, income: 0, expense: 0, rank: 'tuath', lastAI: 0,
  };
  S.countries.push(c);
  for (const o2 of S.countries) { o2.rel[c.id] = 0; c.rel[o2.id] = 0; }
  c.ruler = genRuler(c, 20, 40);
  if (c.laws.succession === 'primogeniture') c.heir = genRuler(c, 0, 14);
  return c;
}

// ---------- Rulers ----------
function skill() { return clamp(Math.round(R().normal(2.6, 1.5)), 0, 6); }
function rulerName(c) {
  const S = S_(), r = R();
  if (c.culture === 'gaelic') {
    const [n] = r.pick(GAELIC_NAMES);
    if (S.year >= 1050) return `${n} ${c.dynasty}`;
    return `${n} mac ${r.pick(GAELIC_NAMES)[1]}`;
  }
  if (c.culture === 'norse') return `${r.pick(NORSE_NAMES)} ${r.pick(NORSE_NAMES).replace(/r$/, '')}sson`;
  if (c.culture === 'norman') return `${r.pick(NORMAN_FIRST)} ${c.dynasty}`;
  return `${S.year >= 1541 ? 'Lord Deputy' : 'Justiciar'} ${r.pick(ENGLISH_FIRST)} ${r.pick(ENGLISH_SUR)}`;
}
export function genRuler(c, minAge = 18, maxAge = 45) {
  return { name: rulerName(c), adm: skill(), dip: skill(), mil: skill(), age: minAge + R().int(maxAge - minAge + 1) };
}
export function rulerSkill(c, k) { const r = c.ruler; return r.age < 16 ? 1 : r[k]; }

function succeed(c) {
  const old = c.ruler, S = S_();
  const isPlayer = c.id === S.player;
  let text;
  if (c.laws.succession === 'tanistry') {
    if (c.tanist) { c.ruler = c.tanist; text = `${old.name} has died. The tanist ${c.ruler.name} is inaugurated.`; }
    else {
      c.ruler = genRuler(c, 22, 45); c.stability = clamp(c.stability - 2, -3, 3); c.dispute = 48;
      text = `${old.name} died with no tanist named. ${c.ruler.name} seizes the kingship amid a bitter dispute in the derbfine.`;
    }
    c.tanist = null;
  } else if (c.laws.succession === 'primogeniture') {
    c.ruler = c.heir || genRuler(c, 0, 20); c.heir = genRuler(c, 0, 6);
    text = `${old.name} has died. ${c.ruler.name} inherits${c.ruler.age < 16 ? ` at age ${c.ruler.age} — a regency council rules` : ''}.`;
  } else {
    c.ruler = genRuler(c, 25, 45); c.stability = clamp(c.stability - 1, -3, 3);
    text = `${old.name} has died. The thing elects ${c.ruler.name}.`;
  }
  c.cands = null;
  if (isPlayer) log(text, 'ruler');
  // Partible kingship: a rival branch of the derbfine may carve out its own lordship
  if (c.laws.succession === 'tanistry' && c.provs.length > 24 && R().chance(Math.min(0.8, (c.provs.length - 20) / 40))) splitRealm(c);
  else if (c.outsider || c.provs.length > 12) log(`${c.name}: ${text}`, 'world');
}
export function tanistCandidates(c) {
  if (!c.cands) c.cands = [genRuler(c, 18, 40), genRuler(c, 18, 40), genRuler(c, 18, 40)];
  return c.cands;
}
export function designateTanist(c, i) {
  if (c.dip < 25) return false;
  c.dip -= 25; c.tanist = tanistCandidates(c)[i]; c.cands = null; return true;
}

// ---------- Province economics ----------
export function terrainOf(id) {
  const p = M_().provinces[id], P = S_().provinces[id];
  return p.forestShare * P.forest > 0.4 ? 'forest' : p.baseTerrain;
}
function densityOf(id) {
  const p = M_().provinces[id], P = S_().provinces[id];
  let d = 0;
  for (let t = 2; t < 10; t++) {
    const share = p.tcount[t] / p.area; if (!share) continue;
    if (t === PT.forest) {
      d += share * P.forest * TERRAIN.forest.density + share * (1 - P.forest) * TERRAIN[p.baseTerrain].density;
    } else d += share * TERRAIN[PT_NAMES[t]].density;
  }
  return d;
}
export function capacity(id, initial = false) {
  const S = S_(), p = M_().provinces[id], P = S.provinces[id];
  let m = 1;
  if (!initial) {
    const c = S.countries[P.owner];
    if (c) m += 0.025 * c.tech.adm;
    for (const b of P.bld) m += BUILDINGS[b].cap || 0;
    if (S.flags.potato) m *= 1.7;
    m *= 1 - P.devast / 250;
  }
  if (p.coastal) m *= 1.1;
  return p.areaKm * densityOf(id) * m;
}
export function cattleCap(id) {
  const p = M_().provinces[id], P = S_().provinces[id];
  let d = 0;
  for (let t = 2; t < 10; t++) {
    const share = p.tcount[t] / p.area; if (!share) continue;
    d += share * (t === PT.forest ? (P.forest * TERRAIN.forest.cattle + (1 - P.forest) * TERRAIN[p.baseTerrain].cattle) : TERRAIN[PT_NAMES[t]].cattle);
  }
  return p.areaKm * d * (1 - P.devast / 200);
}
export function fortLevel(id) {
  let f = 0; for (const b of S_().provinces[id].bld) f += BUILDINGS[b].fort || 0;
  return Math.min(MAX_FORT, f);
}
export function provValue(id) {
  const P = S_().provinces[id];
  return 1 + P.pop / 800 + P.cattle / 1500;
}
export function provTax(id) {
  const S = S_(), P = S.provinces[id], c = S.countries[P.owner], p = M_().provinces[id];
  if (!c || P.controller !== P.owner) return 0;
  let cattleMul = 1 + 0.04 * c.tech.dip;
  let m = 1 + 0.03 * c.tech.adm + (p.coastal ? 0.04 * c.tech.dip : 0.01 * c.tech.dip) + 0.05 * c.stability;
  for (const b of P.bld) { m += BUILDINGS[b].tax || 0; cattleMul += BUILDINGS[b].cattle || 0; }
  if (c.laws.law === 'brehon') m -= 0.1;
  if (c.laws.law === 'common') m += 0.15;
  if (c.laws.law === 'norse' && p.coastal) m += 0.2;
  let base = P.pop * 0.00009 + P.cattle * 0.00006 * cattleMul;
  if (!P.cores.includes(c.id)) base *= 0.5;
  if (P.unrest > 5) base *= 0.5;
  return Math.max(0, base * m);
}
export function provManpower(id) {
  const S = S_(), P = S.provinces[id], c = S.countries[P.owner];
  if (!c || P.controller !== P.owner) return 0;
  let m = P.pop * 0.05 * (P.cores.includes(c.id) ? 1 : 0.4);
  if (c.laws.army === 'risingout') m *= 1.2;
  return m;
}
export function unrestOf(id) {
  const S = S_(), P = S.provinces[id], c = S.countries[P.owner];
  if (!c) return 0;
  let u = 0;
  if (!P.cores.includes(c.id)) u += 2;
  if (P.culture !== c.culture) u += (c.culture === 'english' && P.culture === 'gaelic') ? 3 : 1.5;
  if (P.religion !== c.religion) u += (P.religion === 'pagan' || c.religion === 'pagan') ? 2 : 3;
  u += c.oe / 20 + c.we / 3 - c.stability;
  for (const b of P.bld) u += BUILDINGS[b].unrest || 0;
  if (P.culture === 'gaelic') { if (c.laws.law === 'brehon') u -= 1; if (c.laws.law === 'common') u += 2; }
  if (c.laws.army === 'coign') u += 1;
  if (c.backlash > 0) u += 2;
  if (c.dispute > 0) u += 3;
  u += P.devast / 25 + P.boost;
  if (S.ardRi === c.id) u -= 1;
  if (!c.outsider) u += Math.max(0, c.provs.length - 30) / 25; // the limits of personal kingship
  return Math.max(0, u);
}

// ---------- Country refresh ----------
export function refreshCountry(c) {
  const S = S_();
  c.provs = []; c.pop = 0; let tax = 0, mp = 0, total = 0, nonCore = 0;
  S.provinces.forEach(P => {
    if (P.owner !== c.id) return;
    c.provs.push(P.id); c.pop += P.pop; tax += provTax(P.id); mp += provManpower(P.id);
    const v = provValue(P.id); total += v; if (!P.cores.includes(c.id)) nonCore += v;
  });
  c.oe = total ? Math.round(nonCore / total * 100) : 0;
  c.maxMP = Math.round(mp);
  let up = 0;
  for (const a of S.armies) if (a.owner === c.id) for (const t in a.troops) up += a.troops[t] / UNIT_SIZE * UNITS[t].up;
  if (c.laws.army === 'coign') up *= 0.6;
  if (c.laws.army === 'standing') up *= 1.3;
  c.tax = tax;
  let trib = 0; for (const sid of c.subjects) { const s = S.countries[sid]; if (s && s.alive) trib += (s.tax || 0) * 0.25; }
  const paid = c.overlord >= 0 ? tax * 0.25 : 0;
  c.income = tax + trib - paid;
  c.expense = up;
  const n = c.provs.length;
  if (c.outsider) c.rank = OUTSIDER_RANKS[c.culture];
  else c.rank = RANKS.filter(r => n >= r.min).pop().id;
  if (!c.provs.includes(c.capital) && c.provs.length) c.capital = c.provs.reduce((a, b) => provValue(a) > provValue(b) ? a : b);
}
export function subjectLimit(c) { return c.outsider ? 8 : (RANKS.find(r => r.id === c.rank) || RANKS[0]).subjects + (S_().ardRi === c.id ? 3 : 0); }
export function armyMen(a) { let m = 0; for (const t in a.troops) m += a.troops[t]; return m; }
export function countryArmyMen(cid) { let m = 0; for (const a of S_().armies) if (a.owner === cid) m += armyMen(a); return m; }
export function strength(cid) {
  const S = S_(), c = S.countries[cid];
  let s = 0;
  for (const a of S.armies) if (a.owner === cid) for (const t in a.troops) s += a.troops[t] * UNITS[t].atk;
  return (s + c.manpower * 0.6) * (1 + 0.06 * c.tech.mil);
}

// ---------- Armies ----------
export function addArmy(owner, loc, troops) {
  const S = S_();
  const a = { id: S.nextArmy++, owner, loc, troops: {}, maxT: {}, morale: 1, path: [], prog: 0, retreat: 0, arrived: 0, target: -1 };
  for (const t in troops) if (troops[t] > 0) { a.troops[t] = troops[t]; a.maxT[t] = troops[t]; }
  a.morale = maxMorale(a);
  S.armies.push(a);
  return a;
}
export function maxMorale(a) {
  const c = S_().countries[a.owner]; let m = 0, n = 0;
  for (const t in a.troops) { m += UNITS[t].mor * a.troops[t]; n += a.troops[t]; }
  let base = n ? m / n : 1;
  base *= 1 + 0.02 * c.tech.mil + c.prestige / 300;
  if (c.laws.army === 'standing') base *= 1.2;
  return base * 3;
}

// ---------- Actions (player & AI) ----------
export function techStatus(c, track) {
  const S = S_(), lvl = c.tech[track] + 1;
  if (lvl > MAX_TECH) return { lvl, max: true };
  const gate = TECH_GATES[track][lvl];
  const cost = techCost(lvl, S.year);
  const ahead = TECH_YEARS[lvl] - S.year;
  let block = null;
  if (gate && !c.inst[gate]) block = `Requires the ${INSTITUTIONS.find(i => i.id === gate).name} institution`;
  else if (ahead > TECH_MAX_AHEAD) block = `Too far ahead of its time (available from ${TECH_YEARS[lvl] - TECH_MAX_AHEAD} AD)`;
  return { lvl, cost, ahead, gate, block, year: TECH_YEARS[lvl] };
}
export function researchTech(c, track) {
  const st = techStatus(c, track);
  if (st.max || st.block || c[track] < st.cost) return false;
  c[track] -= st.cost; c.tech[track]++;
  if (st.ahead > 25) {
    const hit = st.ahead > 60 ? 2 : 1;
    c.stability = clamp(c.stability - hit, -3, 3); c.backlash = 60; c.prestige -= 5;
    if (c.id === S_().player) log(`The filí and the old families resent such rapid change: −${hit} stability and unrest for 5 years.`, 'warn');
  }
  return true;
}
export function instShare(c, k) {
  const S = S_(); let have = 0, tot = 0;
  for (const id of c.provs) { const P = S.provinces[id]; tot += P.pop; if (P.inst[k] >= 50) have += P.pop; }
  return tot ? have / tot : 0;
}
export function embraceCost(c, k) { return Math.round(20 + c.provs.length * 8 * (1 - instShare(c, k))); }
export function canEmbrace(c, k) { return !c.inst[k] && S_().instOn[k] && instShare(c, k) >= 0.1; }
export function embrace(c, k) {
  if (!canEmbrace(c, k)) return false;
  const cost = embraceCost(c, k); if (c.gold < cost) return false;
  c.gold -= cost; c.inst[k] = true;
  if (k === 'christianity' && c.religion === 'pagan') {
    c.religion = 'christian';
    if (c.id === S_().player) log(`${c.name} accepts the faith of Patrick.`, 'good');
  }
  return true;
}
export function coreCost(c, id) { return Math.max(5, Math.round((10 + S_().provinces[id].pop / 120) * (1 - 0.01 * c.tech.adm))); }
export function makeCore(c, id) {
  const P = S_().provinces[id]; if (P.owner !== c.id || P.cores.includes(c.id)) return false;
  const cost = coreCost(c, id); if (c.adm < cost) return false;
  c.adm -= cost; P.cores.push(c.id); return true;
}
export function stabCost(c) { return 80 + 20 * Math.max(0, c.stability); }
export function raiseStability(c) {
  const cost = stabCost(c); if (c.stability >= 3 || c.adm < cost) return false;
  c.adm -= cost; c.stability++; return true;
}
export function claimCost(c) { return Math.max(10, Math.round(30 * (1 - 0.01 * c.tech.dip))); }
export function fabricateClaim(c, id) {
  const P = S_().provinces[id];
  if (P.owner === c.id || P.claims.includes(c.id) || P.cores.includes(c.id)) return false;
  const cost = claimCost(c); if (c.dip < cost) return false;
  c.dip -= cost; P.claims.push(c.id);
  const o = S_().countries[P.owner]; if (o) o.rel[c.id] -= 15;
  return true;
}
export function bldSlots(id) { return 2 + Math.floor(S_().provinces[id].pop / 2500); }
export function canBuild(c, id, b) {
  const P = S_().provinces[id], B = BUILDINGS[b];
  if (P.owner !== c.id || P.controller !== c.id || P.bld.includes(b)) return false;
  if (P.bld.length >= bldSlots(id)) return false;
  return !!B.req(c, P);
}
export function build(c, id, b) {
  if (!canBuild(c, id, b) || c.gold < BUILDINGS[b].cost) return false;
  c.gold -= BUILDINGS[b].cost; S_().provinces[id].bld.push(b); return true;
}
export function clearCost(c, id) { return { gold: 30, adm: Math.max(10, 25 - c.tech.adm) }; }
export function canClear(c, id) {
  const p = M_().provinces[id], P = S_().provinces[id];
  return P.owner === c.id && p.forestShare * P.forest > 0.05;
}
export function clearForest(c, id) {
  const cost = clearCost(c, id); if (!canClear(c, id) || c.gold < cost.gold || c.adm < cost.adm) return false;
  c.gold -= cost.gold; c.adm -= cost.adm;
  const P = S_().provinces[id]; P.forest = Math.max(0, P.forest - 0.35); P.dirty = true; return true;
}
export function canSetLaw(c, cat, key) {
  const L = LAWS[cat][key]; return c.laws[cat] !== key && L.req(c, S_());
}
export function setLaw(c, cat, key) {
  if (!canSetLaw(c, cat, key) || c.adm < 100) return false;
  c.adm -= 100; c.laws[cat] = key; c.stability = clamp(c.stability - 1, -3, 3);
  if (key === 'primogeniture') { c.heir = c.heir || genRuler(c, 0, 14); c.tanist = null; }
  if (key === 'tanistry') c.heir = null;
  return true;
}
export function recruitOptions(c) { return Object.keys(UNITS).filter(k => UNITS[k].req(c)); }
export function unitCost(c, t) {
  let cost = UNITS[t].cost;
  if (t === 'levy' && c.laws.army === 'risingout') cost *= 0.7;
  return Math.round(cost);
}
export function canRecruitAt(c, id) {
  const P = S_().provinces[id]; return P.owner === c.id && P.controller === c.id;
}
export function recruit(c, id, t, n = 1) {
  if (!canRecruitAt(c, id) || !UNITS[t].req(c)) return false;
  const cost = unitCost(c, t) * n, men = UNIT_SIZE * n;
  if (c.gold < cost || c.manpower < men) return false;
  c.gold -= cost; c.manpower -= men;
  const S = S_();
  let a = S.armies.find(x => x.owner === c.id && x.loc === id && !x.path.length && !x.retreat);
  if (a) { a.troops[t] = (a.troops[t] || 0) + men; a.maxT[t] = (a.maxT[t] || 0) + men; }
  else a = addArmy(c.id, id, { [t]: men });
  return a;
}

// ---------- Monthly tick ----------
import { warTick, cleanupCountry, declareWar, isAtWar } from './war.js';
import { aiTick } from './ai.js';
import { eventsTick } from './events.js';

export function tick() {
  const S = S_(), M = M_();
  if (S.over) return;
  S.month++;
  if (S.month > 11) { S.month = 0; S.year++; yearly(); }
  history();
  plagueSpread();
  provincesTick();
  for (const c of S.countries) if (c.alive) countryTick(c);
  warTick();
  revolts();
  aiTick();
  eventsTick();
  for (const c of S.countries) if (c.alive) { refreshCountry(c); if (!c.provs.length) killCountry(c); }
  checkEnd();
  S.rngS = ctx.rng.s;
}

function provincesTick() {
  const S = S_(), M = M_();
  const instKeys = INST_IDS.filter(k => S.instOn[k]);
  const winter = WINTER.has(S.month);
  for (const P of S.provinces) {
    const p = M.provinces[P.id];
    // population (logistic)
    const K = capacity(P.id);
    const r = P.pop < K ? 0.0065 : 0.012;
    P.pop += P.pop * r / 12 * (1 - P.pop / K);
    if (P.plague > 0) { P.pop *= p.coastal || P.bld.includes('market') ? 0.955 : 0.975; P.plague--; }
    P.pop = Math.max(50, P.pop);
    // cattle
    const Kc = cattleCap(P.id);
    P.cattle += P.cattle * 0.06 / 12 * (1 - P.cattle / Kc);
    P.cattle = Math.max(20, P.cattle);
    // slow clearing from population pressure
    if (P.forest > 0 && P.pop > K * 0.95 && R().chance(0.004)) { P.forest = Math.max(0, P.forest - 0.1); P.dirty = true; }
    P.devast = Math.max(0, P.devast - (winter ? 0.3 : 0.8));
    P.boost = Math.max(0, P.boost - 0.05);
    // institutions spread
    for (const k of instKeys) {
      if (P.inst[k] >= 100) continue;
      const def = INSTITUTIONS.find(i => i.id === k);
      if (def.needs && P.inst[def.needs] < 50) continue;
      let g = 0;
      for (const e of p.adj) if (S.provinces[e.to].inst[k] >= 50) g++;
      g = g / p.adj.length * 2.4;
      const o = S.countries[P.owner];
      if (o && o.inst[k]) g += 0.3;
      if ((k === 'norse_trade' || k === 'gunpowder' || k === 'printing') && (p.coastal || P.bld.includes('market'))) g += 0.25;
      if (k === 'learning' && P.bld.includes('monastery')) g += 0.6;
      P.inst[k] = Math.min(100, P.inst[k] + g);
      if (k === 'christianity' && P.inst[k] >= 100 && P.religion === 'pagan') P.religion = 'christian';
    }
    // culture drift
    const o = S.countries[P.owner];
    if (o && P.culture !== o.culture) {
      let ch = 0.0015;
      if (o.culture === 'english' && P.culture === 'gaelic') ch = 0.0004;
      if (o.culture === 'gaelic' && P.culture !== 'gaelic') ch = 0.003; // Gaelicisation
      if (R().chance(ch)) P.culture = o.culture;
    }
    if (o && o.religion === 'protestant' && P.religion !== 'protestant' && R().chance(0.0003)) P.religion = 'protestant';
    P.unrest = unrestOf(P.id);
  }
}

function countryTick(c) {
  const S = S_();
  // points
  const ard = S.ardRi === c.id ? 1 : 0;
  c.adm = Math.min(999, c.adm + 3 + rulerSkill(c, 'adm'));
  c.dip = Math.min(999, c.dip + 3 + rulerSkill(c, 'dip') + ard);
  c.mil = Math.min(999, c.mil + 3 + rulerSkill(c, 'mil'));
  // money and men
  c.gold += c.income - c.expense;
  if (c.gold < 0) {
    // unpaid troops desert
    c.gold = 0; c.stability = clamp(c.stability - (R().chance(0.15) ? 1 : 0), -3, 3);
    for (const a of S.armies) if (a.owner === c.id) for (const t in a.troops) a.troops[t] *= 0.97;
  }
  c.manpower = Math.min(c.maxMP, c.manpower + c.maxMP / 120);
  // Féile: a king is judged by his generosity. Hoards beyond ~3 years' income are given away as feasts and gifts.
  const hoard = 60 + Math.max(0, c.income) * 36;
  if (c.gold > hoard) { const g = (c.gold - hoard) * 0.03; c.gold -= g; c.prestige = Math.min(100, c.prestige + g / 40); }
  // drift
  c.prestige = clamp(c.prestige * 0.99 + (ard ? 0.2 : 0), -100, 100);
  for (const id of c.provs) for (const b of S.provinces[id].bld) c.prestige += BUILDINGS[b].prestige || 0;
  const atWar = S.wars.some(w => w.att.includes(c.id) || w.def.includes(c.id));
  c.we = Math.max(0, c.we - (atWar ? 0.02 : 0.15));
  if (c.backlash > 0) c.backlash--;
  if (c.dispute > 0) c.dispute--;
  if (c.stability < 1 && R().chance(c.laws.law === 'brehon' ? 0.012 : 0.006)) c.stability++;
  // relations drift toward baseline
  for (const k in c.rel) {
    const o = S.countries[k]; if (!o || !o.alive) continue;
    let base = c.fostered.includes(+k) ? 30 : 0;
    if (c.culture === o.culture) base += 5;
    if (c.allies.includes(+k)) base += 25;
    const v = c.rel[k]; c.rel[k] = v + clamp(base - v, -1, 1);
  }
  // ruler aging
  const r = c.ruler; r.age += 1 / 12;
  if (c.heir) c.heir.age += 1 / 12;
  if (c.tanist) { c.tanist.age += 1 / 12; if (R().chance(deathChance(c.tanist.age))) { c.tanist = null; if (c.id === S.player) log('Your tanist has died. Name another before the king dies.', 'warn'); } }
  if (R().chance(deathChance(r.age))) succeed(c);
}
function deathChance(age) { return age < 16 ? 0.0006 : age < 40 ? 0.0009 : age < 55 ? 0.0022 : age < 65 ? 0.005 : age < 75 ? 0.012 : 0.03; }

function revolts() {
  const S = S_();
  for (const P of S.provinces) {
    if (P.owner < 0 || P.unrest <= 5 || P.controller !== P.owner) continue;
    if (!R().chance((P.unrest - 5) * 0.004)) continue;
    revolt(P.id);
  }
}
export function revolt(id) {
  const S = S_(), M = M_(), P = S.provinces[id], old = S.countries[P.owner];
  if (old.provs.length <= 1) return;
  // a former owner with a core on it rises again, or a new lordship forms
  let to = P.cores.map(k => S.countries[k]).find(k => k && k.id !== old.id && !isAtWar(k.id, old.id) && k.overlord < 0);
  let fresh = false;
  if (!to) {
    if (old.culture !== 'gaelic' && P.culture === 'gaelic') {
      to = makeCountry({ tag: 'R' + S.countries.length, name: lordshipName(M.provinces[id].name), color: randomColor(), culture: 'gaelic' });
      fresh = true;
    } else return; // no one to rise for
  }
  if (!to.alive) { to.alive = true; to.ruler = genRuler(to, 20, 40); to.stability = 0; to.gold = 30; fresh = true; }
  const group = [id];
  for (const e of M.provinces[id].adj) {
    const Q = S.provinces[e.to];
    if (group.length < 4 && Q.owner === old.id && Q.unrest > 3 && Q.controller === Q.owner && e.to !== old.capital) group.push(e.to);
  }
  for (const g of group) transferProvince(g, to.id);
  if (fresh) {
    to.capital = id; refreshCountry(to);
    to.manpower = Math.max(300, to.maxMP);
    to.tech = { ...old.tech }; to.tech.adm = Math.max(0, to.tech.adm - 1);
    for (const k in old.inst) to.inst[k] = old.inst[k] && to.culture === old.culture;
    if (to.culture === 'gaelic') { to.inst.christianity = old.inst.christianity; to.religion = to.inst.christianity ? 'christian' : 'pagan'; }
    const men = Math.max(300, Math.round(to.manpower * 0.6 / 100) * 100);
    addArmy(to.id, id, to.culture === 'gaelic' ? { kern: men * 0.6, levy: men * 0.4 } : { levy: men });
    to.manpower -= men;
  }
  old.rel[to.id] = -100; to.rel[old.id] = -100;
  declareWar(old.id, to.id, 'rebellion', null, true);
  const msg = `Revolt! ${M.provinces[id].name} rises against ${old.name} and joins ${to.name}.`;
  log(msg, old.id === S.player || to.id === S.player ? 'bad' : 'world', { prov: id });
}
export function splitRealm(c) {
  const S = S_(), M = M_();
  // seed: owned province farthest (in hops) from the capital
  const hop = new Map([[c.capital, 0]]), q = [c.capital];
  while (q.length) { const u = q.shift(); for (const e of M.provinces[u].adj) if (!hop.has(e.to) && S.provinces[e.to].owner === c.id) { hop.set(e.to, hop.get(u) + 1); q.push(e.to); } }
  let seed = -1, far = -1; for (const [id, d] of hop) if (d > far) { far = d; seed = id; }
  if (seed < 0 || far < 3) return;
  const want = Math.floor(c.provs.length / 4), group = [seed], seen = new Set([seed]);
  for (let i = 0; i < group.length && group.length < want; i++) for (const e of M.provinces[group[i]].adj) {
    if (group.length >= want) break;
    if (!seen.has(e.to) && S.provinces[e.to].owner === c.id && e.to !== c.capital) { seen.add(e.to); group.push(e.to); }
  }
  const [, gen] = R().pick(GAELIC_NAMES);
  const n = makeCountry({ tag: 'K' + S.countries.length, name: `Clann ${gen}`, color: randomColor(), culture: c.culture });
  n.dynasty = R().pick(GAELIC_SURNAMES);
  for (const id of group) { transferProvince(id, n.id); const P = S.provinces[id]; if (!P.cores.includes(n.id)) P.cores.push(n.id); }
  for (const a of S.armies) if (a.owner === c.id && group.includes(a.loc)) a.owner = n.id;
  n.capital = seed; n.tech = { ...c.tech }; n.inst = { ...c.inst }; n.religion = c.religion; n.laws = { ...c.laws };
  n.gold = 30; refreshCountry(n); n.manpower = n.maxMP * 0.5;
  n.rel[c.id] = -60; c.rel[n.id] = -60;
  const pl = S_().player;
  log(`A rival branch of the derbfine breaks away from ${c.name}: ${n.name} takes ${group.length} territories around ${M.provinces[seed].name}.`, c.id === pl ? 'bad' : 'world', { prov: seed });
}
function lordshipName(pn) { return 'Lordship of ' + pn.replace(/\s*\(.*\)/, '').split(' ').slice(0, 2).join(' '); }
export function randomColor() {
  const h = R().int(360), s = 35 + R().int(30), l = 38 + R().int(22);
  return `hsl(${h} ${s}% ${l}%)`;
}
export function transferProvince(id, to) {
  const S = S_(), P = S.provinces[id];
  P.owner = to; P.controller = to; P.siege = null; P.dirty = true;
  P.claims = P.claims.filter(k => k !== to);
}
export function killCountry(c) {
  const S = S_();
  c.alive = false;
  S.armies = S.armies.filter(a => a.owner !== c.id);
  cleanupCountry(c);
  if (c.id === S.player) {
    S.over = { kind: 'defeat', text: `${c.name} has been destroyed.` };
  } else log(`${c.name} is no more.`, 'world');
}

function yearly() {
  const S = S_(), M = M_();
  const e = eraOf(S.year);
  if (e.id !== S.era) {
    S.era = e.id;
    log(`A new era begins: ${e.name}. ${e.desc}`, 'era');
    S.pending.push({ kind: 'era', era: e.id });
  }
  // harvest
  if (R().chance(0.06)) {
    const center = R().int(M.provinces.length), cp = M.provinces[center];
    let n = 0;
    for (const p of M.provinces) {
      if (Math.hypot(p.x - cp.x, p.y - cp.y) < 120) { const P = S.provinces[p.id]; P.pop *= 0.93; n++; if (P.owner === S.player) P.boost += 2; }
    }
    log(`Failed harvest and famine around ${cp.name}.`, S.provinces[center].owner === S.player ? 'bad' : 'world', { prov: center });
  }
  // outsider support from overseas
  for (const c of S.countries) if (c.alive && c.outsider) {
    const [g, m] = OUTSIDER_SUPPORT[c.culture] || [0, 0];
    const eraMul = 1 + Math.max(0, S.year - 1169) / 150 + (S.year >= 1534 ? 2 : 0);
    c.gold += g * eraMul; c.manpower += m * eraMul;
  }
  // Ard Rí
  updateArdRi();
  // plantations
  if (S.year >= 1556) for (const P of S.provinces) {
    const o = S.countries[P.owner];
    if (o && o.culture === 'english' && P.culture === 'gaelic' && R().chance(0.025)) {
      P.culture = 'english'; P.religion = o.religion; P.pop *= 0.9; P.boost += 3;
      if (P.cores.length > 1 && R().chance(0.3)) log(`Plantation of ${M.provinces[P.id].name}: settlers take the land.`, 'world', { prov: P.id });
    }
  }
  // Gaelicisation of the Normans
  const nor = S.countries.find(c => c.tag === 'NOR');
  if (nor && nor.alive && nor.culture === 'norman' && S.year > 1340 && R().chance(0.03)) {
    nor.culture = 'gaelic'; nor.laws.law = 'brehon';
    log(`${nor.name} have become "more Irish than the Irish themselves" — they adopt Gaelic speech, law and dress.`, 'world');
  }
}

function updateArdRi() {
  const S = S_(), M = M_();
  const tara = M.byKey.tara; if (tara === undefined) return;
  const holder = S.provinces[tara].owner;
  let cand = -1, best = 0;
  for (const c of S.countries) {
    if (!c.alive || c.culture !== 'gaelic' || c.overlord >= 0) continue;
    const holdsTara = holder === c.id || c.subjects.includes(holder);
    if (!holdsTara) continue;
    const n = c.provs.length + c.subjects.reduce((a, s) => a + S.countries[s].provs.length, 0);
    if ((c.rank === 'coiced' || c.subjects.length >= 3 || n >= 22) && n > best) { best = n; cand = c.id; }
  }
  if (cand !== S.ardRi) {
    const prev = S.ardRi;
    S.ardRi = cand;
    if (cand >= 0) {
      const c = S.countries[cand]; c.prestige = Math.min(100, c.prestige + 25);
      log(`${c.ruler.name} of ${c.name} is proclaimed Ard Rí — High King of Ireland — at Tara.`, cand === S.player ? 'good' : 'era');
    } else if (prev >= 0) log('There is no High King in Ireland.', 'world');
  }
}

// ---------- Scripted history ----------
function history() {
  const S = S_(), M = M_(), y = S.year;
  const once = (k, f) => { if (!S.flags[k]) { S.flags[k] = true; f(); } };
  // institutions
  for (const inst of INSTITUTIONS) {
    if (S.instOn[inst.id] || y < inst.year) continue;
    let origin = M.byKey[inst.origin];
    if (inst.id === 'norse_trade') {
      const n = S.countries.find(c => c.alive && c.culture === 'norse');
      if (n) origin = n.capital; else if (y < 1050) continue;
    }
    if (inst.id === 'feudalism') {
      const n = S.countries.find(c => c.alive && (c.culture === 'norman' || c.culture === 'english'));
      if (n) origin = n.capital; else if (y < 1300) continue;
    }
    S.instOn[inst.id] = true;
    S.provinces[origin].inst[inst.id] = 100;
    if (inst.id === 'christianity') S.provinces[origin].religion = 'christian';
    for (const c of S.countries) if (c.alive && (c.culture === 'english' || (c.culture === 'norman' && inst.id !== 'printing'))) c.inst[inst.id] = true;
    log(`${inst.name} has appeared in ${M.provinces[origin].name}. ${inst.desc}`, 'era', { prov: origin });
  }
  // plagues
  if (y === 544 && S.month === 4) once('blefed', () => startPlague('Blefed (Plague of Justinian)', 'dublin'));
  if (y === 664 && S.month === 4) once('buide', () => startPlague('Buide Connaill (Yellow Plague)', 'wexford'));
  if (y === 1348 && S.month === 7) once('blackdeath', () => startPlague('The Black Death', 'drogheda'));
  if (y === 1650) once('potato', () => { S.flags.potato = true; log('The potato spreads through Ireland. Land can feed far more people.', 'era'); });
  if (y === 1740 && S.month === 0) once('aircold', () => {
    for (const P of S.provinces) P.pop *= 0.88;
    log('Bliain an Áir — the Year of Slaughter. Frost and famine kill one in eight.', 'bad');
  });
  if (y === 1536 && S.month === 0) once('reform', () => {
    const e = S.countries.find(c => c.tag === 'ENG');
    if (e && e.alive) { e.religion = 'protestant'; log('The Crown breaks with Rome. The Lordship becomes Protestant.', 'era'); }
  });
  if (y === 1541 && S.month === 5) once('kingdom', () => {
    const e = S.countries.find(c => c.tag === 'ENG');
    if (e && e.alive) { e.name = 'Kingdom of Ireland (English Crown)'; log('Henry VIII is declared King of Ireland. "Surrender and Regrant" is offered to Gaelic lords.', 'era'); }
  });
  // Viking raids
  if (y >= 795 && y < 1050 && R().chance(y < 850 ? 0.04 : 0.02)) vikingRaid();
  // outsider waves
  for (let i = 0; i < WAVES.length; i++) {
    const w = WAVES[i];
    if (y === w.year && S.month === 4) once('wave' + i, () => spawnWave(w));
  }
}
function startPlague(name, key) {
  const S = S_(), M = M_();
  const id = M.byKey[key];
  S.provinces[id].plague = 6;
  S.plagueName = name; S.plagueUntil = S.year + 4;
  log(`${name} arrives at ${M.provinces[id].name}!`, 'bad', { prov: id });
}
export function plagueSpread() {
  const S = S_(), M = M_();
  if (!S.plagueUntil || S.year > S.plagueUntil) return;
  const next = [];
  for (const P of S.provinces) if (P.plague > 0) for (const e of M.provinces[P.id].adj) {
    const Q = S.provinces[e.to]; if (Q.plague > 0 || Q.immune >= S.year) continue;
    if (R().chance(0.18)) next.push(Q);
  }
  for (const Q of next) { Q.plague = 6; Q.immune = S.year + 30; }
}
function vikingRaid() {
  const S = S_(), M = M_();
  const coastal = M.provinces.filter(p => p.coastal && S.provinces[p.id].owner >= 0 && S.countries[S.provinces[p.id].owner].culture !== 'norse');
  if (!coastal.length) return;
  const rich = coastal.filter(p => S.provinces[p.id].bld.some(b => b === 'monastery' || b === 'church') || p.special === 'church');
  const p = R().chance(0.7) && rich.length ? R().pick(rich) : R().pick(coastal);
  const P = S.provinces[p.id], o = S.countries[P.owner];
  P.pop *= 0.95; P.cattle *= 0.7; P.devast = Math.min(100, P.devast + 25);
  const loot = Math.min(o.gold * 0.15, 40); o.gold -= loot;
  log(`Viking raiders sack ${p.name}${loot > 1 ? `, carrying off ${Math.round(loot)} in treasure` : ''}.`, o.id === S.player ? 'bad' : 'world', { prov: p.id });
}
function spawnWave(w) {
  const S = S_(), M = M_();
  let c = S.countries.find(x => x.tag === w.tag);
  if (w.onlyIfDead && c && c.alive) return;
  const def = OUTSIDERS[w.tag];
  let landing = -1;
  const keys = w.landing.map(k => M.byKey[k]).filter(v => v !== undefined);
  if (c && c.alive) landing = keys.find(id => S.provinces[id].owner === c.id) ?? c.capital;
  if (landing < 0) landing = keys[0];
  if (landing === undefined || landing < 0) return;
  const fresh = !c || !c.alive;
  if (!c) c = makeCountry({ tag: w.tag, name: def.name, color: def.color, culture: def.culture, outsider: true });
  if (fresh) {
    c.alive = true; c.outsider = true; c.ruler = genRuler(c, 25, 40); c.stability = 1; c.capital = landing;
    let onTime = 0; while (onTime < MAX_TECH && TECH_YEARS[onTime + 1] <= S.year) onTime++;
    c.tech = { adm: onTime, dip: onTime, mil: onTime };
    for (const k of INST_IDS) if (S.instOn[k] && (def.culture !== 'norse' || k === 'norse_trade')) c.inst[k] = true;
    if (def.culture === 'norse') c.inst.norse_trade = true;
    c.religion = def.culture === 'norse' ? 'pagan' : (def.culture === 'english' && S.year >= 1536 ? 'protestant' : 'christian');
  }
  c.gold += 150 + Math.max(0, S.year - 1100) / 2;
  const P = S.provinces[landing];
  const prev = P.owner;
  if (prev !== c.id) {
    transferProvince(landing, c.id);
    P.cores.push(c.id);
    if (prev >= 0 && S.countries[prev].alive) {
      const victim = S.countries[prev];
      const victimTop = victim.overlord >= 0 && victim.overlord !== c.id ? victim.overlord : prev;
      if (victimTop !== c.id && !isAtWar(c.id, victimTop) && S.countries[victimTop].alive) declareWar(c.id, victimTop, 'invasion', landing, true);
    }
  }
  // a landing army always comes to fight someone
  if (!S.wars.some(x => x.att.includes(c.id) || x.def.includes(c.id))) {
    const near = new Set();
    for (const id of c.provs.length ? c.provs : [landing]) for (const e of M.provinces[id].adj) {
      const o = S.provinces[e.to].owner; if (o >= 0 && o !== c.id) { const top = S.countries[o].overlord >= 0 ? S.countries[o].overlord : o; if (top !== c.id && !c.subjects.includes(o)) near.add(top); }
    }
    const list = [...near].filter(x => S.countries[x].alive && !c.allies.includes(x));
    if (list.length) declareWar(c.id, list.reduce((a, b) => S.countries[a].provs.length >= S.countries[b].provs.length ? a : b), 'invasion', null, true);
  }
  const troops = {};
  for (const t in w.troops) troops[t] = w.troops[t];
  const army = addArmy(c.id, landing, troops);
  army.elite = def.culture === 'norse' ? 1.3 : 1.5;
  c.manpower += Object.values(troops).reduce((a, b) => a + b, 0) * 0.3;
  if (w.tag === 'ENG') {
    const nor = S.countries.find(x => x.tag === 'NOR');
    if (nor && nor.alive && nor.overlord < 0 && !isAtWar(nor.id, c.id) && nor.culture === 'norman') {
      nor.overlord = c.id; c.subjects.push(nor.id); c.subjSince[nor.id] = S.year;
      log(`${nor.name} submit to the Crown and hold their lands as its vassals.`, 'world');
    }
  }
  refreshCountry(c);
  log(w.msg, 'era', { prov: landing });
  S.pending.push({ kind: 'wave', text: w.msg, prov: landing });
}

function checkEnd() {
  const S = S_();
  const pl = S.countries[S.player];
  if (S.year >= END_YEAR && !S.over) {
    S.over = { kind: 'end', text: `The Act of Union, 1801. ${pl.name} ${pl.alive ? `endures with ${pl.provs.length} territories.` : 'is long gone.'}` };
    return;
  }
  if (pl.alive && !S.over) {
    const realm = new Set([pl.id, ...pl.subjects]);
    if (!S.flags.won && S.provinces.every(P => realm.has(P.owner))) S.over = { kind: 'victory', text: `${pl.name} rules all of Ireland! ${pl.ruler.name} is Ard Rí na hÉireann in fact as well as name.` };
  }
}

export { dateStr };
