// Computer-controlled realms.
import { ctx, log, clamp } from './ctx.js';
import { BUILDINGS, UNITS, INST_IDS } from './data.js';
import {
  techStatus, researchTech, makeCore, coreCost, raiseStability, stabCost, canEmbrace, embraceCost, embrace,
  canBuild, build, recruitOptions, unitCost, recruit, armyMen, strength, designateTanist, provValue, fortLevel,
  fabricateClaim, claimCost, canSetLaw, setLaw, subjectLimit,
} from './game.js';
import {
  isAtWar, warsOf, sideOf, canDeclare, declareWar, neighbours, findPath, peaceOptions, peaceCost, aiAcceptsPeace,
  applyPeace, whitePeace, winnerScore, mergeArmies, DIP, friendly, bordering,
} from './war.js';

const S_ = () => ctx.S, M_ = () => ctx.M, R = () => ctx.rng;

export function aiTick() {
  const S = S_();
  for (const c of S.countries) {
    if (!c.alive) continue;
    if (c.ai) { economy(c); diplomacy(c); }
    if (c.ai) armies(c);
  }
  for (const w of [...S.wars]) peaceAI(w);
}

function economy(c) {
  const S = S_();
  // technology, cheapest first, only when not far ahead of time
  for (const t of ['mil', 'adm', 'dip']) {
    const st = techStatus(c, t);
    if (!st.max && !st.block && st.ahead <= (c.outsider ? 0 : 12) && c[t] >= st.cost) researchTech(c, t);
  }
  if (c.stability < 1 && c.adm >= stabCost(c) + 20) raiseStability(c);
  if (c.adm > 120) {
    const id = c.provs.find(id => !S.provinces[id].cores.includes(c.id));
    if (id !== undefined && c.adm >= coreCost(c, id) + 60) makeCore(c, id);
  }
  if (c.laws.succession === 'tanistry' && !c.tanist && c.dip >= 60) {
    const cands = [0, 1, 2]; designateTanist(c, cands[R().int(3)]);
  }
  for (const k of INST_IDS) if (canEmbrace(c, k) && c.gold >= embraceCost(c, k) + 15) embrace(c, k);
  // laws
  if (c.adm > 300) {
    if (c.culture === 'gaelic' && S.year > 1300 && c.laws.army === 'risingout' && c.income < c.expense * 1.3 && canSetLaw(c, 'army', 'coign')) setLaw(c, 'army', 'coign');
    else if (c.culture !== 'gaelic' && c.laws.law === 'brehon' && canSetLaw(c, 'law', 'common')) setLaw(c, 'law', 'common');
  }
  // buildings
  if (c.gold > 80 && R().chance(0.5)) {
    const id = R().pick(c.provs);
    const border = M_().provinces[id].adj.some(e => S.provinces[e.to].owner !== c.id);
    const order = border ? ['castle', 'rath', 'motte', 'towerhouse', 'bastion', 'church', 'market', 'oenach', 'monastery', 'mill', 'walls']
                         : ['market', 'church', 'oenach', 'monastery', 'mill', 'rath', 'towerhouse', 'walls'];
    for (const b of order) if (canBuild(c, id, b) && c.gold >= BUILDINGS[b].cost + 20) { build(c, id, b); break; }
  }
  // recruitment
  const atWar = warsOf(c.id).length > 0;
  const men = S.armies.filter(a => a.owner === c.id).reduce((s, a) => s + armyMen(a), 0);
  const want = c.maxMP * (atWar ? 0.9 : 0.45) + (c.outsider ? 600 : 0);
  if (men < want && c.manpower >= 100 && c.income - c.expense > (atWar ? -2 : 0.3)) {
    const opts = recruitOptions(c);
    const pick = choiceUnit(c, opts);
    const where = c.capital >= 0 && S.provinces[c.capital].controller === c.id ? c.capital : c.provs.find(id => S.provinces[id].controller === c.id);
    if (where !== undefined && c.gold >= unitCost(c, pick)) recruit(c, where, pick, 1);
  }
}
function choiceUnit(c, opts) {
  const r = R().next();
  const best = ['shot', 'galloglass', 'knights', 'axemen'].find(u => opts.includes(u));
  if (best && r < 0.45) return best;
  if (opts.includes('archers') && r < 0.65) return 'archers';
  if (opts.includes('kern') && r < 0.75) return 'kern';
  if (r < 0.85) return 'horse';
  return 'levy';
}

function realmStrength(cid) {
  const S = S_(), c = S.countries[cid];
  let s = strength(cid);
  for (const x of [...c.subjects, ...c.allies]) if (S.countries[x]?.alive) s += strength(x) * 0.6;
  return s;
}

