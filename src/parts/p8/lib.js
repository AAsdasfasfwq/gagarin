// ─────────────────────────────────────────────────────────────────────────────
// p8/lib.js — local toolkit for part 8 ("One of You"): perspective ground
// projector + mode-7 textured ground, sky & clouds, character sprites,
// crowds, celebration VFX, kinetic type helpers. Pure / deterministic.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, E, tw, rng, noise, makeNoise, TAU, hash, kf } from '../../core/math.js';
import { C, rgba, shade, mixColor, hexToRgb } from '../../core/palette.js';
import { F, font, setText } from '../../core/type.js';
import { W, H, makeCanvas, cached, scratchCanvas, tex, tintedSmoke, glow, contactShadow } from '../../core/draw.js';
import { drawCharacter, CAST } from '../../core/characters.js';

export { W, H };

// ── word timings (absolute, from assets/script.json) ─────────────────────────
export const WT = {
  generals: 1129.48, doctors: 1130.38, journalists: 1131.34, they: 1132.26, farmwoman: 1133.38, anna: 1134.42,
  granddaughter: 1136.12, planting: 1137.96, potatoes: 1138.28, imagine: 1139.38, shock: 1140.16,
  man: 1141.42, descends: 1141.76, sky: 1142.58, orange: 1143.78, spacesuit: 1144.16, white: 1145.06, helmet: 1145.32,
  backs: 1146.82, terror: 1147.56, thinking: 1148.24, american: 1149.34, spy: 1149.70, alien: 1150.66,
  struggling: 1151.64, walk: 1152.44, heavy: 1153.10, calls: 1154.64, imOne: 1155.44, comrades: 1156.72,
  oneOfYou: 1157.42, soviet: 1159.06, citizen: 1159.42, come: 1160.68, space: 1161.14, what: 1161.64,
  days: 1163.74, changed: 1164.08, history: 1165.34, forever: 1165.82,
  levitan: 1167.64, announced: 1168.06, firstHuman: 1168.66, spaceflight: 1169.30, stateRadio: 1170.14,
  people: 1171.44, sovietUnion: 1172.44, world: 1174.04, spontaneously: 1174.42, poured: 1175.22, streets: 1176.34,
  celebration: 1177.92, comparable: 1178.48, victory: 1179.36, strangers: 1180.64, embraced: 1181.40, cried: 1182.26,
  homemade: 1183.54, signs: 1183.96, against: 1184.86, fear: 1186.00, nuclear: 1186.68, cuban: 1187.92, crises: 1188.28,
  spyS: 1189.12, scandals: 1189.50, gagarinsFlight: 1190.08, glimpse: 1191.86, pure: 1192.42, absolute: 1193.28, light: 1193.76,
  moreThan: 1195.34, country: 1196.06, victory2: 1196.56, victory3: 1197.90, humanity: 1198.90, laws: 1200.04, gravity: 1200.62,
  overnight: 1201.52, yuri: 1202.70, unknown: 1204.00, senior: 1204.46, lieutenant: 1204.88, most: 1206.02, famous: 1206.24,
  person: 1206.74, planet: 1207.60, crowds: 1208.70, millions: 1209.98, greeted: 1210.52, moscow: 1211.28,
  embarked: 1212.54, worldTour: 1213.20, visiting: 1214.32, thirty: 1214.90, countries: 1215.32,
  dined: 1216.62, queen: 1217.30, britain: 1217.72, broke: 1218.48, etiquette: 1218.74, asking: 1219.36,
  photographed: 1220.02, because: 1220.98, notMan: 1222.12, earth: 1222.90, but: 1223.50, heavens: 1224.08,
  extraordinary: 1225.46, fame: 1226.16, became: 1226.72, crushing: 1227.28, burden: 1227.76,
  aboveAll: 1230.10, fighter: 1231.22, pilot: 1231.54, longed: 1232.68, skyL: 1233.52, fly: 1234.66, spaceAgain: 1235.18,
  state: 1236.74, risk: 1237.50, living: 1238.56, symbol: 1238.88, guarded: 1240.04, precious: 1241.26, possession: 1241.80,
  banned: 1243.22, combat: 1244.14, aircraft: 1244.58, surrounded: 1245.48, tight: 1246.42, circle: 1246.68,
  security: 1247.32, party: 1248.58, officials: 1248.88, livingMon: 1250.78, monument: 1251.08, diplomatic: 1252.32, weapon: 1252.80,
  took: 1253.90, years: 1254.12, desperate: 1254.88, struggle: 1255.40, leadership: 1256.24, permission: 1257.10, flyAgain: 1257.84,
  gotWay: 1259.28, skyThat: 1260.70, immortal: 1262.12, ultimately: 1262.54, tookHim: 1263.36,
  march: 1264.82, y1968: 1265.12, died: 1267.44, training: 1268.28, mig: 1269.28, uti: 1270.04, only: 1271.72, n34: 1272.06,
  flightLasted: 1273.30, n108: 1274.84, minutes: 1275.62, dividing: 1278.50, line: 1278.94, past: 1279.80, future: 1280.66,
  proved: 1282.04, humanityC: 1282.78, leave: 1283.66, cradle: 1284.22,
  despite: 1285.44, brutality: 1286.26, coldWar: 1287.10, deadly: 1288.28, risks: 1288.58, burning: 1289.54, rockets: 1289.86,
  secret: 1290.76, bunkers: 1291.14, whatH: 1291.82, remember: 1293.16, forever2: 1293.54, notA: 1294.44, weaponF: 1294.94,
  ordinary: 1296.14, youngMan: 1296.66, extraordinarily: 1297.84, bright: 1298.58, smile: 1299.14, looked: 1300.28, abyss: 1300.94,
  simply: 1301.72, said: 1302.10, lets: 1302.70, go: 1303.38,
};

