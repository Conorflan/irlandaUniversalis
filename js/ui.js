// DOM panels, modals and player actions.
import { ctx, log, dateStr } from './ctx.js';
import {
  TERRAIN, UNITS, UNIT_SIZE, BUILDINGS, LAWS, RANKS, INSTITUTIONS, TECH_YEARS, TECH_NAMES, TECH_INFO, TECH_GATES, MAX_TECH,
  ERAS, eraOf, POLITIES, MONTHS,
} from './data.js';
import * as Gm from './game.js';
import * as War from './war.js';
import { EVENTS, resolveEvent } from './events.js';

const $ = s => document.querySelector(s);
const S = () => ctx.S, M = () => ctx.M;
const me = () => S().countries[S().player];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmt = n => { n = +n || 0; const a = Math.abs(n); return a >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : a >= 100 ? Math.round(n).toString() : a >= 10 ? n.toFixed(1) : n.toFixed(1); };
const pn = id => esc(M().provinces[id].name);
const cn = id => esc(S().countries[id]?.name || '—');
const dot = c => `<span class="dot" style="background:${c.color}"></span>`;
const religionName = r => r === 'christian' ? (S().year >= 1536 ? 'Catholic' : 'Christian') : r === 'pagan' ? 'Pagan' : 'Protestant';
const cultureName = c => ({ gaelic: 'Gaelic', norse: 'Norse', norman: 'Norman', english: 'English' }[c]);

export const UI = {
  view: null, tab: null, prov: -1, country: -1, army: null, diploTab: 'all', logFilter: 'mine', ledgerSort: 'provs',
  onChange: null, // hook set by main to request redraw
  pause: null,
};

// ---------- panel framework ----------
export function openPanel(kind, arg) {
  UI.tab = kind;
  if (kind === 'province') UI.prov = arg;
  if (kind === 'country') UI.country = arg;
  $('#panel').classList.remove('hidden');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === kind));
  renderPanel();
}
export function closePanel() {
  UI.tab = null; $('#panel').classList.add('hidden');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
  if (UI.view) UI.view.setSel(-1);
}
export function renderPanel() {
  if (!UI.tab || !S()) return;
  const body = $('#panel-body');
  const st = $('#panel').scrollTop;
  const f = { province, realm, tech, diplo, country, military, ledger, log: annals, menu }[UI.tab];
  body.innerHTML = f ? f() : '';
  $('#panel').scrollTop = st;
}

// ---------- HUD ----------
export function renderHUD() {
  const s = S(), c = me();
  $('#hud-realm .swatch').style.background = c.color;
  $('#hud-realm .nm').textContent = c.name.replace(/\s*\(.*\)/, '');
  const net = c.income - c.expense;
  const coin = s.instOn.norse_trade ? '🪙' : '🐄';
  $('#res').innerHTML = `
    <span class="r" title="Treasury (monthly balance)">${coin}<b>${fmt(c.gold)}</b><small class="${net >= 0 ? '' : 'bad'}">${net >= 0 ? '+' : ''}${net.toFixed(1)}</small></span>
    <span class="r" title="Manpower / max">⚔<b>${fmt(c.manpower)}</b><small>/${fmt(c.maxMP)}</small></span>
    <span class="r pts" title="Rule (administrative) points" data-act="tab" data-tab="tech">⚖<b>${Math.floor(c.adm)}</b></span>
    <span class="r pts" title="Diplomacy points" data-act="tab" data-tab="diplo">✉<b>${Math.floor(c.dip)}</b></span>
    <span class="r pts" title="War points" data-act="tab" data-tab="military">⛨<b>${Math.floor(c.mil)}</b></span>
    <span class="r" title="Stability">⚓<b class="${c.stability < 0 ? 'bad' : ''}">${c.stability > 0 ? '+' : ''}${c.stability}</b></span>
    <span class="r" title="Prestige">✶<b>${Math.round(c.prestige)}</b></span>`;
  $('#date').innerHTML = `${MONTHS[s.month]} ${s.year} AD<small>${eraOf(s.year).name}</small>`;
}

