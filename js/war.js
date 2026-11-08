// Armies, movement, battles, sieges, war score, peace and diplomacy.
import { ctx, log, clamp } from './ctx.js';
import { TERRAIN, UNITS, UNIT_SIZE, WINTER, eraOf } from './data.js';
import {
  terrainOf, fortLevel, provValue, armyMen, maxMorale, strength, transferProvince, refreshCountry, subjectLimit, addArmy,
} from './game.js';

const S_ = () => ctx.S, M_ = () => ctx.M, R = () => ctx.rng;
const name = id => S_().countries[id].name;
const pname = id => M_().provinces[id].name;

// ---------- Relations helpers ----------
export function isAtWar(a, b) {
  for (const w of S_().wars) if ((w.att.includes(a) && w.def.includes(b)) || (w.def.includes(a) && w.att.includes(b))) return true;
  return false;
}
export function warBetween(a, b) {
  return S_().wars.find(w => (w.att.includes(a) && w.def.includes(b)) || (w.def.includes(a) && w.att.includes(b)));
}
export function warsOf(c) { return S_().wars.filter(w => w.att.includes(c) || w.def.includes(c)); }
export function sideOf(w, c) { return w.att.includes(c) ? 'att' : w.def.includes(c) ? 'def' : null; }
export function friendly(a, b) {
  if (a === b) return true;
  const S = S_(), A = S.countries[a], B = S.countries[b];
  if (!A || !B) return false;
  return A.allies.includes(b) || A.subjects.includes(b) || A.overlord === b || (A.overlord >= 0 && A.overlord === B.overlord);
}
export function canPass(cid, pid) {
  const o = S_().provinces[pid].owner;
  return o < 0 || friendly(cid, o) || isAtWar(cid, o);
}
function truceKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
export function truceUntil(a, b) { return S_().truces[truceKey(a, b)] || 0; }
export function bordering(a, b) {
  const S = S_(), M = M_();
  for (const P of S.provinces) if (P.owner === a) for (const e of M.provinces[P.id].adj) if (S.provinces[e.to].owner === b) return true;
  return false;
}
export function neighbours(cid) {
  const S = S_(), M = M_(), set = new Set();
  for (const P of S.provinces) if (P.owner === cid) for (const e of M.provinces[P.id].adj) {
    const o = S.provinces[e.to].owner; if (o >= 0 && o !== cid) set.add(o);
  }
  return [...set];
}

// ---------- Pathfinding ----------
export function findPath(cid, from, to) {
  const M = M_(), S = S_(), n = M.provinces.length;
  if (from === to) return [];
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  dist[from] = 0;
  for (;;) {
    let u = -1, bd = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === to) break;
    done[u] = 1;
    for (const e of M.provinces[u].adj) {
      if (e.to !== to && !canPass(cid, e.to)) continue;
      const c = TERRAIN[terrainOf(e.to)].move + (e.river ? 0.6 : 0) + (e.sea ? 3 : 0);
      if (bd + c < dist[e.to]) { dist[e.to] = bd + c; prev[e.to] = u; }
    }
  }
  if (!isFinite(dist[to])) return null;
  const path = []; for (let v = to; v !== from; v = prev[v]) path.unshift(v);
  return path;
}
export function orderMove(a, to) {
  const p = findPath(a.owner, a.loc, to);
  if (!p) return false;
  a.path = p; a.target = to; return true;
}
function riverBetween(a, b) {
  const e = M_().provinces[a].adj.find(x => x.to === b); return !!(e && e.river);
}

