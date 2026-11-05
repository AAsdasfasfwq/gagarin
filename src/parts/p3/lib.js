// ─────────────────────────────────────────────────────────────────────────────
// p3/lib.js — shared craft helpers for part 3 ("The Sphere and the Chosen One").
// Everything is deterministic (seeded) and cached; no core files are modified.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, E, tw, rng, noise, TAU, handheld } from '../../core/math.js';
import { C, rgba, shade, mixColor } from '../../core/palette.js';
import { F, setText } from '../../core/type.js';
import { W, H, makeCanvas, cached, tex, shadeSphere, glow, contactShadow, poly, smoothPath, roundRect, texturePath, scratchCanvas } from '../../core/draw.js';

export { W, H };

// local tween on ABSOLUTE film time
export const at = (a, t0, t1, ease = E.out) => tw(a, t0, t1, ease);
// in/out envelope on absolute time
export const env = (a, i0, i1, o0, o1, ei = E.out, eo = E.in) => tw(a, i0, i1, ei) * (1 - tw(a, o0, o1, eo));

// ── grounds ──────────────────────────────────────────────────────────────────
// Blueprint drafting sheet: navy paper, fine + major grid, fibre texture.
export function blueprintSheet() {
  return cached('p3:bpSheet', () => {
    const w = 2400, h = 1500;
    const { c, ctx } = makeCanvas(w, h);
    ctx.fillStyle = C.blueprint;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.55;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(tex.paper('#C9D6E0', { w: 960, h: 600, seed: 31, stain: 1.4, fiber: 1.6 }), 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (let x = 0; x <= w; x += 30) {
      const major = x % 150 === 0;
      ctx.strokeStyle = rgba(C.blueprintLine, major ? 0.16 : 0.06);
      ctx.lineWidth = major ? 1.3 : 1;
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += 30) {
      const major = y % 150 === 0;
      ctx.strokeStyle = rgba(C.blueprintLine, major ? 0.16 : 0.06);
      ctx.lineWidth = major ? 1.3 : 1;
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
    // faint chalk smudges
    const r = rng(77);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, rr = 60 + r() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, rgba(C.blueprintLine, 0.025 + r() * 0.03));
      g.addColorStop(1, rgba(C.blueprintLine, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    return c;
  });
}
// Draw the blueprint ground with optional parallax offset/zoom and a light pool.
export function blueprintBg(ctx, { ox = 0, oy = 0, zoom = 1, light = 0.22, cx = W * 0.5, cy = H * 0.45, rot = 0 } = {}) {
  const sh = blueprintSheet();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.blueprintDeep;
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.drawImage(sh, -sh.width / 2 - ox, -sh.height / 2 - oy);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1250);
  g.addColorStop(0, `rgba(170,215,240,${light * 0.5})`);
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(3,10,22,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Light editorial paper with a soft pool; cool or warm temperature.
export function editorialBg(ctx, { color = C.paperLight, seed = 7, cx, cy, dark = 0.3, light = 0.06 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tex.paper(color, { seed }), 0, 0, W, H);
  const x = cx ?? W * 0.5, y = cy ?? H * 0.42;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 1300);
  g.addColorStop(0, `rgba(255,250,236,${light})`);
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(28,22,14,${dark})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── ablative sphere (2D with volume) ────────────────────────────────────────
export function ablativeTex() {
  return cached('p3:ablTex', () => {
    const w = 512, h = 512;
    const { c, ctx } = makeCanvas(w, h);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = noise.fbm2(x / 70 + 3, y / 70, 4) * 0.5 + 0.5;
      const m = noise.n2(x / 6.5, y / 6.5) * 0.5 + 0.5;
      const k = 0.62 + n * 0.5 + (m - 0.5) * 0.18;
      const i = (y * w + x) * 4;
      d[i] = 92 * k; d[i + 1] = 84 * k; d[i + 2] = 78 * k; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}
// The Vostok descent sphere in 2D: skin, straps, hatch, porthole. rotY rotates features.
export function drawSphere2D(ctx, x, y, r, { rotY = 0.35, porthole = true, hatch = true, straps = true, tint = '#4E4844', rim = C.blueprintLine, spec = 0.22, alpha = 1, ink = false } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  shadeSphere(ctx, x, y, r, tint, { rim, spec, bounce: 0.12 });
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  texturePath(ctx, ablativeTex(), { alpha: 0.55, op: 'overlay', scale: r / 260 });
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  // surface feature projector: lon (around y axis), lat
  const P = (lon, lat, rr = 1) => {
    const a = lon + rotY;
    const cx = Math.cos(lat) * Math.sin(a), cy = -Math.sin(lat), cz = Math.cos(lat) * Math.cos(a);
    return { x: x + cx * r * rr, y: y + cy * r * rr, z: cz };
  };
  if (straps) {
    for (let k = 0; k < 4; k++) {
      const lon = (k + 0.5) * (TAU / 4);
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 40; i++) {
        const lat = lerp(-0.75, 1.5, i / 40);
        const p = P(lon, lat, 1.005);
        if (p.z < 0) { pen = false; continue; }
        pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        pen = true;
      }
      ctx.strokeStyle = rgba('#B9C2C6', 0.75);
      ctx.lineWidth = r * 0.035;
      ctx.stroke();
      ctx.strokeStyle = rgba('#20252A', 0.5);
      ctx.lineWidth = r * 0.01;
      ctx.stroke();
    }
  }
  const feature = (lon, lat, rad, fn) => {
    const p = P(lon, lat);
    if (p.z < 0.05) return;
    const a = lon + rotY;
    const sx = Math.max(0.05, Math.cos(a) * Math.cos(lat) ** 0.2);
    ctx.save();
    ctx.translate(p.x, p.y);
    const ang = Math.atan2(-Math.sin(lat) * Math.sin(a), Math.cos(a));
    ctx.rotate(ang * 0.0);
    ctx.scale(Math.abs(Math.cos(a)) * 0.9 + 0.1, Math.cos(lat) * 0.85 + 0.15);
    fn(rad * r);
    ctx.restore();
  };
  if (hatch) feature(-0.55, 0.15, 0.36, (R) => {
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
    ctx.fillStyle = rgba('#2A2725', 0.55); ctx.fill();
    ctx.lineWidth = R * 0.12; ctx.strokeStyle = '#8E979B'; ctx.stroke();
    ctx.lineWidth = R * 0.03; ctx.strokeStyle = '#D7DEE0'; ctx.beginPath(); ctx.arc(-R * 0.04, -R * 0.04, R * 0.95, 3.6, 5.2); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.fillStyle = '#C9D0D2'; ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R, R * 0.035, 0, TAU); ctx.fill(); }
  });
  if (porthole) feature(0.45, 0.3, 0.17, (R) => {
    ctx.beginPath(); ctx.arc(0, 0, R * 1.25, 0, TAU); ctx.fillStyle = '#7F888C'; ctx.fill();
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#3E5A72'); g.addColorStop(1, '#0B1622');
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(-R * 0.35, -R * 0.4, R * 0.28, R * 0.12, -0.6, 0, TAU); ctx.fill();
  });
  ctx.restore();
  if (ink) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.strokeStyle = rgba(C.blueprintLine, 0.8); ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

// ── technical drafting marks ─────────────────────────────────────────────────
export function dimLine(ctx, x0, y0, x1, y1, p, { color = C.blueprintLine, width = 2, tick = 16, alpha = 1 } = {}) {
  if (p <= 0) return;
  const e = E.outCubic(clamp(p));
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const ax = lerp(mx, x0, e), ay = lerp(my, y0, e), bx = lerp(mx, x1, e), by = lerp(my, y1, e);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  const tk = (x, y) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(-tick * 0.5, tick * 0.5); ctx.lineTo(tick * 0.5, -tick * 0.5); ctx.moveTo(0, -tick); ctx.lineTo(0, tick); ctx.stroke(); ctx.restore(); };
  tk(ax, ay); tk(bx, by);
  ctx.restore();
}

// type with a hand-set mono bracket label (no animation, alpha only)
export function monoTag(ctx, str, x, y, { size = 26, color = C.cream, align = 'left', alpha = 1, chars = null, weight = 600 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  setText(ctx, { family: F.MONO, size, weight, color, align, baseline: 'middle', tracking: 2 });
  const s = `[ ${str} ]`;
  ctx.fillText(chars == null ? s : s.slice(0, Math.floor(chars)), x, y);
  ctx.restore();
}

// ── a gloved spacesuit hand (close-up inserts) ─────────────────────────────
// pose: 'point' | 'grip' | 'open'. Drawn pointing +x; rotate via ang.
export function glove(ctx, x, y, s, ang = 0, { pose = 'point', color = '#5E6369', cuff = C.orange, press = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(s, s);
  const line = '#2A2D31';
  // cuff (orange suit sleeve)
  ctx.beginPath(); ctx.roundRect(-150, -46, 70, 92, 18);
  ctx.fillStyle = cuff; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-140, -40, 50, 14);
  ctx.lineWidth = 3; ctx.strokeStyle = shade(cuff, -0.5); ctx.stroke();
  // metal wrist ring
  ctx.beginPath(); ctx.roundRect(-92, -44, 20, 88, 6);
  const rg = ctx.createLinearGradient(0, -44, 0, 44); rg.addColorStop(0, '#E3E8EA'); rg.addColorStop(0.5, '#8C969B'); rg.addColorStop(1, '#4D5559');
  ctx.fillStyle = rg; ctx.fill(); ctx.strokeStyle = line; ctx.stroke();
  // palm
  ctx.beginPath();
  ctx.moveTo(-74, -38); ctx.bezierCurveTo(-30, -48, 10, -44, 26, -30);
  ctx.lineTo(30, 30); ctx.bezierCurveTo(6, 44, -40, 46, -74, 38); ctx.closePath();
  const pg = ctx.createLinearGradient(0, -48, 0, 46); pg.addColorStop(0, shade(color, 0.25)); pg.addColorStop(0.6, color); pg.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = pg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = line; ctx.stroke();
  const finger = (ox, oy, len, a, w = 17) => {
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(a);
    ctx.beginPath(); ctx.roundRect(0, -w / 2, len, w, w / 2);
    const fg = ctx.createLinearGradient(0, -w / 2, 0, w / 2); fg.addColorStop(0, shade(color, 0.3)); fg.addColorStop(1, shade(color, -0.3));
    ctx.fillStyle = fg; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = rgba(line, 0.5); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(len * 0.45, -w / 2 + 2); ctx.lineTo(len * 0.45, w / 2 - 2); ctx.stroke();
    ctx.restore();
  };
  if (pose === 'point') {
    finger(20, 26, 46, 0.9, 19); finger(20, 12, 44, 1.15, 19); finger(18, -2, 42, 1.35, 19);
    finger(22, -20, 78 - press * 8, -0.05, 19); // index extended
    finger(-30, -40, 48, -0.85, 21); // thumb
  } else if (pose === 'grip') {
    for (let i = 0; i < 4; i++) finger(22, -24 + i * 16, 40, 1.2 + i * 0.08, 19);
    finger(-24, -40, 50, -0.4, 21);
  } else {
    for (let i = 0; i < 4; i++) finger(24, -26 + i * 17, 70 - Math.abs(i - 1.2) * 8, -0.1 + i * 0.1, 18);
    finger(-30, -40, 50, -0.9, 21);
  }
  ctx.restore();
}

// ── nixie tube ───────────────────────────────────────────────────────────────
const NIX_PATHS = {
  1: [[[0, -1], [0, 1]], [[-0.25, -0.75], [0, -1]]],
  2: [[[-0.5, -0.55], [-0.35, -0.9], [0, -1], [0.35, -0.9], [0.5, -0.55], [0.4, -0.2], [-0.5, 1], [0.55, 1]]],
  5: [[[0.5, -1], [-0.42, -1], [-0.5, -0.1], [0, -0.25], [0.4, -0.12], [0.55, 0.35], [0.4, 0.82], [0, 1], [-0.4, 0.88], [-0.55, 0.6]]],
};
export function nixie(ctx, x, y, h, digit, on, { t = 0, seed = 1 } = {}) {
  const w = h * 0.46;
  ctx.save();
  ctx.translate(x, y);
  // base socket
  const bg = ctx.createLinearGradient(-w * 0.62, 0, w * 0.62, 0);
  bg.addColorStop(0, '#16181B'); bg.addColorStop(0.4, '#4A4F55'); bg.addColorStop(0.6, '#5C6268'); bg.addColorStop(1, '#121417');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(-w * 0.62, h * 0.47, w * 1.24, h * 0.16, 10); ctx.fill();
  // glass envelope (dark interior)
  const glassPath = new Path2D();
  glassPath.moveTo(-w / 2, h * 0.48);
  glassPath.lineTo(-w / 2, -h * 0.32);
  glassPath.bezierCurveTo(-w / 2, -h * 0.56, w / 2, -h * 0.56, w / 2, -h * 0.32);
  glassPath.lineTo(w / 2, h * 0.48); glassPath.closePath();
  const ig = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  ig.addColorStop(0, 'rgba(30,22,16,.92)'); ig.addColorStop(0.5, 'rgba(48,36,26,.85)'); ig.addColorStop(1, 'rgba(22,16,12,.95)');
  ctx.fillStyle = ig; ctx.fill(glassPath);
  // anode mesh
  ctx.save(); ctx.clip(glassPath);
  ctx.strokeStyle = 'rgba(160,150,130,.12)'; ctx.lineWidth = 1;
  for (let i = -w; i < w; i += 7) { ctx.beginPath(); ctx.moveTo(i, -h * 0.5); ctx.lineTo(i + h * 0.3, h * 0.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, h * 0.5); ctx.lineTo(i + h * 0.3, -h * 0.5); ctx.stroke(); }
  // dim unlit cathodes (all digits stacked, faint)
  ctx.strokeStyle = 'rgba(150,120,90,.16)'; ctx.lineWidth = h * 0.012;
  for (const k of [1, 2, 5]) for (const seg of NIX_PATHS[k]) { ctx.beginPath(); seg.forEach(([a, b], i) => (i ? ctx.lineTo(a * w * 0.62, b * h * 0.3) : ctx.moveTo(a * w * 0.62, b * h * 0.3))); ctx.stroke(); }
  ctx.restore();
  // lit digit
  if (on > 0 && NIX_PATHS[digit]) {
    const fl = 0.92 + 0.08 * noise.n2(t * 23 + seed, seed * 3.3);
    const path = new Path2D();
    for (const seg of NIX_PATHS[digit]) seg.forEach(([a, b], i) => (i ? path.lineTo(a * w * 0.62, b * h * 0.3) : path.moveTo(a * w * 0.62, b * h * 0.3)));
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = on * fl;
    ctx.strokeStyle = 'rgba(255,120,30,.35)'; ctx.lineWidth = h * 0.09; ctx.stroke(path);
    ctx.strokeStyle = 'rgba(255,150,60,.6)'; ctx.lineWidth = h * 0.04; ctx.stroke(path);
    ctx.strokeStyle = '#FFE0B0'; ctx.lineWidth = h * 0.016; ctx.stroke(path);
    ctx.restore();
    glow(ctx, 0, 0, h * 0.7, '#FF8A2A', 0.32 * on * fl);
  }
  // glass highlights
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const hg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.12, 'rgba(255,255,255,.22)'); hg.addColorStop(0.2, 'rgba(255,255,255,0)');
  hg.addColorStop(0.82, 'rgba(255,255,255,0)'); hg.addColorStop(0.9, 'rgba(255,255,255,.12)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.fill(glassPath);
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(220,210,190,.25)'; ctx.stroke(glassPath);
  ctx.restore();
}

// ── brain (crafted, gyri drawn with seeded noise folds) ─────────────────────
export function brainSprite(color = '#E7B9B0') {
  return cached(`p3:brain:${color}`, () => {
    const w = 700, h = 520;
    const { c, ctx } = makeCanvas(w, h);
    ctx.translate(w / 2, h / 2);
    // silhouette (lateral view): cerebrum + cerebellum + stem
    const cer = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      let rx = 300, ry = 205;
      let px = Math.cos(a) * rx, py = Math.sin(a) * ry;
      if (py > 0) py *= 0.78 + 0.22 * Math.abs(Math.cos(a));
      if (px > 150 && py > 40) py -= 30; // temporal notch
      px *= 1 + 0.04 * noise.n2(a * 3, 1.1);
      cer.push([px, py - 20]);
    }
    const shp = new Path2D();
    const n = cer.length;
    const m = (i) => [(cer[i][0] + cer[(i + 1) % n][0]) / 2, (cer[i][1] + cer[(i + 1) % n][1]) / 2];
    let q = m(n - 1); shp.moveTo(q[0], q[1]);
    for (let i = 0; i < n; i++) { q = m(i); shp.quadraticCurveTo(cer[i][0], cer[i][1], q[0], q[1]); }
    // cerebellum
    ctx.save();
    ctx.beginPath(); ctx.ellipse(175, 150, 110, 70, 0.2, 0, TAU);
    ctx.fillStyle = shade(color, -0.12); ctx.fill();
    ctx.strokeStyle = shade(color, -0.55); ctx.lineWidth = 4; ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = rgba(shade(color, -0.5), 0.6); ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(175, 150 + i * 14 - 60, 120, 30, 0.2, 0.2, 2.9); ctx.stroke(); }
    ctx.restore();
    // stem
    ctx.beginPath(); ctx.moveTo(60, 120); ctx.bezierCurveTo(80, 200, 70, 240, 95, 260); ctx.lineTo(150, 255); ctx.bezierCurveTo(130, 210, 140, 170, 150, 130); ctx.closePath();
    ctx.fillStyle = shade(color, -0.2); ctx.fill(); ctx.strokeStyle = shade(color, -0.55); ctx.lineWidth = 4; ctx.stroke();
    // cerebrum body
    const g = ctx.createRadialGradient(-90, -120, 20, 0, -10, 340);
    g.addColorStop(0, shade(color, 0.32)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.42));
    ctx.fillStyle = g; ctx.fill(shp);
    // gyri: noise contour folds
    ctx.save(); ctx.clip(shp);
    const r = rng(19);
    ctx.lineCap = 'round';
    for (let k = 0; k < 120; k++) {
      let x = r.range(-300, 300), y = r.range(-230, 190);
      const len = r.range(30, 90);
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < len; s += 5) {
        const a = noise.n2(x / 70 + 4.2, y / 70) * TAU * 1.2;
        x += Math.cos(a) * 5; y += Math.sin(a) * 5;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(shade(color, -0.48), 0.75); ctx.lineWidth = 5.5; ctx.stroke();
      ctx.strokeStyle = rgba(shade(color, 0.4), 0.45); ctx.lineWidth = 2; ctx.translate(-2, -3); ctx.stroke(); ctx.translate(2, 3);
    }
    // lateral sulcus
    ctx.strokeStyle = rgba(shade(color, -0.6), 0.9); ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-60, 70); ctx.bezierCurveTo(10, 30, 90, 20, 170, -10); ctx.stroke();
    // shading over
    const sg = ctx.createLinearGradient(0, -230, 0, 200);
    sg.addColorStop(0, 'rgba(255,245,240,.12)'); sg.addColorStop(1, 'rgba(40,10,20,.28)');
    ctx.fillStyle = sg; ctx.fillRect(-350, -260, 700, 500);
    ctx.restore();
    ctx.strokeStyle = shade(color, -0.6); ctx.lineWidth = 5; ctx.stroke(shp);
    return c;
  });
}