// ── perspective projector (world: x right, y up, z forward; 1 unit ≈ 1 cm) ──
export class P3 {
  constructor(o = {}) { this.set({ x: 0, y: 160, z: 0, pitch: 0.05, f: 1000, cx: W / 2, cy: H / 2, roll: 0, ...o }); }
  set(o) { Object.assign(this, o); this.cp = Math.cos(this.pitch); this.sp = Math.sin(this.pitch); return this; }
  project(x, y, z) {
    const dx = x - this.x, dy = y - this.y, dz = z - this.z;
    const yy = dy * this.cp + dz * this.sp;
    const zz = -dy * this.sp + dz * this.cp;
    if (zz < 1) return { x: 0, y: 0, s: 0, z: zz, v: false };
    const s = this.f / zz;
    let sx = dx * s, sy = -yy * s;
    if (this.roll) { const c = Math.cos(this.roll), sn = Math.sin(this.roll); const a = sx * c - sy * sn; sy = sx * sn + sy * c; sx = a; }
    return { x: this.cx + sx, y: this.cy + sy, s, z: zz, v: true };
  }
  horizonY() { return this.cy - this.f * Math.tan(this.pitch); }
}

// Mode-7 textured ground plane (y = gy). Texture must tile in x; z wraps.
// texScale = world units per texture pixel. Draws in bands; beyond maxZ → haze fill.
export function mode7(ctx, P, texC, { texScale = 6, gy = 0, maxZ = 16000, band = 2, haze = null, hazeFrom = 0.45, alpha = 1, y1 = H } = {}) {
  const tw_ = texC.width, th = texC.height;
  const h = P.y - gy;
  const hy = P.horizonY();
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  const start = Math.max(0, Math.floor(hy) + 1);
  // far fill (under haze) for rows beyond maxZ
  for (let sy = start; sy < y1; sy += band) {
    const v = -((sy + band * 0.5) - P.cy) / P.f;
    const den = v * P.cp - P.sp;
    if (den >= -1e-6) continue;
    const t = -h / den;
    const zp = t * (v * P.sp + P.cp);
    if (zp > maxZ) continue;
    const xL = P.x + t * (-(P.cx) / P.f), xR = P.x + t * ((W - P.cx) / P.f);
    const tu0 = xL / texScale, tu1 = xR / texScale;
    let tv = ((P.z + zp) / texScale) % th; if (tv < 0) tv += th;
    const span = tu1 - tu0;
    let k = Math.floor(tu0 / tw_) * tw_;
    for (; k < tu1; k += tw_) {
      const a = Math.max(tu0, k), b = Math.min(tu1, k + tw_);
      if (b <= a) continue;
      const dx0 = ((a - tu0) / span) * W, dx1 = ((b - tu0) / span) * W;
      ctx.drawImage(texC, a - k, tv, b - a, 1, dx0, sy, dx1 - dx0 + 0.6, band + 0.4);
    }
  }
  if (haze) {
    const g = ctx.createLinearGradient(0, hy, 0, hy + (y1 - hy) * hazeFrom);
    g.addColorStop(0, rgba(haze, 1));
    g.addColorStop(0.35, rgba(haze, 0.55));
    g.addColorStop(1, rgba(haze, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, hy - 2, W, (y1 - hy) * hazeFrom + 2);
  }
  ctx.restore();
}

// tileable-in-x pixel generator → canvas
export function genTex(w, h, fn) {
  const { c, ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const [r, g, b, a = 255] = fn(x, y);
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Plowed field (furrows along z). 1032×1024, furrow period 12 px.
export function fieldTexture() {
  return cached('p8:field', () => {
    const w = 1032, h = 1024, P = 12;
    const nz = makeNoise(61);
    const hgt = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const th = (x / w) * TAU;
      const cx = Math.cos(th), sx = Math.sin(th);
      const wob = nz.n2(y / 160, 3.1) * 2.2;
      const ph = (((x + wob) % P) + P) % P / P;
      const ridge = 0.5 - 0.5 * Math.cos(ph * TAU);
      const clod = nz.n3(cx * 30, sx * 30, y / 5) * 0.5 + nz.n3(cx * 70, sx * 70, y / 2.3 + 40) * 0.25;
      const big = nz.n3(cx * 4, sx * 4, y / 90 + 7);
      hgt[y * w + x] = ridge * 1.0 + clod * 0.42 + big * 0.12;
    }
    const dark = hexToRgb('#2E2015'), mid = hexToRgb('#5E4029'), lite = hexToRgb('#9A7652'), dust = hexToRgb('#B79A75');
    const green = hexToRgb('#6F7E3A');
    const r2 = rng(17);
    return genTex(w, h, (x, y) => {
      const i = y * w + x;
      const hl = hgt[y * w + ((x - 1 + w) % w)], hr = hgt[y * w + ((x + 1) % w)];
      const hu = hgt[Math.max(0, y - 1) * w + x], hd = hgt[Math.min(h - 1, y + 1) * w + x];
      const nx = (hl - hr), ny = (hu - hd);
      const lit = clamp(0.5 + nx * 1.1 + ny * 0.5, 0, 1);
      const hh = clamp(hgt[i] * 0.75, 0, 1);
      let col = hh < 0.5 ? dark.map((v, k) => lerp(v, mid[k], hh * 2)) : mid.map((v, k) => lerp(v, lite[k], (hh - 0.5) * 2));
      col = col.map((v, k) => lerp(v * 0.62, Math.min(255, v * 1.28), lit));
      if (hh > 0.72 && lit > 0.6) col = col.map((v, k) => lerp(v, dust[k], 0.35));
      // sparse weeds in troughs
      const rr = r2();
      if (hh < 0.25 && rr < 0.012) col = green.map((v) => v * (0.8 + r2() * 0.4));
      if (rr > 0.9965) col = [150, 142, 128];
      return col;
    });
  });
}

// Cobblestone (Red Square) texture: tileable, 1024×1024
export function cobbleTexture() {
  return cached('p8:cobble', () => {
    const w = 1024, h = 1024, cell = 16;
    const nz = makeNoise(77);
    const base = hexToRgb('#5B5650'), lite = hexToRgb('#8E877C'), dark = hexToRgb('#2A2724');
    return genTex(w, h, (x, y) => {
      const row = Math.floor(y / cell);
      const ox = (row % 2) * cell * 0.5;
      const lx = ((x + ox) % cell) / cell - 0.5, ly = (y % cell) / cell - 0.5;
      const id = hash(Math.floor((x + ox) / cell) * 131 + row * 7);
      const d = Math.max(Math.abs(lx), Math.abs(ly) * 1.05);
      const edge = clamp((0.5 - d) * 9, 0, 1);
      const bump = clamp(1 - (lx * lx + ly * ly) * 3, 0, 1);
      const n = nz.n2(x / 3, y / 3) * 0.08;
      const k = 0.55 + id * 0.35 + bump * 0.25 - lx * 0.25 - ly * 0.15 + n;
      const c = base.map((v, j) => lerp(dark[j], lerp(v, lite[j], clamp(k - 0.4)), edge));
      return c;
    });
  });
}

// ── sky ──────────────────────────────────────────────────────────────────────
export function skyGrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
// Soft cumulus sprite with lit top and shaded underside (cached)
export function cloudSprite(seed = 1, { w = 640, h = 300, lit = '#FFF9EE', shadow = '#9FB3C6', puffs = 9 } = {}) {
  return cached(`p8:cloud:${seed}:${w}:${h}:${lit}:${shadow}:${puffs}`, () => {
    const { c, ctx } = makeCanvas(w, h);
    const r = rng(seed);
    const sm = tintedSmoke('#FFFFFF', 20 + (seed % 5));
    for (let i = 0; i < puffs; i++) {
      const px = w * (0.18 + 0.64 * r()), py = h * (0.35 + 0.35 * r());
      const s = h * (0.55 + r() * 0.6) * (1 - Math.abs(px / w - 0.5) * 0.9);
      ctx.globalAlpha = 0.75 + r() * 0.25;
      ctx.drawImage(sm, px - s, py - s * 0.8, s * 2, s * 1.6);
    }
    // flat-ish bottom
    ctx.globalCompositeOperation = 'destination-out';
    const gb = ctx.createLinearGradient(0, h * 0.72, 0, h);
    gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalAlpha = 1; ctx.fillStyle = gb; ctx.fillRect(0, 0, w, h);
    // shade: underside cool, top warm
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.85);
    g.addColorStop(0, lit); g.addColorStop(0.5, mixColor(lit, shadow, 0.35)); g.addColorStop(1, shadow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    return c;
  });
}

// Distant horizon strip: copses, izbas, poles (atmospheric, tileable-ish)
export function horizonStrip(seed = 3, { w = 3000, h = 160, tree = '#6F8395', roof = '#7D8A97', light = '#A8B9C6' } = {}) {
  return cached(`p8:hz:${seed}:${w}:${tree}`, () => {
    const { c, ctx } = makeCanvas(w, h);
    const r = rng(seed);
    const base = h - 6;
    // far copse layer
    for (let i = 0; i < 80; i++) {
      const x = r() * w, rr = 14 + r() * 34, y = base - rr * (0.4 + r() * 0.5);
      ctx.fillStyle = mixColor(tree, light, 0.45 + r() * 0.2);
      ctx.beginPath(); ctx.ellipse(x, y, rr * 1.4, rr, 0, 0, TAU); ctx.fill();
    }
    // nearer copses + birch clumps
    for (let i = 0; i < 55; i++) {
      const x = r() * w, rr = 10 + r() * 26, y = base - rr * (0.5 + r() * 0.6);
      ctx.fillStyle = mixColor(tree, '#55687A', r() * 0.5);
      ctx.beginPath(); ctx.ellipse(x, y, rr * 1.1, rr * 1.3, 0, 0, TAU); ctx.fill();
    }
    // izbas (small houses with gabled roofs)
    for (let i = 0; i < 16; i++) {
      const x = w * 0.12 + r() * w * 0.76, hw = 9 + r() * 7, hh = 8 + r() * 4;
      ctx.fillStyle = mixColor(roof, '#8C8378', r() * 0.5);
      ctx.fillRect(x - hw, base - hh, hw * 2, hh);
      ctx.fillStyle = mixColor(roof, '#5E6670', 0.5);
      ctx.beginPath(); ctx.moveTo(x - hw - 2, base - hh); ctx.lineTo(x, base - hh - hw * 0.7); ctx.lineTo(x + hw + 2, base - hh); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,190,.55)'; ctx.fillRect(x - 2, base - hh + 3, 3, 3);
    }
    // telegraph poles
    ctx.strokeStyle = rgba('#5B6672', 0.8); ctx.lineWidth = 1.4;
    const poles = [];
    for (let x = 60; x < w; x += 170 + r() * 40) { poles.push(x); ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - 34); ctx.moveTo(x - 6, base - 31); ctx.lineTo(x + 6, base - 31); ctx.stroke(); }
    ctx.lineWidth = 0.7; ctx.strokeStyle = rgba('#5B6672', 0.5);
    for (let i = 1; i < poles.length; i++) { ctx.beginPath(); ctx.moveTo(poles[i - 1], base - 31); ctx.quadraticCurveTo((poles[i - 1] + poles[i]) / 2, base - 24, poles[i], base - 31); ctx.stroke(); }
    // ground line
    ctx.fillStyle = mixColor(tree, light, 0.3); ctx.fillRect(0, base, w, 6);
    return c;
  });
}

