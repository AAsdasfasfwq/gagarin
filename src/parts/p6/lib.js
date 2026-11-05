// ─────────────────────────────────────────────────────────────────────────────
// p6/lib.js — shared craft for "One Orbit": space & warning grounds, a lit 2D
// ortho globe (real coastlines, cloud puffs, night-side city lights, true
// terminator from a low-res shading buffer), orbit/dial geometry, telemetry
// tags, gauges, and the 2D Vostok drawing (solid + blueprint line modes).
// Everything is deterministic and cached.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, rng, noise, TAU, E, tw, smoothstep, makeNoise } from '../../core/math.js';
import { C, rgba, shade, mixColor } from '../../core/palette.js';
import { F, font, setText } from '../../core/type.js';
import { W, H, makeCanvas, cached, tex, shadeSphere, glow, texturePath, scratchCanvas, fillTexture } from '../../core/draw.js';
import { loadGeo, ortho, equirect } from '../../core/geo.js';

export const AMBER = '#F2A33A';
export const SLATE = '#151C26';
export const SLATE2 = '#1E2733';
export const ICE = '#BFD6E2';

// ── grounds ──────────────────────────────────────────────────────────────────
// Deep space: indigo pool + two star layers with parallax + faint dust.
export function spaceBg(ctx, t, { ox = 0, oy = 0, zoom = 1, cx = W * 0.5, cy = H * 0.4, light = 0.1, base = C.space, stars = 1, dust = 0.5, seed = 4 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1300);
  g.addColorStop(0, shade(base, light));
  g.addColorStop(0.55, base);
  g.addColorStop(1, mixColor(base, C.spaceDeep, 0.85));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (dust > 0) {
    const sm = tintedSprite('#5F6FA8', 31);
    ctx.globalAlpha = 0.09 * dust;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(sm, -300 + ox * 0.15, -200 + oy * 0.15, 1500, 1100);
    ctx.drawImage(sm, 900 + ox * 0.2, 300 + oy * 0.2, 1300, 900);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (stars > 0) {
    const s1 = starLayer(seed, 900, 0);
    const s2 = starLayer(seed + 9, 220, 26);
    const drawLayer = (img, k, a) => {
      const z = 1 + (zoom - 1) * k;
      const w = W * z, h = H * z;
      const x = W / 2 - w / 2 + ox * k, y = H / 2 - h / 2 + oy * k;
      ctx.globalAlpha = a * stars;
      // tile 3x3 so pans never reveal an edge
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const xx = x + i * w, yy = y + j * h;
        if (xx > W || yy > H || xx + w < 0 || yy + h < 0) continue;
        ctx.drawImage(img, xx, yy, w, h);
      }
    };
    drawLayer(s1, 0.25, 0.85);
    drawLayer(s2, 0.55, 0.9 + 0.1 * Math.sin(t * 1.3));
  }
  ctx.restore();
}

// Warning / engineering ground: slate with pooled light, fine grid, grit.
export function warnBg(ctx, t, { cx = W * 0.5, cy = H * 0.45, grid = 0.07, gridSize = 60, ox = 0, oy = 0, base = SLATE, light = 0.16, warm = 0 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1250);
  g.addColorStop(0, shade(mixColor(base, '#3A2A1A', warm), light));
  g.addColorStop(0.6, base);
  g.addColorStop(1, shade(base, -0.45));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (grid > 0) {
    ctx.strokeStyle = rgba(C.steelLight, grid);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const offx = ((ox % gridSize) + gridSize) % gridSize, offy = ((oy % gridSize) + gridSize) % gridSize;
    for (let x = offx; x < W; x += gridSize) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = offy; y < H; y += gridSize) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
    // major lines
    ctx.strokeStyle = rgba(C.steelLight, grid * 1.4);
    ctx.beginPath();
    for (let x = offx; x < W; x += gridSize * 4) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = offy; y < H; y += gridSize * 4) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
  }
  fillTexture(ctx, tex.grit(1.2, { seed: 61, alpha: 38 }), { op: 'overlay', alpha: 0.5 });
  ctx.restore();
}

export function vignette(ctx, amt = 0.5, color = C.inkDeep) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, amt));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// crisp star layer: tiny points + a few brighter stars with 4-point glints
export function starLayer(seed, count, bright) {
  return cached(`p6stars:${seed}:${count}:${bright}`, () => {
    const { c, ctx } = makeCanvas(W, H);
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      const x = r() * W, y = r() * H, s = 0.35 + Math.pow(r(), 4) * 1.1;
      const k = r();
      ctx.fillStyle = k < 0.12 ? '#FFE2C0' : k > 0.88 ? '#CFE3FF' : '#F4F1EA';
      ctx.globalAlpha = 0.25 + r() * 0.6;
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < bright; i++) {
      const x = r() * W, y = r() * H, L = 4 + r() * 9;
      ctx.globalAlpha = 0.5 + r() * 0.4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, L * 0.6);
      g.addColorStop(0, 'rgba(255,250,240,.9)'); g.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = g; ctx.fillRect(x - L, y - L, L * 2, L * 2);
      ctx.strokeStyle = 'rgba(255,248,236,.55)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L * 0.8); ctx.lineTo(x, y + L * 0.8); ctx.stroke();
      ctx.fillStyle = '#FFFDF6'; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill();
    }
    return c;
  });
}

