// ─────────────────────────────────────────────────────────────────────────────
// p5/lib.js — local craft toolkit for "Poyekhali!" (P5). Pure functions of t.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, E, tw, noise, rng, TAU, smoothstep, makeNoise } from '../../core/math.js';
import { C, rgba, shade, mixColor, ramp, FIRE_RAMP } from '../../core/palette.js';
import { W, H, tex, cached, makeCanvas, scratchCanvas, tintedSmoke, roundRect, shadeCylinder, glow } from '../../core/draw.js';
import { F, font, setText } from '../../core/type.js';

export { W, H };

// ── altitude-driven sky (0 = pad, 1 = space) ────────────────────────────────
const SKY = [
  // [alt, top, mid, horizon]
  [0.0, '#5E8FC2', '#9DBEDB', '#F1D7BE'],
  [0.25, '#3F74B4', '#7FA9D6', '#D9E4EC'],
  [0.5, '#1F3F7E', '#3C6BAE', '#9FC3E2'],
  [0.72, '#101E4A', '#1E3C79', '#5A8CC6'],
  [0.88, '#0A1230', '#121F4C', '#2C4F8C'],
  [1.0, '#060A1C', '#0A1130', '#121C44'],
];
export function skyCols(alt) {
  alt = clamp(alt);
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) {
      const k = (alt - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
      return [1, 2, 3].map((j) => mixColor(SKY[i - 1][j], SKY[i][j], k));
    }
  }
  return SKY[SKY.length - 1].slice(1);
}
export function skyBg(ctx, alt, { y0 = 0, y1 = H, horizon = 1 } = {}) {
  const [top, mid, hor] = skyCols(alt);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(horizon, hor);
  if (horizon < 1) g.addColorStop(1, hor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── flame (2D, additive, flickering) ────────────────────────────────────────
// Draws a rocket exhaust from (x,y) along angle `ang` (PI/2 = straight down).
export function flame(ctx, x, y, ang, len, w, t, { seed = 1, alpha = 1, hot = 1, diamonds = 0, op = 'lighter' } = {}) {
  if (len <= 2 || alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang - Math.PI / 2);
  ctx.globalCompositeOperation = op;
  const layers = [
    { k: 1.0, l: 1.0, c0: C.fire2, c1: C.fire1, a: 0.55 },
    { k: 0.68, l: 0.82, c0: C.fire3, c1: C.fire2, a: 0.7 },
    { k: 0.42, l: 0.55, c0: C.fire4, c1: C.fire3, a: 0.85 },
    { k: 0.2, l: 0.3, c0: C.fire5, c1: C.fire4, a: 0.9 * hot },
  ];
  layers.forEach((L, li) => {
    const ww = w * L.k, ll = len * L.l * (1 + noise.n2(t * 9 + li, seed) * 0.08);
    const steps = 18;
    const left = [], right = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      // bell: widens quickly then tapers to a point
      const prof = Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5 + 0.0001), 0.6) * Math.pow(1 - u, 0.9);
      const wob = noise.n2(u * 4 - t * 14 + li * 3, seed + li) * ww * 0.18 * u;
      const half = ww * 0.5 * (0.55 + prof * 0.9) + wob;
      left.push([-half + wob * 0.5, u * ll]);
      right.push([half + wob * 0.5, u * ll]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], 0);
    left.forEach((p) => ctx.lineTo(p[0], p[1]));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, ll);
    g.addColorStop(0, rgba(L.c0, L.a * alpha));
    g.addColorStop(0.45, rgba(L.c1, L.a * 0.8 * alpha));
    g.addColorStop(1, rgba(L.c1, 0));
    ctx.fillStyle = g;
    ctx.fill();
  });
  if (diamonds > 0) {
    for (let i = 0; i < 4; i++) {
      const yy = len * (0.12 + i * 0.12);
      const r = w * 0.18 * (1 - i * 0.18);
      const g = ctx.createRadialGradient(0, yy, 0, 0, yy, r * 1.8);
      g.addColorStop(0, rgba(C.fire5, 0.7 * diamonds * alpha));
      g.addColorStop(1, rgba(C.fire4, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-r * 2, yy - r * 2, r * 4, r * 4);
    }
  }
  ctx.restore();
}

