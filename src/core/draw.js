// ─────────────────────────────────────────────────────────────────────────────
// draw.js — canvas craft toolkit: volume shading, 2.5D camera with real
// parallax + depth of field, light, shadow, procedural textures, ink lines,
// paper cards, stamps, halftone. Everything deterministic & cached.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, rng, noise, makeNoise, TAU, E, polyLength } from './math.js';
import { hexToRgb, rgba, shade, mixColor } from './palette.js';

export const W = 1920, H = 1080;

// ── canvases ─────────────────────────────────────────────────────────────────
export function makeCanvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d', { willReadFrequently: false });
  return { c, ctx, w: c.width, h: c.height };
}
// Scratch canvas pool: get a cleared scratch canvas by key (reused each frame)
const scratch = new Map();
export function scratchCanvas(key, w = W, h = H) {
  let s = scratch.get(key);
  if (!s || s.w !== Math.round(w) || s.h !== Math.round(h)) {
    s = makeCanvas(w, h);
    scratch.set(key, s);
  }
  s.ctx.setTransform(1, 0, 0, 1, 0, 0);
  s.ctx.globalAlpha = 1;
  s.ctx.globalCompositeOperation = 'source-over';
  s.ctx.filter = 'none';
  s.ctx.clearRect(0, 0, s.w, s.h);
  return s;
}

// cache for expensive generated textures
const texCache = new Map();
export function cached(key, make) {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key);
}
export function clearCache(prefix) {
  for (const k of [...texCache.keys()]) if (!prefix || k.startsWith(prefix)) texCache.delete(k);
}

