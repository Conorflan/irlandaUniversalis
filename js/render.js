// Canvas map: raster provinces at 2× with crisp borders, plus vector overlays.
import { ctx as G } from './ctx.js';
import { TERRAIN, INSTITUTIONS } from './data.js';
import { PT_NAMES, PT } from './mapgen.js';
import { armyMen, terrainOf, unrestOf, provTax, fortLevel } from './game.js';
import { isAtWar } from './war.js';
import { fbm } from './rng.js';

const SC = 2;
const colorCache = new Map();
const cvs = typeof document !== 'undefined' ? document.createElement('canvas') : null;
export function rgb(css) {
  if (colorCache.has(css)) return colorCache.get(css);
  const c = cvs.getContext('2d'); c.fillStyle = '#000'; c.fillStyle = css; c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data; const v = [d[0], d[1], d[2]];
  colorCache.set(css, v); return v;
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const heat = t => { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? lerp([242, 236, 200], [222, 160, 60], t * 2) : lerp([222, 160, 60], [150, 30, 30], (t - 0.5) * 2); };
const TERR_RGB = Object.fromEntries(Object.entries(TERRAIN).map(([k, v]) => [k, null]));

export class MapView {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.M = null; this.mode = 'political'; this.inst = 'christianity';
    this.zoom = 1; this.panX = 0; this.panY = 0; this.sel = -1; this.selArmy = null; this.hover = -1;
    this.highlight = null; // set of country ids to highlight (start screen)
    this.needs = true;
  }
  setMap(M) {
    this.M = M;
    const { W, H } = M;
    this.off = document.createElement('canvas'); this.off.width = W * SC; this.off.height = H * SC;
    this.octx = this.off.getContext('2d');
    this.img = this.octx.createImageData(W * SC, H * SC);
    this.shade = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i / W) | 0;
      this.shade[i] = 0.9 + 0.12 * fbm(x / 14, y / 14, 99);
    }
    this.coast = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (M.pid[i] < 0) continue;
      if (M.pid[i - 1] === -1 || M.pid[i + 1] === -1 || M.pid[i - W] === -1 || M.pid[i + W] === -1) this.coast[i] = 1;
    }
    for (const k in TERR_RGB) TERR_RGB[k] = rgb(TERRAIN[k].color);
    this.fit();
  }
  fit() {
    const r = this.canvas.getBoundingClientRect();
    // leave room for the start card on wide screens
    const card = document.querySelector('#start:not(.hidden) .start-card');
    const side = card && r.width > 760 ? card.getBoundingClientRect().width : 0;
    const bottom = card && r.width <= 760 ? card.getBoundingClientRect().height : 0;
    const w = r.width - side, h = r.height - bottom;
    const z = Math.min(w / this.M.W, h / this.M.H) * 0.94;
    this.zoom = z; this.panX = (w - this.M.W * z) / 2; this.panY = (h - this.M.H * z) / 2;
    this.needs = true;
  }
  centerOn(id, zoom) {
    const p = this.M.provinces[id], r = this.canvas.getBoundingClientRect();
    if (zoom) this.zoom = zoom;
    this.panX = r.width / 2 - p.sx * this.zoom; this.panY = r.height / 2.4 - p.sy * this.zoom; this.needs = true;
  }
  // per-province colour for the current mode
  provColor(id) {
    const S = G.S, P = S.provinces[id];
    const owner = S.countries[P.owner];
    switch (this.mode) {
      case 'terrain': return null;
      case 'population': {
        const p = this.M.provinces[id]; return heat(Math.sqrt(P.pop / p.areaKm / 40));
      }
      case 'unrest': return P.owner < 0 ? [200, 200, 200] : heat(unrestOf(id) / 10);
      case 'wealth': return heat(provTax(id) / 1.2);
      case 'institution': return lerp([225, 215, 190], [60, 120, 170], P.inst[this.inst] / 100);
      case 'culture': return rgb({ gaelic: '#4f9a5a', norse: '#3b4a7a', norman: '#b0a8c8', english: '#c84a3a' }[P.culture]);
      case 'religion': return rgb({ pagan: '#8a6a3a', christian: '#e0d8b0', protestant: '#5a6ab0' }[P.religion]);
      case 'diplomacy': {
        const pl = S.player; if (P.owner === pl) return [90, 160, 90];
        const me = S.countries[pl];
        if (!owner) return [200, 200, 200];
        if (isAtWar(pl, P.owner)) return [190, 60, 50];
        if (me.subjects.includes(P.owner)) return [140, 200, 120];
        if (me.allies.includes(P.owner)) return [90, 140, 200];
        if (me.overlord === P.owner) return [200, 170, 80];
        const r = owner.rel[pl] || 0;
        return r > 50 ? [170, 200, 220] : r < -50 ? [220, 160, 140] : [215, 210, 195];
      }
      default: {
        if (!owner) return [180, 180, 170];
        let c = rgb(owner.color);
        if (this.highlight && !this.highlight.has(P.owner)) c = lerp(c, [200, 196, 180], 0.65);
        return c;
      }
    }
  }
  repaintAll() {
    const n = this.M.provinces.length;
    this.pc = new Array(n); this.ctrlC = new Array(n);
    for (let i = 0; i < n; i++) this.computeProv(i);
    const { W, H, pid } = this.M;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.paintPixel(x, y, y * W + x);
    for (const P of G.S.provinces) P.dirty = false;
    this.octx.putImageData(this.img, 0, 0);
    this.needs = true;
  }
  computeProv(i) {
    const S = G.S, P = S.provinces[i];
    this.pc[i] = this.provColor(i);
    this.ctrlC[i] = this.mode === 'political' && P.controller !== P.owner && S.countries[P.controller] ? rgb(S.countries[P.controller].color) : null;
  }
  repaintDirty() {
    const S = G.S, M = this.M, set = new Set();
    for (const P of S.provinces) if (P.dirty) { set.add(P.id); for (const e of M.provinces[P.id].adj) set.add(e.to); P.dirty = false; }
    if (!set.size) return;
    if (set.size > 60) { this.repaintAll(); return; }
    for (const id of set) this.computeProv(id);
    const { W } = M;
    for (const id of set) {
      for (let k = M.pixStart[id]; k < M.pixStart[id + 1]; k++) { const i = M.pix[k]; this.paintPixel(i % W, (i / W) | 0, i); }
    }
    this.octx.putImageData(this.img, 0, 0);
    this.needs = true;
  }
  paintPixel(x, y, i) {
    const M = this.M, { W, H, pid, terr, riv, ft } = M, d = this.img.data, S = G.S;
    const id = pid[i];
    const IW = W * SC;
    if (id < 0) {
      const col = id === -2 ? [92, 120, 134] : null;
      for (let sy = 0; sy < SC; sy++) for (let sx = 0; sx < SC; sx++) {
        const o = ((y * SC + sy) * IW + x * SC + sx) * 4;
        if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; } else d[o + 3] = 0;
      }
      return;
    }
    const P = S.provinces[id];
    let base = this.pc[id];
    const t = terr[i];
    let tname = PT_NAMES[t];
    if (t === PT.forest && ft[i] / 255 >= P.forest) tname = M.provinces[id].baseTerrain;
    if (!base) base = TERR_RGB[tname] || [170, 200, 120];
    let sh = this.shade[i];
    if (this.mode !== 'terrain') {
      if (tname === 'mountain') sh *= 0.86; else if (tname === 'forest') sh *= 0.93; else if (tname === 'bog') sh *= 0.95; else if (tname === 'hills') sh *= 0.95;
    }
    let r = base[0] * sh, g = base[1] * sh, b = base[2] * sh;
    if (riv[i]) { r = r * 0.35 + 50; g = g * 0.35 + 95; b = b * 0.35 + 150; }
    if (this.coast[i]) { r *= 0.8; g *= 0.8; b *= 0.8; }
    if (id === this.sel) { r = r * 0.6 + 100; g = g * 0.6 + 100; b = b * 0.6 + 90; }
    const owner = P.owner, ctrl = this.ctrlC[id];
    for (let sy = 0; sy < SC; sy++) for (let sx = 0; sx < SC; sx++) {
      const X = x * SC + sx, Y = y * SC + sy, o = (Y * IW + X) * 4;
      let R = r, Gc = g, B = b;
      if (ctrl && ((X + Y) >> 3) & 1) { R = ctrl[0] * sh; Gc = ctrl[1] * sh; B = ctrl[2] * sh; }
      // borders: thin province borders, thicker realm borders
      let border = 0;
      const chk = (nx, ny, realmOnly) => {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
        const q = pid[ny * W + nx]; if (q === id || q < 0) return;
        const v = S.provinces[q].owner !== owner ? 2 : 1;
        if (realmOnly && v < 2) return;
        if (v > border) border = v;
      };
      if (sx === SC - 1) chk(x + 1, y, false);
      if (sy === SC - 1) chk(x, y + 1, false);
      if (sx === 0) chk(x - 1, y, true);
      if (sy === 0) chk(x, y - 1, true);
      if (border === 1) { R *= 0.72; Gc *= 0.72; B *= 0.72; }
      else if (border === 2) { R = R * 0.25 + 10; Gc = Gc * 0.25 + 8; B = B * 0.25 + 6; }
      d[o] = R; d[o + 1] = Gc; d[o + 2] = B; d[o + 3] = 255;
    }
  }
  setMode(m) { this.mode = m; this.repaintAll(); }
  setSel(id) {
    const old = this.sel; this.sel = id;
    if (!G.S) return;
    if (old >= 0) G.S.provinces[old].dirty = true;
    if (id >= 0) G.S.provinces[id].dirty = true;
    this.repaintDirty();
  }
  toBase(sx, sy) { return [(sx - this.panX) / this.zoom, (sy - this.panY) / this.zoom]; }
  pick(sx, sy) {
    const [x, y] = this.toBase(sx, sy), { W, H, pid } = this.M;
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return -1;
    const v = pid[yi * W + xi]; return v >= 0 ? v : -1;
  }
  pickArmy(sx, sy) {
    if (!this.armyRects) return null;
    for (let k = this.armyRects.length - 1; k >= 0; k--) {
      const r = this.armyRects[k];
      if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return r.a;
    }
    return null;
  }
  computeLabels() {
    const S = G.S, M = this.M;
    const acc = new Map();
    for (const P of S.provinces) {
      if (P.owner < 0) continue;
      const p = M.provinces[P.id];
      let a = acc.get(P.owner); if (!a) { a = { x: 0, y: 0, n: 0, minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9 }; acc.set(P.owner, a); }
      a.x += p.x * p.area; a.y += p.y * p.area; a.n += p.area;
      a.minx = Math.min(a.minx, p.x); a.maxx = Math.max(a.maxx, p.x); a.miny = Math.min(a.miny, p.y); a.maxy = Math.max(a.maxy, p.y);
    }
    this.labels = [...acc].map(([cid, a]) => {
      const c = S.countries[cid]; const cx = a.x / a.n, cy = a.y / a.n;
      // nudge label onto own land
      let best = -1, bd = 1e9;
      for (const P of S.provinces) if (P.owner === cid) { const p = M.provinces[P.id]; const dd = Math.hypot(p.x - cx, p.y - cy); if (dd < bd) { bd = dd; best = P.id; } }
      const p = M.provinces[best];
      const lx = bd < 25 ? cx : p.x, ly = bd < 25 ? cy : p.y;
      const size = Math.max(7, Math.min(34, Math.sqrt(a.n) / 5.5));
      return { cid, x: lx, y: ly, size, name: c.name.replace(/\s*\(.*\)/, '') };
    });
  }
  draw() {
    const S = G.S, M = this.M, c = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    if (this.canvas.width !== Math.round(r.width * dpr) || this.canvas.height !== Math.round(r.height * dpr)) {
      this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grd = c.createLinearGradient(0, 0, r.width, r.height);
    grd.addColorStop(0, '#33454e'); grd.addColorStop(1, '#253740');
    c.fillStyle = grd; c.fillRect(0, 0, r.width, r.height);
    if (!M || !S) return;
    const z = this.zoom;
    c.setTransform(dpr * z, 0, 0, dpr * z, dpr * this.panX, dpr * this.panY);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(this.off, 0, 0, M.W, M.H);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tx = x => x * z + this.panX, ty = y => y * z + this.panY;
    // province names when zoomed in
    if (z > 2.4) {
      c.font = `500 ${Math.min(12.5, 4 + z * 1.5)}px "IBM Plex Sans Condensed", system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const p of M.provinces) {
        const X = tx(p.x), Y = ty(p.y); if (X < -50 || Y < -20 || X > r.width + 50 || Y > r.height + 20) continue;
        const nm = p.name.replace(/\s*\(.*\)/, '');
        c.lineWidth = 3; c.strokeStyle = 'rgba(245,242,234,0.7)'; c.strokeText(nm, X, Y + 10);
        c.fillStyle = '#1d1c1a'; c.fillText(nm, X, Y + 10);
      }
    }
    // realm names
    if (this.mode === 'political' && this.labels && z < 4.5) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const L of this.labels) {
        const fs = L.size * Math.sqrt(z) * 0.9; if (fs < 8) continue;
        c.font = `600 ${fs}px "IBM Plex Serif", Georgia, serif`;
        if ('letterSpacing' in c) c.letterSpacing = `${(fs * 0.12).toFixed(1)}px`;
        const label = L.name.toUpperCase();
        c.lineWidth = Math.max(2, fs / 4.5); c.strokeStyle = 'rgba(23,25,27,0.5)'; c.lineJoin = 'round';
        c.strokeText(label, tx(L.x), ty(L.y));
        c.fillStyle = 'rgba(248,246,240,0.96)'; c.fillText(label, tx(L.x), ty(L.y));
        if ('letterSpacing' in c) c.letterSpacing = '0px';
      }
    }
    // sites
    if (z > 1.3) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const p of M.provinces) {
        if (!p.special || p.special === 'port' || p.special === 'ford') continue;
        const X = tx(p.sx), Y = ty(p.sy);
        const r0 = 3 + z * 0.6;
        c.lineWidth = 1.5; c.strokeStyle = '#17191b';
        if (p.special === 'church') {
          // ringed cross
          c.fillStyle = '#f3f0e9';
          c.fillRect(X - r0 * 0.28, Y - r0 * 1.2, r0 * 0.56, r0 * 2.4); c.fillRect(X - r0, Y - r0 * 0.45, r0 * 2, r0 * 0.56);
          c.strokeRect(X - r0 * 0.28, Y - r0 * 1.2, r0 * 0.56, r0 * 2.4);
          c.beginPath(); c.arc(X, Y - r0 * 0.17, r0 * 0.62, 0, Math.PI * 2); c.stroke();
        } else {
          // royal site: diamond, Tara larger and red
          const rr = p.special === 'tara' ? r0 * 1.5 : r0;
          c.fillStyle = p.special === 'tara' ? '#a3321f' : '#f3f0e9';
          c.beginPath(); c.moveTo(X, Y - rr); c.lineTo(X + rr * 0.75, Y); c.lineTo(X, Y + rr); c.lineTo(X - rr * 0.75, Y); c.closePath(); c.fill(); c.stroke();
        }
      }
    }
    // capitals
    for (const co of S.countries) if (co.alive && co.capital >= 0) {
      const p = M.provinces[co.capital], X = tx(p.sx) + 7, Y = ty(p.sy) - 7;
      c.fillStyle = co.id === S.player ? '#a3321f' : '#f3f0e9'; c.strokeStyle = '#17191b'; c.lineWidth = 1.2;
      c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 2.2 : 5; c.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke();
    }
    // sieges
    for (const P of S.provinces) if (P.siege) {
      const p = M.provinces[P.id], X = tx(p.sx), Y = ty(p.sy) + 14;
      c.strokeStyle = '#1a120a'; c.lineWidth = 4; c.beginPath(); c.arc(X, Y, 6, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#f3f0e9'; c.lineWidth = 2.5; c.beginPath();
      const pr = fortLevel(P.id) === 0 ? 0.5 : Math.min(1, P.siege.months / 10);
      c.arc(X, Y, 6, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); c.stroke();
    }
    // armies
    this.armyRects = [];
    const stacks = new Map();
    for (const a of S.armies) { const k = a.loc; if (!stacks.has(k)) stacks.set(k, []); stacks.get(k).push(a); }
    c.font = '600 11px "IBM Plex Sans Condensed", system-ui, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
    for (const [loc, list] of stacks) {
      const p = M.provinces[loc];
      const battle = list.some(a => list.some(b => isAtWar(a.owner, b.owner)));
      list.forEach((a, k) => {
        const men = armyMen(a);
        const txt = men >= 1000 ? (men / 1000).toFixed(1) + 'k' : Math.round(men).toString();
        const w = c.measureText(txt).width + 18, h = 17;
        const X = tx(p.sx) - w / 2, Y = ty(p.sy) - 8 - k * (h + 2) - 14;
        const co = S.countries[a.owner];
        const mine = a.owner === S.player;
        if (mine && a.path.length && this.selArmy === a) {
          c.strokeStyle = '#a3321f'; c.lineWidth = 2.5; c.setLineDash([6, 4]); c.beginPath();
          c.moveTo(tx(p.sx), ty(p.sy));
          for (const s of a.path) { const q = M.provinces[s]; c.lineTo(tx(q.sx), ty(q.sy)); }
          c.stroke(); c.setLineDash([]);
        }
        c.fillStyle = this.selArmy === a ? '#a3321f' : '#17191b'; c.fillRect(X - 1.5, Y - 1.5, w + 3, h + 3);
        c.fillStyle = co.color; c.fillRect(X, Y, 9, h);
        c.fillStyle = mine ? '#f3f0e9' : '#d9d4c8';
        c.fillRect(X + 9, Y, w - 9, h);
        // morale bar
        const mm = a.morale / Math.max(0.01, (a.troops && 3));
        c.fillStyle = '#2e6a3c'; c.fillRect(X + 9, Y + h - 2, Math.max(0, Math.min(1, a.morale / 3)) * (w - 9), 2);
        c.fillStyle = '#1d1c1a'; c.fillText(txt, X + 9 + (w - 9) / 2, Y + h / 2 - 1);
        if (a.retreat) { c.fillStyle = '#a3321f'; c.fillRect(X - 5, Y, 3, h); }
        this.armyRects.push({ x: X, y: Y, w, h, a });
      });
      if (battle) {
        // crossed blades
        const bx = tx(p.sx), by = ty(p.sy) + 2, k2 = 7;
        c.lineCap = 'round';
        c.strokeStyle = '#17191b'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(bx - k2, by - k2); c.lineTo(bx + k2, by + k2); c.moveTo(bx + k2, by - k2); c.lineTo(bx - k2, by + k2); c.stroke();
        c.strokeStyle = '#e8573f'; c.lineWidth = 2.5; c.stroke();
        c.lineCap = 'butt';
      }
    }
  }
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
