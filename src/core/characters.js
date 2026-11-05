// ─────────────────────────────────────────────────────────────────────────────
// characters.js — shared 2.5D character rigs (the film's model sheet).
//
// Heads are real 3D surfaces (deformed ellipsoids) rotated by yaw/pitch and
// projected, so faces TURN with correct foreshortening; features, hair, ears
// and nose move over the surface. Bodies use the same yaw for shoulders and
// details. Cel-shaded with a key light, coloured line (never black), rim light.
//
//   import { drawCharacter, CAST } from '../../core/characters.js';
//   drawCharacter(ctx, 'gagarin', { x, y, s: 40, yaw: .3, expr: { smile: 1, teeth: 1 },
//                 outfit: 'spacesuit', crop: 'bust', armR: {a: .6, b: -1.2, hand: 'open'} });
//
// UNITS: s = pixels per head-unit (HU). Head is ~2.2 HU tall. Full adult ≈ 12.5 HU.
//   (x,y) = feet ground point for crop:'full'; for crop:'bust'/'head' it is the
//   neck base / chin point (see anchor) — use pose.anchor = 'feet'|'neck'|'head'.
// POSE fields (all optional):
//   yaw  -1..1 (head turn; +ve = turns toward screen-right), bodyYaw (default yaw*.55)
//   pitch -0.6..0.6 (nod down +), tilt (roll, rad), lean (torso, rad)
//   expr: { smile 0..1, teeth 0..1, open 0..1 (mouth), frown 0..1, brow -1..1, worry 0..1,
//           eyeOpen 0..1.3, blink 0..1, lookX -1..1, lookY -1..1, squint 0..1, cheeksPull 0..1 (g-force),
//           pale 0..1, sweat 0..1, tear 0..1, puff 0..1 }
//   armL/armR: { a: upper-arm angle from straight-down (rad, +ve = toward screen-right),
//                b: elbow bend (rad, added to a), hand: 'open'|'fist'|'point'|'hold'|'wave'|'relaxed' }
//   legL/legR: { a, b } same convention; sit: true (seated legs)
//   outfit: per character (see CAST[x].outfits)
//   helmet: 0..1 (spacesuit helmet on), visor: 0..1 (glass visor down)
//   light: { x, y } key light dir (-1..1), rim: hex rim colour, line: outline colour override
//   breathe: seconds (pass t for idle breathing), float: 0..1 weightless hair/cloth lift
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, smoothstep, TAU, noise } from './math.js';
import { rgba, shade, mixColor } from './palette.js';

// ── cast definitions ────────────────────────────────────────────────────────
const SKIN = { warm: '#E8B08A', fair: '#F0C3A2', ruddy: '#DDA184', olive: '#D49E7C', aged: '#D7A487' };

export const CAST = {
  gagarin: {
    name: 'Yuri Gagarin', skin: '#EBB38E', hair: '#4B3322', hairLight: '#8A6240', iris: '#5E86AE', lip: '#C9726A',
    head: { rx: 0.98, top: 1.06, bot: 1.0, rz: 0.96, jaw: 0.6, cheek: 0.1, chin: 0.05, nose: 0.17, noseW: 0.19, noseUp: 0.05, mouthW: 0.37, lipFull: 0.9, browThick: 0.075, browY: -0.31, eyeW: 0.19, eyeH: 0.105, eyeY: -0.06, eyeX: 0.4, ear: 1.08, earStick: 0.22, dimple: 1 },
    hairStyle: 'gagarin', build: { shoulder: 1.95, height: 0.93, chest: 1.05, belly: 0, neck: 0.42 },
    outfits: ['spacesuit', 'uniform', 'flight', 'shirt', 'training'], outfit: 'flight',
    note: 'Round open face, wide smile with upper teeth, dimples, blue-grey eyes, small upturned nose, dense dark-brown wavy hair swept back with a soft front quiff, ears slightly out. Short and compact.',
  },
  titov: {
    name: 'German Titov', skin: '#E3AE8B', hair: '#231B16', hairLight: '#5A4636', iris: '#6B4E36', lip: '#BC6D62',
    head: { rx: 0.86, top: 1.12, bot: 1.06, rz: 0.92, jaw: 0.46, cheek: 0.0, chin: 0.09, nose: 0.27, noseW: 0.15, noseUp: -0.02, mouthW: 0.3, lipFull: 0.7, browThick: 0.07, browY: -0.3, eyeW: 0.17, eyeH: 0.085, eyeY: -0.05, eyeX: 0.37, ear: 0.95, earStick: 0.12, dimple: 0 },
    hairStyle: 'sidepart', build: { shoulder: 1.85, height: 0.97, chest: 1.0, belly: 0, neck: 0.38 },
    outfits: ['spacesuit', 'uniform', 'flight', 'training'], outfit: 'flight',
    note: 'Narrow face, pointed chin, straight longer nose, black hair with neat side part, serious hooded eyes.',
  },
  korolev: {
    name: 'Sergei Korolev', skin: '#D8A182', hair: '#2A2420', hairLight: '#55483E', iris: '#4A3A2D', lip: '#A9655A',
    head: { rx: 1.1, top: 1.02, bot: 1.16, rz: 1.0, jaw: 0.86, cheek: 0.12, chin: 0.02, nose: 0.23, noseW: 0.26, noseUp: 0.0, mouthW: 0.32, lipFull: 0.6, browThick: 0.11, browY: -0.27, eyeW: 0.16, eyeH: 0.075, eyeY: -0.04, eyeX: 0.4, ear: 1.05, earStick: 0.1, dimple: 0, doubleChin: 1 },
    hairStyle: 'receding', build: { shoulder: 2.45, height: 1.0, chest: 1.25, belly: 0.5, neck: 0.62 },
    outfits: ['coat', 'suit', 'hatcoat'], outfit: 'coat',
    note: 'Massive head, heavy square jaw, thick low dark brows, deep-set intense eyes, broad nose, receding dark hair combed back, bull neck, heavy build.',
  },
  nedelin: {
    name: 'Marshal Mitrofan Nedelin', skin: '#D9A385', hair: '#A3A19B', hairLight: '#D2D0CA', iris: '#5A5F66', lip: '#B0675C',
    head: { rx: 1.06, top: 0.98, bot: 1.12, rz: 0.98, jaw: 0.82, cheek: 0.14, chin: 0.0, nose: 0.24, noseW: 0.27, noseUp: -0.02, mouthW: 0.3, lipFull: 0.55, browThick: 0.08, browY: -0.29, eyeW: 0.15, eyeH: 0.07, eyeY: -0.04, eyeX: 0.4, ear: 1.1, earStick: 0.14, dimple: 0, doubleChin: 1, wrinkles: 1 },
    hairStyle: 'cropped', build: { shoulder: 2.25, height: 0.98, chest: 1.2, belly: 0.55, neck: 0.55 },
    outfits: ['marshal'], outfit: 'marshal', hat: 'marshalCap',
    note: 'Older, round fleshy face, jowls, bulbous nose, grey cropped hair, small stern eyes. Marshal uniform with service cap and Gold Star.',
  },
  anna: {
    name: 'Anna Takhtarova', skin: '#D9A07C', hair: '#8D8478', hairLight: '#BDB4A6', iris: '#5C6670', lip: '#B5685E',
    head: { rx: 1.0, top: 1.0, bot: 1.04, rz: 0.96, jaw: 0.7, cheek: 0.16, chin: 0.02, nose: 0.22, noseW: 0.25, noseUp: 0.02, mouthW: 0.28, lipFull: 0.5, browThick: 0.05, browY: -0.31, eyeW: 0.165, eyeH: 0.09, eyeY: -0.05, eyeX: 0.39, ear: 1.0, earStick: 0.1, dimple: 0, wrinkles: 1 },
    hairStyle: 'scarf', build: { shoulder: 1.95, height: 0.88, chest: 1.15, belly: 0.35, neck: 0.4 },
    outfits: ['farm'], outfit: 'farm', scarf: '#B4432F', scarfDots: '#F1E2C4',
    note: 'Elderly farmwoman, round weathered face, red flowered headscarf, dark quilted jacket, apron.',
  },
  rita: {
    name: 'Granddaughter', skin: '#F2C2A0', hair: '#9A6A40', hairLight: '#C8945E', iris: '#5A7A9A', lip: '#D67E74',
    head: { rx: 1.0, top: 1.08, bot: 0.92, rz: 0.95, jaw: 0.66, cheek: 0.16, chin: 0.0, nose: 0.12, noseW: 0.16, noseUp: 0.07, mouthW: 0.27, lipFull: 0.9, browThick: 0.05, browY: -0.32, eyeW: 0.21, eyeH: 0.14, eyeY: -0.02, eyeX: 0.41, ear: 0.95, earStick: 0.12, dimple: 0 },
    hairStyle: 'braids', build: { shoulder: 1.25, height: 0.5, chest: 0.85, belly: 0.1, neck: 0.3, kid: 1 },
    outfits: ['kid'], outfit: 'kid',
    note: 'Little girl ~6, big eyes, two braids with cream ribbons, red coat.',
  },
  valentina: {
    name: 'Valentina Gagarina', skin: '#EFC0A0', hair: '#3A2A20', hairLight: '#6E5240', iris: '#6A5240', lip: '#C46B6B',
    head: { rx: 0.9, top: 1.06, bot: 0.98, rz: 0.93, jaw: 0.52, cheek: 0.06, chin: 0.03, nose: 0.17, noseW: 0.16, noseUp: 0.04, mouthW: 0.3, lipFull: 1.0, browThick: 0.05, browY: -0.32, eyeW: 0.19, eyeH: 0.11, eyeY: -0.05, eyeX: 0.39, ear: 0.92, earStick: 0.08, dimple: 0 },
    hairStyle: 'bob', build: { shoulder: 1.7, height: 0.9, chest: 1.0, belly: 0, neck: 0.33 },
    outfits: ['dress'], outfit: 'dress',
    note: 'Gentle oval face, dark wavy early-60s bob, warm eyes.',
  },
  engineer: {
    name: 'Engineer', skin: SKIN.warm, hair: '#3B2E25', hairLight: '#6E5A48', iris: '#5A4A3A', lip: '#B86C60',
    head: { rx: 0.95, top: 1.04, bot: 1.04, rz: 0.95, jaw: 0.65, cheek: 0.06, chin: 0.04, nose: 0.22, noseW: 0.2, noseUp: 0, mouthW: 0.31, lipFull: 0.7, browThick: 0.07, browY: -0.3, eyeW: 0.165, eyeH: 0.09, eyeY: -0.05, eyeX: 0.39, ear: 1.0, earStick: 0.14, dimple: 0 },
    hairStyle: 'cap', build: { shoulder: 2.0, height: 0.98, chest: 1.05, belly: 0.15, neck: 0.45 },
    outfits: ['overalls', 'labcoat', 'soldier'], outfit: 'overalls',
    note: 'Generic crew. Vary with pose.variant (0..9) for hair/nose/skin/glasses/moustache.',
  },
};

