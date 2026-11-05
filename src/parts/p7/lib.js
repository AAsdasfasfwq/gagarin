// ─────────────────────────────────────────────────────────────────────────────
// p7/lib.js — shared craft for "Fire and Earth": word-time table, plasma &
// ember VFX, heat shimmer, frost, sky, helmet/visor geometry, paper helpers.
// Everything deterministic (seeded) and cached.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, rng, noise, TAU, E, tw, smoothstep } from '../../core/math.js';
import { C, rgba, shade, mixColor, ramp, PLASMA_RAMP, FIRE_RAMP } from '../../core/palette.js';
import { makeCanvas, cached, scratchCanvas, W, H, tex } from '../../core/draw.js';
import { CAST } from '../../core/characters.js';

// Key word times (absolute s) from assets/script.json — the VO is the master clock.
export const T = {
  start: 972.42, falling: 973.58, n17400: 975.10, miles: 976.74, hour: 977.62,
  air: 978.24, friction: 978.74, searing: 979.58, plasma: 980.14,
  temperature: 981.38, several: 982.72, thousand: 983.26, degrees: 983.82,
  ablative: 986.18, melting: 987.36, flowing: 988.18, windows: 989.18,
  cabin: 990.40, smelled: 990.76, burning: 991.36,
  gagarin1: 992.46, streams: 993.24, liquid: 993.92, metal: 994.26, running: 994.66, skin: 996.26,
  myth: 997.14, emerged: 997.74, shouted: 998.54,
  im: 999.08, burningUp: 999.48, up: 999.80, goodbye: 1000.36, comrades: 1001.04,
  inReality: 1001.80, reality: 1002.42, noPanic: 1003.72, panic: 1003.92,
  flames: 1005.96, didNotKnow: 1006.84, capsule: 1007.88, melt: 1008.44,
  but: 1008.96, ice: 1009.96, calm: 1010.38,
  recording: 1011.06, gforces: 1011.60, n10: 1012.88, gs: 1013.32,
  his: 1014.24, crushed: 1015.20, seat: 1016.10, vision: 1017.70, dimmed: 1018.06, chest: 1018.92, air2: 1020.44,
  fortunately: 1021.16, critical: 1023.62, level: 1023.98,
  hot: 1025.00, burned: 1026.04, through: 1026.48, illFated: 1027.08, cable: 1027.60, together: 1028.92,
  instrument: 1030.16, broke: 1030.94, away: 1031.38, burnedUp: 1032.04,
  righted: 1034.04, stabilized: 1035.32, offset: 1036.24, centerOfGravity: 1036.66, gravity: 1037.12,
  hurtled: 1038.02, ground: 1038.96,
  altitude: 1040.04, n23000: 1040.68, feet: 1041.80, automatic: 1042.68, blew: 1043.52, hatch: 1044.34,
  ejection: 1045.56, activated: 1046.44,
  soft: 1048.64, notYet: 1049.60, perfected: 1050.56,
  ifG: 1051.48, landed: 1052.58, inside: 1052.90, steel: 1053.76, sphere: 1053.98,
  impact: 1054.94, tooViolent: 1055.84, violent: 1056.12, seriously: 1057.64, injured: 1058.18,
  plan: 1059.50, required: 1060.36, eject: 1061.08, descend: 1062.66, own: 1063.62, parachute: 1063.86,
  forYears: 1064.72, years: 1065.16, concealed: 1066.92, fact: 1067.80,
  claiming: 1068.62, landedInside: 1069.52, spacecraft: 1070.74,
  federation: 1073.16, aero: 1073.80, intl: 1074.48, fai: 1075.72,
  officially: 1076.76, register: 1077.30, record: 1078.58,
  under: 1079.24, rules: 1080.00, pilot: 1080.86, land: 1081.84, craft: 1082.50,
  truth: 1083.66, acknowledged: 1084.66, decades: 1085.62, later: 1086.18,
  thrown: 1087.66, clear: 1087.90, inSeat: 1089.28, separated: 1090.24, opened: 1091.44, mainChute: 1091.98,
  finalMal: 1093.62, malfunction: 1093.98, reserve: 1096.08, released: 1096.98, openedOwn: 1097.72,
  descended: 1099.68, two: 1100.44, canopies: 1100.80, risking: 1101.80, tangled: 1102.58,
  fortunately2: 1103.54, didnt: 1104.64, collide: 1104.98,
  problem: 1106.86, valve: 1107.68, spacesuit: 1108.34, outsideAir: 1110.00, breathing: 1111.02,
  caught: 1112.44, beneath: 1112.78, folds: 1113.06, clothing: 1113.58,
  severalMin: 1114.86, minutes: 1115.30, couldnt: 1116.42, find: 1116.84, suffocating: 1117.82, sealed: 1118.76,
  until: 1119.44, finally: 1120.20, managed: 1120.68, openIt: 1121.26,
  heLanded: 1122.20, saratov: 1122.86, region: 1123.40, plowed: 1124.36, field: 1124.72, near: 1125.12, smelovka: 1126.10,
  end: 1127.0,
};