function diplomacy(c) {
  const S = S_();
  if (c.overlord >= 0) {
    // clients may throw off weak overlords
    const o = S.countries[c.overlord];
    if (R().chance(0.01) && c.rel[o.id] < 0 && strength(c.id) * 1.3 > realmStrength(o.id) && warsOf(o.id).length) declareWar(c.id, o.id, 'independence');
    return;
  }
  const atWar = warsOf(c.id).length > 0;
  // alliances and fosterage with friendly neighbours
  if (R().chance(0.03) && c.allies.length < 2) {
    const n = neighbours(c.id).map(i => S.countries[i]).filter(x => x.overlord < 0 && !isAtWar(c.id, x.id) && !c.allies.includes(x.id));
    const t = n.find(x => x.rel[c.id] >= 30 && c.rel[x.id] >= 20);
    if (t) DIP.ally(c, t);
    else if (n.length) { const x = R().pick(n); if (c.dip > 80) DIP.improve(c, x); if (DIP.wouldFoster(x, c) && c.fostered.length < 2 && R().chance(0.3)) DIP.foster(c, x); }
  }
  // client-kingship: demand hostages from much weaker neighbours
  if (!atWar && !c.outsider && R().chance(0.02)) {
    const t = neighbours(c.id).map(i => S.countries[i]).find(x => DIP.canDemandHostages(c, x) && DIP.hostageOdds(c, x).ok);
    if (t) {
      if (t.id === S.player) S.pending.push({ kind: 'hostages', from: c.id });
      else { DIP.demandHostages(c, t); log(`${t.name} gives hostages to ${c.name} and becomes a client kingdom.`, 'world'); }
    }
  }
  // annex long-standing loyal clients
  for (const sid of c.subjects) { const t = S.countries[sid]; if (DIP.canAnnex(c, t) && c.dip >= DIP.annexCost(c, t) + 50 && R().chance(0.05)) DIP.annex(c, t); }
  // claims
  if (c.dip > 150 && R().chance(0.05)) {
    const n = neighbours(c.id); if (n.length) {
      const t = R().pick(n);
      const id = S.provinces.find(P => P.owner === t && M_().provinces[P.id].adj.some(e => S.provinces[e.to].owner === c.id));
      if (id) fabricateClaim(c, id.id);
    }
  }
  // war
  if (atWar || c.stability < 0 || c.we > 6) return;
  const agg = c.outsider ? 0.08 : 0.035;
  if (!R().chance(agg)) return;
  const me = realmStrength(c.id);
  const targets = neighbours(c.id).map(i => S.countries[i]).filter(t => {
    const top = t.overlord >= 0 ? t.overlord : t.id;
    return canDeclare(c.id, top).ok;
  }).map(t => S.countries[t.overlord >= 0 ? t.overlord : t.id]);
  let best = null, br = c.outsider ? 1.0 : 1.35;
  for (const t of targets) {
    const r = (c.outsider ? strength(c.id) : me) / Math.max(1, c.outsider ? strength(t.id) * 1.2 : realmStrength(t.id));
    if (r > br) { br = r; best = t; }
  }
  if (!best) return;
  const cbs = canDeclare(c.id, best.id).cbs || [];
  const cb = ['claim', 'conquest', 'hostages', 'tain'].find(x => cbs.includes(x));
  if (!cb) return;
  if (best.id === S.player || best.allies.includes(S.player)) { /* the player gets warned by the log */ }
  declareWar(c.id, best.id, cb);
}