// ── 3D head model ────────────────────────────────────────────────────────────
function headSurf(H, th, v, lift = 0) {
  // v: -1 crown … +1 chin ; th: -π..π, 0 = front
  const y = (v < 0 ? v * H.top : v * H.bot) * 1.12;
  const av = Math.abs(v);
  // upper: round cranium; lower: squarer superellipse → rounded jaw & chin (no V)
  let k = v < 0 ? Math.sqrt(Math.max(0, 1 - av * av)) : Math.pow(Math.max(0, 1 - Math.pow(av, 2.6)), 1 / 2.6);
  if (v > 0) k *= lerp(1, H.jaw, smoothstep(0.28, 1.0, v));
  k *= 1 + H.cheek * Math.exp(-Math.pow((v - 0.12) / 0.28, 2)) * Math.pow(Math.abs(Math.sin(th)), 1.4);
  if (H.doubleChin && v > 0.5) k *= 1 + 0.1 * smoothstep(0.5, 0.95, v);
  const front = Math.cos(th);
  const fz = front >= 0 ? Math.pow(front, 0.72) : front;
  let x = H.rx * 0.95 * k * Math.sin(th);
  let z = H.rz * k * fz;
  z += H.chin * smoothstep(0.6, 1, v) * Math.max(0, front) * 1.2;
  const nx = Math.sin(th) * k, ny = v * 0.9, nz = fz * k;
  const nl = Math.hypot(nx, ny, nz) || 1;
  const n = [nx / nl, ny / nl, nz / nl];
  return [x + n[0] * lift, y + n[1] * lift, z + n[2] * lift, n];
}
function rot(p, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
  const y2 = y * cp + z * sp, z2 = -y * sp + z * cp;
  return [x, y2, z2];
}

// cached silhouette sampling per (spec,yaw,pitch) per frame — cheap anyway
function headOutline(H, yaw, pitch) {
  const bins = 90, R = new Float32Array(bins);
  for (let i = 0; i <= 30; i++) {
    const v = -1 + (2 * i) / 30;
    for (let j = 0; j < 48; j++) {
      const th = -Math.PI + (TAU * j) / 48;
      const p = rot(headSurf(H, th, v), yaw, pitch);
      const a = Math.atan2(p[1], p[0]);
      const r = Math.hypot(p[0], p[1]);
      const b = ((Math.round(((a + Math.PI) / TAU) * bins) % bins) + bins) % bins;
      if (r > R[b]) R[b] = r;
    }
  }
  // fill empty bins & smooth
  for (let k = 0; k < 2; k++) for (let i = 0; i < bins; i++) {
    const a = R[(i - 1 + bins) % bins], b = R[(i + 1) % bins];
    R[i] = Math.max(R[i], (a + b) / 2 * 0.985);
  }
  const pts = [];
  for (let i = 0; i < bins; i++) {
    const a = -Math.PI + (TAU * i) / bins;
    const r = (R[(i - 1 + bins) % bins] + 2 * R[i] + R[(i + 1) % bins]) / 4;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}
function pathFrom(pts, s, ox, oy) {
  const p = new Path2D();
  const n = pts.length;
  const m = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  let q = m(n - 1);
  p.moveTo(ox + q[0] * s, oy + q[1] * s);
  for (let i = 0; i < n; i++) { q = m(i); p.quadraticCurveTo(ox + pts[i][0] * s, oy + pts[i][1] * s, ox + q[0] * s, oy + q[1] * s); }
  p.closePath();
  return p;
}

// ── hair styles: return list of shell sample points {th, v, lift, r} ────────
const bump = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
const HAIR = {
  gagarin(th, v) { // short dense, combed back & up, soft front quiff, short sides
    const a = Math.abs(th);
    const line = a < 0.55 ? -0.68 + a * a * 0.3 : a < 1.35 ? lerp(-0.59, -0.08, smoothstep(0.55, 1.35, a)) : lerp(-0.08, 0.4, smoothstep(1.35, Math.PI, a));
    if (v > line) return null;
    const edge = smoothstep(line, line - 0.12, v);
    const quiff = 0.13 * Math.exp(-th * th * 2.2) * bump(v, line - 0.2, 0.18);
    const side = a > 1.15 && v > -0.55 ? 0.035 : 0.075;
    return { lift: (side + quiff) * (0.45 + 0.55 * edge), wave: 0.022, edge };
  },
  sidepart(th, v) {
    const a = Math.abs(th);
    const line = a < 0.5 ? -0.6 : a < 1.35 ? lerp(-0.58, -0.12, smoothstep(0.5, 1.35, a)) : lerp(-0.12, 0.42, smoothstep(1.35, Math.PI, a));
    if (v > line) return null;
    const edge = smoothstep(line, line - 0.12, v);
    const sweep = 0.1 * bump(v, line - 0.18, 0.2) * Math.exp(-Math.pow(th + 0.2, 2) * 1.5);
    return { lift: (0.07 + sweep) * (0.45 + 0.55 * edge), wave: 0.012, part: Math.abs(th - 0.42) < 0.05 && v < -0.45, edge };
  },
  receding(th, v) {
    const a = Math.abs(th);
    const line = a < 0.35 ? -0.8 : a < 0.9 ? lerp(-0.84, -0.48, smoothstep(0.35, 0.9, a)) : a < 1.4 ? lerp(-0.48, -0.08, smoothstep(0.9, 1.4, a)) : lerp(-0.08, 0.36, smoothstep(1.4, Math.PI, a));
    if (v > line) return null;
    const edge = smoothstep(line, line - 0.1, v);
    return { lift: 0.055 * (0.4 + 0.6 * edge), wave: 0.008, edge };
  },
  cropped(th, v) {
    const a = Math.abs(th);
    const line = a < 0.6 ? -0.7 : lerp(-0.7, 0.3, smoothstep(0.6, Math.PI, a));
    if (v > line) return null;
    return { lift: 0.035, wave: 0.008, edge: 1 };
  },
  cap(th, v) { return HAIR.cropped(th, v); },
  bob(th, v) {
    const a = Math.abs(th);
    const line = a < 0.75 ? -0.58 : a < 1.35 ? lerp(-0.58, 0.45, smoothstep(0.75, 1.35, a)) : 0.62;
    if (v > line) return null;
    const edge = smoothstep(line, line - 0.15, v);
    const vol = 0.08 + 0.12 * smoothstep(-0.3, 0.45, v) * smoothstep(0.9, 1.5, a);
    return { lift: vol * (0.5 + 0.5 * edge), wave: 0.035, edge };
  },
  braids(th, v) {
    const a = Math.abs(th);
    const line = a < 0.5 ? -0.52 : a < 1.3 ? lerp(-0.52, 0.12, smoothstep(0.5, 1.3, a)) : 0.5;
    if (v > line) return null;
    return { lift: 0.06, wave: 0.015, part: Math.abs(th) < 0.04 && v < -0.4, edge: smoothstep(line, line - 0.1, v) };
  },
  scarf() { return null; },
};

// ── main entry ───────────────────────────────────────────────────────────────
export function drawCharacter(ctx, who, pose = {}) {
  const C = typeof who === 'string' ? CAST[who] : who;
  if (!C) throw new Error('unknown character ' + who);
  const P = { yaw: 0, pitch: 0, tilt: 0, lean: 0, s: 40, x: 0, y: 0, crop: 'full', anchor: null, ...pose };
  const E = { smile: 0.25, teeth: 0, open: 0, frown: 0, brow: 0, worry: 0, eyeOpen: 1, blink: 0, lookX: 0, lookY: 0, squint: 0, cheeksPull: 0, pale: 0, sweat: 0, tear: 0, puff: 0, ...(pose.expr || {}) };
  const B = { ...C.build };
  const s = P.s;
  const outfit = P.outfit || C.outfit;
  const light = P.light || { x: -0.55, y: -0.65 };
  const lineCol = P.line || shade(C.skin, -0.62);
  const lw = Math.max(1, s * 0.055) * (P.lineScale ?? 1);
  const bodyYaw = P.bodyYaw ?? P.yaw * 0.55;
  const breathe = P.breathe != null ? Math.sin(P.breathe * 1.6) * 0.5 + 0.5 : 0.5;

  // skeleton (HU, y up negative from feet)
  const kid = B.kid ? 1 : 0;
  const hScale = B.height;
  const legLen = (kid ? 3.2 : 5.1) * hScale;
  const torsoLen = (kid ? 2.5 : 3.9) * hScale;
  const hip = -legLen, shoulderY = hip - torsoLen, neckY = shoulderY - 0.25;
  const headCY = neckY - (kid ? 1.05 : 0.92) - B.neck * 0.22;
  let ox = P.x, oy = P.y;
  const anchor = P.anchor || (P.crop === 'full' ? 'feet' : P.crop === 'head' ? 'head' : 'neck');
  if (anchor === 'neck') oy -= neckY * s;
  if (anchor === 'head') oy -= headCY * s;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const L = (hu) => hu * s;

  const shoulderW = B.shoulder * (kid ? 0.95 : 0.84);
  const cby = Math.cos(bodyYaw), sby = Math.sin(bodyYaw);
  const shL = [-shoulderW * cby, shoulderY], shR = [shoulderW * cby, shoulderY];
  const farIsRight = bodyYaw > 0; // see header: +yaw → screen-right side recedes
  const hipW = (kid ? 0.95 : 1.35) * (1 + B.belly * 0.2);

  // lean (torso) pivot at hip
  const leanT = (fn) => { ctx.save(); ctx.translate(0, L(hip)); ctx.rotate(P.lean); ctx.translate(0, -L(hip)); fn(); ctx.restore(); };

  const drawArm = (side) => {
    // a: upper arm from straight-down, +ve = outward (away from body). b: elbow bend, +ve = forearm folds inward/up.
    const arm = side === 'L' ? (P.armL || { a: 0.1, b: 0.12 }) : (P.armR || { a: 0.1, b: 0.12 });
    const sg = side === 'L' ? -1 : 1;
    const sh0 = side === 'L' ? shL : shR;
    const sh = [sh0[0] * 0.93, shoulderY + 0.62];
    const upper = (kid ? 1.35 : 2.25) * hScale, fore = (kid ? 1.25 : 2.1) * hScale;
    const a1 = arm.a, a2 = arm.a - (arm.b || 0);
    const el = [sh[0] + sg * Math.sin(a1) * upper, sh[1] + Math.cos(a1) * upper];
    const wr = [el[0] + sg * Math.sin(a2) * fore, el[1] + Math.cos(a2) * fore];
    const sleeve = outfitColors(C, outfit).sleeve;
    ctx.save();
    if (P.crop === 'bust') { ctx.beginPath(); ctx.rect(-L(20), L(shoulderY - 20), L(40), L(20 + 3.25)); ctx.clip(); }
    limb(ctx, L, [sh, el, wr], [0.78 * B.chest, 0.6, 0.48], sleeve, lineCol, lw, light, outfit === 'spacesuit');
    const handAng = Math.atan2(wr[1] - el[1], wr[0] - el[0]) - Math.PI / 2;
    drawHand(ctx, L(wr[0]), L(wr[1]), handAng, s, arm.hand || 'relaxed', outfit === 'spacesuit' ? '#5B6168' : C.skin, lineCol, lw, side, outfit);
    if (arm.prop) arm.prop(ctx, L(wr[0]), L(wr[1]), handAng, s);
    ctx.restore();
  };
  const drawLeg = (side) => {
    // a: thigh from straight-down, +ve = outward; b: knee bend (+ve = shin swings back). sit: seated pose.
    const leg = side === 'L' ? (P.legL || { a: 0.05, b: 0 }) : (P.legR || { a: 0.05, b: 0 });
    const sg = side === 'L' ? -1 : 1;
    const hp = [sg * hipW * 0.5 * cby, hip - 0.2];
    const up = legLen * 0.5, lo = legLen * 0.47;
    let a1 = leg.a, a2 = leg.a - (leg.b || 0);
    let kn, an;
    if (P.sit) {
      const fwd = (P.sitDir ?? (bodyYaw >= 0 ? 1 : -1));
      kn = [hp[0] + fwd * up * 0.92 * Math.abs(Math.sin(bodyYaw) * 0.6 + 0.4), hp[1] + up * 0.18];
      an = [kn[0] + fwd * lo * 0.08, kn[1] + lo];
    } else {
      kn = [hp[0] + sg * Math.sin(a1) * up, hp[1] + Math.cos(a1) * up];
      an = [kn[0] + sg * Math.sin(a2) * lo, kn[1] + Math.cos(a2) * lo];
    }
    const oc = outfitColors(C, outfit);
    limb(ctx, L, [hp, kn, an], [1.0 * (1 + B.belly * 0.2), 0.76, 0.6], oc.legs, lineCol, lw, light, outfit === 'spacesuit');
    ctx.save();
    ctx.translate(L(an[0]), L(an[1]));
    const dir = Math.abs(bodyYaw) > 0.35 ? Math.sign(bodyYaw) : sg * 0.35;
    const bp = new Path2D();
    bp.moveTo(-L(0.38), -L(0.25));
    bp.lineTo(L(0.38), -L(0.25));
    bp.quadraticCurveTo(L(0.45 + Math.max(0, dir) * 0.5), L(0.05), L(0.4 + Math.max(0, dir) * 0.55), L(0.32));
    bp.lineTo(-L(0.4 + Math.max(0, -dir) * 0.55), L(0.32));
    bp.quadraticCurveTo(-L(0.45 + Math.max(0, -dir) * 0.5), L(0.05), -L(0.38), -L(0.25));
    ctx.fillStyle = oc.boots; ctx.fill(bp);
    ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke(bp);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-L(0.3), -L(0.2), L(0.25), L(0.1));
    ctx.restore();
  };

  // ── FULL BODY ───────────────────────────────────────────────────────────
  if (P.crop === 'full') {
    // ground contact shadow
    ctx.save();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, L(2.6));
    g.addColorStop(0, 'rgba(10,12,20,.35)'); g.addColorStop(1, 'rgba(10,12,20,0)');
    ctx.fillStyle = g; ctx.scale(1, 0.18); ctx.beginPath(); ctx.arc(0, 0, L(2.6), 0, TAU); ctx.fill();
    ctx.restore();
    if (farIsRight) { drawLeg('R'); drawLeg('L'); } else { drawLeg('L'); drawLeg('R'); }
  }
  leanT(() => {
    if (P.crop !== 'head') {
      // far arm behind torso
      if (P.crop === 'full' || P.arms !== false) farIsRight ? drawArm('R') : drawArm('L');
      drawTorso(ctx, C, P, { L, shoulderY, hip, shoulderW, hipW, bodyYaw, lineCol, lw, light, outfit, breathe, B, crop: P.crop, kid });
    }
    // head group with tilt
    ctx.save();
    ctx.translate(0, L(neckY));
    ctx.rotate(P.tilt);
    ctx.translate(0, -L(neckY));
    if (P.crop !== 'head') drawNeck(ctx, C, L, neckY, headCY, B, lineCol, lw, bodyYaw, outfit);
    drawHead(ctx, C, P, E, { cx: 0, cy: L(headCY), s, lineCol, lw, light, outfit });
    ctx.restore();
    if (P.crop !== 'head' && (P.crop === 'full' || P.arms !== false)) farIsRight ? drawArm('L') : drawArm('R');
    if (P.crop !== 'head' && P.overTorso) P.overTorso(ctx, { L, shoulderY, hip, s });
  });
  ctx.restore();
  return { headX: P.x, headY: oy + L(headCY), s };
}

