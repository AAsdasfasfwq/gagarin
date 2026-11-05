// ─────────────────────────────────────────────────────────────────────────────
// p2/lib.js — shared craft for "Launch Site 41": the R-16 drawing, night pad
// environment, fire / smoke / ash systems, the chair, crew variants, and a
// perspective ground-plane projection for tilted maps. All deterministic.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, rng, noise, TAU, E, tw, smoothstep } from '../../core/math.js';
import { C, rgba, shade, mixColor, ramp, FIRE_RAMP } from '../../core/palette.js';
import { F, setText } from '../../core/type.js';
import { W, H, tex, texturePath, shadeCylinder, glow, lightCone, tintedSmoke, cached, makeCanvas, contactShadow } from '../../core/draw.js';
import { CAST, drawCharacter } from '../../core/characters.js';

export const NIGHT = '#101A2E';
export const ASH = '#3A3733';
export const SODIUM = '#FFC77A';
export const UDMH = C.acid;          // fuel — chartreuse (P1 droplet)
export const NITRIC = '#E8A33A';     // oxidizer — amber (P1 droplet)
export const BODY = mixColor(C.steelLight, C.toxicDark, 0.16);

// ── tiny helpers ────────────────────────────────────────────────────────────
export const env = (t, a, b, c, d) => tw(t, a, b, E.out) * (1 - tw(t, c, d, E.in));
export function monoTag(ctx, str, x, y, { size = 26, color = C.cream, align = 'left', alpha = 1, p = 1, weight = 600, tracking = 2 } = {}) {
  if (p <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  setText(ctx, { family: F.MONO, size, weight, color, align, baseline: 'middle', tracking });
  const s = `[ ${str} ]`;
  ctx.fillText(s.slice(0, Math.ceil(s.length * clamp(p))), x, y);
  ctx.restore();
}
// full-frame fill in screen space
export function screenFill(ctx, color, alpha = 1, op = 'source-over') {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op;
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
export function vignette(ctx, amt = 0.5, color = C.inkDeep, r0 = 0.45) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * r0, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, amt));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── perspective ground plane (tilted map / top-down) ─────────────────────────
// World plane coords (X,Y). Camera above looking down, pitched by `tilt` (rad,
// 0 = top-down). Returns p(X,Y) → {x,y,s}.
export function groundProj({ cx = W / 2, cy = H / 2, tilt = 0.5, D = 1400, f = 1400, camX = 0, camY = 0, rot = 0, zoom = 1 } = {}) {
  const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
  return (X, Y) => {
    let x = X - camX, y = Y - camY;
    const rx = x * cr - y * sr, ry = x * sr + y * cr;
    const zc = D - ry * st;
    const k = (f * zoom) / Math.max(40, zc);
    return { x: cx + rx * k, y: cy + ry * ct * k, s: k };
  };
}
export function projPath(ctx, proj, pts, close = false) {
  ctx.beginPath();
  pts.forEach(([X, Y], i) => { const p = proj(X, Y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
  if (close) ctx.closePath();
}
export function projRect(ctx, proj, x, y, w, h) { projPath(ctx, proj, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true); }

// ── night environment ────────────────────────────────────────────────────────
export function nightSky(ctx, { horizon = 760, t = 0, glowX = 960, starsAlpha = 0.8, offY = 0, offX = 0, warm = 0.35 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, offY - 200, 0, horizon + offY + 200);
  g.addColorStop(0, '#070D1A');
  g.addColorStop(0.55, NIGHT);
  g.addColorStop(0.86, mixColor(NIGHT, '#3A3550', 0.6));
  g.addColorStop(1, mixColor('#3A3550', SODIUM, 0.18));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const st = tex.stars({ seed: 41, count: 700, big: 18 });
  ctx.globalAlpha = starsAlpha;
  const sy = ((offY * 0.25) % H + H) % H, sx = ((offX * 0.25) % W + W) % W;
  ctx.drawImage(st, -sx, -sy); ctx.drawImage(st, W - sx, -sy); ctx.drawImage(st, -sx, H - sy); ctx.drawImage(st, W - sx, H - sy);
  ctx.globalAlpha = 1;
  // twinkle few bright stars
  const r = rng(77);
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = r() * horizon * 0.8 - sy * 0.2;
    const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * (1.5 + r() * 2) + i));
    glow(ctx, x, y, 7, '#F4F1EA', a);
  }
  // horizon sodium haze
  const hz = ctx.createRadialGradient(glowX, horizon + offY, 0, glowX, horizon + offY, 1100);
  hz.addColorStop(0, rgba(SODIUM, 0.22 * warm)); hz.addColorStop(0.5, rgba('#6B5A7A', 0.12 * warm)); hz.addColorStop(1, rgba(NIGHT, 0));
  ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── the R-16 (side elevation) ────────────────────────────────────────────────
// x = centreline, y = base (ground line), h = full height (px).
// Section fractions from the base. The interstage is an OPEN TRUSS — the
// second-stage nozzles sit exposed right above the first-stage tank dome.
export const R16 = {
  skirt: [0, 0.085], f1: [0.095, 0.3], o1: [0.315, 0.555], truss: [0.555, 0.605],
  f2: [0.61, 0.7], o2: [0.71, 0.83], nose: [0.83, 1.0], r: 0.05,
};
export function r16Point(x, y, h, frac, side = 0) { return { x: x + side * h * R16.r, y: y - frac * h }; }

function sectionRect(ctx, x, y, h, a, b, rr) { ctx.beginPath(); ctx.rect(x - rr, y - b * h, rr * 2, (b - a) * h); }

export function drawR16(ctx, x, y, h, o = {}) {
  const { mode = 'solid', body = BODY, light = -0.5, rim = null, warm = null, warmAmt = 0.35, fill = { f1: 1, o1: 1, f2: 1, o2: 1 }, ink = C.cream, lw = 2, alpha = 1, nozzleGlow = 0, xray = 0, seed = 3 } = o;
  const r = h * R16.r;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (mode === 'outline' || mode === 'silhouette') {
    const p = r16OutlinePath(x, y, h);
    if (mode === 'silhouette') { ctx.fillStyle = o.color || C.inkDeep; ctx.fill(p); }
    else { ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(p); }
    ctx.restore();
    return;
  }
  // nozzles (stage 1) peeking under the skirt
  for (let i = -1; i <= 1; i += 2) {
    const nx = x + i * r * 0.45;
    ctx.beginPath(); ctx.moveTo(nx - r * 0.18, y); ctx.lineTo(nx + r * 0.18, y); ctx.lineTo(nx + r * 0.32, y + h * 0.035); ctx.lineTo(nx - r * 0.32, y + h * 0.035); ctx.closePath();
    shadeCylinder(ctx, nx - r * 0.32, r * 0.64, '#4A4E52', { lx: light });
  }
  const metal = tex.metal(body, { w: 256, h: 256, seed: 5 + seed });
  const section = (a, b, col, rr = r) => {
    sectionRect(ctx, x, y, h, a, b, rr);
    shadeCylinder(ctx, x - rr, rr * 2, col, { lx: light, rim, spec: 0.35 });
    sectionRect(ctx, x, y, h, a, b, rr);
    texturePath(ctx, metal, { alpha: 0.5, op: 'multiply', scale: 0.6 });
  };
  section(0, R16.truss[0], body);
  section(R16.truss[1], R16.nose[0], body);
  // nose (warhead) ogive
  const nb = y - R16.nose[0] * h, nt = y - h;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.96, nb);
  ctx.bezierCurveTo(x - r * 0.96, nb - (nb - nt) * 0.55, x - r * 0.3, nt + r * 0.2, x - r * 0.12, nt);
  ctx.lineTo(x + r * 0.12, nt);
  ctx.bezierCurveTo(x + r * 0.3, nt + r * 0.2, x + r * 0.96, nb - (nb - nt) * 0.55, x + r * 0.96, nb);
  ctx.closePath();
  shadeCylinder(ctx, x - r, r * 2, shade(C.steelDark, 0.08), { lx: light, rim });
  // open truss interstage with stage-2 nozzles visible
  const ta = y - R16.truss[0] * h, tb = y - R16.truss[1] * h;
  ctx.fillStyle = rgba(C.inkDeep, 0.85);
  ctx.fillRect(x - r * 0.96, tb, r * 1.92, ta - tb);
  for (let i = -1; i <= 1; i += 2) {
    const nx = x + i * r * 0.4;
    ctx.beginPath(); ctx.moveTo(nx - r * 0.12, tb); ctx.lineTo(nx + r * 0.12, tb); ctx.lineTo(nx + r * 0.26, ta - r * 0.15); ctx.lineTo(nx - r * 0.26, ta - r * 0.15); ctx.closePath();
    ctx.fillStyle = '#3A3F44'; ctx.fill();
    if (nozzleGlow > 0) glow(ctx, nx, ta - r * 0.1, r * 1.2 * nozzleGlow, C.fire3, 0.8 * nozzleGlow);
  }
  ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.beginPath();
  const nTr = 4;
  for (let i = 0; i < nTr; i++) {
    const x0 = x - r + (i * 2 * r) / nTr, x1 = x - r + ((i + 1) * 2 * r) / nTr;
    ctx.moveTo(x0, ta); ctx.lineTo(x1, tb); ctx.moveTo(x1, ta); ctx.lineTo(x0, tb);
  }
  ctx.moveTo(x - r, ta); ctx.lineTo(x - r, tb); ctx.moveTo(x + r, ta); ctx.lineTo(x + r, tb);
  ctx.stroke();
  // rings / panel lines
  ctx.strokeStyle = rgba(shade(body, -0.5), 0.75); ctx.lineWidth = Math.max(1, h * 0.0022);
  [0.085, 0.3, 0.315, 0.555, 0.605, 0.7, 0.71, 0.83].forEach((f) => { ctx.beginPath(); ctx.moveTo(x - r, y - f * h); ctx.lineTo(x + r, y - f * h); ctx.stroke(); });
  ctx.strokeStyle = rgba(shade(body, -0.4), 0.35);
  [0.19, 0.43, 0.65, 0.77].forEach((f) => { ctx.beginPath(); ctx.moveTo(x - r, y - f * h); ctx.lineTo(x + r, y - f * h); ctx.stroke(); });
  // external cable raceway (where the faults live)
  ctx.fillStyle = shade(body, -0.22);
  ctx.fillRect(x + r * 0.52, y - 0.83 * h, r * 0.16, (0.83 - 0.09) * h);
  ctx.fillStyle = rgba(C.white, 0.18);
  ctx.fillRect(x + r * 0.52, y - 0.83 * h, r * 0.04, (0.83 - 0.09) * h);
  // stencil markings
  ctx.save();
  ctx.fillStyle = rgba(C.inkDeep, 0.55);
  ctx.font = `800 ${Math.max(8, r * 0.34)}px ${F.STENCIL}`;
  ctx.textAlign = 'center';
  ctx.translate(x - r * 0.25, y - 0.45 * h);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('8K64', 0, 0);
  ctx.restore();
  ctx.fillStyle = C.red;
  ctx.fillRect(x - r * 0.96, y - 0.835 * h, r * 1.92, h * 0.006);
  // warm floodlight wash from one side
  if (warm) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gx = ctx.createLinearGradient(x - r, 0, x + r, 0);
    const side = o.warmSide ?? 1;
    gx.addColorStop(side > 0 ? 0.55 : 0, rgba(warm, 0)); gx.addColorStop(side > 0 ? 1 : 0.45, rgba(warm, 0));
    gx.addColorStop(side > 0 ? 0.92 : 0.08, rgba(warm, warmAmt));
    ctx.fillStyle = gx;
    ctx.beginPath(); ctx.rect(x - r, y - R16.nose[0] * h, r * 2, R16.nose[0] * h); ctx.fill();
    ctx.restore();
  }
  // x-ray tank fills (fueled)
  if (xray > 0) r16Xray(ctx, x, y, h, fill, xray);
  ctx.restore();
}
// translucent tank fills seen "through" the hull
export function r16Xray(ctx, x, y, h, fill, a = 1) {
  const r = h * R16.r;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const tank = (sec, col, lvl) => {
    if (lvl <= 0) return;
    const y0 = y - sec[0] * h, y1 = y - sec[1] * h;
    const top = lerp(y0, y1, clamp(lvl));
    const g = ctx.createLinearGradient(0, top, 0, y0);
    g.addColorStop(0, rgba(col, 0.55 * a)); g.addColorStop(0.08, rgba(col, 0.28 * a)); g.addColorStop(1, rgba(col, 0.18 * a));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x - r * 0.86, top, r * 1.72, y0 - top - r * 0.08, r * 0.3); ctx.fill();
    ctx.fillStyle = rgba(col, 0.9 * a); ctx.fillRect(x - r * 0.86, top - 1, r * 1.72, 2.5);
  };
  tank(R16.f1, UDMH, fill.f1); tank(R16.o1, NITRIC, fill.o1); tank(R16.f2, UDMH, fill.f2); tank(R16.o2, NITRIC, fill.o2);
  ctx.restore();
}
export function r16OutlinePath(x, y, h) {
  const r = h * R16.r, nb = y - R16.nose[0] * h, nt = y - h;
  const p = new Path2D();
  p.moveTo(x - r, y);
  p.lineTo(x - r, nb);
  p.lineTo(x - r * 0.96, nb);
  p.bezierCurveTo(x - r * 0.96, nb - (nb - nt) * 0.55, x - r * 0.3, nt + r * 0.2, x - r * 0.12, nt);
  p.lineTo(x + r * 0.12, nt);
  p.bezierCurveTo(x + r * 0.3, nt + r * 0.2, x + r * 0.96, nb - (nb - nt) * 0.55, x + r * 0.96, nb);
  p.lineTo(x + r, nb);
  p.lineTo(x + r, y);
  p.closePath();
  return p;
}
// outline as point list (for ink morphs / dragon coils)
export function r16OutlinePts(x, y, h, n = 120) {
  const r = h * R16.r, nb = y - R16.nose[0] * h, nt = y - h;
  const pts = [];
  const seg = (a, b, k) => { for (let i = 0; i < k; i++) pts.push([lerp(a[0], b[0], i / k), lerp(a[1], b[1], i / k)]); };
  const bez = (p0, p1, p2, p3, k) => { for (let i = 0; i < k; i++) { const t = i / k, u = 1 - t; pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } };
  const k = Math.round(n / 6);
  seg([x - r, y], [x - r, nb], k * 2);
  bez([x - r * 0.96, nb], [x - r * 0.96, nb - (nb - nt) * 0.55], [x - r * 0.3, nt + r * 0.2], [x, nt], k);
  bez([x, nt], [x + r * 0.3, nt + r * 0.2], [x + r * 0.96, nb - (nb - nt) * 0.55], [x + r * 0.96, nb], k);
  seg([x + r, nb], [x + r, y], k * 2);
  pts.push([x + r, y]);
  return pts;
}

