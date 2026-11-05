// P5 · 02–05 — 09:07 card, the launch key, 20 engines ignite, the flame trench.
import { clamp, lerp, E, tw, kf, handheld, shake, noise, rng, TAU } from '../../../core/math.js';
import { C, rgba, shade, mixColor } from '../../../core/palette.js';
import { W, H, Cam25, glow, pooledBg, paperBg, roundRect, tex, texturePath, fillTexture, contactShadow, haze } from '../../../core/draw.js';
import { F, font, setText, staggerText, maskRise } from '../../../core/type.js';
import { leadKey } from '../../../core/components.js';
import { flame, billows, motes, tag, tracked, applyCam, skyBg, tunnel } from '../lib.js';

// ── split-flap digit ────────────────────────────────────────────────────────
function flapCard(ctx, x, y, w, h, from, to, p, { size = 260 } = {}) {
  // p: 0 = showing `from`, 1 = showing `to` (top flap falls over 0..1)
  const r = 18;
  const half = (digit, top, scaleY = 1, shadeAmt = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, scaleY);
    ctx.beginPath();
    if (top) roundRect(ctx, -w / 2, -h / 2, w, h / 2 - 2, [r, r, 3, 3]);
    else roundRect(ctx, -w / 2, 2, w, h / 2 - 2, [3, 3, r, r]);
    const g = ctx.createLinearGradient(0, top ? -h / 2 : 0, 0, top ? 0 : h / 2);
    g.addColorStop(0, top ? '#2F3742' : '#1C222B'); g.addColorStop(1, top ? '#232A33' : '#151A21');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    setText(ctx, { family: F.DISPLAY, size, weight: 700, color: C.cream, align: 'center', baseline: 'middle' });
    ctx.fillText(digit, 0, h * 0.02);
    if (shadeAmt) { ctx.fillStyle = `rgba(0,0,0,${shadeAmt})`; ctx.fillRect(-w, -h, w * 2, h * 2); }
    ctx.restore();
    ctx.restore();
  };
  // static halves: top shows `to` once the flap passed, bottom shows `from` until flap lands
  const e = clamp(p);
  half(to, true);
  half(e >= 1 ? to : from, false);
  if (e > 0 && e < 1) {
    if (e < 0.5) half(from, true, 1 - e * 2, e * 0.8); // old top folding down
    else half(to, false, (e - 0.5) * 2, (1 - e) * 0.8); // new bottom unfolding
  } else if (e <= 0) half(from, true);
  // hinge line + side pins
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2, y - 2, w, 4);
  ctx.fillStyle = '#6B737C';
  ctx.fillRect(x - w / 2 - 8, y - 10, 8, 20); ctx.fillRect(x + w / 2, y - 10, 8, 20);
}