function armies(c) {
  const S = S_(), M = M_();
  const mine = S.armies.filter(a => a.owner === c.id && a.retreat === 0);
  if (!mine.length) return;
  // merge stacks sharing a province
  const byLoc = new Map();
  for (const a of mine) { if (!byLoc.has(a.loc)) byLoc.set(a.loc, []); byLoc.get(a.loc).push(a); }
  for (const list of byLoc.values()) if (list.length > 1 && list.every(a => !a.path.length)) mergeArmies(list);
  const armiesNow = S.armies.filter(a => a.owner === c.id && a.retreat === 0);
  const wars = warsOf(c.id);
  if (!wars.length) {
    for (const a of armiesNow) if (a.loc !== c.capital && !a.path.length && c.capital >= 0 && R().chance(0.3)) {
      const P = S.provinces[a.loc];
      if (P.owner !== c.id) { const p = findPath(c.id, a.loc, c.capital); if (p) { a.path = p; a.target = c.capital; } }
    }
    return;
  }
  const enemies = new Set();
  for (const w of wars) { const s = sideOf(w, c.id); for (const e of s === 'att' ? w.def : w.att) enemies.add(e); }
  const enemyArmies = S.armies.filter(b => enemies.has(b.owner));
  for (const a of armiesNow) {
    if (a.path.length && R().chance(0.7)) continue; // keep current orders most of the time
    // stay on a siege we are winning
    const here = S.provinces[a.loc];
    if (here.siege && here.siege.by === c.id && !enemyArmies.some(b => b.loc !== a.loc && power(b) > power(a) && bfsNear(c.id, a.loc, b.loc))) { a.path = []; continue; }
    const myMen = power(a);
    // find best target by distance (BFS hops)
    const hops = bfs(c.id, a.loc, 6);
    let target = -1, score = -Infinity;
    for (const b of enemyArmies) {
      const d = hops.get(b.loc); if (d === undefined) continue;
      const theirs = power(b);
      if (myMen > theirs * 1.15) { const s = 50 - d * 5 + theirs / 200; if (s > score) { score = s; target = b.loc; } }
      else if (theirs > myMen * 1.3 && d <= 2) {
        // flee toward a fort or the capital
        const safe = c.capital; if (safe >= 0 && safe !== a.loc) { target = safe; score = 999; }
      }
    }
    if (score < 999) {
      for (const [pid, d] of hops) {
        const P = S.provinces[pid];
        const own = P.owner === c.id || friendly(c.id, P.owner);
        if (!(enemies.has(P.controller) && (own || enemies.has(P.owner)))) continue;
        const guarded = enemyArmies.some(b => b.loc === pid && power(b) > myMen * 0.9);
        if (guarded) continue;
        const s = (own ? 40 : 25) + provValue(pid) * 2 - d * 6 - fortLevel(pid) * 4 + (S.countries[P.owner]?.capital === pid ? 15 : 0);
        if (s > score) { score = s; target = pid; }
      }
    }
    if (target >= 0 && target !== a.loc) { const p = findPath(c.id, a.loc, target); if (p) { a.path = p; a.target = target; } }
    else if (target === a.loc) a.path = [];
  }
}
function bfsNear(cid, from, to) { const h = bfs(cid, from, 1); return h.has(to); }
function power(a) { let p = 0; for (const t in a.troops) p += a.troops[t] * UNITS[t].atk; return p * (0.5 + 0.5 * Math.min(1, a.morale / 2)); }
function bfs(cid, from, maxD) {
  const M = M_(), out = new Map([[from, 0]]), q = [from];
  while (q.length) {
    const u = q.shift(), d = out.get(u); if (d >= maxD) continue;
    for (const e of M.provinces[u].adj) if (!out.has(e.to)) {
      out.set(e.to, d + 1);
      // only expand through passable ground
      const o = S_().provinces[e.to].owner;
      if (o < 0 || friendly(cid, o) || isAtWar(cid, o)) q.push(e.to);
    }
  }
  return out;
}

function peaceAI(w) {
  const S = S_();
  if (w.months < 6) return;
  for (const side of ['att', 'def']) {
    const leadId = side === 'att' ? w.al : w.dl, otherId = side === 'att' ? w.dl : w.al;
    const lead = S.countries[leadId];
    if (!lead.ai) continue;
    const s = winnerScore(w, side);
    const greedy = lead.outsider && w.months < 60;
    if (s >= (greedy ? 45 : 15)) {
      // demand as much as the score allows
      const opts = peaceOptions(w, side);
      const terms = { provs: [], hostages: false, gold: false, cattle: false, free: opts.free };
      const ranked = opts.provs.sort((a, b) => provValue(b) - provValue(a));
      if (w.cb === 'tain') { terms.cattle = true; terms.gold = true; }
      else {
        for (const id of ranked) { terms.provs.push(id); if (peaceCost(w, side, terms) > s) { terms.provs.pop(); } }
        if (opts.hostages && !terms.provs.length && peaceCost(w, side, { ...terms, hostages: true }) <= s && S.countries[otherId].subjects.length === 0 && !S.countries[otherId].outsider) terms.hostages = true;
        if (!terms.provs.length && !terms.hostages && !terms.free) { terms.gold = true; terms.cattle = true; }
      }
      const cost = peaceCost(w, side, terms);
      if (cost <= 0 || cost > s) continue;
      if (lead.outsider && !terms.provs.length && !terms.hostages && w.months < 72) continue; // invaders want land
      const other = S.countries[otherId];
      if (!other.ai) {
        if (!S.pending.some(p => p.kind === 'peace' && p.war === w.id) && R().chance(0.15)) S.pending.push({ kind: 'peace', war: w.id, side, terms });
      } else if (aiAcceptsPeace(w, side, terms) || R().chance(0.1)) { applyPeace(w, side, terms); return; }
    } else if (s <= -40 && R().chance(lead.outsider ? 0.01 : 0.05)) {
      const other = S.countries[otherId];
      if (other.ai && aiAcceptsPeace(w, side === 'att' ? 'def' : 'att', { provs: [], gold: true })) { applyPeace(w, side === 'att' ? 'def' : 'att', { provs: [], gold: true }); return; }
    } else if (w.months > 48 && Math.abs(s) < 15 && R().chance(0.03)) {
      const other = S.countries[otherId];
      if (other.ai) { whitePeace(w); return; }
    }
  }
}