// ── basic shapes ─────────────────────────────────────────────────────────────
export function roundRect(ctx, x, y, w, h, r = 12) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
export function star(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
export function poly(ctx, pts, close = false) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}
// smooth closed/open blob through points (quadratic midpoints)
export function smoothPath(ctx, pts, close = true) {
  ctx.beginPath();
  const n = pts.length;
  if (n < 3) return poly(ctx, pts, close);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (close) {
    let m = mid(pts[n - 1], pts[0]);
    ctx.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      m = mid(p, q);
      ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const m = mid(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}
// organic blob outline points (seeded) around a centre
export function blobPoints(cx, cy, r, { n = 14, jitter = 0.18, seed = 1, t = 0, speed = 0.4 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + noise.n3(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3, t * speed) * jitter;
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
  }
  return pts;
}

// ── volume shading (2D that reads as 3D) ─────────────────────────────────────
// Light direction convention: lx,ly in -1..1 (default upper-left key light).
export const LIGHT = { x: -0.55, y: -0.7 };

// Sphere-like shading for any closed path already on ctx (call after building path)
// base: hex. Adds core shadow, bounce, highlight + rim.
export function shadeSphere(ctx, cx, cy, r, base, { lx = LIGHT.x, ly = LIGHT.y, rim = null, spec = 0.35, bounce = 0.18 } = {}) {
  const g = ctx.createRadialGradient(cx + lx * r * 0.45, cy + ly * r * 0.45, r * 0.05, cx, cy, r * 1.05);
  g.addColorStop(0, shade(base, 0.28));
  g.addColorStop(0.45, base);
  g.addColorStop(0.82, shade(base, -0.35));
  g.addColorStop(1, shade(base, -0.55));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // bounce light from below (opposite of key)
  if (bounce > 0) {
    const b = ctx.createRadialGradient(cx - lx * r * 0.9, cy - ly * r * 0.9, 0, cx - lx * r * 0.9, cy - ly * r * 0.9, r * 0.9);
    b.addColorStop(0, rgba(shade(base, 0.15), bounce));
    b.addColorStop(1, rgba(base, 0));
    ctx.fillStyle = b;
    ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  }
  if (spec > 0) {
    const s = ctx.createRadialGradient(cx + lx * r * 0.5, cy + ly * r * 0.5, 0, cx + lx * r * 0.5, cy + ly * r * 0.5, r * 0.4);
    s.addColorStop(0, `rgba(255,252,240,${spec})`);
    s.addColorStop(1, 'rgba(255,252,240,0)');
    ctx.fillStyle = s;
    ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  }
  if (rim) {
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(cx + lx * r * 0.25, cy + ly * r * 0.25, r * 0.78, cx, cy, r * 1.02);
    rg.addColorStop(0, rgba(rim, 0));
    rg.addColorStop(1, rgba(rim, 0.55));
    ctx.fillStyle = rg;
    ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  }
  ctx.restore();
}

// Cylinder shading (vertical cylinder) across x..x+w. Apply to current path.
export function shadeCylinder(ctx, x, w, base, { lx = LIGHT.x, spec = 0.4, rim = null, horizontal = false, y = 0, h = 0 } = {}) {
  const g = horizontal ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
  const hl = clamp(0.5 + lx * 0.32, 0.12, 0.88);
  g.addColorStop(0, shade(base, -0.55));
  g.addColorStop(Math.max(0.02, hl - 0.28), shade(base, -0.12));
  g.addColorStop(hl, shade(base, 0.22));
  g.addColorStop(Math.min(0.98, hl + 0.06), shade(base, spec * 0.6));
  g.addColorStop(Math.min(0.99, hl + 0.22), base);
  g.addColorStop(0.9, shade(base, -0.4));
  g.addColorStop(1, rim ? mixColor(shade(base, -0.3), rim, 0.5) : shade(base, -0.6));
  ctx.fillStyle = g;
  ctx.fill();
}

// Contact shadow: soft ellipse on the ground under an object
export function contactShadow(ctx, x, y, w, { h = null, alpha = 0.45, color = '#0A0F1A', blur = 0.6 } = {}) {
  const hh = h ?? w * 0.16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, hh / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(clamp(1 - blur), rgba(color, alpha * 0.55));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, w / 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Drop shadow under arbitrary drawing: fn draws the silhouette.
export function withShadow(ctx, fn, { blur = 30, x = 0, y = 14, color = 'rgba(8,12,20,.35)' } = {}) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = x;
  ctx.shadowOffsetY = y;
  fn(ctx);
  ctx.restore();
}

// ── light ────────────────────────────────────────────────────────────────────
export function glow(ctx, x, y, r, color, alpha = 0.6, op = 'lighter') {
  ctx.save();
  ctx.globalCompositeOperation = op;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.35, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
// Volumetric light cone (spotlight / window beam / searchlight)
export function lightCone(ctx, x, y, angle, spread, length, color = '#FFF2D6', alpha = 0.25, { op = 'lighter', soft = 0.5 } = {}) {
  // soft-edged wedge without ctx.filter: 4 nested wedges of decreasing spread
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, length, 0);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.6, rgba(color, 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const k = 1 - (i / layers) * (0.35 + soft * 0.5);
    const half = Math.tan((spread * k) / 2) * length;
    ctx.globalAlpha = alpha / layers * (1 + i * 0.3);
    ctx.beginPath();
    ctx.moveTo(0, -half * 0.03);
    ctx.lineTo(length, -half);
    ctx.lineTo(length, half);
    ctx.lineTo(0, half * 0.03);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
// Light rays (god rays) radiating from a point, seeded flicker
export function godRays(ctx, x, y, { count = 14, length = 1400, color = '#FFE7B0', alpha = 0.12, t = 0, seed = 2, spread = TAU, rot = 0 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const a = rot + (i / count) * spread + r.range(-0.1, 0.1);
    const w = r.range(0.02, 0.07);
    const fl = 0.6 + 0.4 * noise.n2(i * 3.1, t * 0.6);
    lightCone(ctx, x, y, a, w, length * r.range(0.6, 1), color, alpha * fl, { op: 'lighter' });
  }
  ctx.restore();
}

// ── gradients & fills ────────────────────────────────────────────────────────
export function vGrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}
export function hGrad(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}
export function fillBg(ctx, color) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
// soft radial "pool of light" background — gives every ground depth
export function pooledBg(ctx, base, { cx = W * 0.5, cy = H * 0.45, r = 1100, light = 0.12, dark = 0.35 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, shade(base, light));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, -dark));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── procedural textures (cached) ─────────────────────────────────────────────
function imageFromFn(w, h, fn) {
  const { c, ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a] = fn(x, y);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

export const tex = {
  // Fibrous paper. Use as background or multiply overlay.
  paper(color = '#EDE4CF', { w = 960, h = 540, seed = 7, fiber = 1, stain = 0.5 } = {}) {
    return cached(`paper:${color}:${w}:${h}:${seed}:${fiber}:${stain}`, () => {
      const [R, G, B] = hexToRgb(color);
      const nz = makeNoise(seed);
      return imageFromFn(w, h, (x, y) => {
        const n1 = nz.fbm2(x / 180, y / 180, 4) * 0.5 + 0.5;
        const n2 = nz.n2(x / 3.1, y / 1.3) * 0.5 + 0.5; // fibres
        const n3 = nz.fbm2(x / 40 + 9, y / 40, 3);
        let k = 1 + (n1 - 0.5) * 0.10 * stain + (n2 - 0.5) * 0.045 * fiber + n3 * 0.025;
        const vx = x / w - 0.5, vy = y / h - 0.5;
        k *= 1 - (vx * vx + vy * vy) * 0.18;
        return [R * k, G * k * 0.995, B * k * 0.985, 255];
      });
    });
  },
  // Neutral grey noise tile for multiply/overlay grit (alpha texture)
  grit(scale = 1, { w = 512, h = 512, seed = 3, alpha = 60 } = {}) {
    return cached(`grit:${scale}:${w}:${seed}:${alpha}`, () => {
      const r = rng(seed);
      const nz = makeNoise(seed);
      return imageFromFn(w, h, (x, y) => {
        const v = nz.fbm2(x / (30 * scale), y / (30 * scale), 4) * 0.5 + 0.5;
        const s = r() < 0.04 ? r() * 0.6 : 0;
        const k = clamp(v * 0.8 + s);
        return [k * 255, k * 255, k * 255, alpha];
      });
    });
  },
  // Concrete / launch-pad slab
  concrete(color = '#9A968C', { w = 800, h = 500, seed = 11 } = {}) {
    return cached(`concrete:${color}:${w}:${h}:${seed}`, () => {
      const [R, G, B] = hexToRgb(color);
      const nz = makeNoise(seed);
      const r = rng(seed);
      return imageFromFn(w, h, (x, y) => {
        const n = nz.fbm2(x / 90, y / 90, 5) * 0.5 + 0.5;
        const p = nz.n2(x / 2.2, y / 2.2) * 0.5 + 0.5;
        const pit = r() < 0.006 ? -0.25 : 0;
        const k = 0.82 + n * 0.28 + (p - 0.5) * 0.08 + pit;
        return [R * k, G * k, B * k, 255];
      });
    });
  },
  // Brushed / painted metal panel (horizontal streaks)
  metal(color = '#C3D0D6', { w = 600, h = 400, seed = 5, streak = 1 } = {}) {
    return cached(`metal:${color}:${w}:${h}:${seed}:${streak}`, () => {
      const [R, G, B] = hexToRgb(color);
      const nz = makeNoise(seed);
      return imageFromFn(w, h, (x, y) => {
        const s = nz.n2(x / 300, y / 1.5) * 0.5 + 0.5;
        const m = nz.fbm2(x / 120, y / 120, 3) * 0.5 + 0.5;
        const k = 0.86 + s * 0.12 * streak + m * 0.08;
        return [R * k, G * k, B * k, 255];
      });
    });
  },
  // Clouds / smoke alpha texture (white with alpha)
  smoke({ w = 512, h = 512, seed = 21, scale = 1, soft = 1 } = {}) {
    return cached(`smoke:${w}:${h}:${seed}:${scale}:${soft}`, () => {
      const nz = makeNoise(seed);
      return imageFromFn(w, h, (x, y) => {
        const dx = x / w - 0.5, dy = y / h - 0.5;
        const fall = clamp(1 - Math.sqrt(dx * dx + dy * dy) * 2);
        const n = nz.fbm2((x / w) * 4 * scale, (y / h) * 4 * scale, 5) * 0.5 + 0.5;
        const a = clamp((n - 0.35) * 2.2) * Math.pow(fall, soft);
        return [255, 255, 255, a * 255];
      });
    });
  },
  // Star field (seeded), transparent background
  stars({ w = W, h = H, seed = 4, count = 900, big = 30 } = {}) {
    return cached(`stars:${w}:${h}:${seed}:${count}:${big}`, () => {
      const { c, ctx } = makeCanvas(w, h);
      const r = rng(seed);
      for (let i = 0; i < count; i++) {
        const x = r() * w, y = r() * h, s = Math.pow(r(), 3) * 1.6 + 0.3;
        const warm = r();
        ctx.fillStyle = warm < 0.15 ? '#FFE2C0' : warm > 0.85 ? '#CFE3FF' : '#F4F1EA';
        ctx.globalAlpha = 0.3 + r() * 0.7;
        ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
      }
      for (let i = 0; i < big; i++) {
        const x = r() * w, y = r() * h;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6 + r() * 6);
        g.addColorStop(0, 'rgba(255,250,240,0.9)');
        g.addColorStop(1, 'rgba(255,250,240,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(x - 14, y - 14, 28, 28);
      }
      return c;
    });
  },
  // Halftone dot screen pattern tile (for newspaper/propaganda)
  halftoneDots(cell = 8, color = '#1B1B1B', { size = 0.42 } = {}) {
    return cached(`htdots:${cell}:${color}:${size}`, () => {
      const { c, ctx } = makeCanvas(cell, cell);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cell / 2, cell / 2, cell * size, 0, TAU); ctx.fill();
      return c;
    });
  },
};

// Fill current canvas area (or path clip) with a texture pattern
export function fillTexture(ctx, texCanvas, { x = 0, y = 0, w = W, h = H, alpha = 1, op = 'source-over', scale = 1, offX = 0, offY = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = op;
  const pat = ctx.createPattern(texCanvas, 'repeat');
  if (scale !== 1 || offX || offY) pat.setTransform(new DOMMatrix().translate(offX, offY).scale(scale));
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
// Overlay texture INSIDE the current path (call after building a path)
export function texturePath(ctx, texCanvas, { alpha = 0.35, op = 'multiply', scale = 1, offX = 0, offY = 0 } = {}) {
  ctx.save();
  ctx.clip();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = op;
  const pat = ctx.createPattern(texCanvas, 'repeat');
  pat.setTransform(new DOMMatrix().translate(offX, offY).scale(scale));
  ctx.fillStyle = pat;
  ctx.fillRect(-5000, -5000, 10000, 10000);
  ctx.restore();
}
// Paper ground: full-frame textured paper with soft light pool
export function paperBg(ctx, color = '#EDE4CF', { seed = 7, light = 0.035, dark = 0.24, cx, cy } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tex.paper(color, { seed }), 0, 0, W, H);
  const g = ctx.createRadialGradient(cx ?? W * 0.5, cy ?? H * 0.42, 0, cx ?? W * 0.5, cy ?? H * 0.42, 1250);
  g.addColorStop(0, `rgba(255,250,235,${light})`);
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(20,16,10,${dark})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── ink lines (the "trajectory" motif) ───────────────────────────────────────
// Hand-drawn line along polyline points, drawn up to fraction `p`.
// Variable width & slight wobble make it read as ink, not vector.
export function inkLine(ctx, pts, p = 1, { width = 4, color = '#F4EBD6', wobble = 1.2, seed = 1, taper = true, alpha = 1, dash = null, head = false } = {}) {
  if (pts.length < 2 || p <= 0) return null;
  const total = polyLength(pts);
  const target = total * clamp(p);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  let acc = 0, last = null;
  const nz = noise;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (acc >= target) break;
    const k = Math.min(1, (target - acc) / (seg || 1));
    const ex = x0 + (x1 - x0) * k, ey = y0 + (y1 - y0) * k;
    const u = acc / total;
    const wv = nz.n2(u * 9 + seed, seed * 3.3) * wobble;
    const tp = taper ? Math.min(1, u * 12, (1 - u) * 12 + 0.4) : 1;
    ctx.lineWidth = Math.max(0.6, width * tp * (1 + nz.n2(u * 23, seed) * 0.18));
    ctx.beginPath();
    ctx.moveTo(x0 + wv, y0 - wv);
    ctx.lineTo(ex + wv, ey - wv);
    ctx.stroke();
    last = { x: ex, y: ey, a: Math.atan2(y1 - y0, x1 - x0) };
    acc += seg;
  }
  if (head && last) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(last.x, last.y, width * 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  return last;
}

// Thin technical leader line with dot + label anchor (for callouts)
export function leader(ctx, x0, y0, x1, y1, p = 1, { color = '#F4EBD6', width = 1.5, dot = 5, elbow = true } = {}) {
  const pts = elbow ? [[x0, y0], [x1, y0 + (y1 - y0) * 0.0 + (y1 - y0)], [x1, y1]] : [[x0, y0], [x1, y1]];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  const e = E.outCubic(clamp(p));
  ctx.beginPath();
  ctx.arc(x0, y0, dot * clamp(p * 4), 0, TAU);
  ctx.fill();
  const total = polyLength(pts);
  let rem = total * e;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && rem > 0; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const k = Math.min(1, rem / (seg || 1));
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
    rem -= seg;
  }
  ctx.stroke();
  ctx.restore();
}

// Corner brackets (viewfinder / telemetry framing) around a rect
export function brackets(ctx, x, y, w, h, { len = 26, color = '#F4EBD6', width = 2, p = 1 } = {}) {
  const l = len * E.outCubic(clamp(p));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y);
  ctx.moveTo(x + w - l, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + l);
  ctx.moveTo(x + w, y + h - l); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - l, y + h);
  ctx.moveTo(x + l, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - l);
  ctx.stroke();
  ctx.restore();
}

// ── paper objects ────────────────────────────────────────────────────────────
// Torn-edge paper card with grain and shadow. Draw content inside via fn(ctx) in card coords.
export function paperCard(ctx, x, y, w, h, { color = '#F2EAD8', rot = 0, seed = 5, torn = 0.6, shadow = true, fn = null, lift = 1 } = {}) {
  const r = rng(seed);
  const pts = [];
  const steps = 22;
  const jag = (i) => (r() - 0.5) * 6 * torn;
  for (let i = 0; i <= steps; i++) pts.push([(-w / 2) + (w * i) / steps, -h / 2 + jag(i)]);
  for (let i = 0; i <= steps; i++) pts.push([w / 2 + jag(i), -h / 2 + (h * i) / steps]);
  for (let i = steps; i >= 0; i--) pts.push([(-w / 2) + (w * i) / steps, h / 2 + jag(i)]);
  for (let i = steps; i >= 0; i--) pts.push([-w / 2 + jag(i), -h / 2 + (h * i) / steps]);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(10,8,4,0.32)';
    ctx.shadowBlur = 18 * lift;
    ctx.shadowOffsetX = 6 * lift;
    ctx.shadowOffsetY = 12 * lift;
    poly(ctx, pts, true);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  poly(ctx, pts, true);
  ctx.fillStyle = color;
  ctx.fill();
  poly(ctx, pts, true);
  texturePath(ctx, tex.paper(color, { seed: seed + 1, w: 512, h: 512 }), { alpha: 0.9, op: 'multiply', scale: 1 });
  if (fn) {
    ctx.save();
    poly(ctx, pts, true);
    ctx.clip();
    fn(ctx);
    ctx.restore();
  }
  ctx.restore();
}

// Rubber stamp (e.g. "TOP SECRET" / "СОВЕРШЕННО СЕКРЕТНО"). p = stamp impact progress.
export function stamp(ctx, label, x, y, p, { color = '#C8322A', size = 64, rot = -0.12, family = "'Big Shoulders Stencil Display'", seed = 9, box = true } = {}) {
  if (p <= 0) return;
  const k = E.outQuint(clamp(p));
  const sc = lerp(1.6, 1, k);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  ctx.globalAlpha *= clamp(p * 4) * 0.92;
  const { c, ctx: s } = scratchCanvas('stamp', 1400, 360);
  s.translate(700, 180);
  s.font = `900 ${size}px ${family}`;
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.letterSpacing = `${size * 0.08}px`;
  const w = s.measureText(label).width;
  s.fillStyle = color;
  s.strokeStyle = color;
  s.fillText(label, 0, 4);
  if (box) {
    s.lineWidth = size * 0.08;
    s.strokeRect(-w / 2 - size * 0.35, -size * 0.72, w + size * 0.7, size * 1.44);
  }
  // distress with grit
  s.globalCompositeOperation = 'destination-out';
  const grit = tex.grit(0.6, { seed, alpha: 255 });
  const pat = s.createPattern(grit, 'repeat');
  s.globalAlpha = 0.55;
  s.fillStyle = pat;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.fillRect(0, 0, 1400, 360);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c, -700, -180);
  ctx.restore();
}