// ---------- War declaration ----------
export function casusBelli(att, def) {
  const S = S_(), A = S.countries[att], D = S.countries[def];
  const cbs = [];
  if (A.overlord === def) { cbs.push('independence'); return cbs; }
  if (S.provinces.some(P => P.owner === def && (P.claims.includes(att) || P.cores.includes(att)))) cbs.push('claim');
  if (A.outsider || S.year >= 1169 || S.ardRi === att) cbs.push('conquest');
  if ((A.hostCB || {})[def] >= S.year) cbs.push('hostages');
  if (bordering(att, def)) cbs.push('tain');
  return cbs;
}
export const CB_INFO = {
  tain: { name: 'Táin Bó (Cattle Raid)', desc: 'A limited raid for cattle and treasure. No land can be taken.' },
  claim: { name: 'Press Claims', desc: 'Take provinces you hold a claim or core on.' },
  conquest: { name: 'Conquest', desc: 'Take any occupied territory.' },
  hostages: { name: 'Demand Hostages', desc: 'They refused to give hostages. Force them into clientship.' },
  independence: { name: 'Independence', desc: 'Throw off the overlord.' },
  nocb: { name: 'No Casus Belli', desc: 'Unjustified war: −2 stability, −10 prestige.' },
  rebellion: { name: 'Rebellion', desc: 'A rising against an overlord.' },
  invasion: { name: 'Invasion', desc: 'Foreign landing.' },
};
export function canDeclare(att, def) {
  const S = S_(), A = S.countries[att], D = S.countries[def];
  if (att === def || !D || !D.alive) return { ok: false, reason: 'Invalid target' };
  if (isAtWar(att, def)) return { ok: false, reason: 'Already at war' };
  if (A.overlord >= 0 && A.overlord !== def) return { ok: false, reason: 'Subjects cannot declare war' };
  if (A.subjects.includes(def)) return { ok: false, reason: 'They are your subject' };
  if (A.allies.includes(def)) return { ok: false, reason: 'Break the alliance first' };
  if (truceUntil(att, def) > S.year) return { ok: false, reason: `Truce until ${truceUntil(att, def)}` };
  if (D.overlord >= 0 && D.overlord !== att) return { ok: false, reason: `Subject of ${name(D.overlord)} — attack the overlord` };
  return { ok: true, cbs: casusBelli(att, def) };
}
export function declareWar(att, def, cb, target = null, system = false) {
  const S = S_(), A = S.countries[att], D = S.countries[def];
  if (!system && !canDeclare(att, def).ok) return null;
  const war = { id: S.nextWar++, att: [att], def: [def], al: att, dl: def, cb, target, score: 0, battle: 0, months: 0,
    name: `${A.name} vs ${D.name}`, start: S.year };
  S.wars.push(war);
  if (cb === 'nocb') { A.stability = clamp(A.stability - 2, -3, 3); A.prestige -= 10; }
  D.rel[att] = Math.min(D.rel[att], -100);
  const join = (side, cid) => { if (!war.att.includes(cid) && !war.def.includes(cid)) war[side].push(cid); };
  if (cb !== 'independence' && cb !== 'rebellion') {
    for (const s of D.subjects) join('def', s);
    for (const al of D.allies) {
      const X = S.countries[al]; if (!X.alive || isAtWar(al, att) || friendly(al, att)) continue;
      if (X.rel[def] > -20 && R().chance(0.85)) { join('def', al); if (al === S.player || def === S.player) log(`${X.name} honours the alliance with ${D.name}.`, 'info'); }
    }
    for (const s of A.subjects) join('att', s);
    for (const al of A.allies) {
      const X = S.countries[al]; if (!X.alive || war.def.includes(al) || friendly(al, def)) continue;
      if (X.rel[att] > 30 && R().chance(0.6)) join('att', al);
    }
  }
  const involved = war.att.includes(S.player) || war.def.includes(S.player);
  if (!system || involved) log(`War! ${A.name} declares a ${CB_INFO[cb]?.name || cb} on ${D.name}.`, involved ? 'war' : 'world');
  return war;
}

// ---------- Monthly military tick ----------
export function warTick() {
  const S = S_();
  S.turn = S.year * 12 + S.month;
  movement();
  battles();
  sieges();
  upkeepArmies();
  for (const w of [...S.wars]) updateWar(w);
}

