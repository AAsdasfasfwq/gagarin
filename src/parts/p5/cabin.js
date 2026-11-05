// ─────────────────────────────────────────────────────────────────────────────
// p5/cabin.js — the Vostok cabin: quilted spherical wall, instrument panel,
// Globus instrument, ejection seat and Gagarin (SK-1 suit, white comms cap with
// earphones under the helmet). World units for Cam25 planes (0,0 = centre).
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, E, tw, noise, rng, TAU } from '../../core/math.js';
import { C, rgba, shade, mixColor } from '../../core/palette.js';
import { cached, makeCanvas, roundRect, tex, texturePath, shadeSphere, glow } from '../../core/draw.js';
import { drawCharacter, idle } from '../../core/characters.js';
import { F, setText } from '../../core/type.js';
import { gauge } from './lib.js';

// quilted padding texture (cream leatherette diamonds with stitches)
export function quiltTex() {
  return cached('p5:quilt', () => {
    const { c, ctx } = makeCanvas(1024, 1024);
    ctx.fillStyle = '#BFAF8E';
    ctx.fillRect(0, 0, 1024, 1024);
    const cell = 96;
    for (let j = -1; j < 1024 / cell * 2 + 2; j++) {
      for (let i = -1; i < 1024 / cell + 2; i++) {
        const cx = i * cell + (j % 2 ? cell / 2 : 0), cy = j * cell / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cell / 2); ctx.lineTo(cx + cell / 2, cy); ctx.lineTo(cx, cy + cell / 2); ctx.lineTo(cx - cell / 2, cy); ctx.closePath();
        const g = ctx.createRadialGradient(cx - cell * 0.12, cy - cell * 0.16, 2, cx, cy, cell * 0.55);
        g.addColorStop(0, '#E4D8BD'); g.addColorStop(0.55, '#C9B994'); g.addColorStop(1, '#8F7F62');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(70,58,40,.55)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(245,236,214,.35)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cell / 2 + 7); ctx.lineTo(cx + cell / 2 - 7, cy); ctx.lineTo(cx, cy + cell / 2 - 7); ctx.lineTo(cx - cell / 2 + 7, cy); ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
        // button
        ctx.fillStyle = 'rgba(60,50,36,.6)'; ctx.beginPath(); ctx.arc(cx, cy - cell / 2, 3, 0, TAU); ctx.fill();
      }
    }
    // calm the pattern down (leatherette, not a checkerboard)
    ctx.fillStyle = 'rgba(176,160,128,.42)'; ctx.fillRect(0, 0, 1024, 1024);
    // grime / fabric noise
    const grit = tex.grit(1.2, { seed: 17, alpha: 70 });
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ctx.createPattern(grit, 'repeat');
    ctx.fillRect(0, 0, 1024, 1024);
    return c;
  });
}

// Back wall of the spherical cabin. light: 0..1 extra daylight from porthole.
export function cabinWall(ctx, t, { w = 7200, h = 4400, tint = '#FFE2B0', porthole = { x: 760, y: -230, r: 170 }, outside = null, sun = 0, warm = 1 } = {}) {
  ctx.save();
  // quilted surface
  ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#B9A987'; ctx.fill();
  const pat = ctx.createPattern(quiltTex(), 'repeat');
  pat.setTransform(new DOMMatrix().translate(-w / 2, -h / 2).scale(1.9));
  ctx.fillStyle = pat; ctx.fillRect(-w / 2, -h / 2, w, h);
  // spherical shading: dark falloff to edges, ribs
  const sg = ctx.createRadialGradient(-120, -260, 80, 0, 0, 2400);
  sg.addColorStop(0, rgba(tint, 0.18 * warm)); sg.addColorStop(0.45, 'rgba(20,16,10,0.05)'); sg.addColorStop(1, 'rgba(10,8,6,0.82)');
  ctx.fillStyle = sg; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(40,32,22,.45)'; ctx.lineWidth = 10;
  for (const k of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(0, 0, 1500, 1700, 0, k < 0 ? Math.PI * 0.62 : -Math.PI * 0.38, k < 0 ? Math.PI * 1.38 : Math.PI * 0.38); ctx.stroke();
  }
  // equipment: cable bundle + boxes (left)
  ctx.save();
  ctx.translate(-980, 120);
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = ['#3B3F3A', '#5E4A33', '#2F3537', '#4B5246', '#6B5A3E', '#33383A'][i]; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(-200, -500 + i * 10); ctx.bezierCurveTo(-60, -300 + i * 8, -140, 100, 40 + i * 12, 520); ctx.stroke();
  }
  roundRect(ctx, -60, -260, 260, 170, 14);
  ctx.fillStyle = '#5B625A'; ctx.fill(); texturePath(ctx, tex.metal('#8A938A', { seed: 3 }), { alpha: 0.5 });
  ctx.fillStyle = '#2B302D'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-10 + i * 55, -175, 12, 0, TAU); ctx.fill(); }
  ctx.restore();
  // porthole on the right
  if (porthole) {
    const { x, y, r } = porthole;
    const sh = ctx.createRadialGradient(x, y, r, x, y, r * 1.7);
    sh.addColorStop(0, 'rgba(10,8,6,.6)'); sh.addColorStop(1, 'rgba(10,8,6,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    if (outside) outside(ctx, x, y, r);
    else {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, '#2B3542'); g.addColorStop(1, '#0B0F16');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(210,225,240,.08)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.12, -0.7, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU); ctx.arc(x, y, r, 0, TAU, true);
    const bz = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    bz.addColorStop(0, '#B8BCB4'); bz.addColorStop(0.5, '#6D736C'); bz.addColorStop(1, '#2A2E2B');
    ctx.fillStyle = bz; ctx.fill('evenodd');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.fillStyle = '#3B403C'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 1.13, y + Math.sin(a) * r * 1.13, 6, 0, TAU); ctx.fill(); }
    if (sun > 0) glow(ctx, x, y, r * 3.2, '#FFF1D2', sun * 0.8);
  }
  ctx.restore();
}