// ── billowing, lit smoke (volume via dark base + lit top layer) ────────────
// Deterministic: puffs born along an emitter, rising/spreading.
export function billows(ctx, t, { x = W / 2, y = H, count = 30, seed = 3, spread = 600, rise = 40, grow = 1.4, size = [160, 420], life = 7, lit = '#F2EDE4', dark = '#8E8A86', warm = null, alpha = 0.85, dirX = 0, dirY = -1, gravityFlat = 0, t0 = -99 } = {}) {
  const r = rng(seed);
  const spL = tintedSmoke(lit, 20 + (seed % 5));
  const spD = tintedSmoke(dark, 21 + (seed % 4));
  const spW = warm ? tintedSmoke(warm, 22 + (seed % 3)) : null;
  for (let i = 0; i < count; i++) {
    const birth = r() * life;
    const ox = (r() - 0.5) * spread, oy = (r() - 0.5) * spread * 0.15;
    const s0 = lerp(size[0], size[1], r());
    const rot0 = r() * TAU, rs = (r() - 0.5) * 0.25;
    const sp = 0.6 + r() * 0.8;
    const ph = r() * 50;
    let age = ((t - birth) % life + life) % life;
    if (t - t0 < age) continue; // emitter only started at t0
    const u = age / life;
    const sx = x + ox * (1 + u * 0.8) + dirX * age * rise * sp + noise.n2(ph, t * 0.15) * 30 * u;
    const sy = y + oy + dirY * age * rise * sp * (1 - gravityFlat * u);
    const sz = s0 * (0.45 + u * grow);
    const a = alpha * Math.min(1, u * 6) * Math.pow(1 - u, 1.2);
    if (a < 0.01) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot0 + t * rs);
    ctx.globalAlpha = a;
    ctx.drawImage(spD, -sz / 2, -sz / 2 + sz * 0.06, sz, sz);
    ctx.globalAlpha = a * 0.9;
    ctx.drawImage(spL, -sz / 2 - sz * 0.03, -sz / 2 - sz * 0.05, sz * 0.94, sz * 0.94);
    if (spW) { ctx.globalAlpha = a * 0.55; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(spW, -sz / 2, -sz / 2 + sz * 0.1, sz, sz); }
    ctx.restore();
  }
}

// ── stars + dust motes ───────────────────────────────────────────────────────
export function starfield(ctx, t, { alpha = 1, seed = 9, drift = 4, count = 700, ox = 0, oy = 0 } = {}) {
  const s = tex.stars({ seed, count, big: 18 });
  ctx.save();
  ctx.globalAlpha *= alpha;
  const dx = ((ox + t * drift) % W + W) % W, dy = ((oy % H) + H) % H;
  ctx.drawImage(s, -dx, -dy); ctx.drawImage(s, W - dx, -dy);
  ctx.drawImage(s, -dx, H - dy); ctx.drawImage(s, W - dx, H - dy);
  ctx.restore();
}
export function motes(ctx, t, { count = 40, seed = 5, color = C.cream, alpha = 0.5, box = [0, 0, W, H], speed = 12, size = [0.8, 2.6] } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const bx = r() * box[2], by = r() * box[3], ph = r() * 100, s = lerp(size[0], size[1], r()), sp = 0.5 + r();
    const x = box[0] + ((bx + noise.n2(ph, t * 0.05 * sp) * 120 + t * speed * 0.3 * sp) % box[2] + box[2]) % box[2];
    const y = box[1] + ((by + noise.n2(ph + 7, t * 0.05 * sp) * 120 - t * speed * 0.2 * sp) % box[3] + box[3]) % box[3];
    const tw_ = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + ph);
    ctx.globalAlpha = alpha * (0.35 + 0.65 * tw_);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ── crafted gauge (bezel, glass, needle) ────────────────────────────────────