function movement() {
  const S = S_(), winter = WINTER.has(S.month);
  for (const a of S.armies) {
    if (a.retreat > 0) a.retreat--;
    if (!a.path.length) { a.prog = 0; continue; }
    if (!canPass(a.owner, a.path[0]) && a.path[0] !== a.target) {
      const p = findPath(a.owner, a.loc, a.target); if (!p) { a.path = []; continue; } a.path = p;
    }
    if (!a.path.length) continue;
    const next = a.path[0];
    a.prog += 2.4 / (TERRAIN[terrainOf(next)].move * (riverBetween(a.loc, next) ? 1.5 : 1)) * (winter ? 0.75 : 1);
    while (a.prog >= 1 && a.path.length) {
      a.prog -= 1; a.from = a.loc; a.loc = a.path.shift(); a.arrived = S.turn;
      if (S.armies.some(b => b.loc === a.loc && b.retreat === 0 && isAtWar(a.owner, b.owner))) { a.path = []; a.prog = 0; break; }
    }
  }
}

function battles() {
  const S = S_();
  const byLoc = new Map();
  for (const a of S.armies) { if (!byLoc.has(a.loc)) byLoc.set(a.loc, []); byLoc.get(a.loc).push(a); }
  for (const [loc, list] of byLoc) {
    if (list.length < 2) continue;
    const active = list.filter(a => a.retreat === 0 && armyMen(a) > 0);
    let A = null, B = null;
    outer: for (const x of active) for (const y of active) if (isAtWar(x.owner, y.owner)) { A = x; B = y; break outer; }
    if (!A) continue;
    const sideA = active.filter(x => !isAtWar(x.owner, A.owner) && isAtWar(x.owner, B.owner));
    const sideB = active.filter(x => !isAtWar(x.owner, B.owner) && isAtWar(x.owner, A.owner));
    resolveBattle(sideA, sideB, loc);
  }
  S.armies = S.armies.filter(a => armyMen(a) >= 10);
}