// ── character helpers ───────────────────────────────────────────────────────
// Render a character into its own canvas (feet at bottom centre). Returns {c, ox, oy} where
// (ox, oy) is the feet point in the canvas.
export function charCanvas(key, who, pose, { w = 420, h = 760, ox = null, oy = null } = {}) {
  return cached(`p8:char:${key}`, () => {
    const { c, ctx } = makeCanvas(w, h);
    const X = ox ?? w / 2, Y = oy ?? h - 20;
    drawCharacter(ctx, who, { crop: 'full', ...pose, x: X, y: Y });
    return { c, ox: X, oy: Y };
  });
}
// flat silhouette (tinted) from a canvas
export function silhouette(src, color, key = null) {
  const make = () => {
    const { c, ctx } = makeCanvas(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  };
  return key ? cached(`p8:sil:${key}:${color}`, make) : make();
}
// ghost cut-out: thin outline + diagonal hatch, transparent body
export function ghostify(src, color, key) {
  return cached(`p8:ghost:${key}:${color}`, () => {
    const w = src.width, h = src.height;
    const sil = silhouette(src, '#000');
    const { c, ctx } = makeCanvas(w, h);
    // dilate
    const R = 3;
    for (let a = 0; a < 12; a++) ctx.drawImage(sil, Math.cos((a / 12) * TAU) * R, Math.sin((a / 12) * TAU) * R);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(sil, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    // hatch inside
    const { c: hc, ctx: hx } = makeCanvas(w, h);
    hx.strokeStyle = color; hx.lineWidth = 2; hx.globalAlpha = 0.5;
    for (let i = -h; i < w + h; i += 14) { hx.beginPath(); hx.moveTo(i, 0); hx.lineTo(i + h, h); hx.stroke(); }
    hx.globalCompositeOperation = 'destination-in';
    hx.drawImage(sil, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(hc, 0, 0);
    return c;
  });
}

// Walk cycle (front/back facing, in depth). phase in cycles. heavy 0..1 = suit weight.
export function walkPose(phase, { heavy = 0, amp = 1 } = {}) {
  const s = Math.sin(phase * TAU), c = Math.cos(phase * TAU);
  const lift = (x) => Math.max(0, x);
  return {
    legL: { a: 0.04 + s * 0.1 * amp, b: lift(s) * 0.55 * amp },
    legR: { a: 0.04 - s * 0.1 * amp, b: lift(-s) * 0.55 * amp },
    armL: { a: 0.25 + heavy * 0.25 - s * 0.12 * amp, b: 0.25 + lift(-s) * 0.3, hand: 'relaxed' },
    armR: { a: 0.25 + heavy * 0.25 + s * 0.12 * amp, b: 0.25 + lift(s) * 0.3, hand: 'relaxed' },
    bob: Math.abs(c) * (6 + heavy * 6) * amp, // px at s=1/HU scale ~ multiply by s/40
    sway: s * (0.03 + heavy * 0.05) * amp,
    step: Math.abs(c) < 0.12 ? 1 : 0,
  };
}

// Variant crowd cast (based on the engineer rig) — deterministic
const VAR_SKIN = ['#E8B08A', '#F0C3A2', '#DDA184', '#D49E7C', '#D7A487', '#E9BC98'];
const VAR_HAIR = ['#3B2E25', '#1F1A16', '#6E5038', '#8B6A44', '#A3A19B', '#2B231E'];
export function crowdCast(i) {
  const r = rng(900 + i * 17);
  const base = CAST.engineer;
  const head = { ...base.head };
  head.rx = 0.88 + r() * 0.24; head.jaw = 0.5 + r() * 0.35; head.nose = 0.16 + r() * 0.14; head.noseW = 0.17 + r() * 0.1;
  head.browThick = 0.05 + r() * 0.05; head.eyeH = 0.08 + r() * 0.03; head.mouthW = 0.28 + r() * 0.08; head.cheek = r() * 0.15;
  return { ...base, head, skin: VAR_SKIN[i % VAR_SKIN.length], hair: VAR_HAIR[(i * 3) % VAR_HAIR.length], hairLight: shade(VAR_HAIR[(i * 3) % VAR_HAIR.length], 0.3), hairStyle: ['sidepart', 'cropped', 'receding', 'gagarin', 'cropped', 'bob'][i % 6], build: { ...base.build, shoulder: 1.8 + r() * 0.5, belly: r() * 0.4, height: 0.9 + r() * 0.12 } };
}

// Front crowd silhouettes (heads & shoulders, some arms up, some hats). Returns array of canvases.
export function crowdSilhouettes(color = '#2A1A22', n = 10) {
  return cached(`p8:crowdsil:${color}:${n}`, () => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = rng(300 + i);
      const who = crowdCast(i);
      const up = r() < 0.45;
      const pose = {
        s: 30, yaw: (r() - 0.5) * 0.8, outfit: ['overalls', 'suit', 'soldier', 'coat', 'overalls', 'labcoat'][i % 6],
        hat: r() < 0.3 ? 'fedora' : r() < 0.4 ? 'cap' : undefined,
        armR: up ? { a: 2.5 + r() * 0.4, b: 0.2, hand: 'open' } : { a: 0.2, b: 0.4 },
        armL: r() < 0.25 ? { a: 2.4, b: 0.3, hand: 'fist' } : { a: 0.15, b: 0.3 },
      };
      const { c } = charCanvas(`crowd${i}`, who, pose, { w: 300, h: 520 });
      out.push(silhouette(c, color));
    }
    return out;
  });
}

// Top-down person sprites (head + shoulders from above) for big crowds
export function topPeople(n = 14, size = 40) {
  return cached(`p8:toppeople:${n}:${size}`, () => {
    const out = [];
    const coats = ['#2B2B30', '#3A3532', '#463C35', '#2E3540', '#4B4A48', '#5A3E2E', '#3D4A3C', '#6B6258', '#7A2A22', '#26303A'];
    const hats = ['#1E1E22', '#5A4C3E', '#E9E2D2', '#B4432F', '#3B2E25', '#6E5038', '#4C5662', '#2A231E', '#C9B79A', '#8C8378'];
    for (let i = 0; i < n; i++) {
      const r = rng(700 + i);
      const { c, ctx } = makeCanvas(size, size);
      const cx = size / 2, cy = size / 2;
      // shadow
      ctx.fillStyle = 'rgba(10,8,10,.35)';
      ctx.beginPath(); ctx.ellipse(cx + 3, cy + 4, size * 0.4, size * 0.24, 0.3, 0, TAU); ctx.fill();
      // shoulders
      const coat = coats[(i * 7) % coats.length];
      const g = ctx.createLinearGradient(cx - size * 0.4, cy - size * 0.2, cx + size * 0.4, cy + size * 0.2);
      g.addColorStop(0, shade(coat, 0.25)); g.addColorStop(1, shade(coat, -0.3));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy + 1, size * 0.38, size * 0.2, (r() - 0.5) * 0.6, 0, TAU); ctx.fill();
      // head / hat
      const hat = hats[(i * 3 + 1) % hats.length];
      const hr = size * (0.15 + r() * 0.03);
      const hg = ctx.createRadialGradient(cx - hr * 0.4, cy - hr * 0.5, hr * 0.1, cx, cy, hr * 1.1);
      hg.addColorStop(0, shade(hat, 0.35)); hg.addColorStop(1, shade(hat, -0.35));
      if (r() < 0.35) { ctx.fillStyle = shade(hat, -0.1); ctx.beginPath(); ctx.arc(cx, cy - 1, hr * 1.45, 0, TAU); ctx.fill(); }
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy - 1, hr, 0, TAU); ctx.fill();
      out.push(c);
    }
    return out;
  });
}