export function gauge(ctx, x, y, r, v, { label = '', ticks = 10, a0 = -Math.PI * 0.75, a1 = Math.PI * 0.75, face = '#1C2421', ink = C.cream, needle = C.orange, red = 0.8, glowCol = '#9BE3A8', lit = 0.6, numbers = null } = {}) {
  ctx.save();
  ctx.translate(x, y);
  // bezel
  ctx.beginPath(); ctx.arc(0, 0, r * 1.14, 0, TAU);
  const bz = ctx.createLinearGradient(-r, -r, r, r);
  bz.addColorStop(0, '#C9CDC8'); bz.addColorStop(0.45, '#6E7570'); bz.addColorStop(1, '#2A2F2D');
  ctx.fillStyle = bz; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 1.02, 0, TAU);
  ctx.fillStyle = '#0E1311'; ctx.fill();
  // face
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
  const fg = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
  fg.addColorStop(0, shade(face, 0.12)); fg.addColorStop(1, shade(face, -0.35));
  ctx.fillStyle = fg; ctx.fill();
  // instrument glow (radium-lit dial)
  const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  gg.addColorStop(0, rgba(glowCol, 0.12 * lit)); gg.addColorStop(1, rgba(glowCol, 0));
  ctx.fillStyle = gg; ctx.fill();
  // red zone
  if (red < 1) {
    ctx.strokeStyle = rgba(C.red, 0.85); ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.86, a0 + (a1 - a0) * red - Math.PI / 2, a1 - Math.PI / 2); ctx.stroke();
  }
  // ticks
  ctx.strokeStyle = rgba(ink, 0.85); ctx.fillStyle = rgba(ink, 0.9);
  for (let i = 0; i <= ticks * 2; i++) {
    const a = a0 + ((a1 - a0) * i) / (ticks * 2) - Math.PI / 2;
    const major = i % 2 === 0;
    ctx.lineWidth = major ? r * 0.035 : r * 0.018;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * (major ? 0.7 : 0.77), Math.sin(a) * r * (major ? 0.7 : 0.77));
    ctx.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
    ctx.stroke();
    if (major && numbers && r > 40) {
      const n = numbers[i / 2];
      if (n != null) {
        setText(ctx, { family: F.MONO, size: Math.max(10, r * 0.15), weight: 500, color: rgba(ink, 0.8), align: 'center', baseline: 'middle' });
        ctx.fillText(String(n), Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      }
    }
  }
  if (label && r > 40) {
    setText(ctx, { family: F.MONO, size: Math.max(11, r * 0.16), weight: 600, color: rgba(ink, 0.75), align: 'center', baseline: 'middle', tracking: 2 });
    ctx.fillText(label, 0, r * 0.45);
  }
  // needle
  const an = a0 + (a1 - a0) * clamp(v) - Math.PI / 2;
  ctx.save();
  ctx.rotate(an);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = r * 0.08; ctx.shadowOffsetY = r * 0.04;
  ctx.fillStyle = needle;
  ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.035); ctx.lineTo(r * 0.82, 0); ctx.lineTo(-r * 0.12, r * 0.035); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#2B302E'; ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, TAU); ctx.fill();
  // glass reflection
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  const gl = ctx.createLinearGradient(-r, -r, r * 0.3, r * 0.4);
  gl.addColorStop(0, 'rgba(255,255,255,.22)'); gl.addColorStop(0.45, 'rgba(255,255,255,.04)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  ctx.restore();
}

// ── porthole frame (thick bezel, bolts, glass). inner(ctx) draws the view ───
export function porthole(ctx, x, y, r, inner, { ring = '#8E9590', bolts = 12, glass = 0.35, t = 0, rim = null } = {}) {
  ctx.save();
  // outer recess shadow
  const sh = ctx.createRadialGradient(x, y, r * 0.95, x, y, r * 1.6);
  sh.addColorStop(0, 'rgba(6,8,12,.55)'); sh.addColorStop(1, 'rgba(6,8,12,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, TAU); ctx.fill();
  // view
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  inner(ctx);
  // glass: soft reflection + inner shadow
  const gl = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  gl.addColorStop(0, `rgba(220,235,255,${0.16 * glass})`); gl.addColorStop(0.35, 'rgba(220,235,255,0)'); gl.addColorStop(0.8, 'rgba(0,0,0,0)'); gl.addColorStop(1, `rgba(220,235,255,${0.08 * glass})`);
  ctx.fillStyle = gl; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const ish = ctx.createRadialGradient(x, y, r * 0.7, x, y, r);
  ish.addColorStop(0, 'rgba(0,0,0,0)'); ish.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = ish; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  // bezel ring
  ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TAU); ctx.arc(x, y, r, 0, TAU, true);
  const bz = ctx.createLinearGradient(x - r, y - r * 1.2, x + r, y + r * 1.2);
  bz.addColorStop(0, shade(ring, 0.35)); bz.addColorStop(0.5, ring); bz.addColorStop(1, shade(ring, -0.55));
  ctx.fillStyle = bz; ctx.fill('evenodd');
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(shade(ring, -0.6), 0.8);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TAU); ctx.stroke();
  if (rim) { ctx.lineWidth = r * 0.03; ctx.strokeStyle = rgba(rim, 0.6); ctx.beginPath(); ctx.arc(x, y, r * 1.005, 0, TAU); ctx.stroke(); }
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * TAU + 0.13;
    const bx = x + Math.cos(a) * r * 1.11, by = y + Math.sin(a) * r * 1.11, br = r * 0.035;
    const bg = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.4, 0, bx, by, br);
    bg.addColorStop(0, '#E8EBE6'); bg.addColorStop(1, '#4A504C');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ── waveform ink line (radio voice) ─────────────────────────────────────────