function sidePower(side, terr, isDef, river) {
  const S = S_(); let p = 0;
  for (const a of side) {
    const c = S.countries[a.owner], mm = maxMorale(a);
    const tech = (1 + 0.06 * c.tech.mil) * (a.elite || 1);
    const mf = 0.4 + 0.6 * clamp(a.morale / mm, 0, 1);
    for (const t in a.troops) {
      const U = UNITS[t]; const cls = U.cls === 'cav' ? terr.cav : U.cls === 'light' ? terr.light : 1;
      p += a.troops[t] * U.atk * cls * tech * mf;
    }
  }
  return p;
}
function applyLosses(side, dmg, mdmg) {
  const total = side.reduce((s, a) => s + armyMen(a), 0); if (!total) return 0;
  let avgDef = 0; for (const a of side) for (const t in a.troops) avgDef += a.troops[t] * UNITS[t].def; avgDef /= total;
  let lost = 0;
  for (const a of side) {
    for (const t in a.troops) {
      const l = Math.min(a.troops[t], dmg * (a.troops[t] / total) * avgDef / UNITS[t].def);
      a.troops[t] -= l; lost += l;
    }
    a.morale = Math.max(0, a.morale - mdmg);
  }
  return lost;
}
function resolveBattle(sideA, sideB, loc) {
  const S = S_(), P = S.provinces[loc];
  // Defender: whoever was there first (or holds the ground)
  const firstA = Math.min(...sideA.map(a => a.arrived)), firstB = Math.min(...sideB.map(a => a.arrived));
  let def = sideA, att = sideB;
  if (firstB < firstA || (firstA === firstB && sideB.some(a => a.owner === P.controller))) { def = sideB; att = sideA; }
  const terr = TERRAIN[terrainOf(loc)];
  const river = att.some(a => a.from !== undefined && riverBetween(a.from, loc));
  const start = { att: att.reduce((s, a) => s + armyMen(a), 0), def: def.reduce((s, a) => s + armyMen(a), 0) };
  const lost = { att: 0, def: 0 };
  let winner = null;
  for (let round = 0; round < 15; round++) {
    const pa = sidePower(att, terr, false, river), pd = sidePower(def, terr, true, river);
    const da = Math.max(1, 1 + R().int(6) - (river ? 1 : 0)), dd = Math.max(1, 1 + R().int(6) + terr.def);
    const dmgToDef = pa * da * 0.006, dmgToAtt = pd * dd * 0.006;
    const menA = att.reduce((s, a) => s + armyMen(a), 0) || 1, menD = def.reduce((s, a) => s + armyMen(a), 0) || 1;
    lost.def += applyLosses(def, dmgToDef, dmgToDef / menD * 12);
    lost.att += applyLosses(att, dmgToAtt, dmgToAtt / menA * 12);
    const brokeA = att.every(a => a.morale <= 0.05 || armyMen(a) < 10), brokeD = def.every(a => a.morale <= 0.05 || armyMen(a) < 10);
    if (brokeA || brokeD) { winner = brokeA && brokeD ? (lost.att > lost.def ? 'def' : 'att') : brokeA ? 'def' : 'att'; break; }
  }
  if (!winner) return; // continues next month
  const W = winner === 'att' ? att : def, L = winner === 'att' ? def : att;
  for (const a of L) {
    for (const t in a.troops) a.troops[t] *= 0.88;
    a.morale = 0; a.path = [];
    const dest = retreatTarget(a);
    if (dest < 0) { for (const t in a.troops) a.troops[t] = 0; }
    else { a.loc = dest; a.retreat = 2; a.from = undefined; }
  }
  const wOwner = W[0].owner, lOwner = L[0].owner;
  const war = warBetween(wOwner, lOwner);
  const lostL = winner === 'att' ? lost.def : lost.att, startL = winner === 'att' ? start.def : start.att;
  if (war) {
    const impact = clamp(lostL / Math.max(1, startL) * 20 + 2, 2, 15) * (startL > 300 ? 1 : 0.5);
    war.battle = clamp(war.battle + (war.att.includes(wOwner) ? impact : -impact), -40, 40);
  }
  for (const a of W) S.countries[a.owner].prestige = Math.min(100, S.countries[a.owner].prestige + 1);
  for (const a of L) { const c = S.countries[a.owner]; c.prestige -= 1; c.we += 0.5; }
  const pl = S.player;
  const involved = W.some(a => a.owner === pl) || L.some(a => a.owner === pl);
  if (involved || start.att + start.def > 3000) {
    const txt = `Battle of ${pname(loc)}: ${name(wOwner)} defeats ${name(lOwner)} (${Math.round(start.att + start.def)} engaged, ${Math.round(lost.att + lost.def)} fell).`;
    log(txt, involved ? (W.some(a => a.owner === pl) ? 'good' : 'bad') : 'world', { prov: loc });
  }
}
function retreatTarget(a) {
  const S = S_(), M = M_();
  let best = -1, bd = -1;
  for (const e of M.provinces[a.loc].adj) {
    const P = S.provinces[e.to];
    if (!(friendly(a.owner, P.controller) || P.controller === a.owner)) continue;
    if (S.armies.some(b => b.loc === e.to && isAtWar(a.owner, b.owner))) continue;
    const d = e.to === S.countries[a.owner].capital ? 100 : R().next();
    if (d > bd) { bd = d; best = e.to; }
  }
  return best;
}