// ── VFX ──────────────────────────────────────────────────────────────────────
// soil dust puff at (x,y) starting t0 (sizes in px)
export function dustPuff(ctx, t, t0, x, y, { size = 60, color = '#B79A75', count = 14, seed = 1, dur = 1.4, alpha = 0.55, dir = 0 } = {}) {
  const a = t - t0;
  if (a < 0 || a > dur) return;
  const u = a / dur;
  const r = rng(seed);
  const sm = tintedSmoke(color, 21);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const ang = Math.PI + r() * Math.PI; // upward half
    const sp = 0.4 + r() * 0.8;
    const d = E.outCubic(u) * size * sp * 1.4;
    const px = x + Math.cos(ang) * d * 1.6 + dir * u * size, py = y + Math.sin(ang) * d * 0.6 - u * size * 0.25;
    const s = size * (0.35 + r() * 0.4) * (0.6 + u);
    ctx.globalAlpha = alpha * (1 - u) * (0.5 + r() * 0.5);
    ctx.drawImage(sm, px - s / 2, py - s / 2, s, s);
  }
  ctx.restore();
}

// Paper confetti (stateless). area {x,y,w,h} spawn top band; falls with flutter
export function confetti(ctx, t, { count = 160, seed = 5, x = 0, w = W, y = -40, fall = 160, life = 6, size = 10, colors = [C.confettiRed, C.confettiGold, C.confettiCream], alpha = 1, wind = 20 } = {}) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const birth = r() * life, px0 = x + r() * w, sp = fall * (0.6 + r() * 0.8), ph = r() * TAU, sz = size * (0.5 + r() * 0.8);
    const col = colors[i % colors.length];
    const age = ((t - birth) % life + life) % life;
    const py = y + age * sp;
    if (py > H + 30) continue;
    const px = px0 + Math.sin(age * 2.2 + ph) * 26 + age * wind;
    const flip = Math.cos(age * 7 + ph);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ph + age * 1.5);
    ctx.scale(1, Math.abs(flip) * 0.9 + 0.1);
    ctx.globalAlpha = alpha * (flip > 0 ? 1 : 0.75);
    ctx.fillStyle = flip > 0 ? col : shade(col, -0.25);
    ctx.fillRect(-sz / 2, -sz * 0.3, sz, sz * 0.6);
    ctx.restore();
  }
  ctx.restore();
}