// The Globus navigation instrument: small Earth in a brass-ringed window.
export function globus(ctx, x, y, r, t, { lit = 1 } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, TAU);
  const bz = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  bz.addColorStop(0, '#D9C38A'); bz.addColorStop(0.5, '#8E7A45'); bz.addColorStop(1, '#3E331C');
  ctx.fillStyle = bz; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = '#0E1A26'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, TAU);
  shadeSphere(ctx, x, y, r * 0.86, '#3E6E92', { rim: '#9FD6F0', spec: 0.25 });
  // drifting continents (simple seeded blobs)
  const rr = rng(77);
  ctx.fillStyle = 'rgba(126,150,96,.85)';
  for (let i = 0; i < 7; i++) {
    const ph = rr() * TAU, la = (rr() - 0.5) * 1.6, sz = 0.12 + rr() * 0.22;
    const lon = ph + t * 0.25;
    const z = Math.cos(lon) * Math.cos(la);
    if (z < 0) continue;
    const px = x + Math.sin(lon) * Math.cos(la) * r * 0.86, py = y - Math.sin(la) * r * 0.86;
    ctx.beginPath(); ctx.ellipse(px, py, r * sz * z, r * sz * 0.7, 0.3, 0, TAU); ctx.fill();
  }
  // crosshair
  ctx.strokeStyle = 'rgba(244,235,214,.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  ctx.restore();
  // glass
  const gl = ctx.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.2);
  gl.addColorStop(0, `rgba(255,255,255,${0.25 * lit})`); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