// ---------- Province ----------
function province() {
  const s = S(), id = UI.prov, p = M().provinces[id], P = s.provinces[id], c = me();
  const o = s.countries[P.owner];
  const t = Gm.terrainOf(id), T = TERRAIN[t];
  const mine = P.owner === c.id;
  const K = Gm.capacity(id);
  let h = `<h2>${pn(id)}</h2><div class="muted">${T.name} · ${p.areaKm} km²${p.coastal ? ' · coastal' : ''}${p.lakeside ? ' · lakeshore' : ''}</div>`;
  if (o) h += `<div class="row click" data-act="country" data-id="${o.id}">${dot(o)}<div class="grow"><b>${esc(o.name)}</b>${P.controller !== P.owner ? ` <span class="chip war">occupied by ${cn(P.controller)}</span>` : ''}</div><span class="muted">›</span></div>`;
  h += `<div class="grid">
    ${stat('Population', fmt(P.pop), `capacity ${fmt(K)}`)}
    ${stat('Cattle', fmt(P.cattle))}
    ${stat('Tax / month', Gm.provTax(id).toFixed(2))}
    ${stat('Levies', fmt(Gm.provManpower(id)))}
    ${stat('Fort', Gm.fortLevel(id))}
    ${stat('Unrest', P.unrest.toFixed(1), P.unrest > 5 ? '<span class="bad">revolt risk</span>' : '')}
    ${stat('Devastation', Math.round(P.devast) + '%')}
    ${stat('Forest', Math.round(p.forestShare * P.forest * 100) + '%')}
  </div>`;
  h += `<div class="muted" style="margin-top:6px">Terrain: move ×${T.move}, defender +${T.def} dice, horse ×${T.cav}, kern ×${T.light}${T.atr ? `, attrition +${T.atr}%` : ''}</div>`;
  h += `<div style="margin-top:6px"><span class="chip">${cultureName(P.culture)}</span><span class="chip">${religionName(P.religion)}</span>${P.plague ? '<span class="chip war">plague</span>' : ''}`;
  if (P.cores.length) h += ` <span class="muted">Cores:</span> ${P.cores.map(k => `<span class="chip">${cn(k)}</span>`).join('')}`;
  if (P.claims.length) h += ` <span class="muted">Claims:</span> ${P.claims.map(k => `<span class="chip">${cn(k)}</span>`).join('')}`;
  h += `</div>`;
  if (P.siege) h += `<div class="warn" style="margin-top:6px">Besieged by ${cn(P.siege.by)} — ${P.siege.months} month(s)${P.siege.chance ? `, ${Math.round(P.siege.chance * 100)}%/month` : ''}</div>`;
  // institutions
  const on = INSTITUTIONS.filter(i => s.instOn[i.id]);
  if (on.length) {
    h += `<h3>Institutions</h3>`;
    for (const i of on) h += `<div class="row"><div class="grow">${i.name}<div class="bar"><i style="width:${P.inst[i.id]}%"></i></div></div><span class="muted">${Math.round(P.inst[i.id])}%</span></div>`;
  }
  // buildings
  h += `<h3>Buildings (${P.bld.length}/${Gm.bldSlots(id)})</h3>`;
  h += P.bld.length ? P.bld.map(b => `<span class="chip">${BUILDINGS[b].name}</span>`).join('') : '<div class="muted">None</div>';
  if (mine) {
    const opts = Object.keys(BUILDINGS).filter(b => !P.bld.includes(b) && BUILDINGS[b].req(c, P));
    if (opts.length) {
      h += `<div style="margin-top:6px">`;
      for (const b of opts) {
        const B = BUILDINGS[b], ok = Gm.canBuild(c, id, b) && c.gold >= B.cost;
        h += `<div class="row"><div class="grow"><b>${B.name}</b><div class="muted">${B.desc}</div></div><button class="btn sm" data-act="build" data-b="${b}" ${ok ? '' : 'disabled'}>${B.cost} 🪙</button></div>`;
      }
      h += `</div>`;
    }
    h += `<h3>Actions</h3><div class="btns">`;
    if (!P.cores.includes(c.id)) h += `<button class="btn" data-act="core" ${c.adm >= Gm.coreCost(c, id) ? '' : 'disabled'}>Make core (${Gm.coreCost(c, id)} ⚖)</button>`;
    if (Gm.canClear(c, id)) { const cc = Gm.clearCost(c, id); h += `<button class="btn" data-act="clear" ${c.gold >= cc.gold && c.adm >= cc.adm ? '' : 'disabled'}>Clear forest (${cc.gold} 🪙, ${cc.adm} ⚖)</button>`; }
    h += `</div>`;
    if (Gm.canRecruitAt(c, id)) {
      h += `<h3>Raise troops</h3><div class="muted">Manpower ${fmt(c.manpower)} · units of ${UNIT_SIZE} men</div>`;
      for (const u of Gm.recruitOptions(c)) {
        const U = UNITS[u], cost = Gm.unitCost(c, u);
        const ok1 = c.gold >= cost && c.manpower >= UNIT_SIZE, ok5 = c.gold >= cost * 5 && c.manpower >= UNIT_SIZE * 5;
        h += `<div class="row"><div class="grow"><b>${U.name}</b><div class="muted">attack ${U.atk} · defence ${U.def} · morale ${U.mor} · upkeep ${U.up}/mo${U.cls === 'light' ? ' · rough-ground bonus' : U.cls === 'cav' ? ' · open-ground bonus' : ''}</div></div>
          <button class="btn sm" data-act="recruit" data-u="${u}" data-n="1" ${ok1 ? '' : 'disabled'}>+1 (${cost})</button>
          <button class="btn sm" data-act="recruit" data-u="${u}" data-n="5" ${ok5 ? '' : 'disabled'}>+5</button></div>`;
      }
    }
  } else if (o) {
    h += `<h3>Actions</h3><div class="btns">`;
    if (!P.claims.includes(c.id) && !P.cores.includes(c.id)) h += `<button class="btn" data-act="claim" ${c.dip >= Gm.claimCost(c) ? '' : 'disabled'}>Fabricate claim (${Gm.claimCost(c)} ✉)</button>`;
    h += `<button class="btn" data-act="country" data-id="${o.id}">Diplomacy with ${esc(o.name)}</button></div>`;
  }
  const armies = s.armies.filter(a => a.loc === id);
  if (armies.length) {
    h += `<h3>Armies here</h3>`;
    for (const a of armies) h += armyRow(a);
  }
  return h;
}
function stat(k, v, sub = '') { return `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${sub ? `<div class="muted" style="font-size:11px">${sub}</div>` : ''}</div>`; }
function armyRow(a) {
  const s = S(), co = s.countries[a.owner], men = Gm.armyMen(a);
  const comp = Object.entries(a.troops).filter(([, n]) => n >= 1).map(([t, n]) => `${UNITS[t].name.split(' (')[0]} ${Math.round(n)}`).join(', ');
  const mine = a.owner === s.player;
  return `<div class="row ${mine ? 'click' : ''}" ${mine ? `data-act="selarmy" data-id="${a.id}"` : ''}>${dot(co)}<div class="grow"><b>${fmt(men)} men</b> <span class="muted">· ${pn(a.loc)}${a.path.length ? ` → ${pn(a.path[a.path.length - 1])}` : ''}</span><div class="muted">${comp}</div>
    <div class="bar"><i style="width:${Math.min(100, a.morale / Gm.maxMorale(a) * 100)}%;background:#3a9a3a"></i></div></div>${mine ? `<span class="muted">${UI.army === a ? '✔' : '›'}</span>` : ''}</div>`;
}