// cloud puff sprite with real fbm structure (crisper than a radial blob)
export function cloudSprite(seed) {
  return cached(`p6cloud:${seed}`, () => {
    const S = 128;
    const { c, ctx } = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const nz = makeNoise(seed);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x / S - 0.5, dy = (y / S - 0.5) * 1.6;
      const fall = clamp(1 - Math.sqrt(dx * dx + dy * dy) * 2.1);
      const n = nz.fbm2(x / 22, y / 14, 4) * 0.5 + 0.5;
      const a = clamp((n * fall - 0.18) * 3.2);
      const i = (y * S + x) * 4;
      img.data[i] = 246; img.data[i + 1] = 248; img.data[i + 2] = 250; img.data[i + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}

function tintedSprite(color, seed) {
  return cached(`p6spr:${color}:${seed}`, () => {
    const base = tex.smoke({ seed, scale: 0.8, soft: 1.2 });
    const { c, ctx } = makeCanvas(base.width, base.height);
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  });
}
export { tintedSprite };

// soft round sprite (for city lights, glints, particles)
export function dotSprite(color, size = 32) {
  return cached(`p6dot:${color}:${size}`, () => {
    const { c, ctx } = makeCanvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(0.25, rgba(color, 0.55));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
  });
}

// ── globe ────────────────────────────────────────────────────────────────────
const CITIES = [
  // North America (the "sleeping America" of the seam)
  [-74.0, 40.7, 3], [-118.2, 34.05, 2.6], [-87.6, 41.9, 2.4], [-95.4, 29.8, 1.6], [-75.2, 39.95, 1.8], [-112.1, 33.45, 1.2],
  [-122.4, 37.8, 1.8], [-122.3, 47.6, 1.2], [-71.06, 42.36, 1.6], [-77.04, 38.9, 1.6], [-84.4, 33.75, 1.4], [-80.2, 25.8, 1.3],
  [-96.8, 32.8, 1.5], [-104.99, 39.74, 1], [-83.05, 42.33, 1.6], [-93.27, 44.98, 1.1], [-90.2, 38.63, 1.2], [-90.07, 29.95, 0.9],
  [-94.58, 39.1, 1], [-111.9, 40.76, 0.8], [-80, 40.44, 1.2], [-81.69, 41.5, 1.2], [-84.5, 39.1, 1], [-78.9, 42.9, 0.9],
  [-79.38, 43.65, 1.4], [-73.57, 45.5, 1.2], [-99.13, 19.43, 2], [-82.37, 23.13, 0.8], [-123.1, 49.28, 0.9], [-117.16, 32.7, 1.1],
  [-115.14, 36.17, 0.6], [-122.68, 45.52, 0.8], [-86.78, 36.16, 0.8], [-80.84, 35.23, 0.8], [-82.46, 27.95, 0.9], [-90.05, 35.15, 0.8],
  [-86.16, 39.77, 0.9], [-87.9, 43.04, 0.9], [-82.99, 39.96, 0.9], [-76.6, 39.29, 1.1], [-97.5, 35.47, 0.7], [-98.5, 29.42, 0.8],
  [-97.74, 30.27, 0.7], [-106.44, 31.76, 0.6], [-106.65, 35.08, 0.5], [-95.94, 41.26, 0.6], [-81.66, 30.33, 0.7], [-77.44, 37.54, 0.7],
  [-76.29, 36.85, 0.6], [-78.64, 35.78, 0.6], [-86.8, 33.52, 0.7], [-85.76, 38.25, 0.7], [-121.49, 38.58, 0.6], [-100.3, 25.67, 0.8],
  [-103.35, 20.67, 0.8], [-75.7, 45.42, 0.5], [-113.5, 53.5, 0.5], [-114.07, 51.05, 0.5], [-97.14, 49.9, 0.5],
  // Europe / USSR
  [-0.13, 51.5, 2.6], [2.35, 48.86, 2.3], [13.4, 52.52, 1.8], [-3.7, 40.4, 1.4], [12.5, 41.9, 1.3], [37.62, 55.75, 2.4], [30.3, 59.94, 1.5],
  [30.5, 50.45, 1.2], [21, 52.23, 1], [16.37, 48.2, 1], [19.04, 47.5, 1], [14.42, 50.08, 0.8], [9.19, 45.46, 1.3], [2.17, 41.39, 1],
  [4.9, 52.37, 1], [4.35, 50.85, 1], [10, 53.55, 1], [11.58, 48.14, 0.9], [18.07, 59.33, 0.7], [12.57, 55.68, 0.7], [28.98, 41.0, 1.2],
  [23.73, 37.98, 0.8], [-9.14, 38.72, 0.7], [-2.24, 53.48, 1.2], [-4.25, 55.86, 0.8], [36.23, 50, 0.8], [27.56, 53.9, 0.7], [24.1, 56.95, 0.5],
  [23.32, 42.7, 0.5], [26.1, 44.43, 0.7], [20.46, 44.8, 0.6], [44.0, 56.33, 0.7], [50.1, 53.2, 0.6], [60.6, 56.84, 0.6], [82.92, 55.03, 0.6],
  [49.87, 40.41, 0.6], [69.24, 41.3, 0.7], [76.9, 43.24, 0.5], [7.45, 51.5, 1.4], [6.96, 50.94, 1.1],
  // Asia / Middle East / Africa
  [139.69, 35.69, 2.6], [135.5, 34.69, 1.8], [126.98, 37.57, 1.2], [116.4, 39.9, 1.2], [121.47, 31.23, 1.3], [114.17, 22.32, 1],
  [77.21, 28.61, 1.2], [72.88, 19.08, 1.3], [88.36, 22.57, 1.2], [80.27, 13.08, 0.8], [67, 24.86, 0.9], [51.39, 35.69, 0.9],
  [44.36, 33.31, 0.7], [31.24, 30.04, 1.3], [100.5, 13.75, 0.8], [106.85, -6.21, 0.9], [120.98, 14.6, 0.8], [103.82, 1.35, 0.6],
  [3.38, 6.52, 0.6], [28.05, -26.2, 0.8], [3.06, 36.75, 0.6], [-7.59, 33.57, 0.6], [36.82, -1.29, 0.4], [18.42, -33.92, 0.5],
  // South America / Oceania
  [-46.63, -23.55, 1.6], [-43.2, -22.9, 1.3], [-58.38, -34.6, 1.4], [-77.04, -12.05, 0.7], [-74.07, 4.71, 0.7], [-70.67, -33.45, 0.7],
  [-66.9, 10.5, 0.6], [151.2, -33.87, 1], [144.96, -37.81, 0.9], [153, -27.47, 0.5], [115.86, -31.95, 0.4],
];

let geoP = null;
export function getGeo() {
  if (!geoP) geoP = loadGeo('50m');
  return geoP;
}

// land mask (equirect, 0.5°/px) + city lights + cloud puffs. Built once.
export function globeData(G) {
  return cached('p6:globeData', () => {
    const MW = 720, MH = 360;
    const { ctx } = makeCanvas(MW, MH);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, MW, MH);
    G.draw(ctx, equirect({ cx: MW / 2, cy: MH / 2, scale: MW / 360 }), { fill: '#fff' });
    const d = ctx.getImageData(0, 0, MW, MH).data;
    const land = (lon, lat) => {
      const x = Math.floor((lon + 180) / 360 * MW), y = Math.floor((90 - lat) / 180 * MH);
      if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
      return d[(y * MW + x) * 4] > 128;
    };
    const r = rng(1961);
    const lights = [];
    for (const [lo, la, w] of CITIES) {
      const n = Math.round(16 + w * 42);
      for (let i = 0; i < n; i++) {
        const sp = 0.14 + w * 0.32;
        const g1 = r.gauss() * sp * Math.pow(r(), 0.6), g2 = r.gauss() * sp * 0.75 * Math.pow(r(), 0.6);
        const lon = lo + g1 / Math.cos(la * Math.PI / 180), lat = la + g2;
        if (!land(lon, lat)) continue;
        lights.push([lon, lat, (0.4 + r() * 0.6) * (i < 4 ? 1.6 : 1) * Math.min(1.4, 0.6 + w * 0.35)]);
      }
    }
    // rural scatter, denser in the temperate north
    for (let i = 0; i < 2600; i++) {
      const lon = r() * 360 - 180, lat = r() * 120 - 50;
      if (!land(lon, lat)) continue;
      const dens = Math.exp(-Math.pow((lat - 42) / 16, 2)) * 0.9 + 0.12;
      if (r() > dens) continue;
      lights.push([lon, lat, 0.18 + r() * 0.3]);
    }
    // cloud puffs along weather belts
    const nz = makeNoise(77);
    const clouds = [];
    for (let i = 0; i < 300; i++) {
      const lon = r() * 360 - 180;
      const band = r.pick([-45, -8, 6, 45, 55, 30, -30]);
      const lat = band + r.gauss() * 9;
      const k = nz.fbm2(lon / 40, lat / 25, 3) * 0.5 + 0.5;
      if (k < 0.42) continue;
      clouds.push([lon, lat, 5 + r() * 10 * k, r() * TAU, 0.3 + k * 0.45]);
    }
    return { lights, clouds, land };
  });
}

const D2R = Math.PI / 180;
// Draw the globe. sun = [x,y,z] in view space (x right, y up, z toward viewer).
// opts: cx, cy, r, lon0, lat0, tilt, sun, night (0..1), lights (0..1), clouds (0..1),
// halo (0..1), colours, t, grade ('day'|'ghost'), dusk (terminator band strength)
export function drawGlobe(ctx, G, o) {
  const { cx, cy, r, lon0 = 0, lat0 = 0, tilt = 0, sun = [0.7, 0.35, 0.6], night = 0.95, lights = 1, clouds = 0.7, halo = 1, t = 0,
    ocean = '#16395A', landCol = '#5A6843', landHi = '#8A7650', haloCol = C.halo, nightCol = '#040815', lightCol = '#FFC56E',
    alpha = 1, grade = 'day', dusk = 1, cloudDrift = 0 } = o;
  if (r < 2) return null;
  const data = globeData(G);
  const sl = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  const S = [sun[0] / sl, sun[1] / sl, sun[2] / sl];
  const proj = ortho({ cx, cy, r, lon0, lat0, tilt });
  const sx = S[0], sy = -S[1], sm = Math.hypot(sx, sy) || 1;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // outer atmosphere: soft glow + thin bright rim, brighter toward the sun
  if (halo > 0) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.985, cx, cy, r * 1.09);
    g.addColorStop(0, rgba(haloCol, 0.34 * halo));
    g.addColorStop(0.3, rgba(haloCol, 0.1 * halo));
    g.addColorStop(1, rgba(haloCol, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.09, 0, TAU); ctx.fill();
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  // ocean with volume
  const og = ctx.createRadialGradient(cx + S[0] * r * 0.4, cy - S[1] * r * 0.4, r * 0.05, cx, cy, r * 1.02);
  og.addColorStop(0, shade(ocean, 0.16));
  og.addColorStop(0.55, ocean);
  og.addColorStop(1, shade(ocean, -0.45));
  ctx.fillStyle = og;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // land + relief texture + ochre/olive variation
  ctx.save();
  G.draw(ctx, proj, { fill: landCol });
  ctx.clip('evenodd');
  ctx.globalAlpha = 0.5;
  ctx.drawImage(tintedSprite(landHi, 23), cx - r * 1.2 + ((lon0 * 7) % (r * 0.6)), cy - r * 0.2, r * 2.0, r * 1.2);
  ctx.globalAlpha = 0.35;
  ctx.drawImage(tintedSprite('#33402C', 29), cx - r * 0.6, cy - r * 1.2, r * 1.8, r * 1.4);
  ctx.globalAlpha = 1;
  fillTexture(ctx, tex.grit(0.7, { seed: 12, alpha: 255 }), { x: cx - r, y: cy - r, w: r * 2, h: r * 2, alpha: 0.22, op: 'multiply', scale: Math.max(0.5, r / 700) });
  ctx.restore();
  // coast highlight
  G.draw(ctx, proj, { stroke: rgba('#C9D2B0', 0.18), width: Math.max(0.6, r / 900) });
  // clouds: fbm puffs, streaked along latitude, foreshortened near the limb
  if (clouds > 0) {
    const sprs = [cloudSprite(5), cloudSprite(6), cloudSprite(7)];
    for (let i = 0; i < data.clouds.length; i++) {
      const [lo, la, sz, rot, a] = data.clouds[i];
      const p = proj(lo + cloudDrift, la);
      if (!p.v || p.z < 0.04) continue;
      const nx = (p.x - cx) / r, ny = -(p.y - cy) / r, nz = p.z;
      const lit = nx * S[0] + ny * S[1] + nz * S[2];
      const day = smoothstep(-0.2, 0.35, lit);
      const s = sz * D2R * r * 1.25;
      const p2 = proj(lo + cloudDrift + 3, la);
      const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
      ctx.save();
      ctx.globalAlpha = clamp(a * clouds * (0.06 + day * 0.94)) * 0.85;
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.y - cy, p.x - cx));
      ctx.scale(Math.max(0.12, nz), 1);
      ctx.rotate(ang - Math.atan2(p.y - cy, p.x - cx));
      ctx.drawImage(sprs[i % 3], -s * 1.3, -s * 0.5, s * 2.6, s);
      ctx.restore();
    }
  }
  // night + dusk band + limb darkening from a low-res lighting buffer
  const N = 192;
  const sb = cached('p6:shadebuf', () => makeCanvas(N, N));
  const img = cached('p6:shadeimg', () => sb.ctx.createImageData(N, N));
  const dd = img.data;
  const hx = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const NC = [hx(nightCol, 0), hx(nightCol, 1), hx(nightCol, 2)];
  const DC = [96, 46, 58];
  for (let j = 0; j < N; j++) {
    const Y = 1 - (j + 0.5) / N * 2;
    for (let i = 0; i < N; i++) {
      const X = (i + 0.5) / N * 2 - 1;
      const k = (j * N + i) * 4;
      const rr = X * X + Y * Y;
      if (rr > 1.03) { dd[k + 3] = 0; continue; }
      const Z = Math.sqrt(Math.max(0, 1 - rr));
      const lit = X * S[0] + Y * S[1] + Z * S[2];
      const nk = smoothstep(0.1, -0.16, lit) * night;
      const band = Math.exp(-Math.pow((lit + 0.03) / 0.045, 2)) * dusk * night * 0.6;
      const limb = Math.pow(1 - Z, 2.4) * 0.45;
      const a = clamp(Math.max(nk * 0.97, band * 0.55) + limb * (1 - nk));
      const bk = clamp(band * 1.4) * (1 - nk * 0.6);
      dd[k] = lerp(NC[0], DC[0], bk); dd[k + 1] = lerp(NC[1], DC[1], bk); dd[k + 2] = lerp(NC[2], DC[2], bk); dd[k + 3] = a * 255;
    }
  }
  sb.ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sb.c, cx - r, cy - r, r * 2, r * 2);
  // city lights (crisp cores, small warm bloom)
  if (lights > 0) {
    const spr = dotSprite(lightCol, 32);
    ctx.globalCompositeOperation = 'lighter';
    const ls = clamp(r / 260, 0.6, 3.2);
    ctx.fillStyle = '#FFE8B8';
    for (let i = 0; i < data.lights.length; i++) {
      const [lo, la, w] = data.lights[i];
      const p = proj(lo, la);
      if (!p.v || p.z < 0.03) continue;
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
      const nx = (p.x - cx) / r, ny = -(p.y - cy) / r;
      const lit = nx * S[0] + ny * S[1] + p.z * S[2];
      const nk = smoothstep(0.0, -0.18, lit);
      if (nk <= 0.01) continue;
      const fl = 0.85 + 0.15 * Math.sin(t * 2.3 + i * 1.7);
      const a = clamp(w * nk * lights * fl * (0.35 + 0.65 * p.z));
      const s = ls * (0.6 + w * 0.6) * (0.4 + 0.6 * p.z);
      ctx.globalAlpha = a * 0.45;
      ctx.drawImage(spr, p.x - s * 2.6, p.y - s * 2.6, s * 5.2, s * 5.2);
      ctx.globalAlpha = a;
      ctx.fillRect(p.x - s * 0.45, p.y - s * 0.45, s * 0.9, s * 0.9);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // sun glint on the ocean
  if (S[2] > -0.1) {
    const gx = S[0] * 0.5, gy = S[1] * 0.5;
    glow(ctx, cx + gx * r, cy - gy * r, r * 0.42, '#FFF2D8', 0.16 * clamp(S[2] + 0.3), 'screen');
  }
  ctx.restore();
  // crisp limb line, brighter toward the sun
  if (halo > 0) {
    const lg = ctx.createLinearGradient(cx - (sx / sm) * r, cy - (sy / sm) * r, cx + (sx / sm) * r, cy + (sy / sm) * r);
    lg.addColorStop(0, rgba(haloCol, 0.25 * halo));
    lg.addColorStop(0.5, rgba(haloCol, 0.45 * halo));
    lg.addColorStop(1, rgba(mixColor(haloCol, '#FFFFFF', 0.35), 0.95 * halo));
    ctx.strokeStyle = lg;
    ctx.lineWidth = clamp(r * 0.007, 1.2, 9);
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.003, 0, TAU); ctx.stroke();
  }
  if (grade === 'ghost') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  return proj;
}

