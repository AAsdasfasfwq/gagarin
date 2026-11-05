// ─────────────────────────────────────────────────────────────────────────────
// p8/props.js — crafted props for part 8 (all procedural, shaded, textured).
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, E, rng, noise, TAU, tw } from '../../core/math.js';
import { C, rgba, shade, mixColor } from '../../core/palette.js';
import { F, font } from '../../core/type.js';
import { W, H, makeCanvas, cached, tex, texturePath, shadeSphere, shadeCylinder, contactShadow, glow, blobPoints, smoothPath, roundRect, lightCone, godRays, tintedSmoke, star, poly } from '../../core/draw.js';
import { P3, mode7, fieldTexture, skyGrad, cloudSprite, horizonStrip } from './lib.js';

// ── the spring field world (sky + clouds + horizon + mode-7 soil) ────────────
export const SPRING = {
  zenith: '#7FA7C9', mid: '#B9D3E4', low: '#EAD9C2', horizon: '#F2D9B8', haze: '#D9CDB8', sun: '#FFE9C2',
};
export function fieldWorld(ctx, P, t, { sunX = 330, sunY = 210, clouds = true, hz = true, hazeCol = SPRING.haze, skyShift = 0, ground = true } = {}) {
  const hy = P.horizonY();
  skyGrad(ctx, hy - 900 + skyShift, hy + 20, [[0, SPRING.zenith], [0.55, SPRING.mid], [0.86, SPRING.low], [1, SPRING.horizon]]);
  // sun glow (morning, upper-left)
  glow(ctx, sunX, sunY, 900, '#FFE2B0', 0.35);
  glow(ctx, sunX, sunY, 220, '#FFF6E2', 0.5);
  if (clouds) {
    const drift = t * 6;
    const list = [[-300, -330, 1.25, 1], [520, -400, 0.9, 2], [1250, -300, 1.1, 3], [1900, -380, 0.8, 4], [2600, -310, 1.0, 5]];
    for (const [cx, cy, sc, sd] of list) {
      const cs = cloudSprite(sd, { w: 640, h: 300, lit: '#FFF8EC', shadow: '#A9BCCB' });
      const par = 0.08;
      const x = ((cx - P.x * par + drift + 3600) % 3600) - 700;
      const y = hy + cy * 0.9 * (0.9 + sc * 0.1);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(cs, x, y, 640 * sc, 300 * sc);
      ctx.globalAlpha = 1;
    }
  }
  if (hz) {
    const strip = horizonStrip(3, { w: 3000, h: 160 });
    const px = (-P.x * 0.12) % 3000;
    const sc = 0.9;
    for (let k = -1; k < 2; k++) ctx.drawImage(strip, px + k * 3000 * sc, hy - 160 * sc + 6, 3000 * sc, 160 * sc);
  }
  if (ground) mode7(ctx, P, fieldTexture(), { texScale: 6, haze: hazeCol, hazeFrom: 0.42, maxZ: 22000 });
}
// project a world point and draw a character there (scale from depth)
export function placeChar(P, x, z, y = 0) {
  const p = P.project(x, y, z);
  return { ...p, hu: 13 * p.s };
}