// Halftone a source canvas (for newspaper / propaganda prints).
// Draws dots whose radius ∝ darkness. Expensive: use on <= 640x360 regions.
export function halftone(ctx, src, x, y, w, h, { cell = 9, color = '#1B1A17', angle = 0.26, bg = null, sampleScale = 1 } = {}) {
  const sw = Math.ceil(w / cell), sh = Math.ceil(h / cell);
  const { c, ctx: s } = scratchCanvas('halftone-sample', sw, sh);
  s.drawImage(src, 0, 0, sw, sh);
  const d = s.getImageData(0, 0, sw, sh).data;
  ctx.save();
  ctx.translate(x, y);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.fillStyle = color;
  for (let j = 0; j < sh; j++)
    for (let i = 0; i < sw; i++) {
      const k = (j * sw + i) * 4;
      const lum = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255;
      const a = d[k + 3] / 255;
      const r = (1 - lum) * a * cell * 0.62 * sampleScale;
      if (r < 0.35) continue;
      const ox = (j % 2) * cell * 0.5 * Math.sin(angle * 4);
      ctx.beginPath();
      ctx.arc(i * cell + cell / 2 + ox, j * cell + cell / 2, r, 0, TAU);
      ctx.fill();
    }
  ctx.restore();
}

// ── 2.5D camera with true perspective parallax & depth of field ─────────────
// World planes live at depth z (bigger = farther). Camera at (x,y,z) looks +z.
// A plane at z = cam.z + f renders at scale 1. Default cam: x=y=0, z=-1000, f=1000,
// so content authored on a plane at z=0 appears 1:1 centred on screen.
export class Cam25 {
  constructor({ x = 0, y = 0, z = -1000, f = 1000, rot = 0, focus = 0, aperture = 0 } = {}) {
    Object.assign(this, { x, y, z, f, rot, focus, aperture });
  }
  set(o) { Object.assign(this, o); return this; }
  scaleAt(z) { return this.f / Math.max(1, z - this.z); }
  // world point on plane z → screen
  project(x, y, z) {
    const s = this.scaleAt(z);
    const c = Math.cos(this.rot), sn = Math.sin(this.rot);
    const dx = (x - this.x) * s, dy = (y - this.y) * s;
    return { x: W / 2 + dx * c - dy * sn, y: H / 2 + dx * sn + dy * c, s };
  }
  blurAt(z) {
    if (!this.aperture) return 0;
    const d = Math.abs(1 / Math.max(1, z - this.z) - 1 / Math.max(1, this.focus - this.z));
    return Math.min(40, d * this.f * this.aperture * 10);
  }
  // Draw a plane. fn(ctx, s) draws in world units. Applies parallax + DOF.
  plane(ctx, z, fn, { blur = null, alpha = 1, op = null } = {}) {
    const dz = z - this.z;
    if (dz <= 20) return;
    const s = this.f / dz;
    const b = blur ?? this.blurAt(z);
    const apply = (c) => {
      c.translate(W / 2, H / 2);
      c.rotate(this.rot);
      c.scale(s, s);
      c.translate(-this.x, -this.y);
    };
    if (b > 0.6) {
      const sc = scratchCanvas('cam25-plane');
      sc.ctx.save();
      apply(sc.ctx);
      fn(sc.ctx, s);
      sc.ctx.restore();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha *= alpha;
      if (op) ctx.globalCompositeOperation = op;
      ctx.filter = `blur(${b.toFixed(1)}px)`;
      ctx.drawImage(sc.c, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha *= alpha;
      if (op) ctx.globalCompositeOperation = op;
      apply(ctx);
      fn(ctx, s);
      ctx.restore();
    }
  }
}

// Blur-draw any canvas/image (DOF, rack focus, blur transitions)
export function drawBlurred(ctx, img, x, y, w, h, blur = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.drawImage(img, x, y, w ?? img.width, h ?? img.height);
  ctx.restore();
}

// Atmospheric haze band (fog between depth planes)
export function haze(ctx, y0, y1, color, alpha = 0.4) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, y1 - y0);
  ctx.restore();
}