// ── colours per outfit ───────────────────────────────────────────────────────
function outfitColors(C, outfit) {
  switch (outfit) {
    case 'spacesuit': return { main: '#EE6A22', sleeve: '#EE6A22', legs: '#E8641E', boots: '#3C3A38', trim: '#F2EEE6', dark: '#B4461A' };
    case 'uniform': return { main: '#3F4A5C', sleeve: '#3F4A5C', legs: '#353F4F', boots: '#1E2128', trim: '#D9B44A', dark: '#2A3240' };
    case 'flight': return { main: '#5E6E62', sleeve: '#5E6E62', legs: '#56655A', boots: '#2A2622', trim: '#C9C0A6', dark: '#3F4B42' };
    case 'training': return { main: '#2F5D8A', sleeve: '#2F5D8A', legs: '#2A3A52', boots: '#EDE9E0', trim: '#EDE9E0', dark: '#21456A' };
    case 'shirt': return { main: '#E9E3D3', sleeve: '#E9E3D3', legs: '#3B4250', boots: '#26221F', trim: '#9AA3AE', dark: '#C9C1AE' };
    case 'coat': case 'hatcoat': return { main: '#2E333D', sleeve: '#2E333D', legs: '#262A31', boots: '#16181C', trim: '#E8E2D4', dark: '#1D2128' };
    case 'suit': return { main: '#3A3F4A', sleeve: '#3A3F4A', legs: '#33373F', boots: '#191A1D', trim: '#ECE6DA', dark: '#272B33' };
    case 'marshal': return { main: '#5F6A48', sleeve: '#5F6A48', legs: '#4F5A3C', boots: '#17181A', trim: '#D8B04A', dark: '#434C32' };
    case 'farm': return { main: '#3E3B37', sleeve: '#3E3B37', legs: '#4B3E35', boots: '#2A221D', trim: '#6B5D4E', dark: '#2A2825', apron: '#9C8F78' };
    case 'kid': return { main: '#C6402E', sleeve: '#C6402E', legs: '#3D3B48', boots: '#5A3424', trim: '#F2E7CF', dark: '#8E2A1E' };
    case 'dress': return { main: '#6C7E9C', sleeve: '#6C7E9C', legs: '#E2B79A', boots: '#2B2420', trim: '#F1E8D8', dark: '#4F5F7B' };
    case 'overalls': return { main: '#4F5D6B', sleeve: '#4F5D6B', legs: '#46535F', boots: '#25221F', trim: '#B9A57A', dark: '#38434E' };
    case 'labcoat': return { main: '#EFEBE2', sleeve: '#EFEBE2', legs: '#3D4450', boots: '#24211E', trim: '#B8C2CC', dark: '#CFC8BA' };
    case 'soldier': return { main: '#5A6143', sleeve: '#5A6143', legs: '#4C523A', boots: '#1B1A18', trim: '#C24135', dark: '#41462F' };
    default: return { main: '#55606E', sleeve: '#55606E', legs: '#4A5360', boots: '#222', trim: '#ddd', dark: '#3c4450' };
  }
}

// tapered limb through 3 joints with rounded joints + cylinder shading
function limb(ctx, L, joints, widths, col, lineCol, lw, light, puffy) {
  const pts = joints.map((j) => [L(j[0]), L(j[1])]);
  const wd = widths.map((w) => L(w) * (puffy ? 1.18 : 1));
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = i < pts.length - 1 ? Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) : Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    const a0 = i > 0 ? Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) : a;
    const am = (a + a0) / 2 + (Math.abs(a - a0) > Math.PI ? Math.PI : 0);
    const nx = -Math.sin(am), ny = Math.cos(am);
    left.push([pts[i][0] + nx * wd[i] / 2, pts[i][1] + ny * wd[i] / 2]);
    right.push([pts[i][0] - nx * wd[i] / 2, pts[i][1] - ny * wd[i] / 2]);
  }
  const p = new Path2D();
  p.moveTo(left[0][0], left[0][1]);
  p.quadraticCurveTo(left[1][0], left[1][1], left[2][0], left[2][1]);
  p.arc(pts[2][0], pts[2][1], wd[2] / 2, Math.atan2(left[2][1] - pts[2][1], left[2][0] - pts[2][0]), Math.atan2(right[2][1] - pts[2][1], right[2][0] - pts[2][0]), true);
  p.quadraticCurveTo(right[1][0], right[1][1], right[0][0], right[0][1]);
  p.arc(pts[0][0], pts[0][1], wd[0] / 2, Math.atan2(right[0][1] - pts[0][1], right[0][0] - pts[0][0]), Math.atan2(left[0][1] - pts[0][1], left[0][0] - pts[0][0]), true);
  p.closePath();
  ctx.save();
  ctx.fillStyle = col; ctx.fill(p);
  ctx.clip(p);
  // cel shade: shadow on the side away from light
  const mx = (pts[0][0] + pts[2][0]) / 2, my = (pts[0][1] + pts[2][1]) / 2;
  const sx = -light.x, sy = -light.y;
  const g = ctx.createLinearGradient(mx - sx * wd[0], my - sy * wd[0], mx + sx * wd[0], my + sy * wd[0]);
  g.addColorStop(0, rgba(shade(col, 0.18), 0.6)); g.addColorStop(0.45, rgba(col, 0)); g.addColorStop(0.62, rgba(shade(col, -0.35), 0.0)); g.addColorStop(0.7, rgba(shade(col, -0.35), 0.55)); g.addColorStop(1, rgba(shade(col, -0.45), 0.7));
  ctx.fillStyle = g; ctx.fillRect(mx - 2000, my - 2000, 4000, 4000);
  // elbow fold
  ctx.strokeStyle = rgba(shade(col, -0.45), 0.5); ctx.lineWidth = lw * 0.8;
  ctx.beginPath(); ctx.arc(pts[1][0], pts[1][1], wd[1] * 0.3, 0.3, 1.6); ctx.stroke();
  ctx.restore();
  ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke(p);
}