// Instrument panel slab (foreground). needles: {g, v1, v2} 0..1, lamps: array of 0..1
export function panel(ctx, t, { w = 1500, h = 420, x = 0, y = 0, g = 0.05, shakeN = 0, lamps = [1, 0, 1, 0, 0, 1], knob = 0, globusT = 0, light = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  // body
  roundRect(ctx, -w / 2, -h / 2, w, h, 40);
  const bg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  bg.addColorStop(0, '#6F7A72'); bg.addColorStop(0.12, '#56615A'); bg.addColorStop(1, '#2C332F');
  ctx.fillStyle = bg; ctx.fill();
  roundRect(ctx, -w / 2, -h / 2, w, h, 40);
  texturePath(ctx, tex.metal('#9AA59C', { seed: 8 }), { alpha: 0.45, op: 'multiply' });
  ctx.strokeStyle = 'rgba(220,230,220,.25)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 40, -h / 2 + 2); ctx.lineTo(w / 2 - 40, -h / 2 + 2); ctx.stroke();
  // screws
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.fillStyle = '#9BA39C'; ctx.beginPath(); ctx.arc(sx * (w / 2 - 28), sy * (h / 2 - 28), 7, 0, TAU); ctx.fill(); }
  // gauges
  const jit = (k) => shakeN * noise.n2(t * 22 + k * 7, k) * 0.06;
  gauge(ctx, -w * 0.33, -h * 0.05, h * 0.26, g + jit(1), { label: 'G', numbers: [0, null, 2, null, 4, null, 6, null, 8, null, 10] });
  gauge(ctx, -w * 0.13, -h * 0.08, h * 0.19, 0.42 + jit(2), { label: 'P', red: 0.85, needle: C.cream });
  globus(ctx, w * 0.1, -h * 0.06, h * 0.25, globusT);
  gauge(ctx, w * 0.33, -h * 0.05, h * 0.2, 0.6 + jit(3), { label: 'T°', needle: C.cream });
  // indicator lamps row
  lamps.forEach((on, i) => {
    const lx = -w * 0.38 + i * w * 0.07, ly = h * 0.32;
    ctx.fillStyle = '#1A1E1C'; ctx.beginPath(); ctx.arc(lx, ly, 15, 0, TAU); ctx.fill();
    const col = i % 3 === 0 ? '#9BE3A8' : i % 3 === 1 ? '#F2C25A' : '#E86A4A';
    const lg = ctx.createRadialGradient(lx - 3, ly - 3, 1, lx, ly, 12);
    lg.addColorStop(0, on > 0.5 ? '#FFFDF0' : shade(col, -0.5)); lg.addColorStop(0.4, on > 0.5 ? col : shade(col, -0.55)); lg.addColorStop(1, shade(col, -0.75));
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, 11, 0, TAU); ctx.fill();
    if (on > 0.5) glow(ctx, lx, ly, 46, col, 0.35 * on * light);
  });
  // toggle switches + radio knob
  for (let i = 0; i < 5; i++) {
    const sx = w * 0.08 + i * 46, sy = h * 0.3;
    ctx.fillStyle = '#2A2F2C'; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#CDD3CC'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (i % 2 ? 6 : -6), sy - 22); ctx.stroke();
  }
  const kx = w * 0.4, ky = h * 0.28;
  ctx.fillStyle = '#1C201E'; ctx.beginPath(); ctx.arc(kx, ky, 34, 0, TAU); ctx.fill();
  const kg = ctx.createRadialGradient(kx - 8, ky - 8, 2, kx, ky, 28);
  kg.addColorStop(0, '#5C625E'); kg.addColorStop(1, '#202422');
  ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, 27, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(kx, ky); ctx.rotate(-1.6 + knob * 2.2);
  ctx.fillStyle = C.cream; ctx.fillRect(-2.5, -26, 5, 15); ctx.restore();
  // speaker grille
  ctx.fillStyle = '#20251F';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(w * 0.25 + i * 14, h * 0.24 + j * 14, 4, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Seat + Gagarin bust (helmet, comms cap + earphones) + harness straps.
// Returns head info for overlays.
export function gagarinInSeat(ctx, t, { x = 0, y = 0, s = 60, yaw = 0.12, pitch = 0, tilt = 0, expr = {}, visor = 0, float = 0, armL = null, armR = null, seat = true, strapsSlack = 0, rim = null, light = null, lean = 0, earphones = 1 } = {}) {
  const id = idle(t, 3);
  if (seat) {
    // ejection-seat cradle: padded back, headrest cup with side wings, tube frame
    ctx.save();
    ctx.translate(x, y);
    const u = s;
    const hy = -u * 1.25;
    // seat back (extends below frame)
    ctx.beginPath();
    ctx.moveTo(-u * 2.9, u * 0.2); ctx.quadraticCurveTo(-u * 3.1, u * 4, -u * 2.7, u * 9);
    ctx.lineTo(u * 2.7, u * 9); ctx.quadraticCurveTo(u * 3.1, u * 4, u * 2.9, u * 0.2);
    ctx.quadraticCurveTo(0, -u * 0.6, -u * 2.9, u * 0.2); ctx.closePath();
    const bg = ctx.createLinearGradient(-u * 3, 0, u * 3, 0);
    bg.addColorStop(0, '#4D5148'); bg.addColorStop(0.35, '#6A6D60'); bg.addColorStop(0.75, '#43463E'); bg.addColorStop(1, '#25272A');
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(20,22,20,.6)'; ctx.lineWidth = u * 0.05; ctx.stroke();
    ctx.setLineDash([u * 0.12, u * 0.1]); ctx.strokeStyle = 'rgba(220,214,190,.25)'; ctx.lineWidth = u * 0.03;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * u * 2.45, u * 0.6); ctx.quadraticCurveTo(sd * u * 2.65, u * 4, sd * u * 2.35, u * 9); ctx.stroke(); }
    ctx.setLineDash([]);
    // headrest cup
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sd * u * 1.75, hy + u * 0.3, u * 0.75, u * 1.75, sd * 0.18, 0, TAU);
      const wg = ctx.createRadialGradient(sd * u * 1.6 - u * 0.3, hy - u * 0.3, u * 0.1, sd * u * 1.75, hy + u * 0.3, u * 1.8);
      wg.addColorStop(0, '#7A7C6E'); wg.addColorStop(1, '#2D2F2C');
      ctx.fillStyle = wg; ctx.fill();
      ctx.strokeStyle = 'rgba(15,16,15,.6)'; ctx.lineWidth = u * 0.05; ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(0, hy - u * 0.1, u * 1.85, u * 1.95, 0, 0, TAU);
    const hg = ctx.createRadialGradient(-u * 0.6, hy - u * 0.9, u * 0.2, 0, hy, u * 2);
    hg.addColorStop(0, '#6F7266'); hg.addColorStop(0.7, '#3B3E38'); hg.addColorStop(1, '#202220');
    ctx.fillStyle = hg; ctx.fill();
    // tube frame
    ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      ctx.strokeStyle = '#1C1F22'; ctx.lineWidth = u * 0.34;
      ctx.beginPath(); ctx.moveTo(sd * u * 3.2, -u * 2.6); ctx.lineTo(sd * u * 3.45, u * 9); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,210,215,.35)'; ctx.lineWidth = u * 0.07;
      ctx.beginPath(); ctx.moveTo(sd * u * 3.2 - u * 0.07, -u * 2.6); ctx.lineTo(sd * u * 3.45 - u * 0.07, u * 9); ctx.stroke();
    }
    ctx.restore();
  }
  const straps = (c, o) => {
    const { L, shoulderY } = o;
    c.save();
    c.strokeStyle = '#D9D2BF'; c.lineWidth = L(0.42); c.lineCap = 'butt';
    const sl = strapsSlack;
    for (const sd of [-1, 1]) {
      c.beginPath();
      c.moveTo(sd * L(1.05), L(shoulderY - 0.6));
      c.quadraticCurveTo(sd * L(0.9 + sl * 0.4), L(shoulderY + 1.4 + sl * 0.6), sd * L(0.35), L(shoulderY + 3.4));
      c.stroke();
    }
    c.strokeStyle = 'rgba(80,72,60,.6)'; c.lineWidth = L(0.06);
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * L(0.95), L(shoulderY + 0.2)); c.lineTo(sd * L(0.62), L(shoulderY + 2.4)); c.stroke(); }
    // buckle
    c.fillStyle = '#A9AFA8'; roundRect(c, -L(0.42), L(shoulderY + 2.9), L(0.84), L(0.6), L(0.12)); c.fill();
    c.restore();
  };
  const info = drawCharacter(ctx, 'gagarin', {
    x, y, s, yaw, pitch, tilt, lean, crop: 'bust', outfit: 'spacesuit', helmet: 1, visor, float,
    expr: { blink: id.blink, ...expr }, breathe: t, armL, armR, arms: !!(armL || armR), overTorso: straps,
    rim: rim || undefined, light: light || undefined,
  });
  // white communications cap + earphones inside the helmet opening
  if (earphones > 0) {
    const R = 1.55 * s;
    const hx = info.headX + Math.sin(yaw) * s * 0.05, hy = info.headY - s * 0.1 + pitch * s * 0.1;
    const fx = hx + Math.sin(yaw) * R * 0.38, fw = R * 0.72 * (1 - Math.abs(Math.sin(yaw)) * 0.35);
    const fy = hy + R * 0.12, fh = R * 0.78;
    ctx.save();
    ctx.translate(x - x, 0);
    if (tilt) { ctx.translate(info.headX, info.headY + s * 1.2); ctx.rotate(tilt); ctx.translate(-info.headX, -(info.headY + s * 1.2)); }
    ctx.beginPath(); ctx.ellipse(fx, fy, fw, fh, 0, 0, TAU); ctx.clip();
    ctx.globalAlpha *= earphones;
    // cap band hugging the opening edge (forehead & cheeks)
    ctx.lineWidth = s * 0.34; ctx.strokeStyle = '#ECE6D8';
    ctx.beginPath(); ctx.ellipse(fx, fy, fw * 0.99, fh * 0.99, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.lineWidth = s * 0.06; ctx.strokeStyle = 'rgba(120,110,95,.6)';
    ctx.beginPath(); ctx.ellipse(fx, fy, fw * 0.88, fh * 0.9, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    // earphone pads
    for (const sd of [-1, 1]) {
      const ex = fx + sd * fw * 0.93 + Math.sin(yaw) * s * 0.1, ey = fy - fh * 0.08;
      const er = s * 0.36 * (sd > 0 ? 1 - Math.max(0, yaw) * 0.6 : 1 + Math.min(0, yaw) * 0.6);
      ctx.fillStyle = '#ECE6D8'; ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.05, s * 0.5, 0, 0, TAU); ctx.fill();
      const eg = ctx.createRadialGradient(ex - sd * er * 0.2, ey - s * 0.1, 1, ex, ey, s * 0.4);
      eg.addColorStop(0, '#4A4D52'); eg.addColorStop(1, '#141619');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.7, s * 0.36, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  return info;
}
