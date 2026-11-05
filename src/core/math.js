// ─────────────────────────────────────────────────────────────────────────────
// math.js — deterministic math toolkit. NEVER use Math.random() in scenes.
// Everything here is a pure function of its inputs so any frame can be
// re-rendered identically, in any order (required for parallel rendering).
// ─────────────────────────────────────────────────────────────────────────────

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d, doClamp = true) => {
  let t = invLerp(a, b, v);
  if (doClamp) t = clamp(t);
  return c + (d - c) * t;
};
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const fract = (x) => x - Math.floor(x);
export const mix = lerp;
export const deg = (d) => (d * Math.PI) / 180;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const pingpong = (t) => 1 - Math.abs((fract(t / 2) * 2) - 1);
export const step = (edge, x) => (x < edge ? 0 : 1);

// Quantize time to "animation on twos/threes" for a hand-made, stepped feel.
// onTwos(t) => holds every drawing for 2 frames at 30fps (15 drawings/sec).
export const quantize = (t, fps) => Math.floor(t * fps) / fps;
export const onTwos = (t) => quantize(t, 15);
export const onThrees = (t) => quantize(t, 10);

// ── Easing ───────────────────────────────────────────────────────────────────
// House motion language (see docs/DIRECTION.md):
//   E.out  = signature decelerate  (cubic-bezier(.22,1,.36,1) feel)  — entrances / landings
//   E.inOut= camera travel                                            — moves between holds
//   E.in   = exits (faster than entrances)
//   E.back = ONLY for playful/comic beats, never for danger/serious content
export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inQuint: (t) => t * t * t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inCirc: (t) => 1 - Math.sqrt(1 - t * t),
  outCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  inOutCirc: (t) =>
    t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inOutBack: (t, s = 1.70158 * 1.525) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((s + 1) * 2 * t - s)) / 2
      : (Math.pow(2 * t - 2, 2) * ((s + 1) * (t * 2 - 2) + s) + 2) / 2,
  outElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};
// House aliases
E.out = E.outQuint;
E.in = E.inCubic;
E.inOut = E.inOutCubic;
E.cam = E.inOutQuart; // camera travel between holds
E.snap = E.outExpo; // hard landings, impacts

// cubic-bezier(x1,y1,x2,y2) like CSS — returns easing fn
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = sx(t) - x;
      if (Math.abs(d) < 1e-5) break;
      const dd = dsx(t);
      if (Math.abs(dd) < 1e-6) break;
      t -= d / dd;
    }
    return sy(clamp(t));
  };
}

// Tween helper: value of an eased transition between t0..t1 (absolute or local)
// tw(t, 1.2, 2.0, E.out) -> 0..1
export const tw = (t, t0, t1, ease = E.out) => ease(clamp((t - t0) / (t1 - t0)));

// Keyframe track: kf(t, [[time, value, ease?], ...]) — value can be number or array
// ease on a key applies to the segment ARRIVING at that key.
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ease = E.inOut] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) {
      const p = ease(t1 === t0 ? 1 : (t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((a, j) => a + (v1[j] - a) * p);
      return v0 + (v1 - v0) * p;
    }
  }
  return keys[keys.length - 1][1];
}

// Damped spring response to a step at time t0 (analytic, deterministic).
// Returns displacement progress 0→1 with overshoot. zeta<1 = bouncy.
export function spring(t, t0 = 0, { freq = 2.2, zeta = 0.45 } = {}) {
  const x = t - t0;
  if (x <= 0) return 0;
  const w = TAU * freq;
  if (zeta < 1) {
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + ((zeta * w) / wd) * Math.sin(wd * x));
  }
  return 1 - Math.exp(-w * x) * (1 + w * x);
}

// Secondary-motion "follow through": a damped oscillation kicked at t0.
export const wobble = (t, t0, { freq = 3, decay = 4, amp = 1 } = {}) => {
  const x = t - t0;
  if (x <= 0) return 0;
  return amp * Math.exp(-decay * x) * Math.sin(TAU * freq * x);
};