// mode: amplitude envelope fn(u) & wobble. Returns points.
export function wavePts(x0, x1, y, t, { amp = 40, freq = 9, speed = 6, seed = 1, env = null, jag = 0, n = 220 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const e = env ? env(u) : Math.sin(Math.PI * u);
    const ph = u * freq * TAU - t * speed;
    let v = Math.sin(ph) * 0.65 + Math.sin(ph * 2.3 + 1.3) * 0.25 + noise.n2(u * 12 + seed, t * 2.2) * 0.35;
    if (jag) v += (noise.n2(u * 70 + seed, t * 14) * 1.2) * jag;
    pts.push([lerp(x0, x1, u), y + v * amp * e]);
  }
  return pts;
}
export function strokePts(ctx, pts, { color = C.cream, width = 3, alpha = 1, glowCol = null, p = 1 } = {}) {
  const n = Math.max(2, Math.round(pts.length * clamp(p)));
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (glowCol) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(glowCol, 0.18 * alpha); ctx.lineWidth = width * 5;
    ctx.beginPath(); for (let i = 0; i < n; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.stroke();
    ctx.strokeStyle = rgba(glowCol, 0.3 * alpha); ctx.lineWidth = width * 2.2; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); for (let i = 0; i < n; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.stroke();
  ctx.restore();
  return pts[n - 1];
}

// ── 2D R-7 side elevation (crafted illustration, for infographics) ─────────
// Origin = nozzle exit plane centre. s = px per metre. parts flags.
export function r7Side(ctx, x, y, s, { boosters = 1, core = 1, third = 1, fairing = 1, sphere = 0, flameCore = 0, flameBoost = 0, flameThird = 0, t = 0, ink = null, light = -0.5, boosterOff = 0, boosterRot = 0, coreOff = 0, fairOpen = 0, body = '#D9D8D1' } = {}) {
  const L = (m) => m * s;
  ctx.save();
  ctx.translate(x, y);
  const lineCol = ink || rgba('#2A3038', 0.75);
  const lw = Math.max(1, s * 0.06);
  const cyl = (x0, w, y0, y1, w1 = w, col = body) => {
    ctx.beginPath();
    ctx.moveTo(L(x0 - w / 2), -L(y0)); ctx.lineTo(L(x0 + w / 2), -L(y0));
    ctx.lineTo(L(x0 + w1 / 2), -L(y1)); ctx.lineTo(L(x0 - w1 / 2), -L(y1)); ctx.closePath();
    shadeCylinder(ctx, L(x0 - Math.max(w, w1) / 2), L(Math.max(w, w1)), col, { lx: light, spec: 0.3 });
    ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke();
  };
  const nozzle = (cx, w, len, col = '#4A4D52') => {
    ctx.beginPath();
    ctx.moveTo(L(cx - w * 0.18), 0); ctx.lineTo(L(cx + w * 0.18), 0);
    ctx.quadraticCurveTo(L(cx + w * 0.22), L(len * 0.5), L(cx + w * 0.5), L(len));
    ctx.lineTo(L(cx - w * 0.5), L(len));
    ctx.quadraticCurveTo(L(cx - w * 0.22), L(len * 0.5), L(cx - w * 0.18), 0);
    ctx.closePath();
    shadeCylinder(ctx, L(cx - w * 0.5), L(w), col, { lx: light, spec: 0.5 });
    ctx.lineWidth = lw * 0.8; ctx.strokeStyle = lineCol; ctx.stroke();
  };
  // core + upper stack
  const drawCore = () => {
    ctx.save();
    ctx.translate(0, L(coreOff));
    if (flameCore > 0) {
      for (const nx of [-0.7, 0.7]) flame(ctx, L(nx), L(0.9), Math.PI / 2, L(9 + 5 * flameCore) * flameCore, L(1.0), t, { seed: 3 + nx, diamonds: 0.6 });
    }
    for (const nx of [-0.7, 0.7]) nozzle(nx, 0.7, 0.9);
    cyl(0, 2.6, 0, 14, 2.95); cyl(0, 2.95, 14, 19, 2.2); cyl(0, 2.2, 19, 26, 2.95);
    // panel bands
    ctx.strokeStyle = rgba('#3A4048', 0.35); ctx.lineWidth = lw * 0.7;
    [4, 8, 12, 21, 24].forEach((yy) => { ctx.beginPath(); ctx.moveTo(L(-1.45), -L(yy)); ctx.lineTo(L(1.45), -L(yy)); ctx.stroke(); });
    ctx.restore();
  };
  const drawThird = () => {
    if (flameThird > 0) flame(ctx, 0, -L(26.2), Math.PI / 2, L(8) * flameThird, L(1.3), t, { seed: 9, diamonds: 0.8 });
    // interstage truss
    ctx.strokeStyle = rgba('#2C3238', 0.9); ctx.lineWidth = lw;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(L(-1.2 + i * 0.6), -L(26)); ctx.lineTo(L(-0.9 + i * 0.6), -L(27.2)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(L(-0.9 + i * 0.6), -L(26)); ctx.lineTo(L(-1.2 + i * 0.6), -L(27.2)); ctx.stroke(); }
    cyl(0, 2.6, 27.2, 30.2, 2.6, shade(body, -0.04));
  };
  const drawPayload = () => {
    if (sphere) {
      ctx.beginPath(); ctx.arc(0, -L(32.3), L(1.15), 0, TAU);
      const g = ctx.createRadialGradient(L(-0.4), -L(32.8), L(0.1), 0, -L(32.3), L(1.2));
      g.addColorStop(0, '#E2D6C0'); g.addColorStop(0.6, '#8C7E68'); g.addColorStop(1, '#3B3530');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke();
      // porthole
      ctx.fillStyle = '#1B2430'; ctx.beginPath(); ctx.arc(L(0.45), -L(32.5), L(0.22), 0, TAU); ctx.fill();
    }
    if (fairing) {
      const o = fairOpen;
      for (const sd of [-1, 1]) {
        ctx.save();
        ctx.translate(sd * L(1.3 + o * 4), -L(30.2) + L(o * 2));
        ctx.rotate(sd * o * 0.9);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-sd * L(1.3), 0);
        ctx.lineTo(-sd * L(1.3), -L(2.8));
        ctx.quadraticCurveTo(-sd * L(1.25), -L(5.2), 0 - sd * L(0.02), -L(6.6));
        ctx.lineTo(0, -L(2.8));
        ctx.closePath();
        ctx.fillStyle = sd < 0 ? shade(body, 0.12) : shade(body, -0.22);
        ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke();
        ctx.restore();
      }
    }
  };
  const drawBooster = (sd, front) => {
    ctx.save();
    const bx = sd * 2.5;
    ctx.translate(L(bx + sd * boosterOff * 3), L(boosterOff * 4));
    ctx.rotate(sd * boosterRot);
    if (flameBoost > 0) for (const nx of [-0.6, 0.6]) flame(ctx, L(nx), L(0.9), Math.PI / 2, L(8 + 4 * flameBoost) * flameBoost, L(0.9), t + sd, { seed: 5 + sd + nx, diamonds: 0.5 });
    for (const nx of [-0.6, 0.6]) nozzle(nx, 0.62, 0.9);
    ctx.beginPath();
    ctx.moveTo(L(-1.35), 0); ctx.lineTo(L(1.35), 0);
    ctx.lineTo(L(0.75 - sd * 0.25), -L(17)); ctx.quadraticCurveTo(L(-sd * 0.5), -L(19.6), L(-0.75 - sd * 0.25), -L(17));
    ctx.closePath();
    shadeCylinder(ctx, L(-1.35), L(2.7), front ? shade(body, 0.02) : shade(body, -0.08), { lx: light, spec: 0.3 });
    ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke();
    ctx.strokeStyle = rgba('#3A4048', 0.3); ctx.lineWidth = lw * 0.7;
    [5, 10].forEach((yy) => { const k = 1 - yy / 19; ctx.beginPath(); ctx.moveTo(L(-1.35 * k - 0.1), -L(yy)); ctx.lineTo(L(1.35 * k + 0.1), -L(yy)); ctx.stroke(); });
    ctx.restore();
  };
  if (boosters) { drawBooster(-1, false); drawBooster(1, false); }
  if (core) drawCore();
  if (third) drawThird();
  drawPayload();
  if (boosters && boosterOff < 0.01) {
    // front booster (centre, overlapping core)
    ctx.save(); ctx.globalAlpha *= 0.0; ctx.restore();
  }
  ctx.restore();
}