function drawHand(ctx, x, y, ang, s, kind, col, lineCol, lw, side, outfit) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const u = s * 0.42;
  const mir = side === 'L' ? -1 : 1;
  ctx.scale(mir, 1);
  const p = new Path2D();
  if (kind === 'fist') {
    p.roundRect(-u * 0.95, -u * 0.2, u * 1.9, u * 1.7, u * 0.7);
  } else if (kind === 'point') {
    p.roundRect(-u * 0.9, -u * 0.2, u * 1.8, u * 1.5, u * 0.6);
    p.roundRect(-u * 0.25, u * 1.0, u * 0.5, u * 1.8, u * 0.25);
  } else if (kind === 'hold') {
    p.roundRect(-u * 0.95, -u * 0.2, u * 1.9, u * 1.6, u * 0.7);
  } else {
    const spread = kind === 'open' || kind === 'wave' ? 0.22 : 0.06;
    p.roundRect(-u * 0.9, -u * 0.2, u * 1.8, u * 1.4, u * 0.55);
    for (let i = 0; i < 4; i++) {
      const fx = -u * 0.65 + i * u * 0.43;
      const len = u * (i === 1 || i === 2 ? 1.25 : 1.05) * (kind === 'relaxed' ? 0.85 : 1);
      const p2 = new Path2D();
      ctx.save();
      p2.roundRect(-u * 0.19, 0, u * 0.38, len, u * 0.19);
      const m = new DOMMatrix().translate(fx, u * 0.95).rotate(((i - 1.5) * spread * 180) / Math.PI);
      p.addPath(p2, m);
      ctx.restore();
    }
    const th = new Path2D(); th.roundRect(-u * 0.2, 0, u * 0.4, u * 1.0, u * 0.2);
    p.addPath(th, new DOMMatrix().translate(-u * 0.85, u * 0.3).rotate(kind === 'open' || kind === 'wave' ? 55 : 25));
  }
  ctx.fillStyle = col; ctx.fill(p);
  ctx.save(); ctx.clip(p);
  ctx.fillStyle = rgba(shade(col, -0.35), 0.45); ctx.fillRect(u * 0.2, -u, u * 2, u * 5);
  ctx.restore();
  ctx.lineWidth = lw * 0.85; ctx.strokeStyle = lineCol; ctx.stroke(p);
  if (outfit === 'spacesuit') { ctx.fillStyle = '#F2EEE6'; ctx.fillRect(-u * 1.05, -u * 0.45, u * 2.1, u * 0.4); }
  ctx.restore();
}

function drawNeck(ctx, C, L, neckY, headCY, B, lineCol, lw, bodyYaw, outfit) {
  const w = L(0.62 + B.neck * 0.75);
  const top = L(headCY + 0.45), bot = L(neckY + 0.35);
  ctx.save();
  const p = new Path2D();
  p.moveTo(-w / 2, top); p.lineTo(w / 2, top); p.lineTo(w / 2 * 1.1, bot); p.lineTo(-w / 2 * 1.1, bot); p.closePath();
  ctx.fillStyle = shade(C.skin, -0.12); ctx.fill(p);
  ctx.clip(p);
  const g = ctx.createLinearGradient(0, top, 0, top + w * 0.9);
  g.addColorStop(0, rgba(shade(C.skin, -0.55), 0.8)); g.addColorStop(1, rgba(shade(C.skin, -0.55), 0));
  ctx.fillStyle = g; ctx.fillRect(-w, top, w * 2, w * 2);
  ctx.restore();
  ctx.lineWidth = lw; ctx.strokeStyle = lineCol;
  ctx.beginPath(); ctx.moveTo(-w / 2, top); ctx.lineTo(-w / 2 * 1.1, bot); ctx.moveTo(w / 2, top); ctx.lineTo(w / 2 * 1.1, bot); ctx.stroke();
}

// ── torso & clothing ────────────────────────────────────────────────────────
function drawTorso(ctx, C, P, o) {
  const { L, shoulderY, hip, shoulderW, hipW, bodyYaw, lineCol, lw, light, outfit, breathe, B, kid } = o;
  const oc = outfitColors(C, outfit);
  const cby = Math.cos(bodyYaw), sby = Math.sin(bodyYaw);
  const chestW = shoulderW * 0.98 * B.chest * (1 + breathe * 0.012);
  const waistW = hipW * (1 + B.belly * 0.35);
  const bottom = o.crop === 'full' ? hip + 0.3 : o.crop === 'bust' ? shoulderY + 3.2 : hip;
  const shift = sby * 0.35;
  const nk = 0.45 + B.neck * 0.5;
  const pts = [
    [-nk * cby + shift, shoulderY - 0.18],
    [-shoulderW * cby * 0.8 + shift, shoulderY + 0.12],
    [-shoulderW * cby * 1.02 + shift, shoulderY + 0.65],
    [-shoulderW * cby * 0.98 + shift * 0.9, shoulderY + 1.4],
    [-chestW * cby * 0.9 + shift * 0.8, shoulderY + 2.2],
    [-waistW * cby * 0.86 + shift * 0.5, hip - 0.6],
    [-waistW * cby * 0.95, bottom],
    [waistW * cby * 0.95, bottom],
    [waistW * cby * 0.86 + shift * 0.5, hip - 0.6],
    [chestW * cby * 0.9 + shift * 0.8, shoulderY + 2.2],
    [shoulderW * cby * 0.98 + shift * 0.9, shoulderY + 1.4],
    [shoulderW * cby * 1.02 + shift, shoulderY + 0.65],
    [shoulderW * cby * 0.8 + shift, shoulderY + 0.12],
    [nk * cby + shift, shoulderY - 0.18],
    [0 + shift, shoulderY - 0.05],
  ].map(([x, y]) => [L(x), L(y)]);
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  p.lineTo(pts[0][0], pts[0][1]);
  p.closePath();
  ctx.save();
  ctx.fillStyle = oc.main;
  ctx.fill(p);
  ctx.clip(p);
  // volume shading
  const sw = L(shoulderW);
  const g = ctx.createLinearGradient(-sw * cby + light.x * sw * 0.5, 0, sw * cby, 0);
  g.addColorStop(0, rgba(shade(oc.main, 0.16), 0.7));
  g.addColorStop(0.42, rgba(oc.main, 0));
  g.addColorStop(0.68, rgba(shade(oc.main, -0.3), 0.35));
  g.addColorStop(1, rgba(shade(oc.main, -0.5), 0.8));
  ctx.fillStyle = g; ctx.fillRect(-sw * 3, L(shoulderY - 2), sw * 6, L(20));
  // fabric folds
  ctx.strokeStyle = rgba(shade(oc.main, -0.4), 0.45); ctx.lineWidth = lw * 0.9;
  const fx = L(shift);
  ctx.beginPath();
  ctx.moveTo(fx - sw * 0.5 * cby, L(hip - 1.2)); ctx.quadraticCurveTo(fx - sw * 0.25 * cby, L(hip - 0.8), fx - sw * 0.1, L(hip - 0.2));
  ctx.moveTo(fx + sw * 0.55 * cby, L(shoulderY + 1.3)); ctx.quadraticCurveTo(fx + sw * 0.35 * cby, L(shoulderY + 1.9), fx + sw * 0.4 * cby, L(shoulderY + 2.6));
  ctx.stroke();
  // centre line of the garment (front) – shifts with yaw
  const cx = L(sby * shoulderW * 0.75);
  outfitDetails(ctx, C, P, { L, cx, shoulderY, hip, sw, cby, sby, oc, lw, lineCol, outfit, bottom, kid });
  ctx.restore();
  ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke(p);
}