// ── parachute ────────────────────────────────────────────────────────────────
const CAN_O = '#EE6A22', CAN_C = '#F1E6D2';
// deflated canopy lying on ground, (x,y) = centre of its base on screen, s = px per world unit
export function canopyGround(ctx, x, y, s, t, settle = 1, { flip = 1 } = {}) {
  const Wd = 900 * s, Ht = lerp(320, 70, settle) * s;
  const r = rng(11);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  contactShadow(ctx, 0, 6 * s, Wd * 1.05, { h: 60 * s, alpha: 0.45, color: '#2A1E14' });
  // billow
  const bil = Math.sin(t * 2.1) * 0.06 * (1 - settle * 0.6) + noise.n2(t * 0.8, 3) * 0.05;
  const top = (u) => -Ht * Math.pow(Math.sin(Math.PI * u), 0.8) * (1 + bil * Math.sin(u * 9 + t * 3)) - Math.sin(u * 23 + t * 2) * 6 * s * (1 - settle * 0.5);
  const N = 14;
  for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N;
    ctx.beginPath();
    ctx.moveTo(-Wd / 2 + Wd * u0, 0);
    const steps = 6;
    for (let k = 0; k <= steps; k++) { const u = lerp(u0, u1, k / steps); ctx.lineTo(-Wd / 2 + Wd * u, top(u)); }
    ctx.lineTo(-Wd / 2 + Wd * u1, 0);
    ctx.closePath();
    const col = i % 2 ? CAN_C : CAN_O;
    const lit = 0.18 - (i / N) * 0.36;
    ctx.fillStyle = shade(col, lit);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(col, -0.45), 0.55); ctx.lineWidth = Math.max(1, 1.6 * s); ctx.stroke();
  }
  // folds
  ctx.strokeStyle = 'rgba(40,20,10,.22)'; ctx.lineWidth = Math.max(1, 3 * s);
  for (let i = 0; i < 9; i++) {
    const u = 0.1 + r() * 0.8;
    ctx.beginPath(); ctx.moveTo(-Wd / 2 + Wd * u, -2); ctx.quadraticCurveTo(-Wd / 2 + Wd * (u + 0.03), top(u) * 0.5, -Wd / 2 + Wd * (u + 0.01), top(u) * 0.85); ctx.stroke();
  }
  // top highlight
  ctx.strokeStyle = 'rgba(255,248,232,.5)'; ctx.lineWidth = Math.max(1, 2.5 * s);
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) { const u = 0.08 + 0.5 * (k / 40); const xx = -Wd / 2 + Wd * u, yy = top(u) + 4 * s; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
  ctx.stroke();
  ctx.restore();
}
// canopy seen from below (in the air): centre (cx,cy), radius R, tilt (y squash), lines to (fx,fy)
export function canopyAir(ctx, cx, cy, R, t, fx, fy, { tilt = 0.42, sunX = 400, sunY = 120 } = {}) {
  const N = 28;
  const rr = R;
  // suspension lines (behind skirt first)
  ctx.save();
  ctx.strokeStyle = 'rgba(70,60,55,.55)';
  ctx.lineWidth = Math.max(0.8, R * 0.004);
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * TAU;
    const sx = cx + Math.cos(a) * rr, sy = cy + Math.sin(a) * rr * tilt;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(fx + Math.cos(a) * R * 0.02, fy); ctx.stroke();
  }
  ctx.restore();
  // canopy body: gores
  ctx.save();
  const wob = (a) => 1 + Math.sin(a * N) * 0.018 + noise.n2(Math.cos(a) * 2 + t * 0.7, Math.sin(a) * 2) * 0.03;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R * 0.12);
    for (let k = 0; k <= 6; k++) {
      const a = lerp(a0, a1, k / 6);
      ctx.lineTo(cx + Math.cos(a) * rr * wob(a), cy + Math.sin(a) * rr * tilt * wob(a));
    }
    ctx.closePath();
    const col = i % 2 ? CAN_C : CAN_O;
    const g = ctx.createRadialGradient(cx, cy - R * 0.12, R * 0.05, cx, cy, R);
    // translucent: sun side brighter
    const am = (a0 + a1) / 2;
    const toward = Math.cos(am - Math.atan2(sunY - cy, sunX - cx));
    g.addColorStop(0, shade(col, 0.32 + toward * 0.1));
    g.addColorStop(0.65, shade(col, 0.05 + toward * 0.12));
    g.addColorStop(1, shade(col, -0.22 + toward * 0.1));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(shade(col, -0.4), 0.5); ctx.lineWidth = Math.max(1, R * 0.006); ctx.stroke();
  }
  // radial seams + vent
  ctx.fillStyle = mixColor(SPRING.mid, '#FFFFFF', 0.4);
  ctx.beginPath(); ctx.ellipse(cx, cy - R * 0.12, R * 0.06, R * 0.06 * tilt * 1.6, 0, 0, TAU); ctx.fill();
  // rim seam
  ctx.strokeStyle = 'rgba(120,50,20,.6)'; ctx.lineWidth = Math.max(1.5, R * 0.014);
  ctx.beginPath();
  for (let k = 0; k <= 96; k++) { const a = (k / 96) * TAU; const x = cx + Math.cos(a) * rr * wob(a), y = cy + Math.sin(a) * rr * tilt * wob(a); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

// ── potato ───────────────────────────────────────────────────────────────────
export function potatoSprite(seed = 1, size = 120) {
  return cached(`p8:potato:${seed}:${size}`, () => {
    const pad = size * 0.3;
    const { c, ctx } = makeCanvas(size + pad * 2, size * 0.8 + pad * 2);
    const cx = c.width / 2, cy = c.height / 2;
    const r = rng(seed);
    const pts = blobPoints(cx, cy, size * 0.42, { n: 12, jitter: 0.16, seed: seed * 3.1 }).map(([x, y]) => [cx + (x - cx) * 1.15, cy + (y - cy) * 0.78]);
    smoothPath(ctx, pts, true);
    shadeSphere(ctx, cx, cy, size * 0.44, '#B98A55', { spec: 0.22, bounce: 0.12 });
    smoothPath(ctx, pts, true);
    texturePath(ctx, tex.grit(0.35, { seed: seed + 4, alpha: 130 }), { alpha: 0.5, op: 'multiply' });
    // dirt patches
    ctx.save(); smoothPath(ctx, pts, true); ctx.clip();
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = rgba('#5A3E26', 0.18 + r() * 0.2);
      ctx.beginPath(); ctx.ellipse(cx + (r() - 0.5) * size * 0.8, cy + (r() - 0.3) * size * 0.5, size * (0.05 + r() * 0.12), size * (0.03 + r() * 0.07), r() * 3, 0, TAU); ctx.fill();
    }
    // eyes (small dimples with sprout)
    for (let i = 0; i < 5; i++) {
      const ex = cx + (r() - 0.5) * size * 0.75, ey = cy + (r() - 0.5) * size * 0.45;
      ctx.fillStyle = 'rgba(70,45,25,.55)';
      ctx.beginPath(); ctx.ellipse(ex, ey, size * 0.035, size * 0.018, r() * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,200,.35)';
      ctx.beginPath(); ctx.ellipse(ex - size * 0.01, ey - size * 0.012, size * 0.02, size * 0.01, 0, 0, TAU); ctx.fill();
      if (i < 2) { ctx.fillStyle = '#C9B98A'; ctx.beginPath(); ctx.ellipse(ex, ey - size * 0.02, size * 0.012, size * 0.025, r(), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    smoothPath(ctx, pts, true);
    ctx.strokeStyle = 'rgba(70,45,25,.5)'; ctx.lineWidth = Math.max(1, size * 0.012); ctx.stroke();
    return c;
  });
}

// ── zinc bucket (prop for a hand) ────────────────────────────────────────────
export function bucketProp(fill = true) {
  return (ctx, x, y, ang, s) => {
    ctx.save();
    ctx.translate(x, y + s * 0.15);
    const w = s * 1.25, h = s * 1.2;
    // handle
    ctx.strokeStyle = '#4A4E52'; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.arc(0, h * 0.25, w * 0.55, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.translate(0, h * 0.25);
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, 0); ctx.lineTo(w * 0.55, 0); ctx.lineTo(w * 0.42, h); ctx.lineTo(-w * 0.42, h); ctx.closePath();
    shadeCylinder(ctx, -w * 0.55, w * 1.1, '#9AA3A8', { spec: 0.6 });
    ctx.strokeStyle = '#5D646A'; ctx.lineWidth = s * 0.04; ctx.stroke();
    ctx.strokeStyle = 'rgba(60,66,70,.5)'; ctx.lineWidth = s * 0.035;
    ctx.beginPath(); ctx.moveTo(-w * 0.5, h * 0.3); ctx.lineTo(w * 0.5, h * 0.3); ctx.moveTo(-w * 0.46, h * 0.7); ctx.lineTo(w * 0.46, h * 0.7); ctx.stroke();
    ctx.fillStyle = '#3F4448'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, w * 0.12, 0, 0, TAU); ctx.fill();
    if (fill) {
      for (let i = 0; i < 5; i++) { const px = (i - 2) * w * 0.18, py = -w * 0.05 - (i % 2) * w * 0.07; ctx.drawImage(potatoSprite(3 + i, 60), px - w * 0.2, py - w * 0.16, w * 0.4, w * 0.3); }
    }
    ctx.restore();
  };
}

// handheld press camera (prop) for the journalist ghost
export function pressCamProp() {
  return (ctx, x, y, ang, s) => {
    ctx.save();
    ctx.translate(x, y - s * 0.3);
    ctx.fillStyle = '#2A2A2E';
    roundRect(ctx, -s * 0.7, -s * 0.55, s * 1.4, s * 1.1, s * 0.1); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.38, 0, TAU); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.95, -s * 0.9, s * 0.55, 0, TAU); ctx.fillStyle = '#C9C9C9'; ctx.fill();
    ctx.fillRect(s * 0.6, -s * 0.55, s * 0.12, s * 0.4);
    ctx.restore();
  };
}
export function clipboardProp() {
  return (ctx, x, y, ang, s) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2);
    ctx.fillStyle = '#8A6A44'; ctx.fillRect(-s * 0.6, -s * 1.6, s * 1.2, s * 1.7);
    ctx.fillStyle = '#F1EAD8'; ctx.fillRect(-s * 0.5, -s * 1.45, s, s * 1.45);
    ctx.restore();
  };
}