// ---------- Realm ----------
function realm() {
  const s = S(), c = me();
  const rank = c.outsider ? c.rank : RANKS.find(r => r.id === c.rank).name;
  let h = `<h2>${esc(c.name)}</h2><div class="muted">${rank} · ${cultureName(c.culture)} · ${religionName(c.religion)}${c.overlord >= 0 ? ` · client of ${cn(c.overlord)}` : ''}</div>`;
  if (s.ardRi === c.id) h += `<div class="chip good" style="margin-top:6px">♛ Ard Rí — High King of Ireland</div>`;
  h += rulerCard('Ruler', c.ruler);
  if (c.laws.succession === 'tanistry') {
    if (c.tanist) h += rulerCard('Tanist (heir)', c.tanist);
    else {
      h += `<div class="warn" style="margin:6px 0"><b>No tanist named.</b> If the king dies now the derbfine will fight over the kingship (−2 stability, unrest).</div>`;
      Gm.tanistCandidates(c).forEach((r, i) => {
        h += `<div class="row"><div class="grow">${esc(r.name)}, ${Math.floor(r.age)} <span class="muted">⚖${r.adm} ✉${r.dip} ⛨${r.mil}</span></div><button class="btn sm" data-act="tanist" data-i="${i}" ${c.dip >= 25 ? '' : 'disabled'}>Name tanist (25 ✉)</button></div>`;
      });
    }
  } else if (c.heir) h += rulerCard('Heir', c.heir);
  h += `<h3>State of the realm</h3><div class="grid">
    ${stat('Stability', (c.stability > 0 ? '+' : '') + c.stability, c.stability < 3 ? `<button class="btn sm" data-act="stab" ${c.adm >= Gm.stabCost(c) ? '' : 'disabled'}>Raise (${Gm.stabCost(c)} ⚖)</button>` : '')}
    ${stat('Prestige', Math.round(c.prestige))}
    ${stat('Income', c.income.toFixed(1), `upkeep ${c.expense.toFixed(1)}`)}
    ${stat('Territories', c.provs.length)}
    ${stat('Population', fmt(c.pop))}
    ${stat('Overextension', c.oe + '%', 'non-core land')}
    ${stat('War exhaustion', c.we.toFixed(1))}
    ${stat('Technology', `${c.tech.adm}/${c.tech.dip}/${c.tech.mil}`)}
  </div>`;
  if (c.backlash > 0) h += `<div class="warn">Traditionalist backlash: ${c.backlash} months left (+2 unrest).</div>`;
  if (c.dispute > 0) h += `<div class="warn">Succession dispute: ${c.dispute} months left (+3 unrest).</div>`;
  h += `<h3>Laws &amp; customs</h3><div class="muted">Changing a law costs 100 ⚖ and 1 stability.</div>`;
  const catName = { succession: 'Succession', law: 'Law', army: 'Military service' };
  for (const cat in LAWS) {
    h += `<div style="margin-top:6px"><b>${catName[cat]}</b></div>`;
    for (const [k, L] of Object.entries(LAWS[cat])) {
      const cur = c.laws[cat] === k;
      if (!cur && !L.req(c, s)) continue;
      h += `<div class="row"><div class="grow">${cur ? '● ' : ''}<b>${L.name}</b><div class="muted">${L.desc}</div></div>${cur ? '<span class="chip good">current</span>' : `<button class="btn sm" data-act="law" data-cat="${cat}" data-k="${k}" ${c.adm >= 100 ? '' : 'disabled'}>Adopt</button>`}</div>`;
    }
  }
  const on = INSTITUTIONS.filter(i => s.instOn[i.id]);
  h += `<h3>Institutions</h3>`;
  if (!on.length) h += `<div class="muted">None yet. Christianity arrives c. 432 AD.</div>`;
  for (const i of on) {
    const share = Math.round(Gm.instShare(c, i.id) * 100);
    h += `<div class="row"><div class="grow"><b>${i.name}</b> <span class="muted">${share}% of your people</span><div class="muted">${i.desc}</div></div>${c.inst[i.id] ? '<span class="chip good">embraced</span>' : `<button class="btn sm" data-act="embrace" data-k="${i.id}" ${Gm.canEmbrace(c, i.id) && c.gold >= Gm.embraceCost(c, i.id) ? '' : 'disabled'}>Embrace (${Gm.embraceCost(c, i.id)} 🪙)</button>`}</div>`;
  }
  if (c.subjects.length) {
    h += `<h3>Client kingdoms (${c.subjects.length}/${Gm.subjectLimit(c)})</h3>`;
    for (const k of c.subjects) h += `<div class="row click" data-act="country" data-id="${k}">${dot(s.countries[k])}<div class="grow">${cn(k)}</div><span class="muted">›</span></div>`;
  } else h += `<h3>Client kingdoms</h3><div class="muted">You may hold up to ${Gm.subjectLimit(c)}. Demand hostages from weaker neighbours in Diplomacy.</div>`;
  h += `<h3>The High Kingship</h3><div class="muted">${s.ardRi >= 0 ? `${cn(s.ardRi)} holds the title.` : 'The title is vacant.'} A Gaelic king who holds Tara (directly or through a client) and is a provincial king, or has 3+ clients, may claim it: +1 ✉/month, −1 unrest, more clients, and a Conquest casus belli.</div>`;
  return h;
}
function rulerCard(label, r) {
  return `<div class="ruler"><div class="grow"><div class="muted">${label}</div><b>${esc(r.name)}</b> <span class="muted">age ${Math.floor(r.age)}${r.age < 16 ? ' (regency)' : ''}</span></div>
    <div class="sk"><span title="Rule">⚖<b>${r.adm}</b></span><span title="Diplomacy">✉<b>${r.dip}</b></span><span title="War">⛨<b>${r.mil}</b></span></div></div>`;
}