// ── orbit geometry ───────────────────────────────────────────────────────────
// Ellipse in screen space: centre (cx,cy), radii rx, ry, rotation rot. θ param.
export function ellPt(e, th) {
  const c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0);
  const x = Math.cos(th) * e.rx, y = Math.sin(th) * e.ry;
  return [e.cx + x * c - y * s, e.cy + x * s + y * c];
}
// polyline of the ellipse between θ0..θ1 (radians), n samples
export function ellArc(e, th0, th1, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(ellPt(e, lerp(th0, th1, i / n)));
  return pts;
}
// normal (outward) at θ
export function ellNormal(e, th) {
  const c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0);
  const nx = Math.cos(th) / e.rx, ny = Math.sin(th) / e.ry;
  const l = Math.hypot(nx, ny) || 1;
  return [(nx * c - ny * s) / l, (nx * s + ny * c) / l];
}
// Stroke an ellipse arc split into back (sin θ < 0 → behind the globe) / front halves.
// part: 'back' | 'front' | 'all'. p = draw progress 0..1 from th0.
export function strokeOrbit(ctx, e, { th0 = 0, span = TAU, p = 1, part = 'all', color = C.cream, width = 3, alpha = 1, dash = null, backAlpha = 0.35 } = {}) {
  const n = Math.max(24, Math.round(160 * Math.abs(span) / TAU));
  const end = th0 + span * clamp(p);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  if (dash) ctx.setLineDash(dash);
  for (const which of part === 'all' ? ['back', 'front'] : [part]) {
    ctx.globalAlpha = alpha * (which === 'back' ? backAlpha : 1);
    ctx.lineWidth = which === 'back' ? width * 0.8 : width;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= n; i++) {
      const th = lerp(th0, end, i / n);
      const back = Math.sin(th) < 0;
      if ((which === 'back') !== back) { pen = false; continue; }
      const [x, y] = ellPt(e, th);
      if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ── the orange dot (Gagarin) ────────────────────────────────────────────────
export function orangeDot(ctx, x, y, r = 9, { glowAmt = 1, color = C.orange, ring = 0, t = 0 } = {}) {
  ctx.save();
  if (glowAmt > 0) glow(ctx, x, y, r * 5, color, 0.45 * glowAmt);
  if (ring > 0) {
    const k = (t * 0.8) % 1;
    ctx.strokeStyle = rgba(color, (1 - k) * 0.7 * ring);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * (1.4 + k * 3), 0, TAU); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  shadeSphere(ctx, x, y, r, color, { spec: 0.5, bounce: 0.1 });
  ctx.restore();
}

// ── telemetry tag (mono, bracketed, typed on) ───────────────────────────────
export function tag(ctx, t, x, y, label, { color = C.cream, accent = AMBER, size = 26, align = 'left', dot = true, out = null, bg = null, baseline = 'middle' } = {}) {
  if (t <= 0) return 0;
  const o = out != null ? 1 - tw(t, out, out + 0.25, E.in) : 1;
  if (o <= 0) return 0;
  ctx.save();
  ctx.globalAlpha *= o * tw(t, 0, 0.15, E.out);
  setText(ctx, { family: F.MONO, size, weight: 600, color, align, baseline, tracking: 2 });
  const full = `[ ${label} ]`;
  const n = Math.ceil(full.length * tw(t, 0, 0.45, E.linear));
  const str = full.slice(0, n);
  const w = ctx.measureText(full).width;
  const ax = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(ax - 12, y - size * 0.85, w + 24, size * 1.7);
    ctx.fillStyle = color;
  }
  ctx.textAlign = 'left';
  ctx.fillText(str, ax, y);
  if (dot) {
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(ax - 16, y, 4.5 * tw(t, 0, 0.3, E.snap), 0, TAU); ctx.fill();
  }
  ctx.restore();
  return w;
}

// Big hero word with italic serif lead — local wrapper with tracking animation
export function heroWord(ctx, t, x, y, word, { size = 150, color = C.cream, family = F.COND, weight = 800, align = 'center', track0 = 0.01, track1 = 0.01, out = null, rise = true, alpha = 1 } = {}) {
  if (t <= 0) return;
  const o = out != null ? 1 - tw(t, out, out + 0.3, E.in) : 1;
  if (o <= 0) return;
  ctx.save();
  ctx.globalAlpha *= o * alpha;
  const p = tw(t, 0, 0.7, E.out);
  const tr = lerp(track0, track1, tw(t, 0, 3, E.outCubic)) * size;
  setText(ctx, { family, size, weight, color, align, tracking: tr });
  ctx.beginPath();
  const w = ctx.measureText(word).width + 400;
  ctx.rect(x - w, y - size * 1.1, w * 2, size * 1.4);
  ctx.clip();
  ctx.globalAlpha *= clamp(p * 2);
  ctx.fillText(word, x, y + (rise ? (1 - p) * size * 0.9 : 0));
  ctx.restore();
}

// ── dimension bracket (engineering measure, no arrowheads) ──────────────────
export function dimension(ctx, x0, y0, x1, y1, p, { color = AMBER, width = 2, tick = 14 } = {}) {
  const e = E.out(clamp(p));
  if (e <= 0) return;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const ax = lerp(mx, x0, e), ay = lerp(my, y0, e), bx = lerp(mx, x1, e), by = lerp(my, y1, e);
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l * tick, ny = dx / l * tick;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  ctx.moveTo(ax - nx, ay - ny); ctx.lineTo(ax + nx, ay + ny);
  ctx.moveTo(bx - nx, by - ny); ctx.lineTo(bx + nx, by + ny);
  ctx.stroke();
  ctx.restore();
}

// ── a crafted gauge face (bezel, glass, ticks) ──────────────────────────────
export function gaugeFace(ctx, x, y, r, { a0 = -Math.PI * 1.25, a1 = Math.PI * 0.25, ticks = 40, major = 5, face = '#20262C', ink = C.cream, bezel = '#7D868C', t = 0 } = {}) {
  ctx.save();
  // bezel
  ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU);
  shadeSphere(ctx, x, y, r * 1.12, bezel, { spec: 0.35, bounce: 0.1 });
  texturePath(ctx, tex.metal('#A9B1B5', { w: 400, h: 400 }), { alpha: 0.35, op: 'overlay' });
  ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU);
  ctx.strokeStyle = 'rgba(10,12,16,.6)'; ctx.lineWidth = 2; ctx.stroke();
  // face
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  const fg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
  fg.addColorStop(0, shade(face, 0.12)); fg.addColorStop(1, shade(face, -0.35));
  ctx.fillStyle = fg; ctx.fill();
  texturePath(ctx, tex.grit(0.5, { seed: 8, alpha: 255 }), { alpha: 0.12, op: 'overlay' });
  // ticks
  ctx.strokeStyle = ink;
  for (let i = 0; i <= ticks; i++) {
    const a = lerp(a0, a1, i / ticks);
    const mj = i % major === 0;
    ctx.lineWidth = mj ? 3 : 1.4;
    ctx.globalAlpha = mj ? 0.95 : 0.6;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * (mj ? 0.78 : 0.85), y + Math.sin(a) * r * (mj ? 0.78 : 0.85));
    ctx.lineTo(x + Math.cos(a) * r * 0.93, y + Math.sin(a) * r * 0.93);
    ctx.stroke();
  }
  ctx.restore();
}
export function gaugeGlass(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  const g = ctx.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.4);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.03)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
export function needle(ctx, x, y, r, a, { color = AMBER, w = 7 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, -w * 0.6); ctx.lineTo(r * 0.92, -1.2); ctx.lineTo(r * 0.92, 1.2); ctx.lineTo(-r * 0.16, w * 0.6); ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(0, 0, w * 1.5, 0, TAU);
  shadeSphere(ctx, 0, 0, w * 1.5, '#3A4046', { spec: 0.5 });
  ctx.restore();
}