// ── tear-off calendar block (Soviet style) ───────────────────────────────────
// draws a single page with day + month; (x,y) top-left, w,h
export function calendarPage(ctx, x, y, w, h, day, month = 'АПРЕЛЬ', dow = '', { seed = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#F4EEDF';
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath(); ctx.rect(0, 0, w, h);
  texturePath(ctx, tex.paper('#F4EEDF', { seed: 30 + seed, w: 512, h: 512 }), { alpha: 0.9, op: 'multiply' });
  // perforated top
  ctx.fillStyle = 'rgba(80,70,60,.25)';
  for (let i = 8; i < w; i += 14) { ctx.beginPath(); ctx.arc(i, 10, 2.4, 0, TAU); ctx.fill(); }
  // red header
  ctx.fillStyle = C.red;
  ctx.font = font(F.DISPLAY, w * 0.11, 700);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${w * 0.02}px`;
  ctx.fillText(month, w / 2, h * 0.17);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = C.ink;
  ctx.font = font(F.DISPLAY, w * 0.52, 800);
  ctx.fillText(String(day), w / 2, h * 0.68);
  if (dow) { ctx.fillStyle = C.red; ctx.font = font(F.MONO, w * 0.065, 600); ctx.letterSpacing = '4px'; ctx.fillText(dow, w / 2, h * 0.82); }
  ctx.strokeStyle = 'rgba(20,20,30,.15)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.88); ctx.lineTo(w * 0.85, h * 0.88); ctx.stroke();
  ctx.restore();
}

// ── birch tree (for 1968 snow forest) ────────────────────────────────────────
export function birchSprite(seed = 1, h = 900) {
  return cached(`p8:birch:${seed}:${h}`, () => {
    const w = Math.round(h * 0.42);
    const { c, ctx } = makeCanvas(w, h);
    const r = rng(seed);
    const tw_ = h * (0.022 + r() * 0.01);
    const cx = w / 2 + (r() - 0.5) * w * 0.1;
    // thin branches (fine twiggy crown)
    ctx.strokeStyle = 'rgba(60,52,60,.55)';
    for (let i = 0; i < 26; i++) {
      const y0 = h * (0.05 + r() * 0.5), dir = r() < 0.5 ? -1 : 1, len = h * (0.08 + r() * 0.18);
      ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath(); ctx.moveTo(cx, y0);
      ctx.quadraticCurveTo(cx + dir * len * 0.5, y0 - len * 0.1, cx + dir * len, y0 + len * (0.2 + r() * 0.4));
      ctx.stroke();
      ctx.lineWidth = 0.6;
      for (let k = 0; k < 4; k++) { const u = 0.4 + r() * 0.6; const bx = cx + dir * len * u, by = y0 + len * 0.2 * u; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dir * len * 0.2, by + len * (0.15 + r() * 0.25)); ctx.stroke(); }
    }
    // trunk
    ctx.beginPath();
    ctx.moveTo(cx - tw_ * 0.5, 0); ctx.lineTo(cx + tw_ * 0.5, 0); ctx.lineTo(cx + tw_ * 1.1, h); ctx.lineTo(cx - tw_ * 1.1, h); ctx.closePath();
    shadeCylinder(ctx, cx - tw_, tw_ * 2, '#E9E6E2', { spec: 0.3 });
    // black lenticels / patches
    ctx.save(); ctx.clip();
    for (let i = 0; i < 70; i++) {
      const y = r() * h, ww = tw_ * (0.6 + r() * 1.6), hh = 1.5 + r() * 4;
      ctx.fillStyle = rgba('#2B2628', 0.5 + r() * 0.4);
      ctx.beginPath(); ctx.ellipse(cx + (r() - 0.5) * tw_ * 0.8, y, ww * 0.5, hh, (r() - 0.5) * 0.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    return c;
  });
}

// ── a grey sky-to-snow gradient strip of a forest (far, flat) ────────────────
export function forestStrip(seed = 2, { w = 2400, h = 300, col = '#7A7684' } = {}) {
  return cached(`p8:forest:${seed}:${w}:${col}`, () => {
    const { c, ctx } = makeCanvas(w, h);
    const r = rng(seed);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, hh = h * (0.4 + r() * 0.6);
      ctx.strokeStyle = rgba(mixColor(col, '#D8D6DE', r() * 0.5), 0.5 + r() * 0.4);
      ctx.lineWidth = 1 + r() * 3;
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + (r() - 0.5) * 6, h - hh); ctx.stroke();
    }
    // twiggy haze
    for (let i = 0; i < 90; i++) {
      const x = r() * w, y = h * (0.15 + r() * 0.5), rr = 20 + r() * 60;
      ctx.fillStyle = rgba(col, 0.08 + r() * 0.08);
      ctx.beginPath(); ctx.ellipse(x, y, rr * 1.4, rr, 0, 0, TAU); ctx.fill();
    }
    return c;
  });
}

// ── MiG-15 side profile (silver, swept) — drawn centred, nose to +x ─────────
export function migSprite(uti = false, { len = 900, livery = '#B9C2C6' } = {}) {
  return cached(`p8:mig:${uti}:${len}:${livery}`, () => {
    const w = len * 1.05, h = len * 0.42;
    const { c, ctx } = makeCanvas(w, h);
    ctx.translate(w * 0.5, h * 0.55);
    const L = len;
    const u = (v) => v * L;
    // fuselage: stubby barrel with nose intake
    const body = new Path2D();
    body.moveTo(u(0.47), u(-0.005));
    body.bezierCurveTo(u(0.47), u(-0.06), u(0.40), u(-0.085), u(0.30), u(-0.085));
    body.lineTo(u(-0.18), u(-0.07));
    body.bezierCurveTo(u(-0.32), u(-0.06), u(-0.40), u(-0.04), u(-0.47), u(-0.025));
    body.lineTo(u(-0.47), u(0.03));
    body.bezierCurveTo(u(-0.38), u(0.05), u(-0.25), u(0.07), u(-0.12), u(0.075));
    body.lineTo(u(0.30), u(0.075));
    body.bezierCurveTo(u(0.40), u(0.07), u(0.47), u(0.05), u(0.47), u(-0.005));
    body.closePath();
    // tail fin (swept, tall)
    const fin = new Path2D();
    fin.moveTo(u(-0.22), u(-0.065)); fin.lineTo(u(-0.38), u(-0.30)); fin.lineTo(u(-0.47), u(-0.31)); fin.lineTo(u(-0.45), u(-0.03)); fin.closePath();
    // horizontal stabiliser (high on the fin)
    const stab = new Path2D();
    stab.moveTo(u(-0.36), u(-0.235)); stab.lineTo(u(-0.50), u(-0.25)); stab.lineTo(u(-0.51), u(-0.225)); stab.lineTo(u(-0.38), u(-0.215)); stab.closePath();
    // wing (swept, seen from the side as a thin sliver + far wing tip)
    const wing = new Path2D();
    wing.moveTo(u(0.12), u(0.045)); wing.lineTo(u(-0.16), u(0.10)); wing.lineTo(u(-0.24), u(0.10)); wing.lineTo(u(-0.02), u(0.045)); wing.closePath();
    const metal = (p, base, k = 0) => {
      ctx.fillStyle = base; ctx.fill(p);
      ctx.save(); ctx.clip(p);
      const g = ctx.createLinearGradient(0, u(-0.1), 0, u(0.09));
      g.addColorStop(0, rgba('#FFFFFF', 0.55)); g.addColorStop(0.35, rgba('#FFFFFF', 0.05)); g.addColorStop(0.6, rgba('#22303A', 0.05)); g.addColorStop(1, rgba('#22303A', 0.45));
      ctx.fillStyle = g; ctx.fillRect(-w, -h, w * 2, h * 2);
      ctx.drawImage(tex.metal(livery, { w: 600, h: 400, seed: 5 + k }), -w / 2, -h / 2, w, h);
      ctx.globalCompositeOperation = 'multiply';
      ctx.restore();
      ctx.strokeStyle = 'rgba(40,50,58,.75)'; ctx.lineWidth = Math.max(1, L * 0.0025); ctx.stroke(p);
    };
    // far wing hint
    ctx.fillStyle = shade(livery, -0.35);
    ctx.beginPath(); ctx.moveTo(u(0.10), u(0.0)); ctx.lineTo(u(-0.12), u(-0.03)); ctx.lineTo(u(-0.18), u(-0.03)); ctx.lineTo(u(-0.02), u(0.0)); ctx.fill();
    metal(fin, shade(livery, -0.06), 1);
    metal(body, livery, 0);
    metal(stab, shade(livery, -0.05), 2);
    metal(wing, shade(livery, 0.04), 3);
    // panel lines
    ctx.strokeStyle = 'rgba(40,50,58,.35)'; ctx.lineWidth = Math.max(0.8, L * 0.0015);
    for (const x of [0.36, 0.22, 0.05, -0.1, -0.25]) { ctx.beginPath(); ctx.moveTo(u(x), u(-0.083)); ctx.lineTo(u(x), u(0.074)); ctx.stroke(); }
    // nose intake (dark ellipse)
    ctx.fillStyle = '#1B2229';
    ctx.beginPath(); ctx.ellipse(u(0.468), u(-0.005), u(0.012), u(0.052), 0, 0, TAU); ctx.fill();
    // red nose ring
    ctx.strokeStyle = C.red; ctx.lineWidth = u(0.012);
    ctx.beginPath(); ctx.moveTo(u(0.455), u(-0.055)); ctx.quadraticCurveTo(u(0.47), u(-0.005), u(0.455), u(0.048)); ctx.stroke();
    // canopy (bubble), tandem for UTI
    const canopy = (x0, x1) => {
      const p = new Path2D();
      p.moveTo(u(x0), u(-0.082)); p.bezierCurveTo(u(x0 + 0.01), u(-0.15), u(x1 - 0.02), u(-0.15), u(x1), u(-0.08)); p.closePath();
      const g = ctx.createLinearGradient(u(x0), u(-0.15), u(x1), u(-0.08));
      g.addColorStop(0, '#CFE7F2'); g.addColorStop(0.5, '#5F8296'); g.addColorStop(1, '#2C4252');
      ctx.fillStyle = g; ctx.fill(p);
      ctx.strokeStyle = 'rgba(30,40,48,.8)'; ctx.lineWidth = Math.max(1, L * 0.003); ctx.stroke(p);
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1, L * 0.002);
      ctx.beginPath(); ctx.moveTo(u(x0 + 0.02), u(-0.11)); ctx.quadraticCurveTo(u((x0 + x1) / 2), u(-0.142), u(x1 - 0.03), u(-0.115)); ctx.stroke();
    };
    if (uti) { canopy(0.24, 0.33); canopy(0.12, 0.23); } else canopy(0.17, 0.30);
    // red star on fin
    ctx.save(); ctx.translate(u(-0.40), u(-0.16));
    star(ctx, 0, 0, u(0.035), u(0.014)); ctx.fillStyle = C.red; ctx.fill();
    ctx.strokeStyle = '#F4EBD6'; ctx.lineWidth = Math.max(1, L * 0.002); ctx.stroke();
    ctx.restore();
    // exhaust
    ctx.fillStyle = '#2B2622'; ctx.beginPath(); ctx.ellipse(u(-0.47), u(0.003), u(0.008), u(0.03), 0, 0, TAU); ctx.fill();
    // tail number
    ctx.fillStyle = C.red; ctx.font = font(F.STENCIL, u(0.045), 800); ctx.textAlign = 'center';
    ctx.fillText(uti ? '18' : '01', u(0.33), u(0.035));
    return c;
  });
}

// ── period radio receiver (walnut, fabric grille, glowing dial) ─────────────
export function radioSprite() {
  return cached('p8:radio', () => {
    const w = 1100, h = 760;
    const { c, ctx } = makeCanvas(w + 120, h + 120);
    ctx.translate(60, 60);
    // cabinet with rounded top
    const cab = new Path2D(); cab.roundRect(0, 0, w, h, [160, 160, 26, 26]);
    const wood = makeCanvas(w, h);
    {
      const x = wood.ctx; const r = rng(4);
      const g = x.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#4A2614'); g.addColorStop(0.5, '#7A4426'); g.addColorStop(1, '#3E1F10');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { // grain lines
        const y0 = r() * h; x.strokeStyle = rgba(r() < 0.5 ? '#2A1206' : '#A0623A', 0.08 + r() * 0.12); x.lineWidth = 1 + r() * 2.5;
        x.beginPath(); x.moveTo(0, y0); for (let k = 0; k <= 20; k++) x.lineTo((k / 20) * w, y0 + Math.sin(k * 0.7 + i) * (4 + r() * 6) + noise.n2(k * 0.3, i) * 8); x.stroke();
      }
    }
    ctx.save(); ctx.clip(cab); ctx.drawImage(wood.c, 0, 0);
    // varnish highlight
    const vg = ctx.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, 'rgba(255,220,180,.28)'); vg.addColorStop(0.18, 'rgba(255,220,180,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.strokeStyle = '#2A1408'; ctx.lineWidth = 4; ctx.stroke(cab);
    // bevel inner line
    ctx.strokeStyle = 'rgba(255,210,160,.25)'; ctx.lineWidth = 3;
    const inner = new Path2D(); inner.roundRect(18, 18, w - 36, h - 36, [145, 145, 16, 16]); ctx.stroke(inner);
    // speaker grille (fabric) – upper area
    const gx = 90, gy = 70, gw = w - 180, gh = 380;
    const gp = new Path2D(); gp.roundRect(gx, gy, gw, gh, [120, 120, 10, 10]);
    ctx.fillStyle = '#C9B48C'; ctx.fill(gp);
    ctx.save(); ctx.clip(gp);
    const fab = makeCanvas(64, 64);
    { const x = fab.ctx; x.fillStyle = '#CDB990'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(90,70,40,.35)'; x.lineWidth = 1; for (let i = 0; i < 64; i += 3) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); x.beginPath(); x.moveTo(0, i + 1); x.lineTo(64, i + 1); x.stroke(); } }
    ctx.fillStyle = ctx.createPattern(fab.c, 'repeat'); ctx.fillRect(gx, gy, gw, gh);
    const sg = ctx.createRadialGradient(gx + gw / 2, gy + gh * 0.6, 10, gx + gw / 2, gy + gh * 0.6, gw * 0.6);
    sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(40,20,5,.45)'); ctx.fillStyle = sg; ctx.fillRect(gx, gy, gw, gh);
    ctx.restore();
    // vertical wooden slats over grille
    for (let i = 0; i < 7; i++) {
      const sx = gx + gw * (0.14 + i * 0.12);
      ctx.fillStyle = '#5A2E16'; ctx.fillRect(sx - 9, gy + 10, 18, gh - 10);
      ctx.fillStyle = 'rgba(255,210,160,.22)'; ctx.fillRect(sx - 9, gy + 10, 5, gh - 10);
    }
    // brass trim around grille
    ctx.strokeStyle = '#C9A24A'; ctx.lineWidth = 6; ctx.stroke(gp);
    ctx.strokeStyle = 'rgba(255,240,190,.5)'; ctx.lineWidth = 2; ctx.stroke(gp);
    // dial window
    const dx = 120, dy = 490, dw = w - 240, dh = 120;
    ctx.fillStyle = '#1B120A'; ctx.fillRect(dx - 8, dy - 8, dw + 16, dh + 16);
    ctx.strokeStyle = '#C9A24A'; ctx.lineWidth = 5; ctx.strokeRect(dx - 8, dy - 8, dw + 16, dh + 16);
    // knobs
    for (const kx of [180, w - 180]) {
      const ky = h - 70;
      ctx.beginPath(); ctx.arc(kx, ky, 38, 0, TAU);
      shadeSphere(ctx, kx, ky, 38, '#3A2418', { spec: 0.4 });
      ctx.strokeStyle = '#C9A24A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(kx, ky, 40, 0, TAU); ctx.stroke();
    }
    // brand plate
    ctx.fillStyle = '#C9A24A'; ctx.font = font(F.RUS, 34, 400); ctx.textAlign = 'center'; ctx.fillText('РЕКОРД', w / 2, h - 58);
    return { c, dial: { x: dx + 60, y: dy + 60, w: dw, h: dh }, grille: { x: gx + 60 + gw / 2, y: gy + 60 + gh * 0.55 }, w: w + 120, h: h + 120 };
  });
}
export function drawDial(ctx, d, t, needle, { glowAmt = 1 } = {}) {
  const { x, y, w, h } = d;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#FFC874'); g.addColorStop(0.5, '#F5A64A'); g.addColorStop(1, '#D9832E');
  ctx.fillStyle = g; ctx.globalAlpha = 0.65 + 0.35 * glowAmt; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  // scale marks & stations
  ctx.strokeStyle = 'rgba(60,30,10,.8)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 60; i++) { const xx = x + 20 + (w - 40) * (i / 60); ctx.beginPath(); ctx.moveTo(xx, y + 14); ctx.lineTo(xx, y + (i % 5 ? 26 : 36)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(60,30,10,.9)'; ctx.font = font(F.MONO, 17, 600); ctx.textAlign = 'center';
  const st = ['РИГА', 'КИЕВ', 'МОСКВА', 'МИНСК', 'ТАЛЛИН', 'БАКУ'];
  st.forEach((s, i) => ctx.fillText(s, x + 70 + (w - 140) * (i / (st.length - 1)), y + 66));
  ctx.font = font(F.MONO, 13, 400);
  ['ДВ', 'СВ', 'КВ'].forEach((s, i) => ctx.fillText(s, x + 30, y + 92 + i * 0 + (i - 1) * 0));
  // needle
  const nx = x + 70 + (w - 140) * needle;
  ctx.strokeStyle = C.red; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(nx, y + 8); ctx.lineTo(nx, y + h - 8); ctx.stroke();
  ctx.restore();
  glow(ctx, x + w / 2, y + h / 2, w * 0.6, '#FFB25A', 0.22 * glowAmt);
}

// ── Kremlin skyline silhouette (Spasskaya + wall + St Basil) ────────────────
export function kremlinSprite(col = '#2A1622') {
  return cached(`p8:kremlin:${col}`, () => {
    const w = 2400, h = 700;
    const { c, ctx } = makeCanvas(w, h);
    const base = h - 10;
    ctx.fillStyle = col;
    // wall with swallowtail merlons
    const wallTop = base - 120;
    ctx.fillRect(0, wallTop, w, 130);
    for (let x = 0; x < w; x += 34) {
      ctx.beginPath(); ctx.moveTo(x + 4, wallTop); ctx.lineTo(x + 4, wallTop - 26); ctx.lineTo(x + 12, wallTop - 18); ctx.lineTo(x + 20, wallTop - 26); ctx.lineTo(x + 20, wallTop); ctx.fill();
    }
    // Spasskaya tower
    const tx = 760;
    ctx.fillRect(tx - 70, base - 330, 140, 330);
    ctx.fillRect(tx - 58, base - 420, 116, 100);
    ctx.fillRect(tx - 46, base - 480, 92, 70);
    ctx.beginPath(); ctx.moveTo(tx - 44, base - 480); ctx.lineTo(tx, base - 640); ctx.lineTo(tx + 44, base - 480); ctx.fill();
    // clock face (lit)
    ctx.save(); ctx.fillStyle = '#F3D27A'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(tx, base - 370, 30, 0, TAU); ctx.fill(); ctx.restore();
    // star on top (ruby)
    ctx.save(); ctx.translate(tx, base - 660); star(ctx, 0, 0, 26, 11); ctx.fillStyle = '#E2463A'; ctx.fill(); ctx.restore();
    // second tower further
    const t2 = 1880;
    ctx.fillRect(t2 - 50, base - 250, 100, 250); ctx.fillRect(t2 - 40, base - 310, 80, 70);
    ctx.beginPath(); ctx.moveTo(t2 - 40, base - 310); ctx.lineTo(t2, base - 430); ctx.lineTo(t2 + 40, base - 310); ctx.fill();
    ctx.save(); ctx.translate(t2, base - 446); star(ctx, 0, 0, 18, 8); ctx.fillStyle = '#E2463A'; ctx.fill(); ctx.restore();
    // St Basil's (onion domes) at left
    const domes = [[220, 300, 46], [300, 360, 40], [140, 250, 34], [380, 260, 36], [260, 210, 30], [60, 220, 28]];
    ctx.fillStyle = col;
    ctx.fillRect(40, base - 200, 420, 200);
    for (const [dx, dh, r] of domes) {
      ctx.fillRect(dx - r * 0.55, base - dh, r * 1.1, dh);
      ctx.beginPath();
      ctx.moveTo(dx - r * 0.6, base - dh);
      ctx.bezierCurveTo(dx - r * 1.2, base - dh - r * 0.6, dx - r * 0.3, base - dh - r * 1.2, dx, base - dh - r * 1.9);
      ctx.bezierCurveTo(dx + r * 0.3, base - dh - r * 1.2, dx + r * 1.2, base - dh - r * 0.6, dx + r * 0.6, base - dh);
      ctx.fill();
      ctx.fillRect(dx - 2, base - dh - r * 2.4, 4, r * 0.6);
    }
    // lit windows in wall/tower
    ctx.fillStyle = 'rgba(243,210,122,.6)';
    for (let i = 0; i < 6; i++) ctx.fillRect(tx - 40 + (i % 3) * 30, base - 260 + Math.floor(i / 3) * 60, 10, 22);
    return c;
  });
}

// ── halftone image maker (render fn into small canvas, then dots) ────────────
export function halftoneCanvas(key, w, h, drawFn, { cell = 7, ink = '#1C1A17', paper = null, angle = 0 } = {}) {
  return cached(`p8:ht:${key}`, () => {
    const src = makeCanvas(w, h);
    drawFn(src.ctx, w, h);
    const sw = Math.ceil(w / cell), sh = Math.ceil(h / cell);
    const sm = makeCanvas(sw, sh);
    sm.ctx.drawImage(src.c, 0, 0, sw, sh);
    const d = sm.ctx.getImageData(0, 0, sw, sh).data;
    const out = makeCanvas(w, h);
    const x = out.ctx;
    if (paper) { x.fillStyle = paper; x.fillRect(0, 0, w, h); }
    x.fillStyle = ink;
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
      const k = (j * sw + i) * 4;
      const lum = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255;
      const a = d[k + 3] / 255;
      const rr = Math.sqrt(1 - lum) * a * cell * 0.62;
      if (rr < 0.3) continue;
      const ox = (j % 2) * cell * 0.5;
      x.beginPath(); x.arc(i * cell + cell / 2 + ox, j * cell + cell / 2, rr, 0, TAU); x.fill();
    }
    return out.c;
  });
}