export const s02 = {
  id: 'p5-02-clock0907',
  start: 657.40, end: 660.00,
  transition: { type: 'clock', dur: 0.4, center: [0.5, 0.5] },
  post: { saturation: 1.0, vignette: 0.38, bloom: 0.15 },
  render(ctx, t) {
    const T0 = 657.40;
    const hh = handheld(t, 2.5, 0.4, 21);
    paperBg(ctx, '#D9876A', { light: 0.1, dark: 0.35, cx: 1300, cy: 300 });
    // morning light leak from right
    glow(ctx, 1700, 120, 1100, '#FFE3C2', 0.22);
    ctx.save();
    const z = 1 + t * 0.022;
    ctx.translate(W / 2 + hh.x, H / 2 + hh.y); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    // clock ring: 60 ticks, sweeping second hand → circle motif (match into the key escutcheon)
    const cx = 960, cy = 520, R = 400;
    ctx.save();
    ctx.strokeStyle = rgba(C.ink, 0.55);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2;
      const show = tw(t, 0.05 + i * 0.006, 0.35 + i * 0.006, E.out);
      if (show <= 0) continue;
      const big = i % 5 === 0;
      ctx.lineWidth = big ? 5 : 2;
      ctx.globalAlpha = show;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - (big ? 34 : 18)), cy + Math.sin(a) * (R - (big ? 34 : 18)));
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.restore();
    const sec = (t + 0.1) * 1.0;
    const sa = (sec / 60) * TAU * 6 - Math.PI / 2 + 1.2;
    ctx.strokeStyle = C.orange; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(sa) * 40, cy - Math.sin(sa) * 40); ctx.lineTo(cx + Math.cos(sa) * (R - 10), cy + Math.sin(sa) * (R - 10)); ctx.stroke();
    // flap cards 0 9 : 0 6→7
    const inP = tw(t, 0.0, 0.45, E.out);
    const cw = 170, ch = 240, gap = 22;
    const xs = [cx - cw * 1.5 - gap * 1.5 - 30, cx - cw * 0.5 - gap * 0.5 - 30, cx + cw * 0.5 + gap * 0.5 + 30, cx + cw * 1.5 + gap * 1.5 + 30];
    const digits = [['0', '0'], ['9', '9'], ['0', '0'], ['6', '7']];
    const flipAt = 657.80 - T0;
    xs.forEach((xx, i) => {
      ctx.save();
      ctx.globalAlpha = tw(t, i * 0.06, i * 0.06 + 0.35, E.out);
      const yy = cy + (1 - E.out(clamp((t - i * 0.06) / 0.5))) * 60;
      ctx.shadowColor = 'rgba(40,14,6,.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 18;
      flapCard(ctx, xx, yy, cw, ch, digits[i][0], digits[i][1], tw(t, flipAt, flipAt + 0.28, E.inOutCubic), { size: 190 });
      ctx.restore();
    });
    // colon
    const blink = 0.55 + 0.45 * Math.round(0.5 + 0.5 * Math.sin(t * Math.PI * 2));
    ctx.fillStyle = rgba(C.ink, 0.85 * inP * blink);
    ctx.beginPath(); ctx.arc(cx, cy - 40, 13, 0, TAU); ctx.arc(cx, cy + 40, 13, 0, TAU); ctx.fill();
    // labels
    staggerText(ctx, '12 · IV · 1961', cx, cy - ch / 2 - 60, t - 0.25, { family: F.MONO, size: 28, weight: 600, color: rgba(C.ink, 0.85), align: 'center', tracking: 8, stagger: 0.03, dur: 0.35, mode: 'fade' });
    ctx.save();
    ctx.globalAlpha = tw(t, 1.55, 2.0, E.out);
    const k = tw(t, 1.55, 2.2, E.out);
    setText(ctx, { family: F.COND, size: 64, weight: 800, color: C.ink, align: 'center', tracking: 10 + 14 * (1 - k) });
    ctx.fillText('MOSCOW TIME', cx, cy + ch / 2 + 92);
    ctx.restore();
    staggerText(ctx, 'a.m.', cx + cw * 2 + gap * 2 + 70, cy + 92, t - 0.75, { family: F.SERIF, size: 54, italic: true, color: C.ink, align: 'left', stagger: 0.04, dur: 0.4 });
    ctx.restore();
  },
};