// ---------- Technology ----------
function tech() {
  const s = S(), c = me();
  const e = eraOf(s.year);
  let h = `<h2>Learning</h2><div class="muted">Spend points to advance. Research ahead of its time costs more, and more than 25 years early angers the old families (stability loss and unrest). You cannot go more than 100 years early, and some advances need an institution first.</div>`;
  h += `<div class="tabs2">${ERAS.map(x => `<button class="${x.id === e.id ? 'on' : ''}" title="${esc(x.desc)}">${x.name} ${x.start}</button>`).join('')}</div>`;
  for (const t of ['adm', 'dip', 'mil']) {
    const st = Gm.techStatus(c, t);
    h += `<div class="tech-col"><div style="display:flex;align-items:baseline;gap:8px"><span class="lvl">${c.tech[t]}</span><b>${TECH_NAMES[t]}</b><span class="muted" style="margin-left:auto">${Math.floor(c[t])} points</span></div>
      <div class="muted">${TECH_INFO[t]}</div>`;
    if (st.max) h += `<div>Fully advanced.</div>`;
    else {
      const aheadTxt = st.ahead > 0 ? `<span class="${st.ahead > 25 ? 'bad' : 'warn'}">${st.ahead} years ahead of its time (+${Math.round(st.ahead / 40 * 100)}% cost${st.ahead > 25 ? ', backlash!' : ''})</span>` : '<span class="good">on time</span>';
      h += `<div style="margin:6px 0">Next: level ${st.lvl} (${st.year} AD) — ${aheadTxt}</div>`;
      const unl = unlocksAt(t, st.lvl);
      if (unl) h += `<div class="muted">Unlocks: ${unl}</div>`;
      if (st.block) h += `<div class="bad">${st.block}</div>`;
      h += `<button class="btn gold" style="margin-top:6px" data-act="research" data-t="${t}" ${!st.block && c[t] >= st.cost ? '' : 'disabled'}>Research (${st.cost})</button>`;
    }
    h += `</div>`;
  }
  return h;
}
function unlocksAt(track, lvl) {
  const u = [];
  if (track === 'mil') { if (lvl === 13) u.push('Galloglass'); if (lvl === 16) u.push('Shot (needs Gunpowder)'); if (lvl === 12) u.push('Knights & castles (with Feudalism)'); if (lvl === 18) u.push('Standing army, star forts'); }
  if (track === 'adm') { if (lvl === 6) u.push('Monasteries'); if (lvl === 10) u.push('Mills'); if (lvl === 14) u.push('Tower houses'); }
  if (track === 'dip') { if (lvl === 2) u.push('Óenach fairs'); if (lvl === 9) u.push('Market towns'); if (lvl === 14) u.push('Town walls'); }
  const g = TECH_GATES[track][lvl]; if (g) u.push(`(requires ${INSTITUTIONS.find(i => i.id === g).name})`);
  return u.join(', ');
}

// ---------- Diplomacy ----------
function relTag(c, o) {
  const s = S(), t = [];
  if (War.isAtWar(c.id, o.id)) t.push('<span class="chip war">war</span>');
  if (c.allies.includes(o.id)) t.push('<span class="chip good">ally</span>');
  if (c.subjects.includes(o.id)) t.push('<span class="chip good">client</span>');
  if (c.overlord === o.id) t.push('<span class="chip">overlord</span>');
  if (o.overlord >= 0 && o.overlord !== c.id) t.push(`<span class="chip">client of ${cn(o.overlord)}</span>`);
  if (c.fostered.includes(o.id)) t.push('<span class="chip">fosterage</span>');
  if (War.truceUntil(c.id, o.id) > s.year) t.push(`<span class="chip">truce ${War.truceUntil(c.id, o.id)}</span>`);
  if (o.outsider) t.push('<span class="chip">foreign</span>');
  return t.join('');
}
function diplo() {
  const s = S(), c = me();
  let h = `<h2>Diplomacy</h2>`;
  const wars = War.warsOf(c.id);
  if (wars.length) {
    h += `<h3>Wars</h3>`;
    for (const w of wars) {
      const side = War.sideOf(w, c.id), sc = War.winnerScore(w, side);
      const lead = w.al === c.id || w.dl === c.id;
      h += `<div class="row"><div class="grow"><b>${esc(w.name)}</b><div class="muted">${War.CB_INFO[w.cb]?.name || w.cb} · ${w.months} months · allies: ${(side === 'att' ? w.att : w.def).map(cn).join(', ')} · enemies: ${(side === 'att' ? w.def : w.att).map(cn).join(', ')}</div>
        <div class="bar"><i style="width:${50 + sc / 2}%;background:${sc >= 0 ? 'var(--good)' : 'var(--bad)'}"></i></div></div>
        <b class="${sc >= 0 ? 'good' : 'bad'}">${sc > 0 ? '+' : ''}${sc}%</b>
        ${lead ? `<button class="btn sm" data-act="peace" data-w="${w.id}">Peace</button>` : `<button class="btn sm" data-act="leavewar" data-w="${w.id}">Leave</button>`}</div>`;
    }
  }
  const neigh = new Set(War.neighbours(c.id));
  h += `<div class="tabs2">${[['all', 'All'], ['near', 'Neighbours'], ['friends', 'Friends'], ['foreign', 'Foreign']].map(([k, n]) => `<button class="${UI.diploTab === k ? 'on' : ''}" data-act="diplotab" data-k="${k}">${n}</button>`).join('')}</div>`;
  let list = s.countries.filter(o => o.alive && o.id !== c.id);
  if (UI.diploTab === 'near') list = list.filter(o => neigh.has(o.id));
  if (UI.diploTab === 'friends') list = list.filter(o => c.allies.includes(o.id) || c.subjects.includes(o.id) || c.fostered.includes(o.id) || o.rel[c.id] > 40);
  if (UI.diploTab === 'foreign') list = list.filter(o => o.outsider);
  list.sort((a, b) => (neigh.has(b.id) - neigh.has(a.id)) || b.provs.length - a.provs.length);
  for (const o of list) {
    const op = Math.round(o.rel[c.id] || 0);
    h += `<div class="row click" data-act="country" data-id="${o.id}">${dot(o)}<div class="grow"><b>${esc(o.name)}</b> <span class="muted">${o.provs.length} terr.</span><div>${relTag(c, o)}</div></div><span class="${op > 0 ? 'good' : op < 0 ? 'bad' : 'muted'}" title="Their opinion of you">${op > 0 ? '+' : ''}${op}</span></div>`;
  }
  return h;
}
function country() {
  const s = S(), c = me(), o = s.countries[UI.country];
  if (!o) return '';
  if (o.id === c.id) return realm();
  const rank = o.outsider ? o.rank : RANKS.find(r => r.id === o.rank)?.name;
  const ratio = Gm.strength(c.id) / Math.max(1, Gm.strength(o.id));
  let h = `<h2>${dot(o)} ${esc(o.name)}</h2><div class="muted">${rank} · ${cultureName(o.culture)} · ${religionName(o.religion)}</div><div>${relTag(c, o)}</div>`;
  if (o.desc) h += `<p class="muted"><i>${esc(o.desc)}</i></p>`;
  h += rulerCard('Ruler', o.ruler);
  h += `<div class="grid">${stat('Opinion of you', Math.round(o.rel[c.id] || 0))}${stat('Territories', o.provs.length)}${stat('Army', fmt(Gm.countryArmyMen(o.id)))}${stat('Your strength', `×${ratio.toFixed(1)}`)}${stat('Technology', `${o.tech.adm}/${o.tech.dip}/${o.tech.mil}`)}${stat('Allies', o.allies.length)}</div>`;
  if (!o.alive) return h;
  h += `<h3>Actions</h3>`;
  const act = (a, label, ok, why = '') => `<div class="row"><div class="grow">${label}${why ? `<div class="muted">${why}</div>` : ''}</div><button class="btn sm" data-act="${a}" data-id="${o.id}" ${ok ? '' : 'disabled'}>Do it</button></div>`;
  const atWar = War.isAtWar(c.id, o.id);
  h += act('improve', `Send envoys (+25 opinion, 15 ✉)`, c.dip >= 15 && !atWar);
  h += act('gift', `Send gifts of cattle (+30 opinion, ${War.DIP.giftCost(c, o)} 🪙)`, c.gold >= War.DIP.giftCost(c, o) && !atWar);
  if (c.allies.includes(o.id)) h += act('breakally', 'Break alliance', true);
  else h += act('ally', 'Propose alliance', !atWar, War.DIP.wouldAlly(o, c) ? '<span class="good">They would accept</span>' : 'Needs opinion ≥ 30, max 3 allies, neither a client');
  if (!c.fostered.includes(o.id)) h += act('foster', 'Exchange foster-sons (+40 opinion both ways, +2 prestige)', War.DIP.wouldFoster(o, c) && c.fostered.length < 4, War.DIP.wouldFoster(o, c) ? '' : 'Needs opinion ≥ 0, at most 4 fosterage ties');
  if (!c.subjects.includes(o.id)) {
    const odds = War.DIP.hostageOdds(c, o);
    h += act('hostages', 'Demand hostages (make them a client kingdom)', War.DIP.canDemandHostages(c, o), War.DIP.canDemandHostages(c, o) ? (odds.ok ? '<span class="good">They are likely to submit</span>' : `They will refuse (you need ×2.5 strength, you have ×${odds.ratio.toFixed(1)}) — but refusal gives you a war goal`) : 'Must border them, they must be independent, Gaelic and without clients; check your client limit');
  } else {
    h += act('annex', `Absorb client (${War.DIP.annexCost(c, o)} ✉)`, War.DIP.canAnnex(c, o) && c.dip >= War.DIP.annexCost(c, o), 'After 10 years as a client and opinion ≥ 50');
    h += act('release', 'Release client', true);
  }
  if (!atWar) {
    const cd = War.canDeclare(c.id, o.id);
    h += `<h3>War</h3>`;
    if (!cd.ok) h += `<div class="muted">${esc(cd.reason)}</div>`;
    else {
      const cbs = [...cd.cbs, 'nocb'];
      for (const cb of cbs) h += `<div class="row"><div class="grow"><b>${War.CB_INFO[cb].name}</b><div class="muted">${War.CB_INFO[cb].desc}</div></div><button class="btn sm danger" data-act="declare" data-id="${o.id}" data-cb="${cb}">Declare</button></div>`;
      if (o.allies.length) h += `<div class="muted">Their allies may join: ${o.allies.map(cn).join(', ')}</div>`;
    }
  }
  return h;
}

