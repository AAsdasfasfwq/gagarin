// ─────────────────────────────────────────────────────────────────────────────
// p6/cabin.js — the inside of the Vostok sphere: quilted padded wall, the
// porthole (with whatever is outside), the instrument panel with the Globus
// navigation globe, the ejection-seat headrest, gloves, pencil, water hose,
// weightless droplets. All in local "set" coordinates, drawn on Cam25 planes.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, rng, noise, TAU, E, tw } from '../../core/math.js';
import { C, rgba, shade, mixColor } from '../../core/palette.js';
import { F, setText } from '../../core/type.js';
import { tex, shadeSphere, shadeCylinder, glow, texturePath, roundRect, lightCone, cached, makeCanvas } from '../../core/draw.js';
import { dotSprite, AMBER } from './lib.js';

export const WALL = '#B9B2A2';
export const PANEL = '#6F7A6B';

// quilted padded wall of a sphere seen from inside. (cx,cy) = dome centre, R = radius.
export function padWall(ctx, cx, cy, R, { light = [-0.4, -0.5], warm = 0.5, t = 0, tint = null } = {}) {
  ctx.save();
  // base dome shading (concave: dark rim, lit middle)
  const g = ctx.createRadialGradient(cx + light[0] * R * 0.3, cy + light[1] * R * 0.3, R * 0.05, cx, cy, R * 1.25);
  const base = tint || WALL;
  g.addColorStop(0, shade(base, 0.1));
  g.addColorStop(0.45, base);
  g.addColorStop(0.8, shade(base, -0.42));
  g.addColorStop(1, shade(base, -0.72));
  ctx.fillStyle = g;
  ctx.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);
  // quilt: curved diamond stitching following the dome (latitude/longitude grid rotated 45°)
  ctx.strokeStyle = rgba('#5A5246', 0.35);
  ctx.lineWidth = Math.max(1, R * 0.004);
  const n = 16;
  for (let k = -n; k <= n; k++) {
    for (const sgn of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = (i / 40) * 2 - 1;
        const v = (k / n) + u * sgn * 0.9;
        // map (u,v) on a sphere cap → screen with bulge
        const x = u, y = v;
        const rr = Math.hypot(x, y);
        const bulge = 1 + 0.35 * (1 - Math.min(1, rr));
        const px = cx + x * R * 1.3 * bulge, py = cy + y * R * 1.3 * bulge;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  }
  // stitch puffs: soft highlights in each diamond
  ctx.globalCompositeOperation = 'soft-light';
  fillTex(ctx, tex.grit(1.6, { seed: 41, alpha: 255 }), cx - R * 2, cy - R * 2, R * 4, R * 4, 0.55);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
function fillTex(ctx, img, x, y, w, h, a) {
  ctx.save();
  ctx.globalAlpha *= a;
  const p = ctx.createPattern(img, 'repeat');
  ctx.fillStyle = p;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// porthole: thick metal ring with bolts; inside view drawn by viewFn(ctx, x, y, r)
export function porthole(ctx, x, y, r, viewFn, { t = 0, ring = '#8A8F92', bolts = 10, glare = 1, heat = 0 } = {}) {
  ctx.save();
  // recess shadow on the wall
  const sg = ctx.createRadialGradient(x + r * 0.08, y + r * 0.12, r * 1.1, x + r * 0.08, y + r * 0.12, r * 1.6);
  sg.addColorStop(0, 'rgba(10,8,6,.45)'); sg.addColorStop(1, 'rgba(10,8,6,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x + r * 0.08, y + r * 0.12, r * 1.6, 0, TAU); ctx.fill();
  // outer ring (torus-like shading)
  ctx.beginPath(); ctx.arc(x, y, r * 1.32, 0, TAU); ctx.arc(x, y, r, 0, TAU, true);
  const rg = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.2, x, y, r * 1.4);
  rg.addColorStop(0, shade(ring, 0.45)); rg.addColorStop(0.6, ring); rg.addColorStop(1, shade(ring, -0.55));
  ctx.fillStyle = rg; ctx.fill('evenodd');
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r * 1.32, 0, TAU); ctx.arc(x, y, r, 0, TAU, true); ctx.clip('evenodd');
  texturePath(ctx, tex.metal('#A9B1B5', { w: 300, h: 300 }), { alpha: 0.45, op: 'overlay' });
  // inner bevel
  ctx.strokeStyle = 'rgba(255,250,240,.35)'; ctx.lineWidth = r * 0.03;
  ctx.beginPath(); ctx.arc(x, y, r * 1.27, Math.PI * 1.0, Math.PI * 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = r * 0.05;
  ctx.beginPath(); ctx.arc(x, y, r * 1.03, 0, TAU); ctx.stroke();
  ctx.restore();
  // bolts
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * TAU + 0.3;
    const bx = x + Math.cos(a) * r * 1.16, by = y + Math.sin(a) * r * 1.16;
    ctx.beginPath(); ctx.arc(bx, by, r * 0.055, 0, TAU);
    shadeSphere(ctx, bx, by, r * 0.055, '#6E7376', { spec: 0.6, bounce: 0.1 });
  }
  // the view
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  viewFn(ctx, x, y, r);
  // thick-glass edge darkening + reflection streaks
  const eg = ctx.createRadialGradient(x, y, r * 0.65, x, y, r);
  eg.addColorStop(0, 'rgba(10,20,30,0)'); eg.addColorStop(1, 'rgba(10,20,30,.55)');
  ctx.fillStyle = eg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (glare > 0) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.22 * glare;
    ctx.fillStyle = '#E8F2FF';
    ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.12, r * 0.55, 0.7, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.1 * glare;
    ctx.beginPath(); ctx.ellipse(x - r * 0.08, y - r * 0.15, r * 0.05, r * 0.4, 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (heat > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(C.fire3, 0.5 * heat);
    ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.arc(x, y, r * 1.02, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// Earth-limb view through a window: blue curve, black space, a few stars
export function limbView(ctx, x, y, r, { t = 0, roll = 0.35, horizon = 0.35, glowCol = C.halo, earth = '#1D4E7A', spin = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = '#060A1A';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.translate(x, y);
  ctx.rotate(roll + spin);
  // stars
  const rr = rng(7);
  ctx.fillStyle = '#F4F1EA';
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.3 + rr() * 0.6;
    ctx.fillRect((rr() - 0.5) * r * 2.4, (rr() - 0.5) * r * 2.4 - r * 0.4, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  const R = r * 4;
  const ey = r * horizon + R;
  const g = ctx.createRadialGradient(0, ey, R * 0.9, 0, ey, R * 1.04);
  g.addColorStop(0, shade(earth, -0.2));
  g.addColorStop(0.92, earth);
  g.addColorStop(0.965, '#7FC4E8');
  g.addColorStop(0.985, rgba('#BFE6F8', 0.6));
  g.addColorStop(1, rgba(glowCol, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, ey, R * 1.04, 0, TAU); ctx.fill();
  // cloud streaks on the earth
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#EEF3F6';
  const cr = rng(3);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (cr() - 0.5) * 0.5 + t * 0.01;
    const d = R * (0.9 + cr() * 0.07);
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, ey + Math.sin(a) * d, r * (0.2 + cr() * 0.3), r * 0.03, a + Math.PI / 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// instrument panel (angled slab). (x,y) top-left of the panel face, w,h; skew = perspective
export function panel(ctx, x, y, w, h, { t = 0, lamps = null, globe = true, skew = 0.12, light = 1 } = {}) {
  ctx.save();
  const p = [[x, y], [x + w, y - h * skew], [x + w, y + h], [x, y + h * (1 + skew * 0.3)]];
  // body thickness
  ctx.beginPath();
  ctx.moveTo(p[0][0] - 26, p[0][1] + 18); ctx.lineTo(p[0][0], p[0][1]); ctx.lineTo(p[3][0], p[3][1]); ctx.lineTo(p[3][0] - 26, p[3][1] + 18); ctx.closePath();
  ctx.fillStyle = shade(PANEL, -0.55); ctx.fill();
  ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath();
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, shade(PANEL, 0.18 * light)); g.addColorStop(0.6, PANEL); g.addColorStop(1, shade(PANEL, -0.4));
  ctx.fillStyle = g; ctx.fill();
  texturePath(ctx, tex.metal('#9AA393', { w: 400, h: 300, streak: 0.6 }), { alpha: 0.45, op: 'multiply' });
  ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath();
  ctx.strokeStyle = 'rgba(230,236,226,.35)'; ctx.lineWidth = 3; ctx.stroke();
  // face coords helper (u,v in 0..1)
  const at = (u, v) => [lerp(lerp(p[0][0], p[1][0], u), lerp(p[3][0], p[2][0], u), v), lerp(lerp(p[0][1], p[1][1], u), lerp(p[3][1], p[2][1], u), v)];
  const S = w / 700;
  // Globus — the navigation globe in its brass dome
  if (globe) {
    const [gx, gy] = at(0.2, 0.3);
    const gr = 62 * S;
    ctx.beginPath(); ctx.arc(gx, gy, gr * 1.28, 0, TAU);
    shadeSphere(ctx, gx, gy, gr * 1.28, '#8F7A4E', { spec: 0.5, bounce: 0.1 });
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, TAU);
    shadeSphere(ctx, gx, gy, gr, '#3E6E8E', { spec: 0.3 });
    ctx.save();
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(230,220,190,.55)'; ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(gx, gy + i * gr * 0.35, gr * Math.sqrt(1 - (i * 0.35) ** 2), gr * 0.12, 0, 0, TAU); ctx.stroke(); }
    const rot = t * 0.15;
    for (let i = 0; i < 6; i++) { const k = Math.cos(rot + i * 0.52); ctx.beginPath(); ctx.ellipse(gx, gy, Math.abs(k) * gr, gr, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120,140,80,.6)';
    ctx.beginPath(); ctx.ellipse(gx + Math.sin(rot) * gr * 0.4, gy - gr * 0.2, gr * 0.3, gr * 0.22, 0.4, 0, TAU); ctx.fill();
    ctx.restore();
    // crosshair (current position)
    ctx.strokeStyle = C.orange; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx - gr * 0.25, gy); ctx.lineTo(gx + gr * 0.25, gy); ctx.moveTo(gx, gy - gr * 0.25); ctx.lineTo(gx, gy + gr * 0.25); ctx.stroke();
    glassHL(ctx, gx, gy, gr);
  }
  // round gauges
  const gauges = [[0.5, 0.25], [0.72, 0.22], [0.9, 0.2], [0.55, 0.62], [0.78, 0.6]];
  gauges.forEach(([u, v], i) => {
    const [gx, gy] = at(u, v);
    const r = 38 * S;
    ctx.beginPath(); ctx.arc(gx, gy, r * 1.18, 0, TAU);
    shadeSphere(ctx, gx, gy, r * 1.18, '#4D5650', { spec: 0.4, bounce: 0.1 });
    ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fillStyle = '#16191C'; ctx.fill();
    ctx.strokeStyle = 'rgba(244,235,214,.7)'; ctx.lineWidth = 1;
    for (let k = 0; k < 12; k++) { const a = -2.4 + k * 0.4; ctx.beginPath(); ctx.moveTo(gx + Math.cos(a) * r * 0.7, gy + Math.sin(a) * r * 0.7); ctx.lineTo(gx + Math.cos(a) * r * 0.88, gy + Math.sin(a) * r * 0.88); ctx.stroke(); }
    const na = -1.6 + Math.sin(t * 0.7 + i * 2) * 0.3 + i * 0.4;
    ctx.strokeStyle = i === 3 ? AMBER : C.cream; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(na) * r * 0.78, gy + Math.sin(na) * r * 0.78); ctx.stroke();
    glassHL(ctx, gx, gy, r);
  });
  // indicator lamps row
  const nl = 6;
  for (let i = 0; i < nl; i++) {
    const [lx, ly] = at(0.12 + i * 0.075, 0.82);
    const on = lamps ? lamps[i] : 0.3 + 0.2 * Math.sin(t * 2 + i);
    const col = lamps && lamps.colors ? lamps.colors[i] : ['#9BE07A', '#F2C14E', '#9BE07A', '#F2A33A', '#E8E3D5', '#9BE07A'][i];
    roundRect(ctx, lx - 13 * S, ly - 10 * S, 26 * S, 20 * S, 3 * S);
    ctx.fillStyle = '#20231F'; ctx.fill();
    roundRect(ctx, lx - 10 * S, ly - 7 * S, 20 * S, 14 * S, 2 * S);
    ctx.fillStyle = mixColor('#2A2C28', col, clamp(on)); ctx.fill();
    if (on > 0.5) glow(ctx, lx, ly, 34 * S, col, 0.35 * on);
  }
  // toggle switches
  for (let i = 0; i < 5; i++) {
    const [sx, sy] = at(0.14 + i * 0.07, 0.62);
    ctx.beginPath(); ctx.arc(sx, sy, 8 * S, 0, TAU); shadeSphere(ctx, sx, sy, 8 * S, '#9EA4A0', { spec: 0.6 });
    ctx.strokeStyle = '#D9DCD6'; ctx.lineWidth = 4 * S; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 4 * S, sy - 18 * S); ctx.stroke();
  }
  ctx.restore();
  return { at };
}
export function glassHL(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.5, r * 0.22, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// ejection-seat headrest / shoulders behind the pilot
export function seat(ctx, x, y, s) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - s * 2.6, y + s * 6);
  ctx.lineTo(x - s * 2.5, y - s * 0.6);
  ctx.quadraticCurveTo(x - s * 2.4, y - s * 2.9, x, y - s * 3.0);
  ctx.quadraticCurveTo(x + s * 2.4, y - s * 2.9, x + s * 2.5, y - s * 0.6);
  ctx.lineTo(x + s * 2.6, y + s * 6);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - s * 2.6, 0, x + s * 2.6, 0);
  g.addColorStop(0, '#2A2E2C'); g.addColorStop(0.35, '#4B524E'); g.addColorStop(0.6, '#3D4340'); g.addColorStop(1, '#1E2120');
  ctx.fillStyle = g; ctx.fill();
  texturePath(ctx, tex.grit(0.8, { seed: 33, alpha: 255 }), { alpha: 0.35, op: 'overlay' });
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = Math.max(1, s * 0.06); ctx.stroke();
  // seams
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath(); ctx.moveTo(x - s * 1.6, y - s * 2.2); ctx.lineTo(x - s * 1.7, y + s * 6); ctx.moveTo(x + s * 1.6, y - s * 2.2); ctx.lineTo(x + s * 1.7, y + s * 6); ctx.stroke();
  ctx.restore();
}

// spacesuit glove: grip around an object at angle ang (object axis), scale s (px per unit ~ palm width)
export function glove(ctx, x, y, ang, s, { grip = 1, col = '#5B6168', cuff = '#E9E4D8', t = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  // wrist + cuff (behind, coming from +y)
  ctx.beginPath();
  ctx.moveTo(-0.55 * s, 0.35 * s); ctx.lineTo(-0.6 * s, 2.4 * s); ctx.lineTo(0.6 * s, 2.4 * s); ctx.lineTo(0.55 * s, 0.35 * s); ctx.closePath();
  shadeCylinder(ctx, -0.6 * s, 1.2 * s, col, { spec: 0.25 });
  ctx.fillStyle = cuff;
  ctx.beginPath(); ctx.ellipse(0, 1.15 * s, 0.68 * s, 0.22 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,44,.6)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.stroke();
  // palm
  ctx.beginPath(); ctx.ellipse(0, 0, 0.62 * s, 0.55 * s, 0, 0, TAU);
  shadeSphere(ctx, 0, 0, 0.62 * s, col, { spec: 0.18, bounce: 0.2 });
  // fingers (curled over the object, along -y side)
  for (let i = 0; i < 4; i++) {
    const fx = (-0.42 + i * 0.28) * s;
    const curl = lerp(0.0, 1, grip);
    ctx.beginPath();
    ctx.ellipse(fx, -0.42 * s - (1 - curl) * 0.35 * s, 0.15 * s, (0.3 + (1 - curl) * 0.25) * s, 0, 0, TAU);
    shadeSphere(ctx, fx, -0.45 * s, 0.2 * s, shade(col, 0.05), { spec: 0.2 });
    ctx.strokeStyle = 'rgba(25,26,30,.55)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
  }
  // thumb
  ctx.beginPath(); ctx.ellipse(-0.62 * s, -0.05 * s, 0.17 * s, 0.34 * s, -0.5, 0, TAU);
  shadeSphere(ctx, -0.62 * s, -0.05 * s, 0.2 * s, col, { spec: 0.2 });
  ctx.strokeStyle = 'rgba(25,26,30,.55)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
  ctx.restore();
}

// hexagonal wooden pencil; (x,y) centre, len px, ang rad
export function pencil(ctx, x, y, len, ang, { body = '#A8452F', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(ang);
  const w = len * 0.075, hl = len / 2;
  // body (3 facets)
  const facets = [shade(body, 0.25), body, shade(body, -0.35)];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = facets[i];
    ctx.fillRect(-hl, -w / 2 + (i * w) / 3, len * 0.78, w / 3 + 0.5);
  }
  // gold stamp
  ctx.fillStyle = 'rgba(230,190,90,.7)';
  ctx.fillRect(-hl + len * 0.08, -w * 0.12, len * 0.18, w * 0.15);
  // end cap
  ctx.fillStyle = shade(body, -0.5); ctx.fillRect(-hl - 1, -w / 2, 2, w);
  // sharpened cone
  const cx0 = -hl + len * 0.78;
  ctx.beginPath(); ctx.moveTo(cx0, -w / 2); ctx.lineTo(hl - len * 0.04, -w * 0.12); ctx.lineTo(hl - len * 0.04, w * 0.12); ctx.lineTo(cx0, w / 2); ctx.closePath();
  const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  g.addColorStop(0, '#F0D3A6'); g.addColorStop(0.5, '#D9B27C'); g.addColorStop(1, '#A7824F');
  ctx.fillStyle = g; ctx.fill();
  // scalloped edge
  ctx.strokeStyle = shade(body, -0.2); ctx.lineWidth = Math.max(1, w * 0.12);
  ctx.beginPath(); ctx.moveTo(cx0, -w / 2); ctx.quadraticCurveTo(cx0 + w * 0.5, 0, cx0, w / 2); ctx.stroke();
  // graphite
  ctx.fillStyle = '#2E2F33';
  ctx.beginPath(); ctx.moveTo(hl - len * 0.07, -w * 0.18); ctx.lineTo(hl, 0); ctx.lineTo(hl - len * 0.07, w * 0.18); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// weightless water droplet: wobbling sphere with refraction highlights
export function droplet(ctx, x, y, r, t, { seed = 1, tint = '#BFE1F2', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const n = 18, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + 0.09 * Math.sin(a * 2 + t * 7 + seed) + 0.05 * Math.sin(a * 3 - t * 5.3 + seed * 2);
    pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]);
  }
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, rgba('#FFFFFF', 0.55));
  g.addColorStop(0.4, rgba(tint, 0.22));
  g.addColorStop(0.85, rgba(shade(tint, -0.4), 0.45));
  g.addColorStop(1, rgba('#FFFFFF', 0.7));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = rgba('#FFFFFF', 0.45); ctx.lineWidth = Math.max(0.8, r * 0.06); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.18, r * 0.11, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// corrugated hose along a bezier, ribbed
export function hose(ctx, pts, { w = 18, col = '#C9C6BC', t = 0 } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]); };
  path(); ctx.strokeStyle = shade(col, -0.55); ctx.lineWidth = w + 3; ctx.stroke();
  path(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  path(); ctx.strokeStyle = shade(col, 0.4); ctx.lineWidth = w * 0.25; ctx.setLineDash([w * 0.12, w * 0.3]); ctx.stroke();
  ctx.setLineDash([w * 0.15, w * 0.28]);
  path(); ctx.strokeStyle = rgba(shade(col, -0.45), 0.6); ctx.lineWidth = w * 0.9; ctx.stroke();
  ctx.restore();
}