function sieges() {
  const S = S_();
  for (const P of S.provinces) if (P.siege && !S.armies.some(a => a.loc === P.id && a.owner === P.siege.by && !a.path.length)) P.siege = null;
  const handled = new Set();
  for (const a of S.armies) {
    if (a.path.length || a.retreat > 0 || handled.has(a.loc)) continue;
    const P = S.provinces[a.loc];
    const ctrl = P.controller;
    const hostileCtrl = ctrl >= 0 && ctrl !== a.owner && isAtWar(a.owner, ctrl);
    if (!hostileCtrl) continue;
    if (S.armies.some(b => b.loc === a.loc && isAtWar(a.owner, b.owner) && b.retreat === 0)) continue;
    handled.add(a.loc);
    const friends = S.armies.filter(b => b.loc === a.loc && !isAtWar(a.owner, b.owner) && !b.path.length);
    const men = friends.reduce((s, b) => s + armyMen(b), 0);
    if (men < 100) continue;
    if (!P.siege || P.siege.by !== a.owner) P.siege = { by: a.owner, months: 0 };
    P.siege.months++;
    const fort = fortLevel(P.id);
    let done = false;
    if (fort === 0) done = P.siege.months >= 1;
    else {
      const guns = friends.some(b => b.troops.shot > 0);
      const ch = 0.05 + 0.05 * Math.min(3, men / (fort * 400)) - 0.01 * fort + (guns ? 0.06 : 0);
      P.siege.chance = ch;
      done = P.siege.months >= 2 && R().chance(ch);
    }
    if (done) occupy(P, a.owner);
  }
}
function occupy(P, by) {
  const S = S_();
  const liberate = friendly(by, P.owner) || P.owner === by || (S.wars.some(w => sideOf(w, by) && sideOf(w, by) === sideOf(w, P.owner)));
  const prevCtrl = P.controller;
  P.controller = liberate ? P.owner : by; P.siege = null; P.dirty = true;
  if (!liberate) {
    const take = P.cattle * 0.3; P.cattle -= take; S.countries[by].gold += take * 0.02;
    P.devast = Math.min(100, P.devast + 15);
  }
  const pl = S.player;
  if (by === pl || P.owner === pl || prevCtrl === pl) {
    log(liberate ? `${pname(P.id)} is retaken.` : `${name(by)} occupies ${pname(P.id)}.`, by === pl ? 'good' : 'bad', { prov: P.id });
  }
}

function upkeepArmies() {
  const S = S_(), winter = WINTER.has(S.month);
  const menAt = new Map();
  for (const a of S.armies) { const k = a.loc * 1000 + a.owner; menAt.set(k, (menAt.get(k) || 0) + armyMen(a)); }
  for (const a of S.armies) {
    const P = S.provinces[a.loc], c = S.countries[a.owner];
    const terr = TERRAIN[terrainOf(a.loc)];
    const supply = (P.pop * 0.4 + P.cattle * 0.4) * terr.supply;
    const men = menAt.get(a.loc * 1000 + a.owner);
    const hostile = P.controller !== a.owner && !friendly(a.owner, P.controller);
    let pct = Math.max(0, men - supply) / men * 3 + (winter ? 1 : 0) + terr.atr + (hostile ? 1 : 0);
    if (a.path.length === 0 && !hostile && men <= supply && !winter) pct = 0;
    if (c.outsider && P.owner === a.owner && M_().provinces[a.loc].coastal) pct = 0; // supplied by the fleet
    if (pct > 0) for (const t in a.troops) a.troops[t] *= 1 - pct / 100;
    if (men > supply) P.devast = Math.min(100, P.devast + 1);
    // reinforce & recover at home
    const home = P.controller === a.owner || friendly(a.owner, P.controller);
    const inBattle = S.armies.some(b => b.loc === a.loc && isAtWar(a.owner, b.owner));
    if (home && !inBattle) {
      for (const t in a.maxT) {
        const need = a.maxT[t] - (a.troops[t] || 0); if (need <= 0) continue;
        const add = Math.min(need, a.maxT[t] * 0.1, c.manpower);
        a.troops[t] = (a.troops[t] || 0) + add; c.manpower -= add;
      }
    }
    if (!inBattle) a.morale = Math.min(maxMorale(a), a.morale + maxMorale(a) * (home ? 0.2 : 0.08));
  }
  S.armies = S.armies.filter(a => armyMen(a) >= 10);
}