// ── typography helpers ──────────────────────────────────────────────────────
export function tracked(ctx, str, x, y, { family = F.COND, size = 60, weight = 800, color = C.cream, align = 'center', tracking = 0, alpha = 1, italic = false, baseline = 'alphabetic' } = {}) {
  ctx.save();
  setText(ctx, { family, size, weight, color, align, tracking, italic, baseline });
  ctx.globalAlpha *= alpha;
  ctx.fillText(str, x, y);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}
// Telemetry tag in brackets that types on (mono)
export function tag(ctx, t, x, y, label, { size = 26, color = C.cream, align = 'left', accent = C.orange, out = null, dot = true, bg = null } = {}) {
  const o = (out != null ? 1 - tw(t, out, out + 0.3, E.in) : 1) * tw(t, 0, 0.2, E.out);
  if (o <= 0) return;
  const str = `[ ${label} ]`;
  const n = Math.floor(str.length * tw(t, 0.05, 0.45, E.linear));
  ctx.save();
  ctx.globalAlpha *= o;
  setText(ctx, { family: F.MONO, size, weight: 600, color, align, baseline: 'middle', tracking: 2 });
  const w = ctx.measureText(str).width;
  const ax = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(ax - 14, y - size * 0.9, w + 28, size * 1.8); ctx.fillStyle = color; }
  if (dot) { ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(ax - 18, y, 5, 0, TAU); ctx.fill(); ctx.fillStyle = color; }
  ctx.fillText(str.slice(0, n), x, y);
  ctx.restore();
}