// ── the launch key ПУСК ───────────────────────────────────────────────────
export const s03 = {
  id: 'p5-03-key',
  start: 660.00, end: 661.45,
  post: { saturation: 0.95, vignette: 0.5, bloom: 0.35, bloomThreshold: 0.72 },
  render(ctx, t) {
    const T0 = 660.0;
    const hh = handheld(t, 2, 0.5, 31);
    const turn = tw(t, 660.5 - T0, 660.72 - T0, E.snap);
    const lamp = tw(t, 660.8 - T0, 660.86 - T0, E.out);
    pooledBg(ctx, '#2D3430', { cx: 900, cy: 480, light: 0.12, dark: 0.6 });
    fillTexture(ctx, tex.metal('#56605A', { seed: 12 }), { alpha: 0.35, op: 'multiply' });
    ctx.save();
    const z = 1.0 + t * 0.05;
    ctx.translate(W / 2 + hh.x, H / 2 + hh.y); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    // out-of-focus console switches (bokeh)
    ctx.save(); ctx.filter = 'blur(10px)';
    for (let i = 0; i < 7; i++) {
      const bx = 160 + i * 270, by = 900;
      ctx.fillStyle = '#1D2220'; ctx.beginPath(); ctx.arc(bx, by, 40, 0, TAU); ctx.fill();
      ctx.fillStyle = i % 3 ? '#B9C2BB' : '#C9B37A'; ctx.fillRect(bx - 7, by - 70, 14, 60);
    }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#3E4A43', '#4A3B33', '#3A4350', '#4B4A3A'][i]; ctx.fillRect(80 + i * 460, 70, 380, 160); }
    ctx.restore();
    const cx = 960, cy = 520;
    // escutcheon (the clock ring becomes this chrome ring)
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
    ctx.beginPath(); ctx.arc(cx, cy, 400, 0, TAU);
    const ring = ctx.createLinearGradient(cx - 400, cy - 400, cx + 400, cy + 400);
    ring.addColorStop(0, '#E3E7E3'); ring.addColorStop(0.45, '#7E8781'); ring.addColorStop(0.55, '#5B635E'); ring.addColorStop(1, '#2B302D');
    ctx.fillStyle = ring; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, 330, 0, TAU);
    const face = ctx.createRadialGradient(cx - 90, cy - 120, 20, cx, cy, 340);
    face.addColorStop(0, '#2E3532'); face.addColorStop(1, '#121614');
    ctx.fillStyle = face; ctx.fill();
    // engraved positions
    setText(ctx, { family: F.MONO, size: 30, weight: 700, color: rgba(C.cream, 0.55), align: 'center', baseline: 'middle', tracking: 4 });
    ctx.fillText('0', cx - 230, cy - 120);
    ctx.fillStyle = rgba(C.cream, 0.55 + 0.45 * turn);
    ctx.fillText('I', cx + 120, cy - 240);
    // the key
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(lerp(-0.62, 0.95, turn) + noise.n2(t * 30, 2) * 0.01 * turn);
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 25; ctx.shadowOffsetX = 14; ctx.shadowOffsetY = 18;
    ctx.beginPath(); roundRect(ctx, -60, -250, 120, 330, 40);
    const kg = ctx.createLinearGradient(-60, 0, 60, 0);
    kg.addColorStop(0, '#5E4A2A'); kg.addColorStop(0.35, '#D8B76A'); kg.addColorStop(0.6, '#A7843F'); kg.addColorStop(1, '#4A3920');
    ctx.fillStyle = kg; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(20,14,6,.55)'; ctx.beginPath(); ctx.arc(0, -180, 26, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 110, 0, TAU);
    const hub = ctx.createRadialGradient(-30, -40, 5, 0, 0, 115);
    hub.addColorStop(0, '#F1F3EF'); hub.addColorStop(0.5, '#8B948E'); hub.addColorStop(1, '#3B423E');
    ctx.fillStyle = hub; ctx.fill();
    ctx.restore();
    // label plate ПУСК
    ctx.save();
    roundRect(ctx, cx - 150, cy + 430, 300, 92, 10);
    ctx.fillStyle = '#C9C3B1'; ctx.fill();
    texturePath(ctx, tex.metal('#D8D2C0', { seed: 4 }), { alpha: 0.6 });
    setText(ctx, { family: F.MONO, size: 58, weight: 800, color: '#7E1E16', align: 'center', baseline: 'middle', tracking: 12 });
    ctx.fillText('ПУСК', cx, cy + 478);
    ctx.restore();
    // launch lamp (top right) → iris centre for the next scene
    const lx = 1290 - (W / 2), ly = 380 - (H / 2);
    const LX = W / 2 + lx / z * 1, LY = H / 2 + ly / z;
    void LX; void LY;
    ctx.fillStyle = '#1A1E1C'; ctx.beginPath(); ctx.arc(1440, 250, 66, 0, TAU); ctx.fill();
    const lg = ctx.createRadialGradient(1428, 238, 4, 1440, 250, 54);
    lg.addColorStop(0, lamp > 0.5 ? '#FFFBEA' : '#5A1C14'); lg.addColorStop(0.45, lamp > 0.5 ? '#FF6A3A' : '#4A140E'); lg.addColorStop(1, '#2A0A08');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(1440, 250, 52, 0, TAU); ctx.fill();
    if (lamp > 0) glow(ctx, 1440, 250, 320, '#FF6A3A', 0.6 * lamp);
    ctx.restore();
    // caption
    staggerText(ctx, 'the launch command', 140, 160, t - 0.1, { family: F.SERIF, size: 54, italic: true, color: rgba(C.cream, 0.92), align: 'left', stagger: 0.025, dur: 0.45, mode: 'rise' });
  },
};