// ── Vostok 2D drawing ───────────────────────────────────────────────────────
// Craft axis vertical: descent sphere centre at (0,0) radius 1, instrument
// module below (y>0). (x,y) = sphere centre on screen, s = px per sphere radius.
// opts: rot, mode 'solid'|'line', sep (sphere offset along axis, in R), cable 0..1,
// heat 0..1 (glow on leading side), tdu 0..1 (retro plume), light dir, ghostModule
const MOD = [[0.5, 0.86], [1.05, 1.52], [0.62, 2.72]]; // [halfWidth, y]
export function vostok(ctx, x, y, s, o = {}) {
  const { rot = 0, mode = 'solid', sep = 0, cable = 1, heat = 0, tdu = 0, t = 0, ink = C.cream, lineW = 2.2, alpha = 1, dot = 1,
    moduleAlpha = 1, sphereAlpha = 1, shield = 0, moduleDash = false, lx = -0.6, ly = -0.55, burn = 0, sphereOnly = false } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  const lw = lineW / s;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const solid = mode === 'solid';
  const modulePath = () => {
    ctx.beginPath();
    ctx.moveTo(-MOD[0][0], MOD[0][1]);
    ctx.lineTo(-MOD[1][0], MOD[1][1]);
    ctx.lineTo(-MOD[2][0], MOD[2][1]);
    ctx.lineTo(MOD[2][0], MOD[2][1]);
    ctx.lineTo(MOD[1][0], MOD[1][1]);
    ctx.lineTo(MOD[0][0], MOD[0][1]);
    ctx.closePath();
  };
  const bottles = (front) => {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.2;
      const z = Math.sin(a);
      if ((z > 0) !== front) continue;
      const bx = Math.cos(a) * 0.86, by = 1.06 - z * 0.05;
      const br = 0.15 * (0.92 + z * 0.08);
      if (solid) {
        ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU);
        shadeSphere(ctx, bx, by, br, front ? '#C9CCC3' : '#8E918A', { lx, ly, spec: 0.45, bounce: 0.15 });
        ctx.lineWidth = lw * 0.6; ctx.strokeStyle = 'rgba(20,24,30,.55)'; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU);
        ctx.strokeStyle = rgba(ink, front ? 0.9 : 0.35); ctx.lineWidth = lw * 0.7; ctx.stroke();
      }
    }
  };
  // ── TDU plume (behind module, out of the nozzle, pointing +y) ──
  const nozzleY = MOD[2][1] + 0.36;
  // ── instrument module ──
  if (!sphereOnly) {
    ctx.save();
    ctx.globalAlpha *= moduleAlpha;
    if (tdu > 0) drawPlume(ctx, 0, nozzleY, tdu, t);
    bottles(false);
    // nozzle
    ctx.beginPath();
    ctx.moveTo(-0.17, MOD[2][1]); ctx.lineTo(-0.3, nozzleY); ctx.lineTo(0.3, nozzleY); ctx.lineTo(0.17, MOD[2][1]); ctx.closePath();
    if (solid) {
      const ng = ctx.createLinearGradient(-0.3, 0, 0.3, 0);
      ng.addColorStop(0, '#2A2C30'); ng.addColorStop(0.35, '#6E6A66'); ng.addColorStop(0.55, '#4A4643'); ng.addColorStop(1, '#1D1F23');
      ctx.fillStyle = ng; ctx.fill();
      ctx.lineWidth = lw * 0.7; ctx.strokeStyle = 'rgba(10,12,16,.7)'; ctx.stroke();
      if (tdu > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(C.fire3, 0.5 * tdu); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    } else {
      ctx.strokeStyle = ink; ctx.lineWidth = lw; if (moduleDash) ctx.setLineDash([0.08, 0.06]); ctx.stroke(); ctx.setLineDash([]);
    }
    modulePath();
    if (solid) {
      const g = ctx.createLinearGradient(-1.05, 0, 1.05, 0);
      const base = '#C7CBC8';
      g.addColorStop(0, shade(base, -0.55)); g.addColorStop(0.22, shade(base, 0.05)); g.addColorStop(0.36, shade(base, 0.3));
      g.addColorStop(0.5, base); g.addColorStop(0.82, shade(base, -0.35)); g.addColorStop(1, shade(base, -0.65));
      ctx.fillStyle = g; ctx.fill();
      ctx.save();
      modulePath();
      texturePath(ctx, tex.metal('#C3D0D6', { w: 300, h: 300 }), { alpha: 0.4, op: 'multiply', scale: 1 / s });
      ctx.restore();
      // louvers on lower cone
      ctx.save();
      modulePath(); ctx.clip();
      for (let i = 0; i < 9; i++) {
        const yy = 1.72 + i * 0.1;
        const hw = lerp(MOD[1][0], MOD[2][0], (yy - MOD[1][1]) / (MOD[2][1] - MOD[1][1]));
        ctx.fillStyle = i % 2 ? 'rgba(30,34,40,.35)' : 'rgba(255,255,255,.12)';
        ctx.fillRect(-hw * 0.55, yy, hw * 1.1, 0.05);
      }
      // seam rings
      ctx.strokeStyle = 'rgba(20,24,30,.45)'; ctx.lineWidth = lw * 0.6;
      ctx.beginPath(); ctx.moveTo(-1.05, MOD[1][1]); ctx.lineTo(1.05, MOD[1][1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.8, 1.2); ctx.lineTo(0.8, 1.2); ctx.stroke();
      // core shadow under the sphere
      const sg = ctx.createRadialGradient(0, 0.86, 0, 0, 0.86, 0.9);
      sg.addColorStop(0, 'rgba(8,10,16,.55)'); sg.addColorStop(1, 'rgba(8,10,16,0)');
      ctx.fillStyle = sg; ctx.fillRect(-1.2, 0.8, 2.4, 0.8);
      if (burn > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const bg = ctx.createLinearGradient(0, 0.8, 0, 2.8);
        bg.addColorStop(0, rgba(C.fire3, 0.0)); bg.addColorStop(1, rgba(C.fire2, 0.8 * burn));
        ctx.fillStyle = bg; ctx.fillRect(-1.2, 0.8, 2.4, 2.1);
      }
      ctx.restore();
      modulePath();
      ctx.lineWidth = lw * 0.8; ctx.strokeStyle = 'rgba(14,18,24,.75)'; ctx.stroke();
    } else {
      ctx.strokeStyle = ink; ctx.lineWidth = lw;
      if (moduleDash) ctx.setLineDash([0.1, 0.07]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha *= 0.45;
      ctx.beginPath(); ctx.moveTo(-1.05, MOD[1][1]); ctx.lineTo(1.05, MOD[1][1]); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, MOD[1][1], 1.05, 0.16, 0, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, MOD[0][1], 0.5, 0.08, 0, 0, Math.PI); ctx.stroke();
    }
    bottles(true);
    // module whip antennas
    ctx.strokeStyle = solid ? 'rgba(200,205,210,.8)' : rgba(ink, 0.7); ctx.lineWidth = lw * 0.5;
    ctx.beginPath(); ctx.moveTo(-0.95, 1.6); ctx.lineTo(-1.9, 2.5); ctx.moveTo(0.95, 1.6); ctx.lineTo(1.9, 2.5); ctx.stroke();
    ctx.restore();
  }
  // ── cable bundle between module top and sphere ──
  if (!sphereOnly && cable > 0) {
    const y0 = 0.86, y1 = 0.78 - sep;
    const cx0 = -0.32;
    ctx.save();
    for (let k = 0; k < 5; k++) {
      const off = (k - 2) * 0.022;
      const wob = Math.sin(t * 9 + k) * 0.01 * clamp(sep * 4);
      ctx.beginPath();
      ctx.moveTo(cx0 + off, y0 + 0.02);
      ctx.bezierCurveTo(cx0 + off - 0.05 + wob, lerp(y0, y1, 0.33), cx0 + off + 0.05 - wob, lerp(y0, y1, 0.66), cx0 + off * 0.6, y1);
      ctx.strokeStyle = solid ? ['#2B2D31', '#4A3A30', '#2E3A44', '#3D3A35', '#26282C'][k] : rgba(ink, 0.9);
      ctx.lineWidth = solid ? 0.03 : lw * 0.6;
      ctx.stroke();
    }
    ctx.restore();
  }
  // ── descent sphere ──
  ctx.save();
  ctx.globalAlpha *= sphereAlpha;
  ctx.translate(0, -sep);
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU);
  if (solid) {
    shadeSphere(ctx, 0, 0, 1, '#9C958B', { lx, ly, rim: heat > 0 ? C.fire3 : C.halo, spec: 0.28, bounce: 0.22 });
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU);
    texturePath(ctx, tex.grit(0.8, { seed: 19, alpha: 255 }), { alpha: 0.25, op: 'multiply', scale: 1.2 / s });
    // panel rings (latitude lines suggest a sphere)
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(30,26,22,.28)'; ctx.lineWidth = lw * 0.6;
    for (const la of [-0.55, 0.05, 0.6]) { ctx.beginPath(); ctx.ellipse(0, la, Math.sqrt(1 - la * la), 0.12 * Math.sqrt(1 - la * la), 0, 0, Math.PI); ctx.stroke(); }
    ctx.restore();
    // hatch + porthole
    ctx.beginPath(); ctx.ellipse(0.42, -0.18, 0.2, 0.24, -0.4, 0, TAU);
    ctx.fillStyle = '#20252C'; ctx.fill();
    ctx.lineWidth = 0.05; ctx.strokeStyle = '#6F6A63'; ctx.stroke();
    const pg = ctx.createLinearGradient(0.3, -0.4, 0.55, 0.05);
    pg.addColorStop(0, 'rgba(160,200,230,.55)'); pg.addColorStop(0.5, 'rgba(40,60,90,.2)'); pg.addColorStop(1, 'rgba(255,255,255,.1)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(0.42, -0.18, 0.17, 0.21, -0.4, 0, TAU); ctx.fill();
    if (dot > 0) { glow(ctx, 0.42, -0.16, 0.25, C.orange, 0.5 * dot); }
    ctx.beginPath(); ctx.ellipse(-0.35, -0.42, 0.28, 0.3, 0.3, 0, TAU);
    ctx.strokeStyle = 'rgba(30,26,22,.45)'; ctx.lineWidth = lw * 0.8; ctx.stroke();
    // heat glow (leading side = -y in craft space after rotation, we use bottom-left)
    if (heat > 0) {
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const hg = ctx.createRadialGradient(0, 1.1, 0.1, 0, 1.1, 1.4);
      hg.addColorStop(0, rgba(C.fire4, 0.85 * heat)); hg.addColorStop(0.4, rgba(C.fire2, 0.5 * heat)); hg.addColorStop(1, rgba(C.fire1, 0));
      ctx.fillStyle = hg; ctx.fillRect(-1.2, -1.2, 2.4, 2.6);
      ctx.restore();
    }
    // straps (two visible) to the top lock
    ctx.strokeStyle = '#D5D7D4'; ctx.lineWidth = 0.045;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.97, 0.97, 0, Math.PI * 0.6, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 0.45, 0.98, 0, Math.PI * 1.5, Math.PI * 2.35); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,20,24,.35)'; ctx.lineWidth = 0.015;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.94, 0.94, 0, Math.PI * 0.6, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -0.98, 0.07, 0, TAU); ctx.fillStyle = '#5B5E62'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU);
    ctx.lineWidth = lw * 0.9; ctx.strokeStyle = 'rgba(14,16,22,.7)'; ctx.stroke();
    if (shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(AMBER, 0.85 * shield); ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.arc(0, 0, 1.04, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  } else {
    ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
    if (shield > 0) {
      // ablative shield as a hatched thick shell
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, 1.12, 0, TAU); ctx.arc(0, 0, 1.0, 0, TAU, true); ctx.clip();
      ctx.strokeStyle = rgba(AMBER, 0.9 * shield); ctx.lineWidth = lw * 0.6;
      for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(i * 0.09 - 1.2, -1.2); ctx.lineTo(i * 0.09 + 1.2, 1.2); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, 1.12, 0, TAU); ctx.strokeStyle = rgba(AMBER, shield); ctx.lineWidth = lw; ctx.stroke();
    }
    ctx.globalAlpha *= 0.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 1, 0.16, 0, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0.42, -0.18, 0.17, 0.21, -0.4, 0, TAU); ctx.stroke();
    ctx.globalAlpha /= 0.5;
    if (dot > 0) { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(0, 0.05, 0.11, 0, TAU); ctx.fill(); glow(ctx, 0, 0.05, 0.4, C.orange, 0.4 * dot); }
  }
  // sphere antennas
  ctx.strokeStyle = solid ? 'rgba(210,214,218,.85)' : rgba(ink, 0.7); ctx.lineWidth = lw * 0.5;
  ctx.beginPath(); ctx.moveTo(-0.3, -0.95); ctx.lineTo(-0.9, -2.0); ctx.moveTo(0.3, -0.95); ctx.lineTo(0.95, -1.9); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// retro-rocket plume (craft-space, pointing +y from nozzle)