// ---------- Military ----------
function military() {
  const s = S(), c = me();
  const mine = s.armies.filter(a => a.owner === c.id);
  let h = `<h2>Military</h2><div class="grid">${stat('Men under arms', fmt(mine.reduce((t, a) => t + Gm.armyMen(a), 0)))}${stat('Manpower', `${fmt(c.manpower)} / ${fmt(c.maxMP)}`)}${stat('Upkeep', c.expense.toFixed(1) + '/mo')}${stat('War tech', c.tech.mil)}</div>`;
  h += `<p class="muted">Tap an army (here or on the map) to select it, then tap a province to march. Raise troops from any province you hold. Winter (Samhain–Feabhra) slows marching and brings attrition; armies larger than the land can feed waste away.</p>`;
  if (UI.army && s.armies.includes(UI.army)) {
    const a = UI.army, here = s.armies.filter(b => b.loc === a.loc && b.owner === c.id && b !== a);
    h += `<h3>Selected army</h3>${armyRow(a)}<div class="btns">
      <button class="btn sm" data-act="split">Split</button>
      <button class="btn sm" data-act="merge" ${here.length ? '' : 'disabled'}>Merge with others here</button>
      <button class="btn sm" data-act="halt" ${a.path.length ? '' : 'disabled'}>Halt</button>
      <button class="btn sm" data-act="disband">Disband</button>
      <button class="btn sm" data-act="deselect">Deselect</button></div>`;
  }
  h += `<h3>Armies</h3>`;
  h += mine.length ? mine.map(armyRow).join('') : '<div class="muted">No armies. Open one of your provinces to raise troops.</div>';
  const enemies = new Set(); for (const w of War.warsOf(c.id)) for (const e of War.sideOf(w, c.id) === 'att' ? w.def : w.att) enemies.add(e);
  if (enemies.size) {
    h += `<h3>Enemy armies</h3>`;
    h += s.armies.filter(a => enemies.has(a.owner)).map(armyRow).join('') || '<div class="muted">None in the field.</div>';
  }
  return h;
}