// ---------- War score & peace ----------
function updateWar(w) {
  const S = S_();
  w.att = w.att.filter(c => S.countries[c].alive);
  w.def = w.def.filter(c => S.countries[c].alive);
  if (!S.countries[w.al].alive || !S.countries[w.dl].alive || !w.att.length || !w.def.length) { endWar(w); return; }
  const att = new Set(w.att), def = new Set(w.def);
  let dt = 0, dOcc = 0, at = 0, aOcc = 0;
  for (const P of S.provinces) {
    const cap = S.countries[P.owner]?.capital === P.id ? 2 : 1;
    if (def.has(P.owner)) { const v = provValue(P.id) * cap; dt += v; if (att.has(P.controller)) dOcc += v; }
    else if (att.has(P.owner)) { const v = provValue(P.id) * cap; at += v; if (def.has(P.controller)) aOcc += v; }
  }
  const occ = (dt ? dOcc / dt : 0) * 100 - (at ? aOcc / at : 0) * 100;
  w.score = clamp(Math.round(occ * 0.8 + w.battle), -100, 100);
  w.months++;
  for (const c of [...w.att, ...w.def]) S.countries[c].we = Math.min(20, S.countries[c].we + 0.04);
  // rebellions and invasions fizzle out when one side has no army and no land taken
  if (w.months > 120 && Math.abs(w.score) < 10) { endWar(w); log(`${w.name} peters out in exhaustion.`, 'world'); }
}
export function loserIds(w, winnerSide) { return winnerSide === 'att' ? w.def : w.att; }
export function peaceOptions(w, winnerSide) {
  const S = S_();
  const winners = new Set(winnerSide === 'att' ? w.att : w.def), losers = new Set(loserIds(w, winnerSide));
  const provs = S.provinces.filter(P => losers.has(P.owner) && winners.has(P.controller)).map(P => P.id);
  return {
    provs: w.cb === 'tain' ? [] : provs,
    hostages: w.cb !== 'tain' && w.cb !== 'independence',
    free: w.cb === 'independence' && winnerSide === 'att',
  };
}
export function peaceCost(w, winnerSide, terms) {
  const S = S_(), losers = new Set(loserIds(w, winnerSide));
  let total = 0; for (const P of S.provinces) if (losers.has(P.owner)) total += provValue(P.id);
  let cost = 0;
  for (const id of terms.provs || []) cost += provValue(id) / Math.max(1, total) * 100;
  if (terms.hostages) cost += w.cb === 'hostages' ? 25 : 40;
  if (terms.gold) cost += w.cb === 'tain' ? 5 : 10;
  if (terms.cattle) cost += w.cb === 'tain' ? 5 : 10;
  if (terms.free) cost += 30;
  return Math.round(cost);
}
export function winnerScore(w, side) { return side === 'att' ? w.score : -w.score; }
export function aiAcceptsPeace(w, winnerSide, terms) {
  const S = S_();
  const loserLead = S.countries[winnerSide === 'att' ? w.dl : w.al];
  const cost = peaceCost(w, winnerSide, terms);
  const s = winnerScore(w, winnerSide);
  if (cost === 0) return s >= -15 || (w.months > 36 && s > -35);
  const capOcc = S.provinces[loserLead.capital]?.controller !== loserLead.id ? 10 : 0;
  return s + loserLead.we * 1.5 + capOcc >= cost;
}
export function applyPeace(w, winnerSide, terms) {
  const S = S_();
  const W = S.countries[winnerSide === 'att' ? w.al : w.dl], L = S.countries[winnerSide === 'att' ? w.dl : w.al];
  const winners = winnerSide === 'att' ? w.att : w.def;
  const parts = [];
  for (const id of terms.provs || []) {
    const P = S.provinces[id];
    const rec = winners.find(c => P.cores.includes(c)) ?? W.id;
    transferProvince(id, rec);
  }
  if (terms.provs?.length) parts.push(`${terms.provs.length} territor${terms.provs.length > 1 ? 'ies' : 'y'}`);
  if (terms.hostages) { makeSubject(W, L); parts.push('hostages (clientship)'); }
  if (terms.gold) { const g = L.gold * 0.5; L.gold -= g; W.gold += g; parts.push(`${Math.round(g)} treasure`); }
  if (terms.cattle) {
    let take = 0; for (const P of S.provinces) if (P.owner === L.id) { const t = P.cattle * 0.25; P.cattle -= t; take += t; }
    W.gold += take * 0.02; parts.push(`${Math.round(take)} cattle`);
  }
  if (terms.free) { freeSubject(L, W); parts.push('independence'); }
  W.prestige = Math.min(100, W.prestige + 10); L.prestige -= 10;
  if (terms.provs?.length) L.stability = clamp(L.stability - 1, -3, 3);
  const involved = [...w.att, ...w.def].includes(S.player);
  log(`Peace: ${W.name} wins against ${L.name}${parts.length ? ' — ' + parts.join(', ') : ' (white peace)'}.`, involved ? (winners.includes(S.player) ? 'good' : 'bad') : 'world');
  endWar(w);
}
export function whitePeace(w) {
  const S = S_();
  log(`White peace in ${w.name}.`, [...w.att, ...w.def].includes(S.player) ? 'info' : 'world');
  endWar(w);
}
export function endWar(w) {
  const S = S_();
  const A = new Set(w.att), D = new Set(w.def);
  S.wars = S.wars.filter(x => x !== w);
  for (const P of S.provinces) {
    if (P.controller !== P.owner && ((A.has(P.owner) && D.has(P.controller)) || (D.has(P.owner) && A.has(P.controller)))) {
      if (!isAtWar(P.owner, P.controller)) { P.controller = P.owner; P.dirty = true; }
    }
    if (P.siege && (A.has(P.siege.by) || D.has(P.siege.by))) P.siege = null;
  }
  // armies left standing in foreign land march home
  for (const a of S.armies) {
    if (!(A.has(a.owner) || D.has(a.owner)) || canPass(a.owner, a.loc)) continue;
    const c = S.countries[a.owner];
    const home = c.provs.includes(c.capital) ? c.capital : c.provs[0];
    if (home !== undefined) { a.loc = home; a.path = []; a.prog = 0; }
  }
  const years = w.cb === 'rebellion' ? 5 : 10;
  for (const a of w.att) for (const d of w.def) S.truces[truceKey(a, d)] = S.year + years;
  for (const c of [...w.att, ...w.def]) refreshCountry(S.countries[c]);
}
export function cleanupCountry(c) {
  const S = S_();
  for (const w of [...S.wars]) {
    if (w.al === c.id || w.dl === c.id) { endWar(w); continue; }
    w.att = w.att.filter(x => x !== c.id); w.def = w.def.filter(x => x !== c.id);
  }
  for (const o of S.countries) {
    o.allies = o.allies.filter(x => x !== c.id);
    o.subjects = o.subjects.filter(x => x !== c.id);
    if (o.overlord === c.id) o.overlord = -1;
  }
  c.allies = []; c.subjects = []; c.overlord = -1;
  if (S.ardRi === c.id) S.ardRi = -1;
}