// ── porthole frame (brass/steel ring with bolts + glass) ────────────────────
export function porthole(ctx, x, y, r, inner, { metal = '#9A8F7A', bolts = 12, glassTint = 'rgba(160,200,230,.10)', crack = 0, t = 0 } = {}) {
  ctx.save();
  // outer ring shadow
  ctx.save();
  ctx.shadowColor = 'rgba(20,14,8,.45)'; ctx.shadowBlur = r * 0.12; ctx.shadowOffsetY = r * 0.05;
  ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TAU); ctx.fillStyle = metal; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TAU);
  shadeSphere(ctx, x, y, r * 1.22, metal, { spec: 0.35, bounce: 0.1 });
  ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TAU); ctx.arc(x, y, r * 1.02, 0, TAU, true);
  texturePath(ctx, tex.metal(metal, { seed: 9 }), { alpha: 0.35, op: 'overlay' });
  // inner bevel
  const bv = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  bv.addColorStop(0, shade(metal, -0.5)); bv.addColorStop(1, shade(metal, 0.3));
  ctx.beginPath(); ctx.arc(x, y, r * 1.04, 0, TAU); ctx.lineWidth = r * 0.06; ctx.strokeStyle = bv; ctx.stroke();
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * TAU + 0.13;
    const bx = x + Math.cos(a) * r * 1.13, by = y + Math.sin(a) * r * 1.13;
    ctx.beginPath(); ctx.arc(bx, by, r * 0.035, 0, TAU);
    shadeSphere(ctx, bx, by, r * 0.035, shade(metal, -0.1), { spec: 0.6, bounce: 0 });
  }
  // content
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  if (inner) inner(ctx);
  // glass
  ctx.fillStyle = glassTint; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const gl = ctx.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.4);
  gl.addColorStop(0, 'rgba(255,255,255,.22)'); gl.addColorStop(0.35, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = gl; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 0.5, r * 0.36, r * 0.09, -0.75, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // inner shadow
  const sh = ctx.createRadialGradient(x, y, r * 0.75, x, y, r);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,8,6,.5)');
  ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (crack > 0) {
    const R2 = rng(5);
    ctx.strokeStyle = `rgba(240,250,255,${0.8 * clamp(crack * 2)})`; ctx.lineWidth = 2.2;
    const cx0 = x + r * 0.15, cy0 = y - r * 0.1;
    for (let k = 0; k < 9; k++) {
      let a = (k / 9) * TAU + R2.range(-0.2, 0.2), px = cx0, py = cy0;
      const len = r * R2.range(0.5, 1.3) * clamp(crack * 1.5);
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let s = 0; s < len; s += r * 0.1) { a += R2.range(-0.35, 0.35); px += Math.cos(a) * r * 0.1; py += Math.sin(a) * r * 0.1; ctx.lineTo(px, py); }
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(240,250,255,${0.5 * clamp(crack * 2 - 0.5)})`; ctx.lineWidth = 1.2;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU; const rr = r * 0.12 * k * (1 + 0.15 * Math.sin(a * 5 + k)); i ? ctx.lineTo(cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr) : ctx.moveTo(cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr); } ctx.stroke(); }
  }
  ctx.restore();
  ctx.restore();
}

// ── top-down fighter jet (swept-wing, MiG-ish) ──────────────────────────────
export function jetSprite() {
  return cached('p3:jet', () => {
    const w = 220, h = 260;
    const { c, ctx } = makeCanvas(w, h);
    ctx.translate(w / 2, 40);
    const body = new Path2D();
    // nose up (−y). fuselage
    body.moveTo(0, -30); body.bezierCurveTo(12, -28, 15, 0, 15, 40);
    body.lineTo(16, 120); body.lineTo(10, 175); body.lineTo(-10, 175); body.lineTo(-16, 120); body.lineTo(-15, 40);
    body.bezierCurveTo(-15, 0, -12, -28, 0, -30); body.closePath();
    const wing = new Path2D();
    wing.moveTo(12, 55); wing.lineTo(100, 120); wing.lineTo(102, 135); wing.lineTo(14, 112);
    wing.moveTo(-12, 55); wing.lineTo(-100, 120); wing.lineTo(-102, 135); wing.lineTo(-14, 112);
    const tail = new Path2D();
    tail.moveTo(8, 150); tail.lineTo(46, 182); tail.lineTo(46, 192); tail.lineTo(9, 178);
    tail.moveTo(-8, 150); tail.lineTo(-46, 182); tail.lineTo(-46, 192); tail.lineTo(-9, 178);
    const metal = (p, x0, x1) => {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, '#6F7A80'); g.addColorStop(0.35, '#D9E0E2'); g.addColorStop(0.55, '#B7C1C5'); g.addColorStop(1, '#5D676D');
      ctx.fillStyle = g; ctx.fill(p);
      ctx.strokeStyle = '#3A4248'; ctx.lineWidth = 2; ctx.stroke(p);
    };
    metal(wing, -100, 100); metal(tail, -46, 46); metal(body, -16, 16);
    // red stars on wings
    ctx.fillStyle = C.red;
    for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * 66, 112); ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 4 : 9; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); }
    // canopy
    const cg = ctx.createLinearGradient(-6, 0, 6, 0); cg.addColorStop(0, '#203247'); cg.addColorStop(0.4, '#7FA5C4'); cg.addColorStop(1, '#162536');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(0, 18, 7, 20, 0, 0, TAU); ctx.fill();
    // panel lines
    ctx.strokeStyle = 'rgba(40,50,56,.4)'; ctx.lineWidth = 1;
    for (const yy of [50, 80, 110, 140]) { ctx.beginPath(); ctx.moveTo(-14, yy); ctx.lineTo(14, yy); ctx.stroke(); }
    return c;
  });
}

// ── misc ─────────────────────────────────────────────────────────────────────
export function cam2D(ctx, t, { x = 0, y = 0, zoom = 1, rot = 0, hh = 3, seed = 0, cx = W / 2, cy = H / 2 } = {}) {
  const h = handheld(t, hh, 0.35, seed);
  ctx.translate(cx + h.x, cy + h.y);
  ctx.rotate(rot + h.r);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx - x, -cy - y);
}

// Soft dust motes floating in a light beam (stateless).
export function motes(ctx, t, { x = 0, y = 0, w = W, h = H, count = 60, seed = 3, color = '#FFF2D6', alpha = 0.35, size = [1, 3], drift = 12 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const px = x + r() * w + noise.n2(i * 1.7, t * 0.15) * drift * 4;
    const py = y + ((r() * h - t * drift * (0.3 + r())) % h + h) % h;
    const s = lerp(size[0], size[1], r());
    ctx.globalAlpha = alpha * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.8 + i)));
    ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Big condensed word that can fly apart per-letter (weightless) — returns nothing.
export function floatingWord(ctx, str, x, y, a, { size = 170, color = C.ink, family = F.COND, weight = 800, lift = 0, seed = 4, tracking = 6, appear = 1 } = {}) {
  ctx.save();
  setText(ctx, { family, size, weight, color, align: 'left', baseline: 'alphabetic', tracking });
  const chars = [...str];
  const ws = chars.map((ch) => ctx.measureText(ch).width + tracking);
  const total = ws.reduce((p, q) => p + q, 0) - tracking;
  let cx = x - total / 2;
  const r = rng(seed);
  chars.forEach((ch, i) => {
    const ph = r() * 10, vx = r.range(-1, 1), vy = r.range(0.4, 1.4), vr = r.range(-1, 1);
    const k = clamp(lift - i * 0.035);
    const e = E.inOutSine(clamp(k));
    const ap = clamp(appear * chars.length - i);
    if (ap <= 0) { cx += ws[i]; return; }
    ctx.save();
    ctx.translate(cx + ws[i] / 2 + vx * 70 * e + Math.sin(a * 0.9 + ph) * 6 * e, y - size * 0.35 - vy * 150 * e + Math.cos(a * 0.7 + ph) * 8 * e);
    ctx.rotate(vr * 0.6 * e + Math.sin(a * 0.6 + ph) * 0.05 * e);
    ctx.globalAlpha *= ap;
    ctx.fillText(ch, -ws[i] / 2 + tracking / 2, size * 0.35);
    ctx.restore();
    cx += ws[i];
  });
  ctx.restore();
}