// ---------- Ledger ----------
function ledger() {
  const s = S();
  const key = UI.ledgerSort;
  const rows = s.countries.filter(c => c.alive).map(c => ({ c, provs: c.provs.length, pop: c.pop, army: Gm.countryArmyMen(c.id), income: c.income, tech: c.tech.adm + c.tech.dip + c.tech.mil }));
  rows.sort((a, b) => b[key] - a[key]);
  const pop = s.provinces.reduce((t, P) => t + P.pop, 0);
  let h = `<h2>Ledger</h2><div class="grid">${stat('Island population', fmt(pop))}${stat('Realms', rows.length)}${stat('Wars', s.wars.length)}${stat('High King', s.ardRi >= 0 ? cn(s.ardRi) : '—')}</div>`;
  h += `<div class="tabs2">${[['provs', 'Land'], ['pop', 'People'], ['army', 'Army'], ['income', 'Income'], ['tech', 'Tech']].map(([k, n]) => `<button class="${key === k ? 'on' : ''}" data-act="ledgersort" data-k="${k}">${n}</button>`).join('')}</div>`;
  for (const r of rows) {
    const v = key === 'income' ? r.income.toFixed(1) : fmt(r[key]);
    h += `<div class="row click" data-act="country" data-id="${r.c.id}">${dot(r.c)}<div class="grow">${r.c.id === s.player ? '<b>' : ''}${esc(r.c.name)}${r.c.id === s.player ? '</b>' : ''}${r.c.overlord >= 0 ? ` <span class="muted">(client of ${cn(r.c.overlord)})</span>` : ''}</div><b>${v}</b></div>`;
  }
  return h;
}

// ---------- Annals ----------
function annals() {
  const s = S();
  let h = `<h2>Annals</h2><div class="tabs2">${[['mine', 'Your realm'], ['all', 'All of Ireland']].map(([k, n]) => `<button class="${UI.logFilter === k ? 'on' : ''}" data-act="logfilter" data-k="${k}">${n}</button>`).join('')}</div>`;
  const list = s.log.filter(e => UI.logFilter === 'all' || e.kind !== 'world').slice().reverse();
  for (const e of list) h += `<div class="log-entry ${e.kind}" ${e.prov !== undefined ? `data-act="goto" data-id="${e.prov}" style="cursor:pointer"` : ''}><span class="d">${e.d}</span>${esc(e.text)}</div>`;
  return h;
}

// ---------- Menu ----------
function menu() {
  const theme = document.documentElement.dataset.theme || 'auto';
  return `<h2>Menu</h2><div class="btns" style="flex-direction:column">
    <button class="btn" data-act="save">Save game</button>
    <button class="btn" data-act="load" ${localStorage.getItem('eire.save') ? '' : 'disabled'}>Load saved game</button>
    <button class="btn" data-act="loadauto" ${localStorage.getItem('eire.auto') ? '' : 'disabled'}>Load autosave</button>
    <button class="btn" data-act="newgame">New game</button>
    <button class="btn" data-act="theme">Panel theme: ${theme}</button>
    <button class="btn" data-act="help">How to play</button></div>
    <p class="muted">Autosaves every Eanáir. Saves stay in this browser.</p>`;
}
export function helpHTML() {
  return `<h2>How to play</h2>
  <p>You rule one Iron Age kingdom of Ireland in 1 AD. Guide it to 1801 — or unite the island.</p>
  <p><b>Time.</b> One tick is one month. Use the speed buttons (space pauses).</p>
  <p><b>Points.</b> Your ruler generates ⚖ Rule, ✉ Diplomacy and ⛨ War points each month. Spend them on Learning (technology), cores, stability, claims and envoys.</p>
  <p><b>Land & people.</b> Every territory has a real terrain. Population grows toward what the land can feed; forests can be cleared; famines and plagues strike. People bring taxes and levies; cattle are wealth.</p>
  <p><b>Kingship.</b> Gaelic kings follow tanistry — name a tanist or face a succession dispute. Large realms risk a rival branch of the royal kin breaking away. Take hostages to make client kingdoms. Hold Tara to claim the High Kingship.</p>
  <p><b>War.</b> Choose a casus belli. Cattle-raids take only cattle and treasure; conquest needs claims (or comes later, with the Normans). Armies fight better on their favoured ground: kern in bog, forest and mountain; horse on open plains. Rivers hurt attackers.</p>
  <p><b>Outsiders.</b> Vikings (from 795), Normans (1169) and the English Crown (1171, returning with each Tudor and Stuart army) arrive from the sea. They exist only through what they hold here.</p>
  <p><b>Progress.</b> Institutions (Christianity, Learning, Coinage, Feudalism, Gunpowder, Print) spread from province to province. Some advances need them. Racing ahead of your time costs extra and angers the filí and the old families.</p>`;
}

// ---------- Modals ----------
export function showModal(html) { $('#modal-card').innerHTML = html; $('#modal').classList.remove('hidden'); }
export function hideModal() { $('#modal').classList.add('hidden'); }
export function modalOpen() { return !$('#modal').classList.contains('hidden'); }