function outfitDetails(ctx, C, P, o) {
  const { L, cx, shoulderY, hip, sw, cby, sby, oc, lw, lineCol, outfit, bottom } = o;
  const top = L(shoulderY);
  ctx.lineWidth = lw * 0.9;
  if (outfit === 'spacesuit') {
    // white harness / ventilation hose connectors, shoulder straps
    ctx.strokeStyle = '#F2EEE6'; ctx.lineWidth = L(0.28);
    ctx.beginPath();
    ctx.moveTo(cx - sw * 0.55 * cby, top + L(0.1)); ctx.lineTo(cx - sw * 0.25 * cby, L(hip - 0.4));
    ctx.moveTo(cx + sw * 0.55 * cby, top + L(0.1)); ctx.lineTo(cx + sw * 0.25 * cby, L(hip - 0.4));
    ctx.stroke();
    // chest unit
    ctx.fillStyle = '#D9D4CA'; ctx.strokeStyle = lineCol; ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.roundRect(cx - L(0.55) * cby, top + L(1.5), L(1.1) * cby, L(0.8), L(0.15)); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3C4148';
    [-0.25, 0, 0.25].forEach((k) => { ctx.beginPath(); ctx.arc(cx + L(k) * cby, top + L(1.9), L(0.08), 0, TAU); ctx.fill(); });
    // collar ring (helmet seal)
    ctx.fillStyle = '#C9C6BF'; ctx.beginPath(); ctx.ellipse(L(sby * 0.3), top - L(0.05), L(1.15) * (0.7 + 0.3 * cby), L(0.32), 0, 0, TAU); ctx.fill(); ctx.stroke();
    // seams
    ctx.strokeStyle = rgba(oc.dark, 0.6); ctx.lineWidth = lw * 0.7;
    ctx.beginPath(); ctx.moveTo(cx, top + L(2.4)); ctx.lineTo(cx, bottom); ctx.stroke();
  } else if (outfit === 'uniform' || outfit === 'marshal') {
    // tunic: buttons, belt, shoulder boards, collar
    ctx.fillStyle = oc.trim;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx, top + L(0.9 + i * 0.85), L(0.09), 0, TAU); ctx.fill(); }
    ctx.strokeStyle = rgba(oc.dark, 0.9); ctx.beginPath(); ctx.moveTo(cx, top + L(0.3)); ctx.lineTo(cx, bottom); ctx.stroke();
    ctx.fillStyle = shade(oc.main, -0.45); ctx.fillRect(-sw * 2, L(hip - 0.75), sw * 4, L(0.32));
    ctx.fillStyle = oc.trim; ctx.fillRect(cx - L(0.22), L(hip - 0.78), L(0.44), L(0.38));
    // shoulder boards
    [-1, 1].forEach((sd) => {
      ctx.save(); ctx.translate(cx * 0.3 + sd * sw * 0.68 * cby, top + L(0.18)); ctx.rotate(sd * 0.08);
      ctx.fillStyle = outfit === 'marshal' ? '#D7AE47' : '#9DA9B8'; ctx.strokeStyle = lineCol; ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.roundRect(-L(0.55) * cby, -L(0.17), L(1.1) * cby, L(0.34), L(0.1)); ctx.fill(); ctx.stroke();
      if (outfit === 'marshal') { ctx.fillStyle = '#F4D27A'; starPath(ctx, 0, 0, L(0.15), L(0.06)); ctx.fill(); }
      ctx.restore();
    });
    // collar tabs
    ctx.fillStyle = shade(oc.main, -0.2);
    ctx.beginPath(); ctx.moveTo(cx - L(0.55), top - L(0.05)); ctx.lineTo(cx, top + L(0.55)); ctx.lineTo(cx + L(0.55), top - L(0.05)); ctx.closePath(); ctx.fill();
    if (outfit === 'marshal' || P.medal) {
      // Gold Star (Hero of the Soviet Union) on ribbon
      const mx = cx - L(0.95) * cby, my = top + L(0.9);
      ctx.fillStyle = '#C8352B'; ctx.fillRect(mx - L(0.17), my - L(0.22), L(0.34), L(0.22));
      ctx.fillStyle = '#F2C14E'; ctx.strokeStyle = '#8A6420'; ctx.lineWidth = lw * 0.5;
      starPath(ctx, mx, my + L(0.25), L(0.3), L(0.12)); ctx.fill(); ctx.stroke();
      if (outfit === 'marshal') {
        // medal bars
        const cols = ['#C8352B', '#2F6FB0', '#E7C24A', '#3B8A4E', '#C8352B', '#EDE7DA'];
        cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(cx + L(0.35 + (i % 3) * 0.32) * cby, top + L(0.75 + Math.floor(i / 3) * 0.22), L(0.3) * cby, L(0.18)); });
      }
    }
  } else if (outfit === 'flight' || outfit === 'overalls' || outfit === 'training') {
    ctx.strokeStyle = rgba(shade(oc.main, -0.5), 0.9); ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(cx, top + L(0.2)); ctx.lineTo(cx, bottom); ctx.stroke();
    // zip pull + chest pockets
    ctx.fillStyle = '#B9B3A3'; ctx.fillRect(cx - L(0.07), top + L(0.6), L(0.14), L(0.35));
    ctx.strokeStyle = rgba(shade(oc.main, -0.45), 0.8); ctx.lineWidth = lw * 0.7;
    [-1, 1].forEach((sd) => { ctx.strokeRect(cx + sd * L(0.95) * cby - L(0.45) * cby, top + L(1.1), L(0.9) * cby, L(0.75)); });
    // collar
    ctx.fillStyle = shade(oc.main, 0.08); ctx.strokeStyle = lineCol;
    [-1, 1].forEach((sd) => { ctx.beginPath(); ctx.moveTo(cx, top + L(0.5)); ctx.lineTo(cx + sd * L(0.85), top - L(0.05)); ctx.lineTo(cx + sd * L(0.95), top + L(0.35)); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    if (outfit === 'training') { ctx.strokeStyle = '#EDE9E0'; ctx.lineWidth = L(0.12); ctx.beginPath(); ctx.moveTo(cx - L(1.6), top + L(1.2)); ctx.lineTo(cx + L(1.6), top + L(1.2)); ctx.stroke(); }
  } else if (outfit === 'coat' || outfit === 'hatcoat' || outfit === 'suit') {
    // shirt + tie V and lapels
    ctx.fillStyle = oc.trim;
    ctx.beginPath(); ctx.moveTo(cx - L(0.6), top - L(0.05)); ctx.lineTo(cx, top + L(1.8)); ctx.lineTo(cx + L(0.6), top - L(0.05)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5A2B2B'; ctx.beginPath(); ctx.moveTo(cx - L(0.13), top + L(0.15)); ctx.lineTo(cx + L(0.13), top + L(0.15)); ctx.lineTo(cx + L(0.18), top + L(1.6)); ctx.lineTo(cx, top + L(1.85)); ctx.lineTo(cx - L(0.18), top + L(1.6)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(oc.main, -0.2); ctx.strokeStyle = lineCol; ctx.lineWidth = lw * 0.8;
    [-1, 1].forEach((sd) => { ctx.beginPath(); ctx.moveTo(cx + sd * L(0.62), top - L(0.08)); ctx.lineTo(cx + sd * L(0.15), top + L(2.2)); ctx.lineTo(cx + sd * L(1.1), top + L(0.9)); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#1A1D22'; [0, 1].forEach((i) => { ctx.beginPath(); ctx.arc(cx + L(0.25), top + L(2.6 + i * 0.9), L(0.1), 0, TAU); ctx.fill(); });
  } else if (outfit === 'farm') {
    // quilted jacket stitch lines + apron
    ctx.strokeStyle = rgba(shade(oc.main, -0.5), 0.8); ctx.lineWidth = lw * 0.7;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-sw * 1.5, top + L(0.6 + i * 0.6)); ctx.lineTo(sw * 1.5, top + L(0.6 + i * 0.6)); ctx.stroke(); }
    ctx.fillStyle = oc.apron; ctx.strokeStyle = lineCol; ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.moveTo(cx - L(1.0) * cby, L(hip - 1.4)); ctx.lineTo(cx + L(1.0) * cby, L(hip - 1.4)); ctx.lineTo(cx + L(1.2) * cby, bottom); ctx.lineTo(cx - L(1.2) * cby, bottom); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (outfit === 'kid') {
    ctx.fillStyle = oc.trim; ctx.fillRect(-sw * 2, top - L(0.1), sw * 4, L(0.45));
    ctx.fillStyle = '#2B2622'; [0, 1, 2].forEach((i) => { ctx.beginPath(); ctx.arc(cx, top + L(0.8 + i * 0.6), L(0.08), 0, TAU); ctx.fill(); });
  } else if (outfit === 'labcoat') {
    ctx.strokeStyle = rgba('#9C9688', 0.9); ctx.beginPath(); ctx.moveTo(cx, top + L(0.6)); ctx.lineTo(cx, bottom); ctx.stroke();
    ctx.fillStyle = '#C9D3DC'; ctx.beginPath(); ctx.moveTo(cx - L(0.5), top); ctx.lineTo(cx, top + L(0.9)); ctx.lineTo(cx + L(0.5), top); ctx.closePath(); ctx.fill();
  } else if (outfit === 'dress') {
    ctx.fillStyle = oc.trim; ctx.beginPath(); ctx.ellipse(cx, top + L(0.1), L(0.7), L(0.3), 0, 0, Math.PI); ctx.fill();
  }
}

function starPath(ctx, x, y, r1, r2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}

// ── head ─────────────────────────────────────────────────────────────────────
function drawHead(ctx, C, P, E, o) {
  const H = C.head;
  const { cx, cy, s, lineCol, lw, light } = o;
  const yaw = clamp(P.yaw, -1.2, 1.2) * 1.1, pitch = clamp(P.pitch, -0.7, 0.7) * 0.6;
  const proj = (th, v, lift = 0) => {
    const q = headSurf(H, th, v, lift);
    const r = rot(q, yaw, pitch);
    const n = rot(q[3], yaw, pitch);
    return { x: cx + r[0] * s, y: cy + r[1] * s, z: r[2], f: n[2], n };
  };
  const skin = E.pale ? mixColor(C.skin, '#D9DCD6', E.pale * 0.55) : C.skin;
  const skinSh = shade(skin, -0.3);
  const helmet = P.helmet ?? (P.outfit === 'spacesuit' ? 0 : 0);
  const outline = headOutline(H, yaw, pitch);
  const headPath = pathFrom(outline, s, cx, cy);
  const t = P.breathe ?? 0;

  // helmet back shell
  if (helmet > 0) drawHelmet(ctx, P, { cx, cy, s, yaw, pitch, lineCol, lw, back: true, amt: helmet });

  // hair behind head (back side)
  const hairFn = HAIR[C.hairStyle];
  const hairPts = [];
  if (hairFn && !(P.hat === 'cap' || C.hairStyle === 'scarf')) {
    for (let i = 0; i <= 40; i++) {
      const v = -1 + i * 0.04;
      for (let j = 0; j < 72; j++) {
        const th = -Math.PI + (TAU * j) / 72;
        const h = hairFn(th, v);
        if (!h) continue;
        const wav = noise.n2(th * 3.1 + 7, v * 4.3) * (h.wave || 0) + (P.float || 0) * 0.15 * smoothstep(0.2, -1, v) * (0.5 + 0.5 * noise.n2(th * 2 + t * 0.6, v * 2));
        const pp = proj(th, v, h.lift + wav);
        hairPts.push({ ...pp, r: (h.lift * 0.6 + 0.045 + 0.03 * (h.edge ?? 1)) * s, part: h.part });
      }
    }
  }
  const hairCol = C.hair, hairLight = C.hairLight;
  const back = hairPts.filter((p) => p.z < 0);
  const front = hairPts.filter((p) => p.z >= 0);
  const drawHairSet = (set) => {
    if (!set.length) return;
    const hp = new Path2D();
    for (const p of set) { hp.moveTo(p.x + p.r, p.y); hp.arc(p.x, p.y, p.r, 0, TAU); }
    // outline via enlarged circles
    ctx.fillStyle = shade(hairCol, -0.55);
    const op = new Path2D();
    for (const p of set) { op.moveTo(p.x + p.r + lw, p.y); op.arc(p.x, p.y, p.r + lw, 0, TAU); }
    ctx.fill(op);
    ctx.fillStyle = hairCol; ctx.fill(hp);
    ctx.save(); ctx.clip(hp);
    // light: lit top-left, darker underside
    const g = ctx.createLinearGradient(cx + light.x * s * 1.5, cy + light.y * s * 1.6, cx - light.x * s, cy - light.y * s * 0.4);
    g.addColorStop(0, rgba(hairLight, 0.75)); g.addColorStop(0.45, rgba(hairCol, 0)); g.addColorStop(1, rgba(shade(hairCol, -0.5), 0.7));
    ctx.fillStyle = g; ctx.fillRect(cx - s * 3, cy - s * 3, s * 6, s * 6);
    // strands
    ctx.strokeStyle = rgba(hairLight, 0.55); ctx.lineWidth = Math.max(1, s * 0.03);
    for (let k = -6; k <= 6; k++) {
      const th0 = k * 0.18;
      ctx.beginPath();
      let first = true;
      for (let v = -0.55; v >= -1; v -= 0.06) {
        const h = hairFn(th0, v); if (!h) continue;
        const q = proj(th0 + noise.n2(k, v * 3) * 0.08, v, h.lift + 0.01);
        if (q.z < 0) continue;
        first ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); first = false;
      }
      ctx.stroke();
    }
    ctx.restore();
  };
  drawHairSet(back);

  // ears (behind face)
  const earSide = (sd) => {
    const th = sd * 1.42, v = 0.04;
    const e = proj(th, v, H.earStick * 0.6);
    const vis = rot([sd, 0, 0.1], yaw, pitch)[2];
    return { ...e, vis, sd };
  };
  const ears = [earSide(-1), earSide(1)];
  const drawEar = (e) => {
    const w = 0.26 * s * H.ear, h = 0.46 * s * H.ear;
    const facing = clamp(Math.abs(e.vis) + 0.35, 0.35, 1);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(facing * (e.sd < 0 ? 1 : -1), 1);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.5);
    ctx.bezierCurveTo(-w * 1.25, -h * 0.65, -w * 1.2, h * 0.35, -w * 0.15, h * 0.5);
    ctx.quadraticCurveTo(w * 0.2, h * 0.2, 0, -h * 0.5);
    ctx.fillStyle = skin; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke();
    ctx.strokeStyle = rgba(skinSh, 0.9); ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.25); ctx.quadraticCurveTo(-w * 0.85, -h * 0.1, -w * 0.35, h * 0.25); ctx.stroke();
    ctx.restore();
  };
  ears.filter((e) => e.vis > -0.55 && e.vis < 0.85).forEach(drawEar);

  // face base
  ctx.save();
  ctx.fillStyle = skin; ctx.fill(headPath);
  ctx.clip(headPath);
  // cel shadow: crescent = head minus a copy shifted toward the light
  {
    const off = 0.34 + 0.22 * Math.max(0, -Math.sign(light.x) * Math.sin(yaw));
    const crescent = new Path2D();
    crescent.rect(cx - s * 4, cy - s * 4, s * 8, s * 8);
    crescent.addPath(headPath, new DOMMatrix().translate(light.x * s * off * -1 * -1, light.y * s * off * 0.6));
    ctx.save();
    ctx.filter = `blur(${Math.max(0.5, s * 0.025)}px)`;
    ctx.fillStyle = rgba(skinSh, 0.5);
    ctx.fill(crescent, 'evenodd');
    ctx.restore();
  }
  // soft form gradient
  const fg = ctx.createRadialGradient(cx + light.x * s * 0.45, cy + light.y * s * 0.45, s * 0.1, cx, cy, s * 1.35);
  fg.addColorStop(0, rgba(shade(skin, 0.14), 0.6)); fg.addColorStop(0.6, rgba(skin, 0)); fg.addColorStop(1, rgba(shade(skin, -0.4), 0.5));
  ctx.fillStyle = fg; ctx.fillRect(cx - s * 2, cy - s * 2, s * 4, s * 4);
  // jaw/neck shadow under chin
  const chin = proj(0, 0.98);
  ctx.fillStyle = rgba(shade(skin, -0.45), 0.35);
  ctx.beginPath(); ctx.ellipse(chin.x, chin.y + s * 0.15, s * 0.7, s * 0.22, 0, 0, TAU); ctx.fill();
  // cheeks blush (raised by smile)
  [-1, 1].forEach((sd) => {
    const q = proj(sd * 0.62, 0.24 - E.smile * 0.08);
    if (q.f < 0.05) return;
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, s * 0.3);
    g.addColorStop(0, rgba(E.pale ? '#D9A0A0' : '#E0766A', 0.32 + E.smile * 0.12 + E.puff * 0.2)); g.addColorStop(1, rgba('#E0766A', 0));
    ctx.fillStyle = g; ctx.fillRect(q.x - s, q.y - s, s * 2, s * 2);
  });
  // wrinkles (age)
  if (H.wrinkles) {
    ctx.strokeStyle = rgba(skinSh, 0.6); ctx.lineWidth = lw * 0.6;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let th = -0.5; th <= 0.5; th += 0.1) { const q = proj(th, -0.55 + k * 0.07, 0.005); th === -0.5 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); }
      ctx.stroke();
    }
  }
  // rim light on the shadow side edge
  if (P.rim) {
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(cx + light.x * s * 0.4, cy + light.y * s * 0.3, s * 0.95, cx, cy, s * 1.25);
    rg.addColorStop(0, rgba(P.rim, 0)); rg.addColorStop(1, rgba(P.rim, 0.6));
    ctx.fillStyle = rg; ctx.fillRect(cx - s * 2, cy - s * 2, s * 4, s * 4);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  ctx.lineWidth = lw * 1.1; ctx.strokeStyle = lineCol; ctx.stroke(headPath);

  // ── features ──
  const smile = clamp(E.smile - E.frown * 0.6, -1, 1);
  const pull = E.cheeksPull;
  // eyes
  const eyeOpen = clamp(E.eyeOpen * (1 - E.blink) * (1 - E.squint * 0.45 - Math.max(0, smile) * 0.32) + E.worry * 0.05, 0, 1.4);
  [-1, 1].forEach((sd) => {
    const q = proj(sd * H.eyeX, H.eyeY + 0.03 + E.cheeksPull * 0.03, 0.0);
    if (q.f < 0.08) return;
    const sq = clamp(q.f * 1.1, 0.15, 1);
    const ew = H.eyeW * s * 1.12, eh = H.eyeH * s * 1.15 * eyeOpen * (1 + pull * 0.4);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(P.tilt * 0 + sd * (0.05 - pull * 0.25));
    ctx.scale(sq, 1);
    // socket shade
    ctx.fillStyle = rgba(skinSh, 0.35 + (H.eyeH < 0.08 ? 0.25 : 0));
    ctx.beginPath(); ctx.ellipse(0, -eh * 0.3, ew * 1.25, ew * 0.75, 0, 0, TAU); ctx.fill();
    if (eh > 0.6) {
      const eye = new Path2D();
      const lowLift = Math.max(0, smile) * 0.55 + E.squint * 0.3;
      eye.moveTo(-ew, 0);
      eye.bezierCurveTo(-ew * 0.55, -eh * 1.25, ew * 0.55, -eh * 1.25, ew, -eh * 0.1);
      eye.bezierCurveTo(ew * 0.5, eh * (0.95 - lowLift), -ew * 0.5, eh * (0.95 - lowLift), -ew, 0);
      ctx.fillStyle = E.pale ? '#F2EEE6' : '#F7F1E6'; ctx.fill(eye);
      ctx.save(); ctx.clip(eye);
      const ix = (E.lookX + yaw * 0.25) * ew * 0.45, iy = E.lookY * eh * 0.4 - eh * 0.1;
      const ir = Math.min(ew * 0.48, eh * 1.15);
      ctx.fillStyle = C.iris; ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(C.iris, -0.5); ctx.beginPath(); ctx.arc(ix, iy, ir * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,250,.95)'; ctx.beginPath(); ctx.arc(ix - ir * 0.35, iy - ir * 0.38, ir * 0.24, 0, TAU); ctx.fill();
      // lid shadow
      ctx.fillStyle = rgba(shade(skin, -0.5), 0.35); ctx.fillRect(-ew * 2, -eh * 2.2, ew * 4, eh * 1.3);
      ctx.restore();
      ctx.lineWidth = lw * 1.25; ctx.strokeStyle = shade(C.hair, -0.3);
      ctx.beginPath(); ctx.moveTo(-ew * 1.05, 0.5); ctx.bezierCurveTo(-ew * 0.55, -eh * 1.3, ew * 0.55, -eh * 1.3, ew * 1.05, -eh * 0.12); ctx.stroke();
      ctx.lineWidth = lw * 0.6; ctx.strokeStyle = rgba(lineCol, 0.7);
      ctx.beginPath(); ctx.moveTo(-ew * 0.8, eh * 0.25); ctx.bezierCurveTo(-ew * 0.4, eh * (0.95 - lowLift), ew * 0.4, eh * (0.95 - lowLift), ew * 0.85, eh * 0.05); ctx.stroke();
    } else {
      // closed / squeezed eye: arc (smile-crescent when smiling)
      ctx.lineWidth = lw * 1.3; ctx.strokeStyle = shade(C.hair, -0.3);
      ctx.beginPath();
      if (smile > 0.3) { ctx.moveTo(-ew, eh * 0.1); ctx.quadraticCurveTo(0, -ew * 0.55, ew, eh * 0.1); }
      else { ctx.moveTo(-ew, 0); ctx.quadraticCurveTo(0, ew * 0.25, ew, 0); }
      ctx.stroke();
    }
    // smile crinkles / tears / sweat
    if (smile > 0.55) { ctx.strokeStyle = rgba(skinSh, 0.8); ctx.lineWidth = lw * 0.55; ctx.beginPath(); ctx.moveTo(sd * ew * 1.15, eh * 0.2); ctx.lineTo(sd * ew * 1.4, eh * 0.55); ctx.stroke(); }
    ctx.restore();
  });
  // brows
  [-1, 1].forEach((sd) => {
    const raise = E.brow * 0.09 - E.frown * 0.05 + E.worry * 0.04 - pull * 0.05;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      const th = sd * (H.eyeX - H.eyeW * 1.15 + u * H.eyeW * 2.4);
      const inner = 1 - u;
      const v = H.browY + 0.05 - raise - 0.04 * Math.sin(u * Math.PI) + inner * (E.worry * -0.07 + E.frown * 0.07);
      pts.push(proj(th, v, 0.03));
    }
    if (pts[3].f < 0.05) return;
    ctx.lineWidth = H.browThick * s;
    ctx.strokeStyle = shade(C.hair, -0.2);
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  });
  // nose
  {
    const nb = proj(0, -0.12, 0.02);
    const tip = proj(0, 0.25 - H.noseUp, H.nose);
    const base = proj(0, 0.36, 0.06);
    const wl = proj(-H.noseW, 0.33, 0.07), wr = proj(H.noseW, 0.33, 0.07);
    const sideTowards = yaw > 0 ? 1 : -1;
    ctx.save();
    // nose shadow (cast, away from light)
    ctx.fillStyle = rgba(shade(skin, -0.45), 0.4);
    ctx.beginPath(); ctx.ellipse(tip.x - light.x * s * 0.1, base.y + s * 0.02, s * H.noseW * 0.9, s * 0.07, 0, 0, TAU); ctx.fill();
    // bridge side line (on the far side)
    ctx.strokeStyle = rgba(lineCol, 0.8); ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    const farW = sideTowards > 0 ? wl : wr;
    ctx.moveTo(nb.x + (tip.x - nb.x) * 0.2 - sideTowards * s * 0.04, nb.y + (tip.y - nb.y) * 0.25);
    ctx.quadraticCurveTo(tip.x - sideTowards * s * 0.08 * (1 - Math.abs(yaw)), tip.y - s * 0.05, tip.x, tip.y + s * 0.02);
    ctx.stroke();
    // nostril wing + tip
    ctx.beginPath();
    ctx.moveTo(wl.x, wl.y - s * 0.02); ctx.quadraticCurveTo(wl.x - s * 0.02, base.y + s * 0.04, base.x, base.y);
    ctx.quadraticCurveTo(wr.x + s * 0.02, base.y + s * 0.04, wr.x, wr.y - s * 0.02);
    ctx.stroke();
    ctx.fillStyle = rgba(shade(skin, -0.6), 0.7);
    [wl, wr].forEach((w) => { if (w.f > 0.15) { ctx.beginPath(); ctx.ellipse((w.x + base.x) / 2, base.y - s * 0.01, s * 0.05, s * 0.025, 0, 0, TAU); ctx.fill(); } });
    // tip highlight
    ctx.fillStyle = rgba(shade(skin, 0.35), 0.6); ctx.beginPath(); ctx.arc(tip.x + light.x * s * 0.04, tip.y - s * 0.03, s * 0.045, 0, TAU); ctx.fill();
    void farW;
    ctx.restore();
  }
  // mouth
  {
    const mw = H.mouthW * (1 + Math.max(0, smile) * 0.32 + pull * 0.45 - E.puff * 0.2);
    const mv = 0.56 + pull * 0.02;
    const open = clamp(E.open + (E.teeth > 0 ? (0.16 + 0.22 * Math.max(0, E.smile)) * E.teeth : 0) + pull * 0.08, 0, 1);
    const corner = -smile * 0.1 + E.frown * 0.05 - pull * 0.02;
    const N = 10, up = [], lo = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N, x = (u - 0.5) * 2;
      const th = x * mw;
      const curve = corner * (x * x) + smile * 0.02;
      up.push(proj(th, mv + curve - 0.012 * (1 - x * x), 0.03));
      lo.push(proj(th, mv + curve + open * 0.24 * (1 - x * x) * (1 + Math.max(0, smile) * 0.25), 0.03));
    }
    const vis = up[N / 2].f > 0.05;
    if (vis) {
      if (open > 0.04) {
        const mp = new Path2D();
        up.forEach((q, i) => (i ? mp.lineTo(q.x, q.y) : mp.moveTo(q.x, q.y)));
        for (let i = lo.length - 1; i >= 0; i--) mp.lineTo(lo[i].x, lo[i].y);
        mp.closePath();
        ctx.fillStyle = '#5A2026'; ctx.fill(mp);
        ctx.save(); ctx.clip(mp);
        if (E.teeth > 0) {
          ctx.fillStyle = '#F6F1E6';
          const tp = new Path2D();
          up.forEach((q, i) => (i ? tp.lineTo(q.x, q.y) : tp.moveTo(q.x, q.y)));
          for (let i = up.length - 1; i >= 0; i--) tp.lineTo(up[i].x, up[i].y + s * 0.13 * E.teeth * (1 - Math.pow((i / N - 0.5) * 2, 2) * 0.55));
          tp.closePath(); ctx.fill(tp);
          ctx.strokeStyle = 'rgba(160,140,120,.35)'; ctx.lineWidth = 1;
          for (let i = 2; i < N - 1; i += 1.5) { const q = up[Math.round(i)]; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x, q.y + s * 0.09); ctx.stroke(); }
        }
        ctx.fillStyle = '#B5525A';
        const mid = lo[N / 2];
        ctx.beginPath(); ctx.ellipse(mid.x, mid.y - s * 0.03, s * mw * 0.45, s * 0.06 * open, 0, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.lineWidth = lw * 1.05; ctx.strokeStyle = rgba(lineCol, 0.95); ctx.stroke(mp);
      } else {
        ctx.lineWidth = lw * 1.2; ctx.strokeStyle = rgba(lineCol, 0.9);
        ctx.beginPath(); up.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      }
      // lower lip volume
      const ll = lo[N / 2];
      ctx.fillStyle = rgba(C.lip, 0.45 * H.lipFull);
      ctx.beginPath(); ctx.ellipse(ll.x, ll.y + s * 0.06, s * mw * 0.32, s * 0.045 * H.lipFull, 0, 0, TAU); ctx.fill();
      // smile lines + dimples
      if (smile > 0.35) {
        ctx.strokeStyle = rgba(skinSh, 0.85 * smile); ctx.lineWidth = lw * 0.75;
        [-1, 1].forEach((sd) => {
          const a = proj(sd * (H.noseW + 0.08), 0.36, 0.05), b = proj(sd * (mw + 0.07), mv + corner + 0.06, 0.03);
          if (a.f < 0.1) return;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x + sd * s * 0.12, (a.y + b.y) / 2, b.x, b.y); ctx.stroke();
          if (H.dimple) { const d = proj(sd * (mw + 0.12), mv - 0.02, 0.02); if (d.f > 0.2) { ctx.beginPath(); ctx.arc(d.x, d.y, s * 0.03, 0, TAU); ctx.stroke(); } }
        });
      }
      // corner tucks
      ctx.fillStyle = rgba(lineCol, 0.8);
      [up[0], up[N]].forEach((q) => { if (q.f > 0.1) { ctx.beginPath(); ctx.arc(q.x, q.y, lw * 0.7, 0, TAU); ctx.fill(); } });
    }
  }
  // sweat / tear
  if (E.sweat > 0) {
    const q = proj(0.55, -0.45, 0.03);
    ctx.fillStyle = 'rgba(220,240,255,.8)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + E.sweat * s * 0.2, s * 0.04, s * 0.07, 0, 0, TAU); ctx.fill();
  }
  if (E.tear > 0) {
    const q = proj(-0.4, 0.05 + E.tear * 0.3, 0.03);
    ctx.fillStyle = 'rgba(220,240,255,.85)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, s * 0.035, s * 0.06, 0, 0, TAU); ctx.fill();
  }

  // front hair
  drawHairSet(front);
  // ears in front of hair? (ears drawn earlier; hair sides already short)

  // hats / scarves / caps
  if (C.hairStyle === 'scarf') drawScarf(ctx, C, proj, s, lineCol, lw, yaw);
  if (P.hat === 'cap' || C.hairStyle === 'cap') drawWorkCap(ctx, proj, s, lineCol, lw, P.capColor || '#4C5662');
  if (C.hat === 'marshalCap' && P.hat !== false) drawMarshalCap(ctx, proj, s, lineCol, lw, yaw);
  if (P.hat === 'fedora') drawFedora(ctx, proj, s, lineCol, lw);
  if (P.glasses) drawGlasses(ctx, proj, C, s, lineCol, lw);
  if (C.hairStyle === 'braids') drawBraids(ctx, C, proj, s, lineCol, lw, P.float || 0, t);
  if (helmet > 0) drawHelmet(ctx, P, { cx, cy, s, yaw, pitch, lineCol, lw, back: false, amt: helmet, proj });
}