// soft round vignette / tunnel (draw on top)
export function tunnel(ctx, amt, { cx = W / 2, cy = H / 2, color = '#05070C', r0 = 0.25, r1 = 1.0 } = {}) {
  if (amt <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const R = Math.hypot(W, H) * 0.5;
  const g = ctx.createRadialGradient(cx, cy, R * lerp(r1, r0, amt), cx, cy, R * lerp(1.3, 0.75, amt));
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, clamp(amt * 1.1)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Cached grain-paper tint for 2D editorial graphs
export function paperTone(ctx, color, { alpha = 1, seed = 31 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(tex.paper(color, { seed }), 0, 0, W, H);
  ctx.restore();
}

// apply a shake/handheld offset to ctx
export function applyCam(ctx, o) {
  ctx.translate(W / 2 + o.x, H / 2 + o.y);
  ctx.rotate(o.r || 0);
  ctx.translate(-W / 2, -H / 2);
}

// drawn once, re-used: radial lens dirt / light leak
export function sunBurst(ctx, x, y, r, a, { color = '#FFF4DA', t = 0, rays = 16, seed = 4 } = {}) {
  if (a <= 0) return;
  glow(ctx, x, y, r, color, a);
  glow(ctx, x, y, r * 0.35, '#FFFFFF', a * 0.9);
  const rr = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * TAU + rr() * 0.2 + t * 0.03;
    const len = r * (1.2 + rr() * 1.6);
    const wd = 0.012 + rr() * 0.03;
    const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.addColorStop(0, rgba(color, a * 0.35 * (0.6 + 0.4 * noise.n2(i, t * 0.7))));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang - wd) * len, y + Math.sin(ang - wd) * len);
    ctx.lineTo(x + Math.cos(ang + wd) * len, y + Math.sin(ang + wd) * len);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
