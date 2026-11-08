// Boot, start screen, game loop, input and saving.
import { ctx } from './ctx.js';
import { generateMap } from './mapgen.js';
import { POLITIES } from './data.js';
import { createGame, tick, refreshCountry } from './game.js';
import { orderMove, findPath } from './war.js';
import { MapView } from './render.js';
import {
  UI, bindUI, openPanel, closePanel, renderHUD, renderPanel, refreshAll, toast, showPending, modalOpen, showModal, hideModal,
  selectArmy, registerActions, helpHTML,
} from './ui.js';

const $ = s => document.querySelector(s);
const SPEEDS = [0, 1000, 500, 220, 90, 25];
let speed = 0, lastSpeed = 2, timer = null, view, M, startSel = null;
const MAP_SEED = 1171;

try { const th = localStorage.getItem('eire.theme'); if (th && th !== 'auto') document.documentElement.dataset.theme = th; } catch {}

async function boot() {
  await new Promise(r => setTimeout(r, 30));
  M = generateMap(MAP_SEED);
  ctx.M = M;
  view = new MapView($('#map'));
  UI.view = view;
  view.setMap(M);
  bindUI();
  bindInput();
  registerActions({
    save: () => { save('eire.save'); toast('Game saved.', 'good'); },
    load: () => load('eire.save'),
    loadauto: () => load('eire.auto'),
    newgame: () => { if (confirm('Abandon this game and start again?')) location.reload(); },
  });
  UI.pause = () => setSpeed(0);
  UI.resume = () => {};
  ctx.listeners.push(e => {
    if (['good', 'bad', 'war', 'warn', 'ruler'].includes(e.kind)) toast(e.text, e.kind);
  });
  // preview game for the start screen (world state only, not yet played)
  createGame(M, POLITIES[0].tag, (Math.random() * 1e9) | 0);
  view.highlight = null;
  view.computeLabels(); view.repaintAll();
  startScreen();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

function startScreen() {
  const S = ctx.S;
  const hasSave = (() => { try { return !!(localStorage.getItem('eire.save') || localStorage.getItem('eire.auto')); } catch { return false; } })();
  const list = S.countries.slice().sort((a, b) => a.name.localeCompare(b.name));
  const body = $('#start-body');
  const sel = startSel ?? S.countries.find(c => c.tag === 'MID').id;
  startSel = sel;
  const c = S.countries[sel];
  view.highlight = new Set([sel]); view.repaintAll();
  if (!startScreen.fitted) { startScreen.fitted = true; view.fit(); }
  body.innerHTML = `
    ${hasSave ? `<div class="btns"><button class="btn gold" id="cont">Continue saved game</button></div>` : ''}
    <p class="muted">Choose a kingdom — tap one on the map or in the list.</p>
    <div class="ruler" style="display:block"><b style="font-family:Cinzel,serif">${c.name}</b> <span class="muted">· ${c.provs.length} territories · ${Math.round(c.pop / 1000)}k people</span><div class="muted"><i>${c.desc}</i></div></div>
    <div class="pol-list">${list.map(o => `<div class="row click ${o.id === sel ? 'on' : ''}" data-pick="${o.id}"><span class="dot" style="background:${o.color}"></span><div class="grow">${o.name}</div><span class="muted">${o.provs.length}</span></div>`).join('')}</div>
    <div class="btns"><button class="btn gold" id="go">Rule ${c.name}</button><button class="btn" id="how">How to play</button></div>
    <p class="muted" style="font-size:12px">Territories are parish-scale divisions grown from real historic sites over real terrain. The map is the same every game; history is not.</p>`;
  body.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => { startSel = +el.dataset.pick; startScreen(); });
  const on = body.querySelector('.row.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  $('#go').onclick = () => begin(c.tag);
  $('#how').onclick = () => showModal(helpHTML() + `<div class="opts"><button class="btn gold" data-act="pclose">Close</button></div>`);
  if (hasSave) $('#cont').onclick = () => load(localStorage.getItem('eire.save') ? 'eire.save' : 'eire.auto');
}

function begin(tag) {
  createGame(M, tag, (Math.random() * 1e9) | 0);
  enterGame();
  openPanel('realm');
  showModal(`<h2>${ctx.S.countries[ctx.S.player].name}, 1 AD</h2><p>The island is a patchwork of túatha under petty kings. You rule from <b>${M.provinces[ctx.S.countries[ctx.S.player].capital].name}</b>.</p>
    <p class="muted">Tip: name a tanist in the Realm panel, build a ringfort, and look to your neighbours. Press a speed button to let time run.</p>
    <div class="opts"><button class="btn gold" data-act="pclose">Begin</button></div>`);
}
function enterGame() {
  const S = ctx.S;
  $('#start').classList.add('hidden');
  ['#hud', '#tabs', '#mapmodes'].forEach(s => $(s).classList.remove('hidden'));
  view.highlight = null; view.sel = -1; UI.army = null; view.selArmy = null;
  view.computeLabels(); view.repaintAll();
  const cap = S.countries[S.player].capital;
  view.centerOn(cap, Math.max(1.6, view.zoom * 1.8));
  buildMapModes();
  setSpeed(0);
  refreshAll();
}

function buildMapModes() {
  const modes = [['political', 'Realms'], ['terrain', 'Terrain'], ['diplomacy', 'Relations'], ['population', 'People'], ['wealth', 'Wealth'], ['unrest', 'Unrest'], ['culture', 'Culture'], ['religion', 'Faith'], ['institution', 'Institution']];
  const box = $('#mapmodes');
  box.innerHTML = modes.map(([k, n]) => `<button data-mode="${k}" class="${view.mode === k ? 'on' : ''}">${n}</button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (b.dataset.mode === 'institution') {
      const on = Object.keys(ctx.S.instOn).filter(k => ctx.S.instOn[k]);
      if (!on.length) { toast('No institutions have appeared yet.'); return; }
      const i = on.indexOf(view.inst); view.inst = view.mode === 'institution' ? on[(i + 1) % on.length] : (on.includes(view.inst) ? view.inst : on[0]);
      toast(`Showing spread of: ${view.inst.replace('_', ' ')}`);
    }
    view.setMode(b.dataset.mode); buildMapModes();
  });
}

// ---------- game loop ----------
function setSpeed(s) {
  speed = s; if (s > 0) lastSpeed = s;
  clearInterval(timer); timer = null;
  if (s > 0) timer = setInterval(step, SPEEDS[s]);
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === s));
}
let lastPanel = 0, lastFull = 0;
function step() {
  const S = ctx.S;
  if (modalOpen()) return;
  tick();
  if (S.month === 0) save('eire.auto');
  const now = performance.now();
  if (view.mode === 'political' || view.mode === 'terrain' || view.mode === 'diplomacy' || view.mode === 'culture' || view.mode === 'religion') view.repaintDirty();
  else if (now - lastFull > 600) { view.repaintAll(); lastFull = now; }
  if (S.month % 6 === 0 || S.provinces.some(P => P.dirty)) view.computeLabels();
  if (UI.army && !S.armies.includes(UI.army)) selectArmy(null);
  renderHUD();
  if (now - lastPanel > 300) { renderPanel(); lastPanel = now; }
  view.needs = true;
  if (S.over) { setSpeed(0); gameOver(); return; }
  if (S.pending.length && showPending()) { setSpeed(0); UI.resume = () => setSpeed(lastSpeed); }
}
function gameOver() {
  const S = ctx.S, o = S.over;
  const title = o.kind === 'victory' ? 'Victory!' : o.kind === 'defeat' ? 'Your line is ended' : 'The end of an age';
  showModal(`<h2>${title}</h2><p>${o.text}</p><div class="opts">
    ${o.kind !== 'end' ? `<button class="btn" id="keep">${o.kind === 'defeat' ? 'Watch history unfold' : 'Keep playing'}</button>` : ''}
    <button class="btn gold" id="again">New game</button></div>`);
  $('#again').onclick = () => location.reload();
  const k = $('#keep'); if (k) k.onclick = () => { S.over = null; S.flags.won = S.flags.won || o.kind === 'victory'; hideModal(); };
}
function frame() {
  if (view.needs) { view.needs = false; view.draw(); }
  requestAnimationFrame(frame);
}

// ---------- input ----------
function bindInput() {
  const cv = $('#map');
  const pts = new Map(); let downAt = null, moved = 0, pinch0 = null;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; }
  });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) { view.panX += dx; view.panY += dy; moved += Math.abs(dx) + Math.abs(dy); view.needs = true; }
    else if (pts.size === 2 && pinch0) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      zoomAt(cx, cy, pinch0.z * d / pinch0.d / view.zoom);
      view.panX += cx - pinch0.cx; view.panY += cy - pinch0.cy; pinch0.cx = cx; pinch0.cy = cy; moved = 999;
    }
  });
  const end = e => {
    const was = pts.size; pts.delete(e.pointerId);
    if (pts.size < 2) pinch0 = null;
    if (was === 1 && moved < 8 && downAt) tap(e.clientX - cv.getBoundingClientRect().left, e.clientY - cv.getBoundingClientRect().top);
    if (pts.size === 0) downAt = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch0 = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  window.addEventListener('resize', () => { if ($('#hud').classList.contains('hidden')) view.fit(); view.needs = true; });
  window.addEventListener('load', () => { if ($('#hud').classList.contains('hidden')) view.fit(); });
  document.querySelectorAll('#speed button').forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));
  window.addEventListener('keydown', e => {
    if (!ctx.S || $('#hud').classList.contains('hidden')) return;
    if (e.code === 'Space') { e.preventDefault(); setSpeed(speed ? 0 : lastSpeed); }
    else if (/^Digit[1-5]$/.test(e.code)) setSpeed(+e.code.slice(5));
    else if (e.code === 'Escape') { if (UI.army) selectArmy(null); else closePanel(); }
  });
}
function zoomAt(x, y, f) {
  const nz = Math.max(0.4, Math.min(12, view.zoom * f)); f = nz / view.zoom;
  view.panX = x - (x - view.panX) * f; view.panY = y - (y - view.panY) * f; view.zoom = nz; view.needs = true;
}
function tap(x, y) {
  const S = ctx.S;
  const inGame = !$('#hud').classList.contains('hidden');
  const id = view.pick(x, y);
  if (!inGame) { if (id >= 0 && S.provinces[id].owner >= 0) { startSel = S.provinces[id].owner; startScreen(); } return; }
  const a = view.pickArmy(x, y);
  if (a && a.owner === S.player) { selectArmy(UI.army === a ? null : a); refreshAll(); return; }
  if (UI.army && id >= 0 && id !== UI.army.loc) {
    if (UI.army.retreat) { toast('That army is retreating.', 'bad'); return; }
    if (orderMove(UI.army, id)) {
      toast(`Marching to ${M.provinces[id].name} (${UI.army.path.length} step${UI.army.path.length > 1 ? 's' : ''}).`);
    } else toast('No route — you need military access, or to be at war, to cross their land.', 'bad');
    view.needs = true; renderPanel(); return;
  }
  if (id < 0) { closePanel(); return; }
  view.setSel(id);
  openPanel('province', id);
}

// ---------- saving ----------
function save(key) {
  try { ctx.S.rngS = ctx.rng.s; localStorage.setItem(key, JSON.stringify(ctx.S)); } catch (e) { console.warn('save failed', e); }
}
function load(key) {
  try {
    const raw = localStorage.getItem(key); if (!raw) return toast('No saved game.', 'bad');
    const S = JSON.parse(raw);
    ctx.S = S; ctx.rng.s = S.rngS || 1;
    for (const c of S.countries) refreshCountry(c);
    hideModal(); closePanel(); enterGame();
    toast(`Loaded ${S.countries[S.player].name}, ${S.year} AD.`, 'good');
  } catch (e) { console.error(e); toast('Could not load the save.', 'bad'); }
}

boot();