export function drawPlume(ctx, x, y, k, t) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const len = 1.6 + k * 1.4 + Math.sin(t * 31) * 0.08;
  for (let i = 0; i < 4; i++) {
    const w = (0.34 - i * 0.06) * (0.9 + 0.1 * Math.sin(t * 23 + i));
    const L = len * (1 - i * 0.18);
    const g = ctx.createLinearGradient(0, y, 0, y + L);
    const col = [C.fire2, C.fire3, C.fire4, C.fire5][i];
    g.addColorStop(0, rgba(col, 0.75 * k));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6, y);
    ctx.quadraticCurveTo(x - w * 1.4, y + L * 0.45, x, y + L);
    ctx.quadraticCurveTo(x + w * 1.4, y + L * 0.45, x + w * 0.6, y);
    ctx.closePath();
    ctx.fill();
  }
  // shock diamonds
  for (let i = 0; i < 4; i++) {
    const yy = y + 0.25 + i * 0.32;
    ctx.fillStyle = rgba(C.fire5, 0.35 * k * (1 - i / 4));
    ctx.beginPath(); ctx.ellipse(x, yy, 0.1 - i * 0.015, 0.06, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// soft text plate (dark backing for type over busy imagery)
export function scrim(ctx, x, y, w, h, a = 0.45, color = C.inkDeep) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.6);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / Math.max(w, h), h / Math.max(w, h));
  ctx.fillRect(-Math.max(w, h), -Math.max(w, h), Math.max(w, h) * 2, Math.max(w, h) * 2);
  ctx.restore();
  ctx.restore();
}

// floating dust motes (cabin / space), deterministic
export function motes(ctx, t, { count = 60, seed = 5, x = 0, y = 0, w = W, h = H, color = '#FFF1D6', size = [1, 3], alpha = 0.5, speed = 12 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const spr = dotSprite(color, 16);
  for (let i = 0; i < count; i++) {
    const px = x + ((r() * w + noise.n2(i, t * 0.05) * 60 + t * speed * (r() - 0.5)) % w + w) % w;
    const py = y + ((r() * h + noise.n2(i + 50, t * 0.05) * 60 + t * speed * (r() - 0.5)) % h + h) % h;
    const s = lerp(size[0], size[1], r()) * 3;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i)));
    ctx.drawImage(spr, px - s / 2, py - s / 2, s, s);
  }
  ctx.restore();
}

export { font };