export function showPending() {
  const s = S();
  while (s.pending.length) {
    const p = s.pending[0];
    if (p.kind === 'era') {
      const e = ERAS.find(x => x.id === p.era);
      showModal(`<h2>${e.name}</h2><p>${e.desc}</p><div class="opts"><button class="btn gold" data-act="pendok">Onward</button></div>`); return true;
    }
    if (p.kind === 'wave') {
      showModal(`<h2>Ships on the horizon</h2><p>${esc(p.text)}</p><div class="opts"><button class="btn gold" data-act="pendok" data-goto="${p.prov}">Show me</button></div>`); return true;
    }
    if (p.kind === 'event') {
      const e = EVENTS[p.id], c = me();
      showModal(`<h2>${e.title}</h2><p>${esc(e.text(c))}</p><div class="opts">${e.options.map((o, i) => `<button class="btn ${i ? '' : 'gold'}" data-act="evopt" data-i="${i}">${esc(o.text)}</button>`).join('')}</div>`); return true;
    }
    if (p.kind === 'peace') {
      const w = s.wars.find(x => x.id === p.war);
      if (!w) { s.pending.shift(); continue; }
      const enemy = s.countries[p.side === 'att' ? w.al : w.dl];
      showModal(`<h2>Terms from ${esc(enemy.name)}</h2><p>${esc(enemy.name)} offers peace in <i>${esc(w.name)}</i> if you accept:</p><ul>${termsList(p.terms)}</ul><p class="muted">War score in their favour: ${War.winnerScore(w, p.side)}%</p>
        <div class="opts"><button class="btn gold" data-act="peaceaccept">Accept</button><button class="btn" data-act="pendok">Refuse and fight on</button></div>`); return true;
    }
    if (p.kind === 'hostages') {
      const from = s.countries[p.from];
      if (!from.alive || War.isAtWar(from.id, s.player) || me().overlord >= 0) { s.pending.shift(); continue; }
      showModal(`<h2>A demand for hostages</h2><p>${esc(from.ruler.name)} of ${esc(from.name)} demands hostages from your royal kin — you would become a client kingdom, paying a quarter of your taxes and following their wars.</p>
        <div class="opts"><button class="btn" data-act="hostyes">Give hostages</button><button class="btn gold" data-act="hostno">Refuse (they gain a war goal)</button></div>`); return true;
    }
    s.pending.shift();
  }
  return false;
}
function termsList(t) {
  const li = [];
  if (t.provs?.length) li.push(`<li>Cede ${t.provs.map(pn).join(', ')}</li>`);
  if (t.hostages) li.push('<li>Give hostages (become a client kingdom)</li>');
  if (t.gold) li.push('<li>Pay half your treasury</li>');
  if (t.cattle) li.push('<li>Hand over a quarter of your cattle</li>');
  if (t.free) li.push('<li>Grant independence</li>');
  return li.join('') || '<li>White peace (no terms)</li>';
}
let peaceDraft = null;
function peaceModal(warId) {
  const s = S(), c = me(), w = s.wars.find(x => x.id === warId); if (!w) return;
  const side = War.sideOf(w, c.id), sc = War.winnerScore(w, side);
  const enemyLead = s.countries[side === 'att' ? w.dl : w.al];
  if (!peaceDraft || peaceDraft.war !== warId) peaceDraft = { war: warId, mode: sc >= 0 ? 'demand' : 'offer', provs: [], hostages: false, gold: false, cattle: false, free: false };
  const d = peaceDraft;
  const winnerSide = d.mode === 'demand' ? side : (side === 'att' ? 'def' : 'att');
  const opts = War.peaceOptions(w, winnerSide);
  const terms = { provs: d.provs.filter(x => opts.provs.includes(x)), hostages: d.hostages && opts.hostages, gold: d.gold, cattle: d.cattle, free: d.free && opts.free };
  const cost = War.peaceCost(w, winnerSide, terms);
  const accept = d.mode === 'demand' ? War.aiAcceptsPeace(w, winnerSide, terms) : aiTakesOffer(w, winnerSide, cost);
  let h = `<h2>Peace with ${esc(enemyLead.name)}</h2><div class="muted">${esc(w.name)} · ${War.CB_INFO[w.cb]?.name} · war score ${sc > 0 ? '+' : ''}${sc}% for you</div>`;
  h += `<div class="tabs2"><button class="${d.mode === 'demand' ? 'on' : ''}" data-act="pmode" data-k="demand">Demand</button><button class="${d.mode === 'offer' ? 'on' : ''}" data-act="pmode" data-k="offer">Concede</button></div>`;
  if (opts.provs.length) {
    h += `<h3>${d.mode === 'demand' ? 'Territory you occupy' : 'Your territory they occupy'}</h3>`;
    for (const id of opts.provs) h += `<label class="chk"><input type="checkbox" data-act="pprov" data-id="${id}" ${d.provs.includes(id) ? 'checked' : ''}> ${pn(id)} <span class="muted">(${S().provinces[id].cores.includes(winnerSide === side ? c.id : enemyLead.id) ? 'core' : 'no core'})</span></label>`;
  } else if (w.cb === 'tain') h += `<div class="muted">A cattle raid cannot take land.</div>`;
  h += `<h3>Other terms</h3>`;
  if (opts.hostages) h += `<label class="chk"><input type="checkbox" data-act="pflag" data-k="hostages" ${d.hostages ? 'checked' : ''}> Hostages (client kingdom)</label>`;
  if (opts.free) h += `<label class="chk"><input type="checkbox" data-act="pflag" data-k="free" ${d.free ? 'checked' : ''}> Independence</label>`;
  h += `<label class="chk"><input type="checkbox" data-act="pflag" data-k="gold" ${d.gold ? 'checked' : ''}> Half of the treasury</label>`;
  h += `<label class="chk"><input type="checkbox" data-act="pflag" data-k="cattle" ${d.cattle ? 'checked' : ''}> A quarter of the cattle</label>`;
  h += `<p>Cost: <b>${cost}%</b> · ${accept ? '<span class="good">They will accept</span>' : '<span class="bad">They will refuse</span>'}</p>`;
  h += `<div class="opts"><button class="btn gold" data-act="psend">${d.mode === 'demand' ? 'Send demand' : 'Offer terms'}</button><button class="btn" data-act="pclose">Close</button></div>`;
  showModal(h);
}
function aiTakesOffer(w, winnerSide, cost) {
  const s = War.winnerScore(w, winnerSide);
  return cost === 0 ? s <= 10 : cost >= s * 0.75;
}