// Firework burst (stateless) at t0 — trailing sparks with gravity, colour ramp
export function firework(ctx, t, t0, x, y, { r = 220, n = 70, color = C.goldLight, seed = 1, life = 2.4, trail = 0.18, alpha = 1, size = 2.6 } = {}) {
  const a = t - t0;
  if (a < 0 || a > life) return;
  const u = a / life;
  const R = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const pos = (aa, sp, ang) => {
    const d = r * sp * (1 - Math.exp(-aa * 3.2));
    return [x + Math.cos(ang) * d, y + Math.sin(ang) * d + 60 * aa * aa];
  };
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + R() * 0.12, sp = 0.75 + R() * 0.3;
    const p1 = pos(a, sp, ang), p0 = pos(Math.max(0, a - trail), sp, ang);
    const fl = 0.65 + 0.35 * Math.sin(a * 30 + i);
    const fade = Math.pow(1 - u, 1.4) * fl * alpha;
    ctx.strokeStyle = rgba(color, fade);
    ctx.lineWidth = size * (1 - u * 0.5);
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    if (u > 0.55 && i % 3 === 0) { // glitter
      ctx.fillStyle = rgba('#FFF4D8', fade * (Math.sin(a * 40 + i * 3) > 0.3 ? 1 : 0.2));
      ctx.fillRect(p1[0] - 1, p1[1] - 1, 2, 2);
    }
  }
  if (a < 0.25) glow(ctx, x, y, r * 0.6, color, (1 - a / 0.25) * 0.5 * alpha);
  ctx.restore();
}
// rising shell trail before burst
export function shellTrail(ctx, t, t0, x0, y0, x1, y1, { color = C.goldLight } = {}) {
  const a = t - t0;
  if (a < 0 || a > 1) return;
  const e = E.outQuad(a);
  const x = lerp(x0, x1, e), y = lerp(y0, y1, e);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x, y, x0, y0);
  g.addColorStop(0, rgba(color, 0.9)); g.addColorStop(0.3, rgba(color, 0.15)); g.addColorStop(1, rgba(color, 0));
  ctx.strokeStyle = g; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
  ctx.restore();
}

