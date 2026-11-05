// 17.42–30.22 · Romantic space poster (LET'S GO) → torn → ICBM blueprint → ARMS RACE
import { clamp, lerp, E, tw, kf, rng, noise, TAU, handheld, catmull, polyAt } from '../../../core/math.js';
import { C, rgba, shade, mixColor } from '../../../core/palette.js';
import { F, setText, staggerText } from '../../../core/type.js';
import { tex, glow, scratchCanvas, inkLine } from '../../../core/draw.js';
import { leadKey } from '../../../core/components.js';
import { blueprintSheet, drawSheet, bpRocket, dimLine, sparkle, tearLine, slideWord, tag, env, W, H } from '../lib.js';

const ICBM = {
  // side elevation of a two-stage missile, tail at x=0 → nose at +x (px)
  profile: [[0, 62], [520, 62], [540, 56], [560, 56], [900, 56], [915, 50], [1060, 50], [1150, 48], [1230, 40], [1300, 26], [1350, 12], [1372, 0]],
  joints: [540, 900, 1060],
  tanks: [[30, 250, 'FUEL'], [270, 510, 'OXIDIZER'], [575, 880, 'STAGE II']],
  nose: 1060,
  bells: [{ y: -30, r0: 18, r1: 26, len: 46 }, { y: 30, r0: 18, r1: 26, len: 46 }],
  fins: { x0: 10, x1: 120, sweep: 30, span: 46 },
};
const RX = 200, RY = 620, RS = 1.15; // rocket placement on the sheet (tail), scale
const NOSE = { x: RX + 1300 * RS, y: RY };

function rocketGlyph(c, x, y, ang, s) {
  // stylised poster Vostok: cream body, red bands, flared boosters, orange flame
  c.save();
  c.translate(x, y); c.rotate(ang); c.scale(s, s);
  // flame
  const fg = c.createLinearGradient(-150, 0, -60, 0);
  fg.addColorStop(0, 'rgba(242,107,29,0)'); fg.addColorStop(0.5, 'rgba(255,165,58,.9)'); fg.addColorStop(1, '#FFE3A1');
  c.fillStyle = fg;
  c.beginPath(); c.moveTo(-60, -16); c.quadraticCurveTo(-130, -8, -170, 0); c.quadraticCurveTo(-130, 8, -60, 16); c.closePath(); c.fill();
  // boosters
  c.fillStyle = '#E9DCC0';
  for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(-62, s2 * 8); c.lineTo(-62, s2 * 26); c.lineTo(10, s2 * 14); c.lineTo(20, s2 * 8); c.closePath(); c.fill(); }
  // core
  const g = c.createLinearGradient(0, -14, 0, 14);
  g.addColorStop(0, '#FFF6E2'); g.addColorStop(0.55, '#EADCBE'); g.addColorStop(1, '#B9A882');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-64, -12); c.lineTo(70, -12); c.quadraticCurveTo(108, -10, 128, 0); c.quadraticCurveTo(108, 10, 70, 12); c.lineTo(-64, 12); c.closePath(); c.fill();
  c.fillStyle = C.red;
  c.fillRect(-30, -12, 10, 24); c.fillRect(40, -12, 6, 24);
  c.beginPath(); c.moveTo(96, -9); c.quadraticCurveTo(112, -6, 128, 0); c.quadraticCurveTo(112, 6, 96, 9); c.closePath(); c.fill();
  c.restore();
}