// ---------- Diplomacy ----------
export function makeSubject(W, L) {
  const S = S_();
  if (L.overlord >= 0) { const o = S.countries[L.overlord]; o.subjects = o.subjects.filter(x => x !== L.id); }
  for (const s of L.subjects) S.countries[s].overlord = -1;
  L.subjects = [];
  for (const al of L.allies) S.countries[al].allies = S.countries[al].allies.filter(x => x !== L.id);
  L.allies = [];
  L.overlord = W.id; W.subjects.push(L.id); W.subjSince[L.id] = S.year;
  L.rel[W.id] = Math.max(L.rel[W.id], -20);
  for (const ww of [...S.wars]) if ((ww.att.includes(L.id) && ww.def.includes(W.id)) || (ww.def.includes(L.id) && ww.att.includes(W.id))) {
    if (ww.al !== L.id && ww.dl !== L.id && ww.al !== W.id && ww.dl !== W.id) { ww.att = ww.att.filter(x => x !== L.id); ww.def = ww.def.filter(x => x !== L.id); }
  }
}
export function freeSubject(overlord, sub) {
  overlord.subjects = overlord.subjects.filter(x => x !== sub.id); sub.overlord = -1;
}
export const DIP = {
  improveCost: 15, allianceMin: 30,
  improve(c, t) { if (c.dip < 15) return false; c.dip -= 15; t.rel[c.id] = Math.min(200, t.rel[c.id] + 25); return true; },
  giftCost(c, t) { return Math.round(15 + Math.max(0, t.income) * 6); },
  gift(c, t) { const g = DIP.giftCost(c, t); if (c.gold < g) return false; c.gold -= g; t.rel[c.id] = Math.min(200, t.rel[c.id] + 30); return true; },
  wouldAlly(t, c) {
    if (t.overlord >= 0 || c.overlord >= 0 || t.allies.length >= 3 || isAtWar(t.id, c.id)) return false;
    return t.rel[c.id] >= 30;
  },
  ally(c, t) {
    if (c.allies.includes(t.id) || !DIP.wouldAlly(t, c)) return false;
    c.allies.push(t.id); t.allies.push(c.id); return true;
  },
  breakAlliance(c, t) { c.allies = c.allies.filter(x => x !== t.id); t.allies = t.allies.filter(x => x !== c.id); t.rel[c.id] -= 30; c.prestige -= 5; },
  wouldFoster(t, c) { return !isAtWar(t.id, c.id) && t.rel[c.id] >= 0 && !t.fostered.includes(c.id) && t.fostered.length < 4; },
  foster(c, t) {
    if (!DIP.wouldFoster(t, c) || c.fostered.length >= 4) return false;
    c.fostered.push(t.id); t.fostered.push(c.id); t.rel[c.id] += 40; c.rel[t.id] += 40; c.prestige += 2; return true;
  },
  hostageOdds(c, t) {
    const sc = strength(c.id), st = Math.max(1, strength(t.id));
    return { ratio: sc / st, ok: (sc >= 2.5 * st && t.rel[c.id] >= -25) || sc >= 4 * st };
  },
  canDemandHostages(c, t) {
    if (t.overlord >= 0 || c.overlord >= 0 || t.outsider || t.subjects.length || isAtWar(c.id, t.id)) return false;
    return c.subjects.length < subjectLimit(c) && bordering(c.id, t.id);
  },
  demandHostages(c, t) {
    if (!DIP.canDemandHostages(c, t)) return 'invalid';
    const S = S_();
    if (DIP.hostageOdds(c, t).ok) { makeSubject(c, t); return 'yes'; }
    t.rel[c.id] -= 30; c.hostCB = c.hostCB || {}; c.hostCB[t.id] = S.year + 5; return 'no';
  },
  annexCost(c, t) { return 12 * t.provs.length; },
  canAnnex(c, t) { const S = S_(); return t.overlord === c.id && S.year - (c.subjSince[t.id] || S.year) >= 10 && t.rel[c.id] >= 50; },
  annex(c, t) {
    if (!DIP.canAnnex(c, t) || c.dip < DIP.annexCost(c, t)) return false;
    c.dip -= DIP.annexCost(c, t);
    const S = S_();
    for (const P of S.provinces) if (P.owner === t.id) { transferProvince(P.id, c.id); if (!P.cores.includes(c.id)) P.cores.push(c.id); }
    for (const a of S.armies) if (a.owner === t.id) a.owner = c.id;
    log(`${c.name} absorbs ${t.name} peacefully.`, c.id === S.player ? 'good' : 'world');
    return true;
  },
  release(c, t) { freeSubject(c, t); t.rel[c.id] += 50; },
};

// split / merge for UI
export function splitArmy(a) {
  const S = S_();
  if (armyMen(a) < 200) return null;
  const half = {};
  for (const t in a.troops) { half[t] = Math.floor(a.troops[t] / 2); a.troops[t] -= half[t]; a.maxT[t] = Math.ceil(a.maxT[t] / 2); }
  const b = addArmy(a.owner, a.loc, half); b.morale = a.morale; b.arrived = a.arrived;
  return b;
}
export function mergeArmies(list) {
  const S = S_();
  if (list.length < 2) return list[0];
  const [a, ...rest] = list;
  for (const b of rest) {
    for (const t in b.troops) { a.troops[t] = (a.troops[t] || 0) + b.troops[t]; a.maxT[t] = (a.maxT[t] || 0) + (b.maxT[t] || b.troops[t]); }
    a.morale = Math.min(a.morale, b.morale);
  }
  S.armies = S.armies.filter(x => !rest.includes(x));
  return a;
}
export function disband(a) { const S = S_(); S.armies = S.armies.filter(x => x !== a); }
export { eraOf };