// ── 20 engines: bottom view of the R-7 cluster igniting in sequence ─────────
function nozzleBell(ctx, x, y, r, fire, t, seed) {
  // metal bell seen from below: outer lip, inner cone rings, dark throat
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#6A6E70'); g.addColorStop(0.7, '#3A3D40'); g.addColorStop(1, '#1C1E20');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(210,214,210,.35)'; ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath(); ctx.arc(x, y, r * 0.95, Math.PI * 1.05, Math.PI * 1.8); ctx.stroke();
  for (let i = 1; i <= 3; i++) { ctx.strokeStyle = `rgba(0,0,0,${0.18 + i * 0.08})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * (1 - i * 0.2), 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#0B0C0E'; ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, TAU); ctx.fill();
  if (fire > 0) {
    const fl = 0.85 + 0.15 * noise.n2(t * 18, seed);
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createRadialGradient(x, y, 0, x, y, r * (0.8 + fire * 0.25));
    fg.addColorStop(0, rgba(C.fire5, 0.9 * fire * fl)); fg.addColorStop(0.28, rgba(C.fire4, 0.7 * fire * fl)); fg.addColorStop(0.6, rgba(C.fire3, 0.35 * fire)); fg.addColorStop(1, rgba(C.fire2, 0));
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, r * (0.8 + fire * 0.25), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export const s04 = {
  id: 'p5-04-nozzles',
  start: 661.45, end: 665.65,
  transition: { type: 'iris', dur: 0.45, center: [1440 / 1920, 1 - 250 / 1080], feather: 0.06 },
  post: (t) => ({ bloom: 0.22 + 0.2 * tw(t, 2.6, 3.0), bloomThreshold: 0.8, vignette: 0.5, saturation: 1.05 }),
  render(ctx, t) {
    const T0 = 661.45;
    const roar = tw(t, 664.15 - T0, 664.5 - T0, E.out);
    const hh = handheld(t, 2 + roar * 6, 0.5 + roar, 41);
    const sk = shake(t, 664.2 - T0, 18, 2.5, 20, 4);
    pooledBg(ctx, '#121820', { cx: 960, cy: 540, light: 0.1, dark: 0.7 });
    ctx.save();
    applyCam(ctx, { x: hh.x + sk.x, y: hh.y + sk.y, r: hh.r + sk.r });
    const z = 0.92 + t * 0.035 + roar * 0.04;
    const rot = -0.25 + t * 0.06;
    const cx = 1180, cy = 560;
    ctx.translate(cx, cy); ctx.scale(z, z); ctx.rotate(rot);
    // ignition order: core 4 first, then boosters clockwise
    const order = [];
    for (let i = 0; i < 4; i++) order.push({ b: -1, i });
    for (let b = 0; b < 4; b++) for (let i = 0; i < 4; i++) order.push({ b, i });
    const igniteAt = (k) => 661.84 - T0 + k * 0.1;
    const fireOf = (k) => tw(t, igniteAt(k), igniteAt(k) + 0.25, E.out) * (0.75 + 0.25 * roar);
    // boosters: conical bases around the core (cross layout)
    const BR = 190, BD = 300;
    for (let b = 0; b < 4; b++) {
      const a = b * Math.PI / 2;
      const bx = Math.cos(a) * BD, by = Math.sin(a) * BD;
      ctx.save();
      ctx.beginPath(); ctx.arc(bx, by, BR, 0, TAU);
      const g = ctx.createRadialGradient(bx - 60, by - 60, 10, bx, by, BR);
      g.addColorStop(0, '#9EA3A2'); g.addColorStop(0.7, '#5E6466'); g.addColorStop(1, '#2C3033');
      ctx.fillStyle = g; ctx.fill();
      texturePath(ctx, tex.metal('#B9C0C2', { seed: 6 + b }), { alpha: 0.35 });
      ctx.strokeStyle = 'rgba(10,12,14,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by, BR, 0, TAU); ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        const na = a + Math.PI / 4 + i * Math.PI / 2;
        const k = 4 + b * 4 + i;
        nozzleBell(ctx, bx + Math.cos(na) * 78, by + Math.sin(na) * 78, 66, fireOf(k), t, k);
      }
      // verniers
      for (const sd of [-1, 1]) nozzleBell(ctx, bx + Math.cos(a + sd * 1.25) * 160, by + Math.sin(a + sd * 1.25) * 160, 22, fireOf(4 + b * 4) * 0.6, t, b * 9 + sd);
    }
    // core
    ctx.beginPath(); ctx.arc(0, 0, 175, 0, TAU);
    const cg = ctx.createRadialGradient(-50, -50, 10, 0, 0, 175);
    cg.addColorStop(0, '#A9AEAD'); cg.addColorStop(0.7, '#62686A'); cg.addColorStop(1, '#2A2E31');
    ctx.fillStyle = cg; ctx.fill();
    for (let i = 0; i < 4; i++) { const na = Math.PI / 4 + i * Math.PI / 2; nozzleBell(ctx, Math.cos(na) * 76, Math.sin(na) * 76, 66, fireOf(i), t, i); }
    for (let i = 0; i < 4; i++) { const na = i * Math.PI / 2; nozzleBell(ctx, Math.cos(na) * 140, Math.sin(na) * 140, 20, fireOf(i) * 0.6, t, 50 + i); }
    // stage rings (thin ink) appear for labels
    const lab = tw(t, 662.9 - T0, 663.5 - T0, E.out);
    ctx.strokeStyle = rgba(C.cream, 0.55 * lab); ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.arc(0, 0, 200, 0, TAU * lab); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, BD + BR + 30, 0, TAU * lab); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // roar flash bloom
    if (roar > 0) glow(ctx, cx, cy, 800, C.fire3, 0.16 * roar);
    // hero number 20 + labels
    const nT = t - (661.84 - T0);
    if (nT > 0) {
      ctx.save();
      const k = E.out(clamp(nT / 0.5));
      ctx.globalAlpha = clamp(nT * 4);
      setText(ctx, { family: F.DISPLAY, size: 300, weight: 800, color: C.cream, align: 'left', baseline: 'alphabetic', tracking: -10 });
      ctx.translate(140, 470 + (1 - k) * 40);
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40;
      // count up as engines ignite
      let lit = 0; for (let i = 0; i < 20; i++) if (t >= igniteAt(i) + 0.05) lit++;
      const shown = Math.max(1, lit);
      ctx.fillText(String(shown).padStart(2, '0'), 0, 0);
      ctx.restore();
      staggerText(ctx, 'ENGINES', 150, 560, nT - 0.25, { family: F.COND, size: 70, weight: 800, color: C.orange, tracking: 12, stagger: 0.03, dur: 0.4 });
    }
    tag(ctx, t - (662.92 - T0), 170, 680, 'STAGE 1 · BOOSTERS', { size: 24, align: 'left' });
    tag(ctx, t - (663.42 - T0), 170, 730, 'STAGE 2 · CORE', { size: 24, align: 'left' });
    tunnel(ctx, 0.25);
  },
};

// ── the flame trench: side section of the pad ─────────────────────────────
// World = screen at the end framing. Camera pulls out & tilts down following the flame.
export const s05 = {
  id: 'p5-05-trench',
  start: 665.65, end: 669.50,
  transition: { type: 'flash', dur: 0.35, color: [1, 0.86, 0.62] },
  post: { bloom: 0.3, bloomThreshold: 0.8, vignette: 0.42, saturation: 1.02, contrast: 1.06 },
  render(ctx, t) {
    const T0 = 665.65;
    const GY = 360;
    const hh = handheld(t, 4, 0.9, 51);
    const zoom = kf(t, [[0, 1.75], [1.4, 1.6, E.out], [3.2, 1.0, E.cam], [3.85, 0.98]]);
    const fx = kf(t, [[0, 520], [1.4, 540], [3.2, 960, E.cam], [3.85, 960]]);
    const fy = kf(t, [[0, 300], [1.4, 360], [3.2, 540, E.cam], [3.85, 545]]);
    const surge = tw(t, 667.28 - T0, 667.9 - T0, E.out);
    // dusty sky
    skyBg(ctx, 0.04);
    ctx.save();
    ctx.translate(W / 2 + hh.x, H / 2 + hh.y); ctx.rotate(hh.r); ctx.scale(zoom, zoom); ctx.translate(-fx, -fy);
    // far steppe band
    ctx.fillStyle = '#A8957A'; ctx.fillRect(-2000, GY - 40, 6000, 60);
    ctx.fillStyle = 'rgba(90,78,62,.5)'; for (let i = 0; i < 14; i++) ctx.fillRect(-1600 + i * 420, GY - 46, 160 + (i % 3) * 60, 8);
    // section: ground mass with trench cut out
    const traceTrench = (p) => {
      p.lineTo(330, GY); p.lineTo(330, GY + 170);
      p.bezierCurveTo(340, GY + 470, 520, GY + 560, 900, GY + 560);
      p.lineTo(1450, GY + 470);
      p.bezierCurveTo(1640, GY + 420, 1760, GY + 200, 1800, GY);
    };
    const trench = new Path2D(); trench.moveTo(330, GY); traceTrench(trench);
    const ground = new Path2D();
    ground.moveTo(-2000, GY); traceTrench(ground); ground.lineTo(4000, GY); ground.lineTo(4000, 3000); ground.lineTo(-2000, 3000); ground.closePath();
    ctx.save();
    ctx.fillStyle = '#6F6A61'; ctx.fill(ground);
    ctx.clip(ground);
    fillTexture(ctx, tex.concrete('#8C877D'), { x: -2000, y: GY, w: 6000, h: 3000, alpha: 0.9 });
    ctx.strokeStyle = 'rgba(30,27,22,.22)'; ctx.lineWidth = 2;
    for (let i = -80; i < 80; i++) { ctx.beginPath(); ctx.moveTo(i * 46, GY + 8); ctx.lineTo(i * 46 + 260, GY + 268); ctx.stroke(); }
    // darker deep earth under text area
    const dg = ctx.createLinearGradient(0, GY, 0, GY + 700);
    dg.addColorStop(0, 'rgba(20,18,15,0)'); dg.addColorStop(1, 'rgba(20,18,15,.55)');
    ctx.fillStyle = dg; ctx.fillRect(-2000, GY, 6000, 3000);
    ctx.restore();
    // trench inner walls (glowing with fire)
    ctx.save();
    const inner = new Path2D(); inner.moveTo(330, GY); traceTrench(inner); inner.closePath();
    ctx.fillStyle = '#2B231C'; ctx.fill(inner);
    ctx.clip(inner);
    const ig = ctx.createLinearGradient(330, 0, 1800, 0);
    ig.addColorStop(0, rgba(C.fire2, 0.55)); ig.addColorStop(0.6, rgba(C.fire1, 0.4)); ig.addColorStop(1, rgba(C.fire0, 0.3));
    ctx.fillStyle = ig; ctx.fillRect(300, GY, 1600, 700);
    ctx.restore();
    ctx.strokeStyle = '#1F1C18'; ctx.lineWidth = 7; ctx.stroke(trench);
    ctx.beginPath(); ctx.moveTo(-2000, GY); ctx.lineTo(330, GY); ctx.moveTo(1800, GY); ctx.lineTo(4000, GY); ctx.stroke();
    // launch table + support arms
    ctx.fillStyle = '#34383D'; ctx.fillRect(250, GY - 30, 470, 30);
    for (const sx of [215, 700]) {
      ctx.fillStyle = '#24272B'; ctx.fillRect(sx, -600, 42, GY - 30 + 600);
      ctx.strokeStyle = '#3B4046'; ctx.lineWidth = 4;
      for (let k = -600; k < GY - 60; k += 70) { ctx.beginPath(); ctx.moveTo(sx, k); ctx.lineTo(sx + 42, k + 70); ctx.stroke(); }
    }
    // rocket lower body (boosters + core skirt), nozzles over the pit
    const NY = GY + 24;
    const bodies = [[340, 150, '#ADAFA9'], [600, 150, '#A2A49F'], [470, 175, '#D4D4CD']];
    for (const [bx, bw, col] of bodies) {
      ctx.beginPath(); ctx.moveTo(bx - bw / 2 + 8, -900); ctx.lineTo(bx + bw / 2 - 8, -900); ctx.lineTo(bx + bw / 2, NY - 70); ctx.lineTo(bx - bw / 2, NY - 70); ctx.closePath();
      const g = ctx.createLinearGradient(bx - bw / 2, 0, bx + bw / 2, 0);
      g.addColorStop(0, shade(col, -0.4)); g.addColorStop(0.32, shade(col, 0.18)); g.addColorStop(1, shade(col, -0.5));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(30,34,40,.35)'; ctx.lineWidth = 2;
      for (const yy of [NY - 260, NY - 520]) { ctx.beginPath(); ctx.moveTo(bx - bw / 2, yy); ctx.lineTo(bx + bw / 2, yy); ctx.stroke(); }
      for (const nx of [-0.25, 0.25]) {
        ctx.beginPath(); ctx.moveTo(bx + nx * bw - 16, NY - 70); ctx.lineTo(bx + nx * bw + 16, NY - 70); ctx.lineTo(bx + nx * bw + 34, NY); ctx.lineTo(bx + nx * bw - 34, NY); ctx.closePath();
        const ng = ctx.createLinearGradient(bx + nx * bw - 34, 0, bx + nx * bw + 34, 0);
        ng.addColorStop(0, '#26282B'); ng.addColorStop(0.4, '#6A6E72'); ng.addColorStop(1, '#1C1E20');
        ctx.fillStyle = ng; ctx.fill();
      }
    }
    // flame columns into the pit
    const len = 360 + surge * 120;
    for (const [bx, bw] of bodies) for (const nx of [-0.25, 0.25]) {
      flame(ctx, bx + nx * bw, NY, Math.PI / 2 + 0.05, len, 78, t, { seed: bx + nx * 10, diamonds: 0.5, alpha: 0.9 });
    }
    // river of fire along the trench floor → exit
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const u = i / 13;
      const prog = clamp((t - 0.2) * 0.9 - u * 0.6 + surge * 0.6);
      if (prog <= 0) continue;
      const px = lerp(520, 1760, u) + noise.n2(i * 1.7, t * 3) * 25;
      const py = u < 0.25 ? lerp(GY + 420, GY + 530, u / 0.25) : u < 0.75 ? GY + 510 - (u - 0.25) * 60 : lerp(GY + 480, GY + 60, (u - 0.75) / 0.25);
      const rr = lerp(150, 230, u) * prog;
      const fl = 0.75 + 0.25 * noise.n2(i, t * 9);
      const fg = ctx.createRadialGradient(px, py, 0, px, py, rr);
      fg.addColorStop(0, rgba(C.fire4, 0.4 * fl)); fg.addColorStop(0.45, rgba(C.fire3, 0.24 * fl)); fg.addColorStop(1, rgba(C.fire2, 0));
      ctx.fillStyle = fg; ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    ctx.restore();
    // billows out of the trench mouth (right) and steam around the pad
    billows(ctx, t + 3, { x: 1760, y: GY - 20, count: 24, seed: 7, spread: 380, rise: 75, size: [220, 520], life: 5, lit: '#F4E7D8', dark: '#857668', warm: '#FF8A3A', dirX: 0.35, alpha: 0.9 * clamp(t * 0.8 + 0.3) });
    billows(ctx, t + 1, { x: 470, y: GY - 10, count: 16, seed: 9, spread: 760, rise: 32, size: [160, 380], life: 6, lit: '#F2E6D6', dark: '#958676', warm: '#FF9A4A', dirX: 0.1, alpha: 0.7 });
    // fire light
    glow(ctx, 470, GY + 260, 700, C.fire3, 0.22 + 0.1 * surge);
    ctx.restore();
    // type: over the concrete, bottom-left
    leadKey(ctx, t - (665.75 - T0), 140, 950, { lead: 'thousands of tons of', key: 'FLAME', size: 150, align: 'left', color: C.cream, keyColor: C.cream, keyAt: 1.2, out: 3.4 });
    const tpx = W / 2 + (1120 - fx) * zoom, tpy = H / 2 + (GY + 600 - fy) * zoom;
    tag(ctx, t - (668.62 - T0), tpx, tpy, 'FLAME TRENCH', { size: 26, align: 'left', color: C.cream });
    tunnel(ctx, 0.2);
  },
};