function drawPoster(c, T) {
  const build = (a, b) => tw(T, a, b, E.out);
  const push = tw(T, 17.4, 23.5, E.inOutSine);
  // L0 sky
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1C3550'); sky.addColorStop(0.45, '#7A4E5E'); sky.addColorStop(0.72, '#D9775A'); sky.addColorStop(1, '#F2B27A');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  // halftone sky dots
  c.save();
  c.globalAlpha = 0.18;
  c.fillStyle = c.createPattern(tex.halftoneDots(9, '#10223A', { size: 0.34 }), 'repeat');
  const hg = c.createLinearGradient(0, 0, 0, 700);
  c.fillRect(0, 0, W, 520);
  c.restore();
  // L1 stars (from the ash)
  const r = rng(31);
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = r() * 560, s = 3 + Math.pow(r(), 3) * 14, ph = r() * 9;
    const a = build(17.42 + r() * 0.8, 18.2 + r() * 0.8) * (0.6 + 0.4 * Math.sin(T * 2.2 + ph));
    sparkle(c, x - push * 10, y - push * 6, s, '#FFF1D6', a);
  }
  // sunburst rays
  const sx = 1390 - push * 18, sy = 620 - push * 10;
  const sunA = build(17.7, 18.9);
  c.save();
  c.translate(sx, sy); c.rotate(T * 0.04);
  c.globalAlpha = 0.16 * sunA;
  c.fillStyle = '#FFE9C2';
  for (let i = 0; i < 24; i += 2) { const a0 = (i / 24) * TAU, a1 = ((i + 1) / 24) * TAU; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 1500, a0, a1); c.closePath(); c.fill(); }
  c.restore();
  // L2 sun disc (paper cut, shadow)
  c.save();
  c.shadowColor = 'rgba(60,20,10,.35)'; c.shadowBlur = 24; c.shadowOffsetX = 8; c.shadowOffsetY = 12;
  const sr = 270 * E.outBack(clamp((T - 17.7) / 1.0));
  if (sr > 1) {
    c.fillStyle = '#F7E2B4'; c.beginPath(); c.arc(sx, sy + (1 - sunA) * 200, sr, 0, TAU); c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = 'rgba(214,120,70,.35)'; c.lineWidth = 3;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.arc(sx, sy + (1 - sunA) * 200, sr * (1 - k * 0.18), 0, TAU); c.stroke(); }
  }
  c.restore();
  // L3 planet limb (paper cut)
  const pA = build(17.9, 19.0);
  const px = 620 - push * 30, py = 2050 + (1 - pA) * 400 - push * 14;
  c.save();
  c.shadowColor = 'rgba(30,10,10,.4)'; c.shadowBlur = 30; c.shadowOffsetX = 6; c.shadowOffsetY = -10;
  c.fillStyle = '#1D4D5C'; c.beginPath(); c.arc(px, py, 1200, 0, TAU); c.fill();
  c.restore();
  c.save();
  c.beginPath(); c.arc(px, py, 1200, 0, TAU); c.clip();
  c.globalAlpha = 0.3; c.fillStyle = c.createPattern(tex.halftoneDots(8, '#0B2730', { size: 0.4 }), 'repeat'); c.fillRect(0, 0, W, H);
  c.globalAlpha = 1;
  c.strokeStyle = 'rgba(244,235,214,.25)'; c.lineWidth = 2;
  for (let k = 1; k < 5; k++) { c.beginPath(); c.ellipse(px, py, 1200, 1200 * (0.2 * k), 0, 0, TAU); c.stroke(); }
  c.restore();
  c.strokeStyle = '#F4EBD6'; c.lineWidth = 4; c.beginPath(); c.arc(px, py, 1200, 0, TAU); c.stroke();
  // L4 trail ribbon + rocket (the trajectory motif, romantic version)
  const trail = catmull([[180, 1120], [520, 860], [900, 560], [1200, 330], [1420, 200]], 14);
  const tp = tw(T, 18.2, 19.9, E.inOutCubic);
  if (tp > 0) {
    c.save();
    c.shadowColor = 'rgba(40,10,10,.35)'; c.shadowBlur = 16; c.shadowOffsetX = 6; c.shadowOffsetY = 10;
    const n = Math.floor(trail.length * tp);
    for (let i = 1; i < n; i++) {
      const u = i / trail.length;
      c.strokeStyle = `rgba(250,243,228,${0.25 + 0.75 * u})`;
      c.lineWidth = lerp(6, 34, u);
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(trail[i - 1][0] - push * 20, trail[i - 1][1] - push * 12); c.lineTo(trail[i][0] - push * 20, trail[i][1] - push * 12); c.stroke();
    }
    c.restore();
    const head = polyAt(trail, tp);
    rocketGlyph(c, head.x - push * 20, head.y - push * 12, head.a, 1.25);
  }
  // L5 title: LET'S GO / ПОЕХАЛИ!
  const ta = tw(T, 20.6, 21.3);
  if (ta > 0) {
    c.save();
    setText(c, { family: F.DISPLAY, size: 64, weight: 900, color: C.red, align: 'left', tracking: 8 });
    c.globalAlpha = tw(T, 20.6, 20.9);
    c.fillText('ПОЕХАЛИ!', 150 - push * 30, 720 + (1 - ta) * 30);
    // misregistered print: red under-layer then cream
    setText(c, { family: F.DISPLAY, size: 176, weight: 900, color: C.red, align: 'left', tracking: -4 });
    c.globalAlpha = 0.9 * ta;
    c.fillText('LET’S GO', 150 + 7 - push * 34, 900 + 6 + (1 - ta) * 60);
    c.fillStyle = '#FBF2DE';
    c.globalAlpha = ta;
    c.fillText('LET’S GO', 150 - push * 34, 900 + (1 - ta) * 60);
    c.restore();
  }
  // print header strip
  setText(c, { family: F.MONO, size: 20, weight: 500, color: 'rgba(251,242,222,.75)', align: 'left', tracking: 6 });
  c.globalAlpha = tw(T, 18.0, 18.6);
  c.fillText('THE SPACE RACE', 154, 140);
  c.fillRect(154, 156, 220 * tw(T, 18.2, 19), 2);
  c.globalAlpha = 1;
  // paper: grain, fold creases, wear
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.drawImage(tex.paper('#F1E6CC', { seed: 12 }), 0, 0, W, H);
  c.restore();
  c.fillStyle = 'rgba(255,248,232,.07)'; c.fillRect(958, 0, 3, H); c.fillRect(0, 538, W, 3);
  c.fillStyle = 'rgba(40,20,10,.08)'; c.fillRect(961, 0, 2, H); c.fillRect(0, 541, W, 2);
}