// ── particles (deterministic, stateless) ────────────────────────────────────
// Each particle's state is a pure function of (index, t). spawn over [0, life].
// opts: count, seed, life (s), emit {x,y,w,h}, vel [vx,vy] ranges, grav, drag, size, color, fade
export function particles(ctx, t, { count = 120, seed = 1, life = 3, rate = null, emit = { x: W / 2, y: H / 2, w: 0, h: 0 }, vx = [-40, 40], vy = [-120, -40], grav = 0, size = [1, 3], color = '#FFE3A1', op = 'lighter', alpha = 1, shape = 'dot', turb = 0, stretch = 0 } = {}) {
  const r = rng(seed);
  const spawnSpan = rate ? count / rate : life;
  ctx.save();
  ctx.globalCompositeOperation = op;
  for (let i = 0; i < count; i++) {
    const birth = r() * spawnSpan;
    const ex = emit.x + (r() - 0.5) * emit.w, ey = emit.y + (r() - 0.5) * emit.h;
    const pvx = lerp(vx[0], vx[1], r()), pvy = lerp(vy[0], vy[1], r());
    const ps = lerp(size[0], size[1], r());
    const plife = life * (0.6 + r() * 0.4);
    const ph = r() * 100;
    // looped age so emission is continuous
    let age = t - birth;
    if (age < 0) continue;
    age = age % (spawnSpan > plife ? spawnSpan : plife);
    if (age > plife) continue;
    const u = age / plife;
    let x = ex + pvx * age, y = ey + pvy * age + 0.5 * grav * age * age;
    if (turb) { x += noise.n2(ph, age * 0.8) * turb; y += noise.n2(ph + 9, age * 0.8) * turb; }
    const a = alpha * Math.sin(Math.PI * Math.min(1, u * 1.2)) * (1 - u * 0.3);
    ctx.globalAlpha = clamp(a);
    ctx.fillStyle = typeof color === 'function' ? color(u, i) : color;
    if (stretch) {
      const vxx = pvx, vyy = pvy + grav * age;
      const ang = Math.atan2(vyy, vxx), len = Math.hypot(vxx, vyy) * stretch;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillRect(-len, -ps / 2, len, ps);
      ctx.restore();
    } else if (shape === 'square') ctx.fillRect(x - ps / 2, y - ps / 2, ps, ps);
    else { ctx.beginPath(); ctx.arc(x, y, ps * (1 - u * 0.4), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// Billowing smoke / vapour plume: stack of rotating smoke sprites (stateless).
export function smokePlume(ctx, t, { x = W / 2, y = H, count = 26, seed = 4, rise = 60, spread = 260, size = [120, 380], life = 6, color = '#E9E4DA', alpha = 0.5, drift = 30, op = 'source-over', dirX = 0 } = {}) {
  const r = rng(seed);
  const sm = tex.smoke({ seed: seed % 5 + 20 });
  ctx.save();
  ctx.globalCompositeOperation = op;
  for (let i = 0; i < count; i++) {
    const birth = r() * life;
    const age = ((t - birth) % life + life) % life;
    const u = age / life;
    const ox = (r() - 0.5) * spread * 0.4;
    const sx = x + ox + dirX * age * rise * 0.6 + noise.n2(i * 2.1, t * 0.2) * drift * u * 3;
    const sy = y - age * rise * (0.6 + r() * 0.8);
    const sz = lerp(size[0], size[1], r()) * (0.5 + u * 1.2);
    const rot = r() * TAU + t * (r() - 0.5) * 0.3;
    const a = alpha * Math.sin(Math.PI * u) ;
    if (a <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    // tint: draw smoke sprite then colourise with source-atop on scratch
    ctx.drawImage(tintedSmoke(color, seed % 5 + 20), -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }
  ctx.restore();
  void sm;
}
function tintedSmoke(color, seed) {
  return cached(`tsmoke:${color}:${seed}`, () => {
    const base = tex.smoke({ seed });
    const { c, ctx } = makeCanvas(base.width, base.height);
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  });
}
export { tintedSmoke };

// ── misc ─────────────────────────────────────────────────────────────────────
// Letterbox bars (cinematic moments). amt 0..1
export function letterbox(ctx, amt = 1, color = '#060A12', h = 120) {
  if (amt <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = color;
  const hh = h * E.inOutCubic(clamp(amt));
  ctx.fillRect(0, 0, W, hh);
  ctx.fillRect(0, H - hh, W, hh);
  ctx.restore();
}
// Apply a 2D camera transform (simple): centre-based zoom/pan/rotate
export function camera2D(ctx, { x = 0, y = 0, zoom = 1, rot = 0, cx = W / 2, cy = H / 2 } = {}) {
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx - x, -cy - y);
}