// ── fire / smoke / ash ───────────────────────────────────────────────────────
const FIRE_COLS = [C.fire1, C.fire2, C.fire3, C.fire4];
// Volumetric fireball: additive tinted smoke sprites, hot core → cool rim, + soot cap.
export function fireball(ctx, x, y, R, t, { seed = 1, count = 46, heat = 1, alpha = 1, soot = 0.8, rise = 1, spin = 0.25 } = {}) {
  const r = rng(seed);
  ctx.save();
  // soot first (behind, upward)
  if (soot > 0) {
    for (let i = 0; i < Math.round(count * 0.45); i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R * 0.9, sz = R * (0.7 + r() * 0.8);
      const sx = x + Math.cos(a) * d * 1.1 + noise.n2(i * 1.7, t * 0.3) * R * 0.15;
      const sy = y + Math.sin(a) * d * 0.8 - R * 0.45 * rise - t * 18 * rise;
      ctx.globalAlpha = alpha * soot * 0.55;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(r() * TAU + t * spin * (r() - 0.5));
      ctx.drawImage(tintedSmoke(C.soot, 20 + (i % 5)), -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const a = r() * TAU, d0 = Math.pow(r(), 0.8);
    const d = d0 * R * 0.85;
    const sz = R * (0.35 + r() * 0.75) * (1.15 - d0 * 0.4);
    const wob = noise.n2(i * 3.1, t * 0.9) * R * 0.12;
    const sx = x + Math.cos(a) * d + wob;
    const sy = y + Math.sin(a) * d * 0.85 - d0 * R * 0.12 * rise + noise.n2(i * 2.3 + 40, t * 0.8) * R * 0.1;
    const hk = clamp((1 - d0) * heat * 1.15 + 0.05);
    const col = ramp(FIRE_RAMP, clamp(0.25 + hk * 0.72));
    ctx.globalAlpha = clamp(alpha * (0.32 + hk * 0.4));
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(r() * TAU + t * spin * (r() - 0.5) * 2);
    ctx.drawImage(tintedSmoke(col, 20 + (i % 5)), -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }
  ctx.restore();
  glow(ctx, x, y, R * 1.6, C.fire3, 0.35 * alpha * heat);
  glow(ctx, x, y, R * 0.6, C.fire5, 0.5 * alpha * heat * heat);
}
// Licking flame tongues along a baseline (illustrative, path-based)
export function flameTongues(ctx, x0, x1, y, h, t, { seed = 3, n = 9, alpha = 1, cols = null, lean = 0, op = 'lighter' } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = op;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n + (r() - 0.5) * 0.06;
    const bx = lerp(x0, x1, u), bw = ((x1 - x0) / n) * (1.1 + r() * 0.9);
    const ph = r() * 10, hh = h * (0.55 + r() * 0.6) * (0.85 + 0.25 * noise.n2(i * 2.1, t * 1.7 + ph));
    const sway = noise.n2(i * 4.1 + 9, t * 2.2 + ph) * bw * 0.6 + lean * hh;
    const tipX = bx + sway, tipY = y - hh;
    const g = ctx.createLinearGradient(0, y, 0, tipY);
    const cc = cols || [C.fire4, C.fire3, C.fire2];
    g.addColorStop(0, rgba(cc[0], 0.9 * alpha)); g.addColorStop(0.35, rgba(cc[1], 0.75 * alpha)); g.addColorStop(0.75, rgba(cc[2], 0.45 * alpha)); g.addColorStop(1, rgba(cc[2], 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, y);
    ctx.bezierCurveTo(bx - bw * 0.55, y - hh * 0.45, tipX - bw * 0.25 + sway * 0.2, tipY + hh * 0.35, tipX, tipY);
    ctx.bezierCurveTo(tipX + bw * 0.2 + sway * 0.2, tipY + hh * 0.4, bx + bw * 0.6, y - hh * 0.4, bx + bw / 2, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
// Smoke column (soot) rising from a source
export function sootColumn(ctx, t, { x = 960, y = 800, rise = 70, spread = 300, size = [160, 420], count = 30, seed = 6, alpha = 0.7, color = C.soot, dirX = 0.15, life = 7 } = {}) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const birth = r() * life, l = life * (0.8 + r() * 0.4);
    const age = (((t - birth) % l) + l) % l, u = age / l;
    const ox = (r() - 0.5) * spread * 0.35;
    const sx = x + ox + dirX * age * rise + noise.n2(i * 2.7, t * 0.15) * spread * 0.3 * u;
    const sy = y - age * rise * (0.7 + r() * 0.6);
    const sz = lerp(size[0], size[1], r()) * (0.45 + u * 1.3);
    const a = alpha * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * 0.35);
    if (a < 0.01) continue;
    ctx.globalAlpha = a;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(r() * TAU + t * 0.08 * (r() - 0.5));
    ctx.drawImage(tintedSmoke(color, 20 + (i % 5)), -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }
  ctx.restore();
}
// Falling ash flakes (the living layer of the ash state)
export function ashFall(ctx, t, { count = 140, seed = 9, speed = 34, color = '#CFC8BC', alpha = 0.7, size = [1.5, 5], ember = 0.06, x = 0, w = W, y = -40, h = H + 80, wind = 12 } = {}) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x0 = x + r() * w, y0 = r() * h, sp = speed * (0.5 + r() * 0.9), ph = r() * TAU, sz = lerp(size[0], size[1], Math.pow(r(), 2));
    const isEmber = r() < ember;
    const yy = y + ((y0 + t * sp) % h);
    const xx = x0 + Math.sin(t * (0.6 + r() * 0.8) + ph) * 14 + t * wind * (0.5 + r());
    const px = ((xx - x) % w + w) % w + x;
    const flip = Math.cos(t * (2 + r() * 3) + ph);
    ctx.save();
    ctx.translate(px, yy);
    ctx.rotate(ph + t * 0.6);
    ctx.scale(1, 0.35 + Math.abs(flip) * 0.65);
    if (isEmber) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(t * 5 + ph));
      ctx.fillStyle = C.fire3;
    } else { ctx.globalAlpha = alpha * (0.45 + 0.55 * Math.abs(flip)); ctx.fillStyle = color; }
    ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.4); ctx.lineTo(sz * 0.7, -sz * 0.7); ctx.lineTo(sz, sz * 0.5); ctx.lineTo(-sz * 0.5, sz * 0.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
// Rising embers (sparks) from an area
export function embers(ctx, t, { count = 80, seed = 12, x = 960, y = 900, w = 600, h = 40, rise = 160, alpha = 0.9, size = [1, 3], wind = 30, life = 2.8 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const birth = r() * life, l = life * (0.6 + r() * 0.6);
    const age = (((t - birth) % l) + l) % l, u = age / l;
    const ex = x + (r() - 0.5) * w + noise.n2(i, t * 0.7) * 40 * u + wind * age;
    const ey = y + (r() - 0.5) * h - age * rise * (0.6 + r() * 0.8);
    const sz = lerp(size[0], size[1], r()) * (1 - u * 0.6);
    ctx.globalAlpha = alpha * Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(t * 9 + i));
    ctx.fillStyle = u < 0.3 ? C.fire4 : u < 0.7 ? C.fire3 : C.fire2;
    ctx.beginPath(); ctx.arc(ex, ey, sz, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// Dust motes drifting in a light beam (life in still frames)
export function motes(ctx, t, { count = 60, seed = 5, x = 0, y = 0, w = W, h = H, color = C.cream, alpha = 0.35, size = [0.8, 2.2] } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const px = x + ((r() * w + t * (r() - 0.3) * 18 + noise.n2(i * 1.3, t * 0.2) * 30) % w + w) % w;
    const py = y + ((r() * h - t * (r() * 10 + 2) + noise.n2(i * 2.9, t * 0.15) * 30) % h + h) % h;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i)));
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px, py, lerp(size[0], size[1], r()), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ── the chair (bentwood-ish wooden chair, 3/4 view) ─────────────────────────
// (x,y) = floor point under the seat centre, s = scale (seat ≈ 100*s wide)
export function drawChair(ctx, x, y, s, { char = 0, light = -0.6, alpha = 1, line = null } = {}) {
  const wood = mixColor('#8A5A34', C.soot, char * 0.85);
  const dark = shade(wood, -0.4), hi = shade(wood, 0.25 * (1 - char));
  const lc = line || shade(wood, -0.6);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const leg = (x0, y0, x1, y1, w, col) => {
    ctx.beginPath(); ctx.moveTo(x0 - w / 2, y0); ctx.lineTo(x0 + w / 2, y0); ctx.lineTo(x1 + w * 0.4, y1); ctx.lineTo(x1 - w * 0.4, y1); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = lc; ctx.stroke();
  };
  // back legs (far)
  leg(-36, -92, -40, 0, 9, dark);
  leg(46, -96, 50, -6, 9, dark);
  // backrest posts + slats
  ctx.save();
  leg(-38, -205, -36, -92, 9, wood);
  leg(44, -210, 46, -96, 9, dark);
  for (let i = 0; i < 3; i++) {
    const yy = -195 + i * 26;
    ctx.beginPath(); ctx.moveTo(-36, yy); ctx.quadraticCurveTo(4, yy - 8, 44, yy - 4); ctx.lineTo(44, yy + 10); ctx.quadraticCurveTo(4, yy + 6, -36, yy + 13); ctx.closePath();
    const g = ctx.createLinearGradient(0, yy - 6, 0, yy + 12); g.addColorStop(0, hi); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = lc; ctx.stroke();
  }
  ctx.restore();
  // seat (parallelogram top with thickness)
  ctx.beginPath(); ctx.moveTo(-52, -92); ctx.lineTo(54, -98); ctx.lineTo(70, -78); ctx.lineTo(-40, -70); ctx.closePath();
  const sg = ctx.createLinearGradient(-50, -98, 60, -70); sg.addColorStop(0, hi); sg.addColorStop(0.6, wood); sg.addColorStop(1, dark);
  ctx.fillStyle = sg; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = lc; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-40, -70); ctx.lineTo(70, -78); ctx.lineTo(70, -70); ctx.lineTo(-40, -61); ctx.closePath();
  ctx.fillStyle = dark; ctx.fill(); ctx.stroke();
  // grain
  ctx.strokeStyle = rgba(dark, 0.5); ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-44 + i * 4, -88 + i * 4); ctx.quadraticCurveTo(10, -92 + i * 4, 60 + i * 2, -94 + i * 4); ctx.stroke(); }
  // front legs (near)
  leg(-38, -64, -44, 0, 10, wood);
  leg(66, -72, 70, -4, 10, wood);
  // stretcher
  ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-41, -28); ctx.lineTo(68, -34); ctx.stroke();
  if (char > 0) {
    // soot & ember specks
    const r = rng(17);
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 40; i++) { ctx.fillStyle = rgba(C.inkDeep, 0.35 * char); ctx.beginPath(); ctx.arc(r() * 140 - 60, -r() * 210, 4 + r() * 12, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// ── crew variants (generic engineer rig with individual faces) ──────────────
const HAIRS = ['#3B2E25', '#1F1A16', '#6E5240', '#8C7A62', '#2A2420', '#A3A19B'];
const SKINS = ['#E8B08A', '#D9A07C', '#F0C3A2', '#D49E7C', '#E3AE8B', '#DDA184'];
export function crew(i) {
  return cached(`p2crew:${i}`, () => {
    const r = rng(500 + i * 13);
    const b = CAST.engineer;
    return {
      ...b,
      skin: SKINS[i % SKINS.length], hair: HAIRS[(i * 3) % HAIRS.length],
      head: { ...b.head, rx: 0.88 + r() * 0.2, jaw: 0.55 + r() * 0.3, nose: 0.18 + r() * 0.1, noseW: 0.18 + r() * 0.08, mouthW: 0.27 + r() * 0.06, browThick: 0.06 + r() * 0.04, cheek: r() * 0.12 },
      hairStyle: r() < 0.5 ? 'cap' : r() < 0.5 ? 'cropped' : 'receding',
      build: { ...b.build, shoulder: 1.85 + r() * 0.35, height: 0.92 + r() * 0.1, belly: r() * 0.3 },
    };
  });
}
export const OUTFITS = ['overalls', 'labcoat', 'soldier'];
export function drawCrew(ctx, i, pose) {
  return drawCharacter(ctx, crew(i), { outfit: OUTFITS[i % 3], ...pose });
}

// ── engineers' flashlight: cone + hot spot ───────────────────────────────────
export function torch(ctx, x, y, tx, ty, { alpha = 0.5, spread = 0.16, color = '#FFF1D2' } = {}) {
  const ang = Math.atan2(ty - y, tx - x), len = Math.hypot(tx - x, ty - y) * 1.05;
  lightCone(ctx, x, y, ang, spread, len, color, alpha, { soft: 0.7 });
  glow(ctx, tx, ty, 60, color, alpha * 0.7);
  glow(ctx, x, y, 14, color, 0.9);
}

// spark burst (electrical fault) — crackling short-lived
export function sparks(ctx, t, x, y, { seed = 3, n = 26, alpha = 1, rate = 7, len = 60, color = '#CFE8FF' } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const k = Math.floor(t * rate);
  const r = rng(seed * 997 + k * 31);
  const flick = r();
  if (flick < 0.25) { ctx.restore(); return 0; }
  const ph = t * rate - k;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6, v = len * (0.3 + r()) * (0.3 + ph);
    const x1 = x + Math.cos(a) * v, y1 = y + Math.sin(a) * v + ph * ph * len * 0.6;
    ctx.globalAlpha = alpha * (1 - ph) * (0.5 + r() * 0.5);
    ctx.strokeStyle = r() < 0.5 ? color : C.fire4;
    ctx.lineWidth = 1 + r() * 1.5;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * v * 0.6, y + Math.sin(a) * v * 0.6); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
  glow(ctx, x, y, 70, '#BFE0FF', alpha * (1 - ph) * 0.8);
  glow(ctx, x, y, 16, C.white, alpha * (1 - ph));
  return 1 - ph;
}

// heat shimmer stripes (cheap distortion feel): offset slices of a region
export function heatShimmer(ctx, src, t, { y0 = 0, y1 = H, amp = 3, bands = 40, alpha = 1 } = {}) {
  const bh = (y1 - y0) / bands;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < bands; i++) {
    const yy = y0 + i * bh;
    const dx = noise.n2(i * 0.37, t * 2.4) * amp;
    ctx.drawImage(src, 0, yy, W, bh + 1, dx, yy, W, bh + 1);
  }
  ctx.restore();
}
export { contactShadow, makeCanvas };