// ---------- Actions ----------
const A = {
  tab: d => { if (UI.tab === d.tab) closePanel(); else openPanel(d.tab); },
  close: () => closePanel(),
  country: d => { openPanel('country', +d.id); },
  goto: d => { UI.view.centerOn(+d.id, Math.max(UI.view.zoom, 2.5)); UI.view.setSel(+d.id); openPanel('province', +d.id); },
  build: d => { Gm.build(me(), UI.prov, d.b); ctx.S.provinces[UI.prov].dirty = true; },
  core: () => Gm.makeCore(me(), UI.prov),
  clear: () => Gm.clearForest(me(), UI.prov),
  recruit: d => { const a = Gm.recruit(me(), UI.prov, d.u, +d.n); if (a) toast(`Raised ${d.n * UNIT_SIZE} ${UNITS[d.u].name.split(' (')[0]}.`, 'good'); },
  claim: () => { if (Gm.fabricateClaim(me(), UI.prov)) toast(`Your brehons find a claim on ${M().provinces[UI.prov].name}.`, 'good'); },
  tanist: d => Gm.designateTanist(me(), +d.i),
  stab: () => Gm.raiseStability(me()),
  law: d => Gm.setLaw(me(), d.cat, d.k),
  embrace: d => Gm.embrace(me(), d.k),
  research: d => Gm.researchTech(me(), d.t),
  diplotab: d => { UI.diploTab = d.k; },
  ledgersort: d => { UI.ledgerSort = d.k; },
  logfilter: d => { UI.logFilter = d.k; },
  improve: d => War.DIP.improve(me(), S().countries[d.id]),
  gift: d => War.DIP.gift(me(), S().countries[d.id]),
  ally: d => { const ok = War.DIP.ally(me(), S().countries[d.id]); toast(ok ? 'Alliance sealed.' : 'They decline your alliance.', ok ? 'good' : 'bad'); },
  breakally: d => War.DIP.breakAlliance(me(), S().countries[d.id]),
  foster: d => { const ok = War.DIP.foster(me(), S().countries[d.id]); toast(ok ? 'Foster-sons exchanged.' : 'They decline.', ok ? 'good' : 'bad'); },
  hostages: d => {
    const t = S().countries[d.id], r = War.DIP.demandHostages(me(), t);
    toast(r === 'yes' ? `${t.name} gives hostages and becomes your client.` : r === 'no' ? `${t.name} refuses! You may now go to war to force them.` : 'Not possible.', r === 'yes' ? 'good' : 'bad');
  },
  annex: d => War.DIP.annex(me(), S().countries[d.id]),
  release: d => War.DIP.release(me(), S().countries[d.id]),
  declare: d => { const w = War.declareWar(me().id, +d.id, d.cb); if (w) { Gm.refreshCountry(me()); } },
  peace: d => { peaceDraft = null; peaceModal(+d.w); UI.pause && UI.pause(); },
  leavewar: d => {
    const s = S(), w = s.wars.find(x => x.id === +d.w); if (!w) return;
    w.att = w.att.filter(x => x !== s.player); w.def = w.def.filter(x => x !== s.player);
    me().prestige -= 5; toast('You withdraw from the war.', 'info');
  },
  pmode: d => { peaceDraft.mode = d.k; peaceDraft.provs = []; peaceModal(peaceDraft.war); },
  pprov: (d, el) => { const id = +d.id; peaceDraft.provs = el.checked ? [...peaceDraft.provs, id] : peaceDraft.provs.filter(x => x !== id); peaceModal(peaceDraft.war); },
  pflag: (d, el) => { peaceDraft[d.k] = el.checked; peaceModal(peaceDraft.war); },
  pclose: () => hideModal(),
  psend: () => {
    const s = S(), c = me(), d = peaceDraft, w = s.wars.find(x => x.id === d.war); if (!w) { hideModal(); return; }
    const side = War.sideOf(w, c.id), winnerSide = d.mode === 'demand' ? side : (side === 'att' ? 'def' : 'att');
    const opts = War.peaceOptions(w, winnerSide);
    const terms = { provs: d.provs.filter(x => opts.provs.includes(x)), hostages: d.hostages && opts.hostages, gold: d.gold, cattle: d.cattle, free: d.free && opts.free };
    const cost = War.peaceCost(w, winnerSide, terms);
    const ok = d.mode === 'demand' ? War.aiAcceptsPeace(w, winnerSide, terms) : aiTakesOffer(w, winnerSide, cost);
    hideModal();
    if (ok) { if (cost === 0) War.whitePeace(w); else War.applyPeace(w, winnerSide, terms); }
    else { toast('Your terms are refused.', 'bad'); const e = s.countries[side === 'att' ? w.dl : w.al]; e.rel[c.id] -= 5; }
  },
  selarmy: d => { const a = S().armies.find(x => x.id === +d.id); selectArmy(UI.army === a ? null : a); },
  deselect: () => selectArmy(null),
  split: () => { const b = War.splitArmy(UI.army); if (!b) toast('Too small to split.', 'bad'); },
  merge: () => { const s = S(); const list = s.armies.filter(b => b.loc === UI.army.loc && b.owner === s.player); UI.army = War.mergeArmies([UI.army, ...list.filter(b => b !== UI.army)]); },
  halt: () => { UI.army.path = []; },
  disband: () => { const a = UI.army; War.disband(a); me().manpower += Gm.armyMen(a) * 0.5; selectArmy(null); },
  pendok: d => { S().pending.shift(); hideModal(); if (d.goto) A.goto({ id: d.goto }); afterModal(); },
  evopt: d => { const p = S().pending.shift(); resolveEvent(p.id, +d.i); hideModal(); afterModal(); },
  peaceaccept: () => { const p = S().pending.shift(); const w = S().wars.find(x => x.id === p.war); if (w) War.applyPeace(w, p.side, p.terms); hideModal(); afterModal(); },
  hostyes: () => { const p = S().pending.shift(); War.makeSubject(S().countries[p.from], me()); log(`You give hostages to ${cn(p.from)}.`, 'bad'); hideModal(); afterModal(); },
  hostno: () => { const p = S().pending.shift(); const f = S().countries[p.from]; f.hostCB = f.hostCB || {}; f.hostCB[S().player] = S().year + 5; f.rel[S().player] -= 30; hideModal(); afterModal(); },
  help: () => showModal(helpHTML() + `<div class="opts"><button class="btn gold" data-act="pclose">Close</button></div>`),
  theme: () => {
    const cur = document.documentElement.dataset.theme || 'auto';
    const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
    if (next === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = next;
    try { localStorage.setItem('eire.theme', next); } catch {}
  },
};
function afterModal() { if (!showPending() && UI.resume) UI.resume(); }
export function selectArmy(a) {
  UI.army = a; if (UI.view) { UI.view.selArmy = a; UI.view.needs = true; }
  if (a) { openPanel('military'); }
}
export function registerActions(extra) { Object.assign(A, extra); }

export function bindUI() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const f = A[el.dataset.act]; if (!f) return;
    if (el.tagName === 'INPUT') return; // handled on change
    e.preventDefault();
    f(el.dataset, el);
    refreshAll();
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('input[data-act]'); if (!el) return;
    A[el.dataset.act]?.(el.dataset, el);
  });
}
export function refreshAll() {
  if (!S()) return;
  Gm.refreshCountry(me());
  renderHUD(); renderPanel();
  if (UI.view) { UI.view.repaintDirty(); UI.view.needs = true; }
}

// ---------- Toasts ----------
export function toast(text, kind = 'info') {
  const box = $('#toasts'); const el = document.createElement('div');
  el.className = `toast ${kind}`; el.textContent = text; box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), 5200);
}