function drawScarf(ctx, C, proj, s, lineCol, lw, yaw) {
  const pts = [];
  for (let th = -1.9; th <= 1.9; th += 0.12) pts.push(proj(th, -0.95 + Math.pow(Math.abs(th) / 1.9, 2) * 1.35, 0.16));
  const p = new Path2D();
  p.moveTo(pts[0].x, pts[0].y);
  pts.forEach((q) => p.lineTo(q.x, q.y));
  const chinL = proj(-0.75, 1.05, 0.25), chinR = proj(0.75, 1.05, 0.25), knot = proj(0.0, 1.25, 0.35);
  p.lineTo(chinR.x, chinR.y); p.quadraticCurveTo(knot.x, knot.y + s * 0.2, chinL.x, chinL.y);
  // face opening (inner edge)
  const inner = [];
  for (let th = 1.25; th >= -1.25; th -= 0.1) inner.push(proj(th, -0.62 + Math.pow(Math.abs(th) / 1.25, 2.2) * 1.45, 0.06));
  inner.forEach((q) => p.lineTo(q.x, q.y));
  p.closePath();
  ctx.save();
  ctx.fillStyle = C.scarf; ctx.fill(p, 'evenodd');
  ctx.clip(p, 'evenodd');
  ctx.fillStyle = C.scarfDots;
  for (let i = 0; i < 40; i++) {
    const th = -1.8 + (i % 8) * 0.5 + (Math.floor(i / 8) % 2) * 0.25, v = -0.9 + Math.floor(i / 8) * 0.38;
    const q = proj(th, v, 0.17);
    if (q.z < -0.1) continue;
    ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ctx.ellipse(q.x + Math.cos(a) * s * 0.05, q.y + Math.sin(a) * s * 0.05, s * 0.035, s * 0.025, a, 0, TAU); } ctx.fill();
  }
  const g = ctx.createLinearGradient(0, pts[0].y, 0, knot.y);
  g.addColorStop(0, 'rgba(255,240,220,.15)'); g.addColorStop(1, 'rgba(40,10,10,.35)');
  ctx.fillStyle = g; ctx.fillRect(knot.x - s * 3, pts[0].y - s * 3, s * 6, s * 6);
  ctx.restore();
  ctx.lineWidth = lw; ctx.strokeStyle = shade(C.scarf, -0.6); ctx.stroke(p);
  // knot tails
  ctx.fillStyle = C.scarf;
  ctx.beginPath(); ctx.moveTo(knot.x, knot.y); ctx.quadraticCurveTo(knot.x + s * 0.5, knot.y + s * 0.5, knot.x + s * 0.3, knot.y + s * 0.9); ctx.lineTo(knot.x - s * 0.05, knot.y + s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  void yaw;
}
function drawWorkCap(ctx, proj, s, lineCol, lw, col) {
  const pts = [];
  for (let th = -1.7; th <= 1.7; th += 0.1) pts.push(proj(th, -0.42 - Math.cos(th) * 0.08, 0.1));
  const top = [];
  for (let th = 1.7; th >= -1.7; th -= 0.1) top.push(proj(th * 0.85, -1.02, 0.14));
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); top.forEach((q) => ctx.lineTo(q.x, q.y)); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = lineCol; ctx.stroke();
  const a = proj(-0.7, -0.45, 0.14), b = proj(0.7, -0.45, 0.14), c = proj(0, -0.3, 0.55);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y + s * 0.12, b.x, b.y); ctx.quadraticCurveTo(c.x, c.y - s * 0.05, a.x, a.y);
  ctx.fillStyle = shade(col, -0.35); ctx.fill(); ctx.stroke();
}
function drawMarshalCap(ctx, proj, s, lineCol, lw, yaw) {
  const band = [], bandTop = [];
  for (let th = -1.7; th <= 1.7001; th += 0.1) { band.push(proj(th, -0.48, 0.1)); bandTop.push(proj(th, -0.7, 0.13)); }
  const bl = bandTop[0], br = bandTop[bandTop.length - 1];
  const cx = (bl.x + br.x) / 2 + Math.sin(yaw) * s * 0.1, hw = Math.abs(br.x - bl.x) / 2;
  const cy = Math.min(bl.y, br.y) - s * 0.42;
  ctx.lineWidth = lw; ctx.strokeStyle = lineCol;
  // crown: wide flat oval top joined to the band
  const crown = new Path2D();
  crown.moveTo(bl.x, bl.y);
  crown.bezierCurveTo(bl.x - hw * 0.35, bl.y - s * 0.25, cx - hw * 1.42, cy + s * 0.05, cx - hw * 1.38, cy);
  crown.ellipse(cx, cy, hw * 1.38, s * 0.36, 0, Math.PI, 0, false);
  crown.bezierCurveTo(cx + hw * 1.42, cy + s * 0.05, br.x + hw * 0.35, br.y - s * 0.25, br.x, br.y);
  for (let i = bandTop.length - 1; i >= 0; i--) crown.lineTo(bandTop[i].x, bandTop[i].y);
  crown.closePath();
  ctx.fillStyle = '#5F6A48'; ctx.fill(crown); ctx.stroke(crown);
  ctx.save(); ctx.clip(crown);
  const g = ctx.createLinearGradient(cx - hw * 1.4, 0, cx + hw * 1.4, 0); g.addColorStop(0, 'rgba(255,255,230,.18)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = g; ctx.fillRect(cx - hw * 2, cy - s, hw * 4, s * 3);
  ctx.restore();
  ctx.strokeStyle = '#C8352B'; ctx.lineWidth = lw * 0.9;
  ctx.beginPath(); ctx.ellipse(cx, cy, hw * 1.38, s * 0.36, 0, 0, Math.PI); ctx.stroke();
  // band
  ctx.lineWidth = lw; ctx.strokeStyle = lineCol;
  ctx.beginPath(); band.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); for (let i = bandTop.length - 1; i >= 0; i--) ctx.lineTo(bandTop[i].x, bandTop[i].y); ctx.closePath();
  ctx.fillStyle = '#1D1F22'; ctx.fill(); ctx.stroke();
  // gold oak-leaf embroidery + cockade
  ctx.strokeStyle = '#D8B04A'; ctx.lineWidth = lw * 0.8;
  for (let i = 3; i < band.length - 3; i += 2) { const q = band[i], r2 = bandTop[i]; if (q.f < 0.1) continue; ctx.beginPath(); ctx.ellipse((q.x + r2.x) / 2, (q.y + r2.y) / 2, s * 0.06 * q.f, s * 0.035, 0.6, 0, TAU); ctx.stroke(); }
  const ck = proj(0, -0.6, 0.16);
  ctx.fillStyle = '#D8B04A'; ctx.beginPath(); ctx.ellipse(ck.x, ck.y - s * 0.12, s * 0.2 * (1 - Math.abs(yaw) * 0.4), s * 0.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#C8352B'; starPath(ctx, ck.x, ck.y - s * 0.12, s * 0.13, s * 0.05); ctx.fill();
  // visor
  const a = proj(-0.85, -0.45, 0.12), b = proj(0.85, -0.45, 0.12), c = proj(0, -0.3, 0.6);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y + s * 0.15, b.x, b.y); ctx.quadraticCurveTo(c.x, c.y - s * 0.05, a.x, a.y);
  ctx.fillStyle = '#121315'; ctx.fill(); ctx.strokeStyle = lineCol; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(a.x + s * 0.2, a.y + s * 0.03); ctx.quadraticCurveTo(c.x, c.y + s * 0.05, b.x - s * 0.3, b.y + s * 0.02); ctx.stroke();
}
function drawFedora(ctx, proj, s, lineCol, lw) {
  const L = proj(-1.0, -0.5, 0.06), R = proj(1.0, -0.5, 0.06), top = proj(0, -1.0, 0.1);
  const cx = (L.x + R.x) / 2, cy = (L.y + R.y) / 2, hw = Math.abs(R.x - L.x) / 2;
  ctx.save();
  ctx.lineWidth = lw; ctx.strokeStyle = lineCol;
  // brim
  ctx.fillStyle = '#2E2C2A';
  ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.02, hw * 1.55, s * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // crown
  const p = new Path2D();
  p.moveTo(cx - hw * 0.98, cy);
  p.bezierCurveTo(cx - hw * 1.02, top.y - s * 0.1, cx - hw * 0.5, top.y - s * 0.3, cx, top.y - s * 0.12);
  p.bezierCurveTo(cx + hw * 0.5, top.y - s * 0.3, cx + hw * 1.02, top.y - s * 0.1, cx + hw * 0.98, cy);
  p.quadraticCurveTo(cx, cy + s * 0.18, cx - hw * 0.98, cy);
  ctx.fillStyle = '#383533'; ctx.fill(p); ctx.stroke(p);
  ctx.save(); ctx.clip(p);
  ctx.fillStyle = '#1B1A19'; ctx.fillRect(cx - hw * 1.2, cy - s * 0.22, hw * 2.4, s * 0.2);
  const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
  ctx.fillStyle = g; ctx.fillRect(cx - hw * 1.2, top.y - s, hw * 2.4, s * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.moveTo(cx, top.y - s * 0.12); ctx.lineTo(cx, top.y + s * 0.2); ctx.stroke();
  ctx.restore();
}
function drawGlasses(ctx, proj, C, s, lineCol, lw) {
  ctx.strokeStyle = '#2B2622'; ctx.lineWidth = lw * 1.1;
  [-1, 1].forEach((sd) => { const q = proj(sd * C.head.eyeX, C.head.eyeY, 0.12); if (q.f < 0.1) return; ctx.beginPath(); ctx.ellipse(q.x, q.y, s * 0.24 * q.f, s * 0.18, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(200,225,240,.15)'; ctx.fill(); });
  const a = proj(-0.17, C.head.eyeY - 0.02, 0.14), b = proj(0.17, C.head.eyeY - 0.02, 0.14);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y - s * 0.06, b.x, b.y); ctx.stroke();
}
function drawBraids(ctx, C, proj, s, lineCol, lw, float, t) {
  [-1, 1].forEach((sd) => {
    const root = proj(sd * 1.25, 0.3, 0.12);
    ctx.fillStyle = C.hair; ctx.strokeStyle = shade(C.hair, -0.5); ctx.lineWidth = lw * 0.8;
    for (let k = 0; k < 5; k++) {
      const sw = Math.sin(t * 2 + k * 0.6 + sd) * float * s * 0.2;
      const x = root.x + sd * s * 0.1 * k + sw, y = root.y + k * s * 0.24;
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.13, s * 0.15, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
    const end = { x: root.x + sd * s * 0.5, y: root.y + s * 1.2 };
    ctx.fillStyle = '#F2E7CF';
    ctx.beginPath(); ctx.ellipse(end.x - sd * s * 0.12, end.y, s * 0.18, s * 0.09, 0.5 * sd, 0, TAU); ctx.ellipse(end.x + sd * s * 0.12, end.y, s * 0.18, s * 0.09, -0.5 * sd, 0, TAU); ctx.fill(); ctx.stroke();
  });
}

// SK-1 style helmet: white shell, round face opening, red "СССР", optional visor
function drawHelmet(ctx, P, o) {
  const { cx, cy, s, yaw, pitch, lineCol, lw, back, amt } = o;
  const R = 1.55 * s;
  const hx = cx + Math.sin(yaw) * s * 0.05, hy = cy - s * 0.1 + pitch * s * 0.1;
  if (back) {
    ctx.save();
    ctx.globalAlpha *= amt;
    ctx.beginPath(); ctx.ellipse(hx, hy, R * 1.0, R * 1.08, 0, 0, TAU);
    const g = ctx.createRadialGradient(hx - R * 0.4, hy - R * 0.5, R * 0.1, hx, hy, R * 1.1);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, '#E9E6DF'); g.addColorStop(1, '#A9A69F');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = '#6E6A63'; ctx.stroke();
    // opening shadow
    const fx = hx + Math.sin(yaw) * R * 0.38, fw = R * 0.72 * (1 - Math.abs(Math.sin(yaw)) * 0.35);
    ctx.fillStyle = '#2B2F36'; ctx.beginPath(); ctx.ellipse(fx, hy + R * 0.12, fw, R * 0.78, 0, 0, TAU); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha *= amt;
  const fx = hx + Math.sin(yaw) * R * 0.38, fw = R * 0.72 * (1 - Math.abs(Math.sin(yaw)) * 0.35);
  // mask: shell ring around the face opening
  const ring = new Path2D();
  ring.ellipse(hx, hy, R, R * 1.08, 0, 0, TAU);
  ring.ellipse(fx, hy + R * 0.12, fw, R * 0.78, 0, 0, TAU);
  const g = ctx.createRadialGradient(hx - R * 0.4, hy - R * 0.5, R * 0.1, hx, hy, R * 1.1);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, '#ECE9E2'); g.addColorStop(1, '#ADA9A1');
  ctx.fillStyle = g; ctx.fill(ring, 'evenodd');
  ctx.lineWidth = lw * 1.2; ctx.strokeStyle = '#6E6A63'; ctx.stroke(ring);
  // gasket rim
  ctx.lineWidth = s * 0.12; ctx.strokeStyle = '#D5D0C6';
  ctx.beginPath(); ctx.ellipse(fx, hy + R * 0.12, fw * 1.02, R * 0.8, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = lw; ctx.strokeStyle = '#7B776F'; ctx.stroke();
  // СССР on the forehead band, following curvature
  ctx.fillStyle = '#C8302A';
  ctx.font = `900 ${Math.round(s * 0.42)}px 'Unbounded'`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const letters = ['С', 'С', 'С', 'Р'];
  letters.forEach((ch, i) => {
    const a = (i - 1.5) * 0.28 + yaw * 0.9;
    if (Math.cos(a) < 0.15) return;
    ctx.save();
    ctx.translate(hx + Math.sin(a) * R * 0.92, hy - R * 0.83 + (1 - Math.cos(a)) * R * 0.1);
    ctx.scale(Math.cos(a), 1);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  // visor glass
  const vz = P.visor || 0;
  if (vz > 0) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(fx, hy + R * 0.12, fw, R * 0.78, 0, 0, TAU); ctx.clip();
    ctx.globalAlpha *= vz;
    const vg = ctx.createLinearGradient(fx - fw, hy - R * 0.6, fx + fw, hy + R);
    vg.addColorStop(0, 'rgba(150,190,220,.35)'); vg.addColorStop(0.5, 'rgba(60,80,110,.18)'); vg.addColorStop(1, 'rgba(20,30,50,.35)');
    ctx.fillStyle = vg; ctx.fillRect(fx - fw * 2, hy - R * 2, fw * 4, R * 4);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(fx - fw * 0.45, hy - R * 0.25, fw * 0.16, R * 0.45, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// Convenience: idle/breathing/blink helper (deterministic in t)
export function idle(t, seed = 0) {
  const blinkPhase = (t + seed * 1.7) % 3.7;
  const blink = blinkPhase < 0.12 ? Math.sin((blinkPhase / 0.12) * Math.PI) : 0;
  return {
    blink,
    breathe: t,
    sway: Math.sin(t * 0.9 + seed) * 0.012,
    lookX: noise.n2(t * 0.25, seed * 9.1) * 0.25,
    lookY: noise.n2(seed * 3.3, t * 0.2) * 0.12,
  };
}

// Lip-flap for a character "speaking" a line between t0..t1 (pure function)
export function talk(t, t0, t1, amt = 0.55) {
  if (t < t0 || t > t1) return 0;
  return amt * Math.max(0, noise.n2(t * 9, 3.1) * 0.6 + 0.45) * Math.sin(Math.PI * clamp((t - t0) / (t1 - t0)));
}