// Snow (stateless) — drifting flakes, depth scaled
export function snow(ctx, t, { count = 220, seed = 8, speed = 40, color = '#F2F2F4', alpha = 0.8, size = 3, wind = 12 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const z = 0.3 + r() * 0.9, x0 = r() * (W + 200) - 100, ph = r() * TAU, y0 = r() * H;
    const y = (y0 + t * speed * z) % (H + 20) - 10;
    const x = x0 + Math.sin(t * 0.6 * z + ph) * 18 * z + t * wind * z;
    const xx = ((x % (W + 200)) + W + 200) % (W + 200) - 100;
    ctx.globalAlpha = alpha * z * 0.8;
    ctx.beginPath(); ctx.arc(xx, y, size * z, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Flash bulb burst (screen add) — p 0..1
export function flashBulb(ctx, x, y, t, t0, { r = 600, dur = 0.5, color = '#FFF6E6' } = {}) {
  const a = t - t0;
  if (a < 0 || a > dur) return;
  const k = Math.pow(1 - a / dur, 2.2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r, color, k * 0.9);
  ctx.globalAlpha = k * 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── type helpers ─────────────────────────────────────────────────────────────
// Hand-painted placard lettering (wobbly per-letter rotation/baseline, brush texture)
export function paintText(ctx, str, x, y, { size = 60, color = C.redDeep, family = F.DISPLAY, weight = 800, seed = 1, align = 'center', jitter = 1 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.font = font(family, size, weight);
  ctx.textBaseline = 'alphabetic';
  const chars = [...str];
  const ws = chars.map((ch) => ctx.measureText(ch).width * 0.96);
  const total = ws.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.fillStyle = color;
  chars.forEach((ch, i) => {
    ctx.save();
    ctx.translate(cx + ws[i] / 2, y + (r() - 0.5) * size * 0.08 * jitter);
    ctx.rotate((r() - 0.5) * 0.12 * jitter);
    const sc = 1 + (r() - 0.5) * 0.1 * jitter;
    ctx.scale(sc, sc);
    ctx.textAlign = 'center';
    ctx.globalAlpha *= 0.88 + r() * 0.12;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cx += ws[i];
  });
  ctx.restore();
  return total;
}

// Word-synced quote (list of {text, at, color?, italic?}) with per-word mask rise
export function quoteWords(ctx, words, x, y, abs, { size = 64, family = F.SERIF, italic = true, weight = 400, color = C.cream, align = 'left', gap = null, dur = 0.35, tracking = 0 } = {}) {
  ctx.save();
  ctx.font = font(family, size, weight, italic);
  ctx.letterSpacing = `${tracking}px`;
  const sp = gap ?? ctx.measureText(' ').width;
  const ws = words.map((w) => { ctx.font = font(w.family || family, w.size || size, w.weight || weight, w.italic ?? italic); return ctx.measureText(w.text).width; });
  const total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  words.forEach((w, i) => {
    const p = clamp((abs - w.at) / dur);
    if (p > 0) {
      const sz = w.size || size;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - 10, y - sz * 1.15, ws[i] + 20, sz * 1.45); ctx.clip();
      ctx.font = font(w.family || family, sz, w.weight || weight, w.italic ?? italic);
      ctx.fillStyle = w.color || color;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha *= clamp(p * 2.5);
      ctx.fillText(w.text, cx, y + (1 - E.outQuint(p)) * sz * 0.9);
      ctx.restore();
    }
    cx += ws[i] + sp;
  });
  ctx.restore();
  return total;
}

// Thin animated strike-through across a text/box (ink line). p 0..1
export function strike(ctx, x0, y0, x1, y1, p, { color = C.red, width = 4 } = {}) {
  if (p <= 0) return;
  const e = E.outCubic(clamp(p));
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, e), lerp(y0, y1, e)); ctx.stroke();
  ctx.restore();
}

// Film-ish vignette for a scene (on top of everything, additive to the post vignette)
export function vignette(ctx, amt = 0.35, color = '#05070C', { cx = W / 2, cy = H / 2, r0 = 0.45, r1 = 1.05 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cx, cy, W * r0 * 0.5, cx, cy, W * r1 * 0.62);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, amt));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Light "breathing" helper and misc
export const breathe = (t, f = 0.5, a = 1) => Math.sin(t * TAU * f) * a;
export const between = (abs, a, b) => abs >= a && abs < b;
export { kf, tw, E, clamp, lerp, rng, noise, TAU };