// ── Seeded randomness ───────────────────────────────────────────────────────
export function hash(n) {
  // integer hash → [0,1)
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export function hash2(a, b) {
  return hash((a | 0) * 374761393 + (b | 0) * 668265263);
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
// mulberry32 PRNG — create once per scene (in init) or per frame with a FIXED seed.
export function rng(seed = 1) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.sign = () => (next() < 0.5 ? -1 : 1);
  next.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  return next;
}

// ── Simplex noise (seeded) ─────────────────────────────────────────────────
const grad3 = new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]);
function buildPerm(seed) {
  const r = rng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512), permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
  return { perm, permMod12 };
}
export function makeNoise(seed = 1337) {
  const { perm, permMod12 } = buildPerm(seed);
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const F3 = 1 / 3, G3 = 1 / 6;
  function n2(xin, yin) {
    let n0 = 0, n1 = 0, n2_ = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { const gi = permMod12[ii + perm[jj]] * 3; t0 *= t0; n0 = t0 * t0 * (grad3[gi] * x0 + grad3[gi + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { const gi = permMod12[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n1 = t1 * t1 * (grad3[gi] * x1 + grad3[gi + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { const gi = permMod12[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; n2_ = t2 * t2 * (grad3[gi] * x2 + grad3[gi + 1] * y2); }
    return 70 * (n0 + n1 + n2_);
  }
  function n3(xin, yin, zin) {
    let n0, n1, n2_, n3_;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0; else { const gi = permMod12[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n0 = t0 * t0 * (grad3[gi] * x0 + grad3[gi + 1] * y0 + grad3[gi + 2] * z0); }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0; else { const gi = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t1 *= t1; n1 = t1 * t1 * (grad3[gi] * x1 + grad3[gi + 1] * y1 + grad3[gi + 2] * z1); }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2_ = 0; else { const gi = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t2 *= t2; n2_ = t2 * t2 * (grad3[gi] * x2 + grad3[gi + 1] * y2 + grad3[gi + 2] * z2); }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3_ = 0; else { const gi = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t3 *= t3; n3_ = t3 * t3 * (grad3[gi] * x3 + grad3[gi + 1] * y3 + grad3[gi + 2] * z3); }
    return 32 * (n0 + n1 + n2_ + n3_);
  }
  const fbm2 = (x, y, oct = 4, lac = 2, gain = 0.5) => {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  };
  const fbm3 = (x, y, z, oct = 4, lac = 2, gain = 0.5) => {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); n += a; a *= gain; f *= lac; }
    return s / n;
  };
  return { n2, n3, fbm2, fbm3 };
}
// default shared noise instance
export const noise = makeNoise(1961);

// Organic "handheld" camera offset: returns {x,y,r} in px/radians.
// amp ~ 2..8 px for subtle life, 20+ for shake. Seeded & continuous in t.
export function handheld(t, amp = 4, speed = 0.35, seed = 0) {
  return {
    x: noise.fbm2(t * speed, 11.3 + seed, 3) * amp,
    y: noise.fbm2(37.1 + seed, t * speed, 3) * amp * 0.8,
    r: noise.fbm2(t * speed * 0.7, 91.7 + seed, 2) * amp * 0.0009,
  };
}
// Camera shake impulse (decaying), e.g. explosions. strength in px.
export function shake(t, t0, strength = 30, decay = 3.5, freq = 18, seed = 3) {
  const x = t - t0;
  if (x < 0) return { x: 0, y: 0, r: 0 };
  const env = Math.exp(-decay * x) * strength;
  return {
    x: noise.n2(x * freq, 5.5 + seed) * env,
    y: noise.n2(17.2 + seed, x * freq) * env,
    r: noise.n2(x * freq * 0.5, 44.1 + seed) * env * 0.0012,
  };
}

// Cubic bezier point & arc-length helpers for paths / trajectories
export function bez3(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
// Sample a polyline from a point list via Catmull-Rom; returns array of [x,y]
export function catmull(points, segs = 16, closed = false) {
  const out = [];
  const n = points.length;
  const get = (i) => (closed ? points[(i + n) % n] : points[clamp(i, 0, n - 1)]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < segs; s++) {
      const t = s / segs, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(points[n - 1]);
  return out;
}
export function polyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
// point & tangent angle at fraction u (0..1) along polyline
export function polyAt(pts, u) {
  const total = polyLength(pts);
  let target = clamp(u) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= seg || i === pts.length - 1) {
      const k = seg ? target / seg : 0;
      return {
        x: lerp(pts[i - 1][0], pts[i][0], k),
        y: lerp(pts[i - 1][1], pts[i][1], k),
        a: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]),
      };
    }
    target -= seg;
  }
  const l = pts[pts.length - 1];
  return { x: l[0], y: l[1], a: 0 };
}
