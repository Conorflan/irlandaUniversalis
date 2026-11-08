// Builds the campaign map: land raster, terrain, rivers and parish-scale
// territories grown outward from historic sites. Deterministic for a seed.
import { W, H, KM_PER_PX, project, COAST, LAKES, RIVERS, TERRAIN_BLOBS, PLACES, NAME_PARTS } from './geo.js';
import { RNG, fbm } from './rng.js';

export const PT_NAMES = ['sea', 'lake', 'plains', 'pasture', 'forest', 'bog', 'drumlin', 'hills', 'mountain', 'karst'];
export const PT = Object.fromEntries(PT_NAMES.map((n, i) => [n, i]));
const PRIORITY = { pasture: 0, plains: 1, drumlin: 2, forest: 3, hills: 4, bog: 5, karst: 6, mountain: 7 };
// Average spacing (km) between parish seats by terrain: dense lowlands, sparse uplands.
const SPACING = { plains: 15, pasture: 16.5, drumlin: 15.5, forest: 18, hills: 20, bog: 22, mountain: 25, karst: 19 };
const STEP_COST = [0, 0, 10, 10, 13, 17, 12, 15, 26, 13];
const RIVER_COST = 120;

function fillPoly(buf, pts, val) {
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > yc) !== (yj > yc)) xs.push(xi + (yc - yi) / (yj - yi) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = x0; x <= x1; x++) buf[y * W + x] = val;
    }
  }
}

export function generateMap(seed = 1171) {
  const rng = new RNG(seed);
  const N = W * H;
  const terr = new Uint8Array(N);
  fillPoly(terr, COAST.map(([a, b]) => project(a, b)), PT.pasture);
  for (const l of LAKES) fillPoly(terr, l.pts.map(([a, b]) => project(a, b)), PT.lake);

  // Terrain regions with noisy edges
  const pri = new Int8Array(N);
  TERRAIN_BLOBS.forEach(([type, lat, lon, r], bi) => {
    const [cx, cy] = project(lat, lon), rp = r / KM_PER_PX, ext = rp * 1.5;
    const x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(W - 1, Math.ceil(cx + ext));
    const y0 = Math.max(0, Math.floor(cy - ext)), y1 = Math.min(H - 1, Math.ceil(cy + ext));
    const p = PRIORITY[type], code = PT[type];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (terr[i] < 2) continue;
      const d = Math.hypot(x - cx, y - cy) / rp + (fbm(x / 16, y / 16, 31 + p + bi) - 0.5) * 1.5;
      if (d < 1 && p >= pri[i]) { pri[i] = p; terr[i] = code; }
    }
  });

  // Rivers
  const riv = new Uint8Array(N);
  for (const r of RIVERS) {
    const pts = r.pts.map(([a, b]) => project(a, b)), rad = r.w / 2;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        // slight meander
        const mx = ax + (bx - ax) * t + (fbm(s * 0.15 + k, 3, 77) - 0.5) * 3;
        const my = ay + (by - ay) * t + (fbm(3, s * 0.15 + k, 78) - 0.5) * 3;
        for (let dy = -Math.ceil(rad); dy <= Math.ceil(rad); dy++) for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) {
          if (dx * dx + dy * dy > rad * rad + 0.3) continue;
          const x = Math.round(mx + dx), y = Math.round(my + dy);
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + x; if (terr[i] >= 2) riv[i] = 1;
        }
      }
    }
  }

  // Seeds: historic places first, then terrain-weighted spacing
  const seeds = [];
  const nearestLand = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    for (let r = 0; r < 25; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && terr[yy * W + xx] >= 2 && !riv[yy * W + xx]) return [xx, yy];
    }
    return null;
  };
  for (const [key, name, lat, lon, special] of PLACES) {
    const p = nearestLand(...project(lat, lon)); if (!p) continue;
    if (seeds.some(s => Math.hypot(s.x - p[0], s.y - p[1]) < 7)) continue;
    seeds.push({ x: p[0], y: p[1], key, name, special: special || null });
  }
  const spacingPx = i => SPACING[PT_NAMES[terr[i]]] / KM_PER_PX;
  for (let tries = 0; tries < 60000; tries++) {
    const x = rng.int(W), y = rng.int(H), i = y * W + x;
    if (terr[i] < 2 || riv[i]) continue;
    const sp = spacingPx(i);
    let ok = true;
    for (const s of seeds) { const dx = s.x - x, dy = s.y - y; if (dx * dx + dy * dy < sp * sp) { ok = false; break; } }
    if (ok) seeds.push({ x, y, key: null, name: null, special: null });
  }

  // Grow territories outward from seeds with terrain/river-weighted cost (Dial's algorithm).
  const pid = new Int16Array(N).fill(-1);
  const dist = new Int32Array(N).fill(0x3fffffff);
  const buckets = Array.from({ length: 256 }, () => []);
  let pending = 0;
  seeds.forEach((s, k) => { const i = s.y * W + s.x; dist[i] = 0; pid[i] = k; buckets[0].push(i); pending++; });
  const NB = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
  for (let cur = 0; pending > 0; cur++) {
    const b = buckets[cur & 255];
    while (b.length) {
      const i = b.pop(); pending--;
      if (dist[i] !== cur) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy, m] of NB) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (terr[j] < 2) continue;
        const c = Math.min(250, Math.round((STEP_COST[terr[j]] + (riv[j] ? RIVER_COST : 0)) * m / 10));
        const nd = cur + c;
        if (nd < dist[j]) { dist[j] = nd; pid[j] = pid[i]; buckets[nd & 255].push(j); pending++; }
      }
    }
  }
  for (let i = 0; i < N; i++) if (terr[i] >= 2 && pid[i] < 0) terr[i] = PT.sea; // unreachable slivers
  for (let i = 0; i < N; i++) if (terr[i] < 2) pid[i] = terr[i] === PT.lake ? -2 : -1;

  // Merge tiny territories into their longest-bordered neighbour
  let st = stats(pid, terr, riv, seeds.length);
  const remap = new Int16Array(seeds.length).map((_, i) => i);
  for (let k = 0; k < seeds.length; k++) {
    if (st.area[k] >= 70 || seeds[k].key) continue;
    let best = -1, bl = 0;
    for (const [to, e] of st.adj[k]) if (e.len > bl && st.area[to] >= 70) { bl = e.len; best = to; }
    if (best >= 0) remap[k] = best;
  }
  const newIndex = new Int16Array(seeds.length).fill(-1);
  const keep = [];
  for (let k = 0; k < seeds.length; k++) if (remap[k] === k && st.area[k] > 0) { newIndex[k] = keep.length; keep.push(seeds[k]); }
  for (let i = 0; i < N; i++) if (pid[i] >= 0) pid[i] = newIndex[remap[pid[i]]];
  st = stats(pid, terr, riv, keep.length);

  // Forest display threshold per pixel (so clearing forest looks organic)
  const ft = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (terr[i] === PT.forest) ft[i] = Math.floor(fbm((i % W) / 9, ((i / W) | 0) / 9, 5) * 255);

  // Build province records
  const used = new Set();
  const provinces = keep.map((s, id) => {
    const tc = st.tcount[id];
    let bestT = PT.pasture, bc = -1;
    for (let t = 2; t < 10; t++) if (t !== PT.forest && tc[t] > bc) { bc = tc[t]; bestT = t; }
    const coastal = st.coast[id] >= 3;
    const forestShare = tc[PT.forest] / st.area[id];
    let name = s.name;
    if (!name) name = makeName(rng, used, coastal ? 'coast' : PT_NAMES[forestShare > 0.4 ? PT.forest : bestT]);
    used.add(name);
    return {
      id, name, key: s.key, special: s.special,
      sx: s.x, sy: s.y, x: st.cx[id] / st.area[id], y: st.cy[id] / st.area[id],
      area: st.area[id], areaKm: Math.round(st.area[id] * KM_PER_PX * KM_PER_PX),
      tcount: Array.from(tc), forestShare, baseTerrain: PT_NAMES[bestT], coastal,
      lakeside: st.lake[id] >= 3,
      adj: [...st.adj[id]].map(([to, e]) => ({ to, len: e.len, river: e.riv / e.len > 0.12 })),
    };
  });
  // Ensure connectivity for any isolated piece (link to nearest by sea)
  for (const p of provinces) if (!p.adj.length) {
    let best = null, bd = 1e9;
    for (const q of provinces) if (q !== p) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } }
    p.adj.push({ to: best.id, len: 1, river: true, sea: true }); best.adj.push({ to: p.id, len: 1, river: true, sea: true });
  }
  const byKey = {};
  provinces.forEach(p => { if (p.key) byKey[p.key] = p.id; });

  // CSR pixel lists per province, for fast partial repaints
  const counts = new Int32Array(provinces.length + 1);
  for (let i = 0; i < N; i++) if (pid[i] >= 0) counts[pid[i] + 1]++;
  for (let k = 1; k <= provinces.length; k++) counts[k] += counts[k - 1];
  const fillPos = counts.slice(0, provinces.length);
  const pix = new Int32Array(counts[provinces.length]);
  for (let i = 0; i < N; i++) if (pid[i] >= 0) pix[fillPos[pid[i]]++] = i;

  return { W, H, KM_PER_PX, pid, terr, riv, ft, provinces, byKey, pixStart: counts, pix };
}