export default {
  id: 'p1-02-poster',
  start: 17.42, end: 30.22,
  transition: { type: 'lumaWipe', dur: 1.0 },
  post: (t, S) => {
    const T = S.abs;
    const k = tw(T, 23.6, 25.2);
    return { saturation: lerp(1.05, 0.9, k), contrast: 1.05, highTint: [lerp(0.08, 0.02, k), lerp(0.04, 0.03, k), 0], vignette: 0.34, grain: 0.06, bloom: 0.15 + 0.25 * tw(T, 27.5, 29.5) };
  },
  init(S) {
    S.state.tear = tearLine(1030, -40, 880, 1120, { n: 90, amp: 22, fine: 5, seed: 17 });
  },
  render(ctx, t, S) {
    const T = S.abs;
    const tear = S.state.tear;
    // ── camera for the blueprint (push toward the warhead) ──
    const hh = handheld(T, 2.5, 0.35, 4);
    const z = kf(T, [[24.0, 1.12], [26.0, 1.0, E.out], [28.0, 1.04], [30.9, 2.6, E.inCubic]]);
    const fx = kf(T, [[24.0, 960], [28.0, 980], [30.9, NOSE.x - 60, E.inOutCubic]]);
    const fy = kf(T, [[24.0, 560], [28.0, 560], [30.9, NOSE.y, E.inOutCubic]]);

    // ── underneath: the ICBM blueprint ──
    if (T > 22.9) {
      const sheet = blueprintSheet(C.blueprint, C.blueprintLine, { w: 2600, h: 1600, grid: 40, seed: 5 });
      ctx.save();
      ctx.translate(960 + hh.x, 540 + hh.y); ctx.scale(z, z); ctx.translate(-fx, -fy);
      ctx.drawImage(sheet, 960 - 1300, 540 - 800);
      const draw = tw(T, 23.2, 25.6, E.inOutCubic);
      const hot = 0.5 + 0.5 * Math.sin(T * 5) * tw(T, 27.2, 28.2);
      ctx.save(); ctx.translate(RX, RY); ctx.scale(RS, RS);
      bpRocket(ctx, ICBM, { p: draw, hot: tw(T, 27.3, 29.4) * (0.7 + 0.3 * hot), labelSize: 16 });
      ctx.restore();
      // dimension lines + section marks
      dimLine(ctx, RX, RY + 160, RX + 1372 * RS, RY + 160, 'OVERALL LENGTH', tw(T, 24.6, 25.6), { size: 15 });
      dimLine(ctx, RX + 1060 * RS, RY - 130, RX + 1372 * RS, RY - 130, 'WARHEAD', tw(T, 25.0, 26.0), { size: 15, color: '#FF8F7A' });
      ctx.strokeStyle = rgba(C.blueprintLine, 0.5); ctx.lineWidth = 1;
      for (const xx of [RX + 1060 * RS, RX + 1372 * RS]) { ctx.beginPath(); ctx.moveTo(xx, RY - 140); ctx.lineTo(xx, RY - 64); ctx.stroke(); }
      // section A-A (cross-section view)
      const sa = tw(T, 24.9, 26.0);
      if (sa > 0) {
        ctx.save(); ctx.globalAlpha = sa;
        const scx = 430, scy = 880;
        ctx.strokeStyle = C.blueprintLine; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(scx, scy, 72 * sa, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(scx, scy, 60 * sa, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(scx - 95, scy); ctx.lineTo(scx + 95, scy); ctx.moveTo(scx, scy - 95); ctx.lineTo(scx, scy + 95); ctx.strokeStyle = rgba(C.blueprintLine, 0.45); ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.arc(scx, scy, 72, 0, TAU); ctx.arc(scx, scy, 60, 0, TAU, true); ctx.clip();
        ctx.strokeStyle = rgba(C.blueprintLine, 0.7); ctx.beginPath(); for (let k = -100; k < 100; k += 6) { ctx.moveTo(scx + k - 80, scy - 80); ctx.lineTo(scx + k + 80, scy + 80); } ctx.stroke(); ctx.restore();
        setText(ctx, { family: F.MONO, size: 15, weight: 500, color: rgba(C.blueprintLine, 0.9), align: 'center', tracking: 3 });
        ctx.fillText('SECTION A–A', scx, scy + 112);
        // section cut marks on the body
        const ax = RX + 300 * RS;
        ctx.strokeStyle = C.blueprintLine; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ax, RY - 100); ctx.lineTo(ax, RY - 80); ctx.moveTo(ax, RY + 80); ctx.lineTo(ax, RY + 100); ctx.stroke();
        setText(ctx, { family: F.MONO, size: 15, weight: 600, color: C.blueprintLine, align: 'center' });
        ctx.fillText('A', ax + 14, RY - 104); ctx.fillText('A', ax + 14, RY + 116);
        ctx.restore();
      }
      // title block
      const tb = tw(T, 24.8, 25.8);
      if (tb > 0) {
        ctx.save(); ctx.globalAlpha = tb;
        ctx.strokeStyle = rgba(C.blueprintLine, 0.7); ctx.lineWidth = 1.5;
        ctx.strokeRect(1380, 820, 420, 140); ctx.beginPath(); ctx.moveTo(1380, 870); ctx.lineTo(1800, 870); ctx.moveTo(1590, 870); ctx.lineTo(1590, 960); ctx.stroke();
        setText(ctx, { family: F.MONO, size: 15, weight: 500, color: rgba(C.blueprintLine, 0.9), tracking: 3 });
        ctx.fillText('ICBM · GENERAL ARRANGEMENT', 1398, 852);
        ctx.fillText('SHEET 1', 1398, 920); ctx.fillText('SECRET', 1608, 920);
        ctx.restore();
      }
      // warhead heat glow
      const hg = tw(T, 27.3, 29.4);
      if (hg > 0) glow(ctx, NOSE.x - 80, NOSE.y, 220, C.red, 0.35 * hg * (0.8 + 0.2 * Math.sin(T * 6)));
      ctx.restore();
      // ARMS RACE
      const o = tw(T, 28.9, 29.4, E.in);
      if (o < 1) {
        ctx.save(); ctx.globalAlpha = 1 - o;
        ctx.shadowColor = 'rgba(4,12,24,.6)'; ctx.shadowBlur = 24;
        leadKey(ctx, T - 25.78, 960, 330, { lead: 'it was an', key: 'ARMS RACE', size: 190, keyAt: 0.85, color: C.cream });
        ctx.shadowBlur = 0;
        ctx.fillStyle = C.red; ctx.fillRect(960 - 330 * tw(T, 26.9, 27.5), 360, 660 * tw(T, 26.9, 27.5), 7);
        ctx.restore();
      }
    }

    // ── the poster on top (whole, then torn into two pieces) ──
    const gone = tw(T, 24.06, 25.3, E.inCubic);
    if (gone >= 1) return;
    const pc = scratchCanvas('p1poster');
    drawPoster(pc.ctx, T);
    // subtle push on the whole poster
    const pz = 1 + tw(T, 17.4, 24.0, E.inOutSine) * 0.035;
    const u = tw(T, 22.98, 24.1, E.inOutCubic); // tear progress top→bottom
    const pivotIdx = Math.max(1, Math.floor(u * (tear.length - 1)));
    const pv = tear[pivotIdx];
    const pieces = [
      { side: -1, poly: [[-60, -60], ...tear, [-60, H + 60]] },
      { side: 1, poly: [[W + 60, -60], ...tear, [W + 60, H + 60]] },
    ];
    for (const pcs of pieces) {
      const s = pcs.side;
      const theta = s * (0.035 * u + 0.5 * gone) ;
      const dx = s * (gone * 1300), dy = gone * 260 - (1 - gone) * 0;
      ctx.save();
      ctx.translate(960, 540); ctx.scale(pz, pz); ctx.translate(-960, -540);
      ctx.translate(dx, dy);
      ctx.translate(pv[0], pv[1]); ctx.rotate(-theta); ctx.translate(-pv[0], -pv[1]);
      ctx.beginPath();
      pcs.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.save();
      if (u > 0) { ctx.shadowColor = 'rgba(4,10,20,.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = s * 10; ctx.shadowOffsetY = 18; }
      ctx.fillStyle = ctx.createPattern(pc.c, 'no-repeat');
      ctx.fill();
      ctx.restore();
      // torn fibrous edge (paper core shows white)
      if (u > 0) {
        const n = gone > 0 ? tear.length : pivotIdx + 1;
        ctx.strokeStyle = '#F6EEDC'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const [x, y] = tear[i]; i ? ctx.lineTo(x + s * 2, y) : ctx.moveTo(x + s * 2, y); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(246,238,220,.8)'; ctx.lineWidth = 1;
        const fr = rng(5 + s);
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const [x, y] = tear[i]; const l = fr() * 7; ctx.moveTo(x, y + fr() * 6); ctx.lineTo(x + s * l, y + fr() * 8); }
        ctx.stroke();
      }
      ctx.restore();
    }
  },
};