// local-time helper: scene-local seconds of an absolute word time
export const L = (S, abs) => abs - S.scene.start;

// ── sprites (cached) ─────────────────────────────────────────────────────────
// soft elongated flame tongue: bright core, noisy breakup, pointing +x
export function flameSprite(color, seed = 1) {
  return cached(`p7flame:${color}:${seed}`, () => {
    const w = 256, h = 96;
    const { c, ctx } = makeCanvas(w, h);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const nz = noise;
    const [r0, g0, b0] = hex(color);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = (y / h - 0.5) * 2;
      const width = 0.95 * Math.pow(1 - u, 0.7) * Math.min(1, u * 6 + 0.35);
      const n = nz.fbm2(u * 5 + seed * 3.7, v * 2.2 + seed, 3) * 0.5 + 0.5;
      const edge = clamp(1 - Math.abs(v) / Math.max(0.02, width * (0.7 + n * 0.6)));
      const head = smoothstep(0, 0.16, u);
      let a = Math.pow(edge, 1.6) * Math.pow(1 - u, 1.2) * (0.6 + n * 0.6) * head;
      a = clamp(a);
      const i = (y * w + x) * 4;
      const hot = Math.pow(edge, 3) * (1 - u);
      d[i] = lerp(r0, 255, hot * 0.7); d[i + 1] = lerp(g0, 246, hot * 0.6); d[i + 2] = lerp(b0, 225, hot * 0.5); d[i + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// round soft dot sprite (embers, glows) pre-tinted
export function dotSprite(color, size = 64) {
  return cached(`p7dot:${color}:${size}`, () => {
    const { c, ctx } = makeCanvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, rgba('#FFF8E6', 1)); g.addColorStop(0.18, rgba(color, 0.95)); g.addColorStop(0.5, rgba(color, 0.25)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return c;
  });
}

// ── plasma sheath (2D VFX around a projected sphere) ────────────────────────
// x,y,r: screen sphere; ang: direction the wake streams toward (rad);
// k: intensity 0..1; len: wake length in px.
export function plasmaSheath(ctx, t, { x, y, r, ang = -Math.PI / 2, k = 1, len = 900, seed = 3, count = 140, shock = 1, speed = 1, bloom = 1 } = {}) {
  if (k <= 0.001) return;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const R = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // outer bloom
  const lead = { x: x - dx * r * 0.85, y: y - dy * r * 0.85 };
  if (bloom > 0) {
    const g = ctx.createRadialGradient(lead.x, lead.y, r * 0.2, x, y, r * 3.2);
    const kb = k * bloom;
    g.addColorStop(0, rgba(C.plasma2, 0.55 * kb)); g.addColorStop(0.3, rgba(C.plasma0, 0.32 * kb)); g.addColorStop(0.7, rgba(C.plasma1, 0.1 * kb)); g.addColorStop(1, rgba(C.plasma1, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
  }
  // wake tongues
  const cols = [C.fire5, C.fire4, C.plasma2, C.fire3, C.plasma0, C.plasma1, C.fire2];
  for (let i = 0; i < count; i++) {
    const a0 = (R() - 0.5) * Math.PI * 1.25; // emission angle around the leading face
    const life = 0.35 + R() * 0.55;
    const ph = R() * life;
    const age = (((t * speed + ph) % life) + life) % life;
    const u = age / life;
    const side = Math.sin(a0);
    // birth point on the limb, perpendicular offset
    const px = -dy, py = dx;
    const bx = x - dx * Math.cos(a0) * r * 0.95 + px * side * r * 1.02;
    const by = y - dy * Math.cos(a0) * r * 0.95 + py * side * r * 1.02;
    const dist = (u * u * 0.4 + u * 0.6) * len * (0.5 + R() * 0.7);
    const spread = side * (r * 0.25 + dist * 0.18) + noise.n2(i * 1.7, t * 2.1) * dist * 0.06;
    const sx = bx + dx * dist + px * spread, sy = by + dy * dist + py * spread;
    const ci = Math.min(cols.length - 1, Math.floor(u * cols.length * 0.95 + R() * 1.2));
    const spr = flameSprite(cols[ci], (i % 4) + 1);
    const sl = (r * 1.2 + dist * 0.5) * (0.6 + R() * 0.8);
    const sw = sl * (0.22 + R() * 0.2) * (1 - u * 0.4);
    ctx.globalAlpha = clamp(k * (1 - u) * Math.min(1, u * 8) * (0.35 + R() * 0.5));
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang + spread / Math.max(200, dist + 200) * 0.6);
    ctx.drawImage(spr, -sl * 0.15, -sw / 2, sl, sw);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (shock > 0) shockGlow(ctx, t, { x, y, r, ang, k: k * shock, seed });
}

// soft volumetric bow-shock crescent (tapered, turbulent, blurred once at half res)
export function shockGlow(ctx, t, { x, y, r, ang, k = 1, span = 1.25, seed = 1, blur = 7 } = {}) {
  if (k <= 0.001) return;
  const sc = scratchCanvas('p7-shock', 960, 540);
  const c = sc.ctx;
  c.setTransform(0.5, 0, 0, 0.5, 0, 0);
  c.globalCompositeOperation = 'lighter';
  const face = ang + Math.PI;
  const layers = [[1.0, C.fire5, 0.95, 0.07], [1.03, C.fire4, 0.75, 0.12], [1.07, C.plasma2, 0.55, 0.17], [1.13, C.plasma0, 0.42, 0.24], [1.2, C.plasma1, 0.25, 0.32]];
  const n = 56;
  for (let L = 0; L < layers.length; L++) {
    const [rk, col, a, th] = layers[L];
    const sp = span * (1 - L * 0.04);
    const outer = [], inner = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const aa = face - sp + u * 2 * sp;
      const fall = Math.pow(Math.sin(Math.PI * u), 0.8);
      const j = noise.n2(u * 7 + seed + L, t * 2.6 - L) * 0.035;
      const r0 = r * (rk + j);
      const r1 = r * (rk + j + th * fall);
      inner.push([x + Math.cos(aa) * r0, y + Math.sin(aa) * r0]);
      outer.push([x + Math.cos(aa) * r1, y + Math.sin(aa) * r1]);
    }
    c.beginPath();
    outer.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    for (let i = inner.length - 1; i >= 0; i--) c.lineTo(inner[i][0], inner[i][1]);
    c.closePath();
    c.fillStyle = rgba(col, a * k);
    c.fill();
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(sc.c, 0, 0, W, H);
  ctx.filter = 'blur(1.5px)';
  ctx.globalAlpha = 0.7;
  ctx.drawImage(sc.c, 0, 0, W, H);
  ctx.restore();
}

// streaking embers / sparks flowing along a direction
export function embers(ctx, t, { x = W / 2, y = H / 2, w = W, h = H, ang = -Math.PI / 2, speed = 900, count = 120, seed = 5, k = 1, size = [1.5, 4], stretch = 0.03, col = null } = {}) {
  if (k <= 0) return;
  const R = rng(seed);
  const dx = Math.cos(ang), dy = Math.sin(ang);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const sp = speed * (0.4 + R() * 0.9);
    const span = (Math.hypot(w, h) + 400) / sp;
    const ph = R() * span;
    const age = (((t + ph) % span) + span) % span;
    const ox = (R() - 0.5) * w, oy = (R() - 0.5) * h;
    // start upstream, travel along dir
    const d0 = -Math.hypot(w, h) * 0.6;
    const along = d0 + age * sp;
    const px = x + ox * Math.abs(dy) + dx * along + noise.n2(i, t * 1.3) * 18;
    const py = y + oy * Math.abs(dx) + dy * along + noise.n2(i + 50, t * 1.3) * 18;
    const s = lerp(size[0], size[1], R());
    const c = col || (R() < 0.4 ? C.fire4 : R() < 0.7 ? C.fire3 : C.plasma0);
    const fl = 0.55 + 0.45 * noise.n2(i * 3.3, t * 9);
    ctx.globalAlpha = clamp(k * fl);
    ctx.strokeStyle = c;
    ctx.lineWidth = s;
    const Ls = sp * stretch;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - dx * Ls, py - dy * Ls); ctx.stroke();
  }
  ctx.restore();
}

// heat shimmer: re-draws a horizontal band in offset strips (cheap displacement)
export function heatWarp(ctx, t, { y0 = 0, y1 = H, amp = 4, freq = 0.035, speed = 6, strip = 6, x0 = 0, x1 = W } = {}) {
  if (amp <= 0.05) return;
  const sc = scratchCanvas('p7-heat', W, H);
  sc.ctx.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let y = Math.max(0, y0 | 0); y < Math.min(H, y1); y += strip) {
    const e = Math.sin(Math.PI * clamp((y - y0) / Math.max(1, y1 - y0)));
    const off = (Math.sin(y * freq + t * speed) * 0.6 + noise.n2(y * 0.02, t * 1.7) * 0.8) * amp * e;
    ctx.drawImage(sc.c, x0, y, x1 - x0, strip, x0 + off, y, x1 - x0, strip);
  }
  ctx.restore();
}

// screen-space glow ring of light (lens flare-ish, restrained)
export function softGlow(ctx, x, y, r, color, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.25, rgba(color, a * 0.45)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// tunnel vision / tinted vignette (amt 0..1, closes to radius rMin)
export function tunnel(ctx, amt, { cx = W / 2, cy = H / 2, color = '#05070C', soft = 0.55 } = {}) {
  if (amt <= 0) return;
  const r1 = lerp(1500, 60, E.inOutCubic(clamp(amt)));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cx, cy, r1 * (1 - soft), cx, cy, r1);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ice frost crystals growing from seeds (dendritic strokes), progress p 0..1
export function frost(ctx, p, { seeds = [[960, 540]], color = '#CFEFFF', seed = 12, reach = 900, alpha = 0.7, width = 1.4 } = {}) {
  if (p <= 0) return;
  const R = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const branch = (x, y, a, len, depth, p0) => {
    if (depth > 4 || len < 6) return;
    const segs = 6;
    let px = x, py = y;
    for (let i = 1; i <= segs; i++) {
      const u = i / segs;
      const need = p0 + u * 0.35 / (depth + 1);
      if (p < need) return;
      const nx = x + Math.cos(a) * len * u, ny = y + Math.sin(a) * len * u;
      ctx.globalAlpha = alpha * (1 - depth * 0.15);
      ctx.lineWidth = width * (1.6 - depth * 0.3);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      if (i % 2 === 0) {
        const s = R() < 0.5 ? 1 : -1;
        branch(nx, ny, a + s * (0.9 + R() * 0.3), len * (0.35 + R() * 0.15), depth + 1, need);
        if (R() < 0.6) branch(nx, ny, a - s * (0.9 + R() * 0.3), len * (0.3 + R() * 0.15), depth + 1, need + 0.02);
      }
      px = nx; py = ny;
    }
  };
  for (const [sx, sy] of seeds) {
    const arms = 6;
    const rot = R() * TAU;
    for (let k = 0; k < arms; k++) branch(sx, sy, rot + (k / arms) * TAU, reach * (0.5 + R() * 0.5), 0, 0);
  }
  ctx.restore();
}

// ── helmet / visor geometry for overlays on drawCharacter output ────────────
// returns the visor opening ellipse in SCREEN coords for a character drawn
// with anchor 'neck' at (x,y) or anchor 'feet' at (x,y). tilt about the neck.
export function visorGeom(who, { x, y, s, yaw = 0, pitch = 0, tilt = 0, anchor = 'neck' }) {
  const B = CAST[who].build;
  const legLen = 5.1 * B.height, torsoLen = 3.9 * B.height;
  const neckY = -legLen - torsoLen - 0.25;
  const headCY = neckY - 0.92 - B.neck * 0.22;
  const ny = anchor === 'neck' ? y : y + neckY * s;
  const hcRel = (headCY - neckY) * s; // negative
  const yawE = clamp(yaw, -1.2, 1.2) * 1.1, pitchE = clamp(pitch, -0.7, 0.7) * 0.6;
  const R = 1.55 * s;
  const hxL = Math.sin(yawE) * s * 0.05, hyL = hcRel - s * 0.1 + pitchE * s * 0.1;
  const fxL = hxL + Math.sin(yawE) * R * 0.38, fyL = hyL + R * 0.12;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const rot = (px, py) => ({ x: x + px * ct - py * st, y: ny + px * st + py * ct });
  const c = rot(fxL, fyL), h = rot(hxL, hyL);
  return { cx: c.x, cy: c.y, rx: R * 0.72 * (1 - Math.abs(Math.sin(yawE)) * 0.35), ry: R * 0.78, rot: tilt, hx: h.x, hy: h.y, R, neckX: x, neckY: ny };
}

// ── backgrounds ─────────────────────────────────────────────────────────────
export function emberGround(ctx, t, { cx = W * 0.5, cy = H * 0.5, heat = 1, base = '#2A0E10' } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1300);
  g.addColorStop(0, mixColor(base, '#7A2414', 0.55 * heat));
  g.addColorStop(0.45, base);
  g.addColorStop(1, '#0E0608');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.5;
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(tex.grit(1.4, { seed: 8, alpha: 90 }), 0, 0, W, H);
  ctx.restore();
}

// atmosphere: sky gradient by altitude a (1 = edge of space, 0 = ground level)
export function skyGrad(ctx, a, { sun = null } = {}) {
  const top = ramp([[0, C.sky2], [0.5, '#4E7DB4'], [0.8, C.sky3], [1, C.space]], a);
  const mid = ramp([[0, '#A8C8E0'], [0.5, '#7FA9CF'], [1, '#2E4F80']], a);
  const bot = ramp([[0, '#E4E6DA'], [0.5, '#C5D6E2'], [1, '#6E8FB8']], a);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(0.6, mid); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (sun) softGlow(ctx, sun[0], sun[1], 700, '#FFF1D2', 0.35);
  ctx.restore();
}

// layered volumetric cloud bank drawn from smoke sprites (not icon clouds)
export function cloudBank(ctx, t, { y = 800, w = 2600, x = 960, count = 26, seed = 31, size = [260, 620], color = '#F2F4F2', alpha = 0.8, drift = 10, shadeCol = '#9FB2C6' } = {}) {
  const R = rng(seed);
  const sm = tex.smoke({ seed: 21 });
  ctx.save();
  for (let i = 0; i < count; i++) {
    const px = x + (R() - 0.5) * w + t * drift * (0.5 + R());
    const py = y + (R() - 0.5) * 90;
    const s = lerp(size[0], size[1], R());
    // shadow underside then lit top
    ctx.globalAlpha = alpha * 0.55;
    ctx.drawImage(tinted(sm, shadeCol), px - s / 2, py - s * 0.32, s, s * 0.62);
    ctx.globalAlpha = alpha;
    ctx.drawImage(tinted(sm, color), px - s / 2, py - s * 0.42, s, s * 0.6);
  }
  ctx.restore();
}
const _ids = new WeakMap();
let _idN = 0;
export function tinted(img, color) {
  if (!_ids.has(img)) _ids.set(img, ++_idN);
  return cached(`p7tint:${color}:${img.width}x${img.height}:${_ids.get(img)}`, () => {
    const { c, ctx } = makeCanvas(img.width, img.height);
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color; ctx.fillRect(0, 0, img.width, img.height);
    return c;
  });
}

// ── misc drawing ────────────────────────────────────────────────────────────
export function strokeArc(ctx, x, y, r, a0, a1, col, lw) {
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
}
// mono telemetry tag with bracket — simpler than callout when no leader is needed
export function tag(ctx, str, x, y, p, { color = C.cream, size = 26, align = 'left', family = "'Martian Mono'", weight = 600 } = {}) {
  if (p <= 0) return;
  const s = `[ ${str} ]`;
  const n = Math.ceil(s.length * clamp(p));
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';
  ctx.fillStyle = color;
  ctx.globalAlpha *= clamp(p * 3);
  ctx.fillText(s.slice(0, n), x, y);
  ctx.restore();
}

export { clamp, lerp, rng, noise, TAU, E, tw, smoothstep, C, rgba, shade, mixColor, ramp, PLASMA_RAMP, FIRE_RAMP };