function stats(pid, terr, riv, n) {
  const area = new Int32Array(n), cx = new Float64Array(n), cy = new Float64Array(n);
  const coast = new Int32Array(n), lake = new Int32Array(n);
  const tcount = Array.from({ length: n }, () => new Int32Array(10));
  const adj = Array.from({ length: n }, () => new Map());
  const link = (a, b, r) => {
    let e = adj[a].get(b); if (!e) { e = { len: 0, riv: 0 }; adj[a].set(b, e); adj[b].set(a, e); }
    e.len++; if (r) e.riv++;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = pid[i]; if (a < 0) continue;
    area[a]++; cx[a] += x; cy[a] += y; tcount[a][terr[i]]++;
    const check = j => {
      const b = pid[j];
      if (b === -1) coast[a]++; else if (b === -2) lake[a]++;
      else if (b !== a) return b;
      return -1;
    };
    if (x + 1 < W) { const b = check(i + 1); if (b >= 0) link(a, b, riv[i] || riv[i + 1]); } else coast[a]++;
    if (y + 1 < H) { const b = check(i + W); if (b >= 0) link(a, b, riv[i] || riv[i + W]); } else coast[a]++;
    if (x > 0) { const b = pid[i - 1]; if (b === -1) coast[a]++; else if (b === -2) lake[a]++; }
    if (y > 0) { const b = pid[i - W]; if (b === -1) coast[a]++; else if (b === -2) lake[a]++; }
  }
  return { area, cx, cy, coast, lake, tcount, adj };
}

function makeName(rng, used, kind) {
  const pre = NAME_PARTS[kind] || NAME_PARTS.default;
  for (let t = 0; t < 50; t++) {
    const p = rng.chance(0.75) ? rng.pick(pre) : rng.pick(NAME_PARTS.default);
    const n = p + ' ' + rng.pick(NAME_PARTS.suffix);
    if (!used.has(n)) return n;
  }
  return rng.pick(pre) + ' ' + rng.int(99);
}
