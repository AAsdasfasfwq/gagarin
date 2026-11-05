// S02 · 164.55–173.55 · the safety rules on a tilted site map: DRAIN · REMOVE · SEND TO MIK
// S03 · 173.55–177.30 · the ink path becomes a calendar: WEEKS vs the red NOV 7 page
import { E, tw, kf, clamp, lerp, handheld, rng, catmull, polyAt, polyLength, noise } from '../../../core/math.js';
import { C, rgba, shade, mixColor } from '../../../core/palette.js';
import { glow, pooledBg, paperCard, texturePath, tex, fillTexture, W, H } from '../../../core/draw.js';
import { F, text, staggerText, maskRise } from '../../../core/type.js';
import { leadKey, trajectory } from '../../../core/components.js';
import { groundProj, projPath, drawR16, monoTag, NIGHT, UDMH, NITRIC, vignette, motes } from '../lib.js';

// world layout (map units)
const PAD = [0, 0];
const MIK = [1480, -900];
const RAIL = catmull([[0, 30], [160, 70], [520, -30], [900, -330], [1220, -660], [1400, -840], [1470, -905]], 14);
const TANKS = [[-300, 150], [-300, 300]];

function mapGround(ctx, proj, t, { x0 = -900, x1 = 2400, y0 = -1700, y1 = 900 } = {}) {
  pooledBg(ctx, '#0F1A2C', { cx: 900, cy: 560, r: 1200, light: 0.1, dark: 0.45 });
  ctx.save();
  // ground tone patches (steppe)
  ctx.globalAlpha = 0.5;
  fillTexture(ctx, tex.grit(2.5, { seed: 7, alpha: 40 }), { op: 'overlay' });
  ctx.globalAlpha = 1;
  // survey grid
  ctx.lineWidth = 1;
  for (let x = Math.ceil(x0 / 100) * 100; x <= x1; x += 100) {
    ctx.strokeStyle = rgba(C.blueprintLine, x % 500 === 0 ? 0.16 : 0.07);
    projPath(ctx, proj, [[x, y0], [x, y1]]); ctx.stroke();
  }
  for (let y = Math.ceil(y0 / 100) * 100; y <= y1; y += 100) {
    ctx.strokeStyle = rgba(C.blueprintLine, y % 500 === 0 ? 0.16 : 0.07);
    projPath(ctx, proj, [[x0, y], [x1, y]]); ctx.stroke();
  }
  ctx.restore();
}
// projected prism (building): footprint rect + height
function prism(ctx, proj, x, y, w, d, h, tilt, { fill = '#1B2A40', top = '#26405E', line = C.blueprintLine, alpha = 1 } = {}) {
  const st = Math.sin(tilt);
  const P = (X, Y, Z = 0) => { const p = proj(X, Y); return [p.x, p.y - Z * p.s * st]; };
  const f = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';
  // visible side faces (south & east)
  const faces = [[f[3], f[2]], [f[1], f[2]]];
  faces.forEach(([a, b], i) => {
    ctx.beginPath();
    const A0 = P(...a), B0 = P(...b), A1 = P(a[0], a[1], h), B1 = P(b[0], b[1], h);
    ctx.moveTo(...A0); ctx.lineTo(...B0); ctx.lineTo(...B1); ctx.lineTo(...A1); ctx.closePath();
    ctx.fillStyle = shade(fill, i ? -0.25 : 0); ctx.fill();
    ctx.strokeStyle = rgba(line, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
  });
  ctx.beginPath(); f.forEach((q, i) => { const p = P(q[0], q[1], h); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }); ctx.closePath();
  ctx.fillStyle = top; ctx.fill(); ctx.strokeStyle = rgba(line, 0.9); ctx.lineWidth = 1.8; ctx.stroke();
  ctx.restore();
}
function railTies(ctx, proj, pts, p = 1) {
  const L = polyLength(pts);
  ctx.save();
  ctx.strokeStyle = rgba(C.cream, 0.35); ctx.lineWidth = 1.4;
  for (let d = 0; d < L * p; d += 26) {
    const a = polyAt(pts, d / L);
    const nx = -Math.sin(a.a) * 16, ny = Math.cos(a.a) * 16;
    const p0 = proj(a.x + nx, a.y + ny), p1 = proj(a.x - nx, a.y - ny);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  ctx.restore();
}
function ruleLabel(ctx, t, n, word, x, y, { color = C.cream, accent = C.gold, size = 84 } = {}) {
  if (t <= 0) return;
  ctx.save();
  staggerText(ctx, n, x, y - size * 0.9, t, { family: F.MONO, size: 26, weight: 600, color: accent, tracking: 4, stagger: 0.04, dur: 0.3, mode: 'fade' });
  maskRise(ctx, word, x, y, tw(t, 0.05, 0.6, E.linear), { family: F.COND, size, weight: 800, color, tracking: 2 });
  ctx.restore();
}

export const s02 = {
  id: 'p2-02-rules', start: 164.55, end: 173.55,
  transition: { type: 'ink', dur: 0.75, center: [0.56, -0.04], seed: 3.1 },
  post: { bloom: 0.25, bloomThreshold: 0.8, vignette: 0.4, saturation: 0.95 },
  render(ctx, t, S) {
    const abs = 164.55 + t;
    const travel = tw(abs, 170.55, 173.2, E.cam);
    const hh = handheld(t, 2.5, 0.3, 11);
    const tilt = lerp(0.95, 0.82, travel);
    const camX = lerp(-40, 1380, travel), camY = lerp(-30, -820, travel);
    const zoom = kf(abs, [[164.55, 2.3], [166.4, 1.55, E.out], [170.55, 1.45], [173.2, 1.25, E.cam]]);
    const proj = groundProj({ cx: 960 + hh.x, cy: 600 + hh.y, tilt, D: 1500, f: 1300, camX, camY, rot: lerp(-0.12, 0.08, travel), zoom });
    mapGround(ctx, proj, t);
    // light pool at the pad
    const pp = proj(...PAD);
    glow(ctx, pp.x, pp.y, 260 * pp.s, '#FFD08A', 0.22, 'lighter');
    // pad apron
    ctx.save();
    projPath(ctx, proj, [[-90, -90], [90, -90], [90, 90], [-90, 90]], true);
    ctx.fillStyle = rgba('#3A4658', 0.7); ctx.fill(); ctx.strokeStyle = rgba(C.cream, 0.6); ctx.lineWidth = 1.5; ctx.stroke();
    projPath(ctx, proj, [[-22, 20], [22, 20], [22, 140], [-22, 140]], true); ctx.fillStyle = 'rgba(5,8,14,.8)'; ctx.fill();
    ctx.restore();
    monoTag(ctx, 'PAD 41', pp.x - 130 * pp.s, pp.y + 70 * pp.s, { size: 26, color: C.cream, alpha: tw(abs, 165.0, 165.6), p: tw(abs, 165.0, 165.7, E.linear), align: 'right' });
    // drain tanks + pipes
    const drain = tw(abs, 167.25, 169.0, E.inOutSine);
    TANKS.forEach(([x, y], i) => {
      const col = i ? NITRIC : UDMH;
      ctx.save();
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -abs * 60;
      ctx.strokeStyle = rgba(col, 0.25 + 0.65 * tw(abs, 167.3, 167.6) * (1 - tw(abs, 169.2, 169.8)));
      ctx.lineWidth = 3;
      projPath(ctx, proj, [[10, 30 + i * 20], [-120, 60 + i * 40], [x + 40, y]]); ctx.stroke();
      ctx.restore();
      const p = proj(x, y), rr = 46 * p.s, hh2 = 60 * p.s * Math.sin(tilt);
      ctx.save();
      ctx.fillStyle = '#1D2B3F'; ctx.strokeStyle = rgba(C.blueprintLine, 0.8); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rr, rr * Math.cos(tilt), 0, 0, Math.PI); ctx.lineTo(p.x - rr, p.y - hh2); ctx.ellipse(p.x, p.y - hh2, rr, rr * Math.cos(tilt), 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); ctx.stroke();
      // liquid level rising in storage
      ctx.globalCompositeOperation = 'lighter';
      const lv = drain * hh2 * 0.85;
      ctx.fillStyle = rgba(col, 0.35);
      ctx.fillRect(p.x - rr * 0.9, p.y - lv, rr * 1.8, lv);
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.ellipse(p.x, p.y - hh2, rr, rr * Math.cos(tilt), 0, 0, Math.PI * 2); ctx.fillStyle = '#2A3D57'; ctx.fill(); ctx.stroke();
      ctx.restore();
    });
    // rail line drawn as the trajectory ink-line
    const railP = tw(abs, 165.3, 167.0, E.inOut);
    railTies(ctx, proj, RAIL, railP);
    const railScr = RAIL.map(([x, y]) => { const p = proj(x, y); return [p.x, p.y]; });
    ctx.save(); ctx.globalAlpha = 0.45; trajectory(ctx, railScr, railP, { color: C.cream, width: 2, head: false, seed: 4 }); ctx.restore();
    // the trip: ink trail on the rail
    const trip = tw(abs, 170.7, 172.85, E.inOutCubic);
    if (trip > 0) trajectory(ctx, railScr, trip, { color: C.cream, width: 4.5, head: false, seed: 9, glowCol: C.gold });
    // MIK — assembly & testing building
    const mikA = tw(abs, 165.6, 166.6);
    prism(ctx, proj, MIK[0] - 60, MIK[1] - 200, 320, 160, 120, tilt, { alpha: mikA });
    const mp = proj(MIK[0] + 100, MIK[1] - 120);
    // door glows when the rocket arrives
    glow(ctx, mp.x - 40 * mp.s, mp.y + 40 * mp.s, 120 * mp.s, '#FFD08A', 0.4 * tw(abs, 172.4, 173.0), 'lighter');

    // the rocket: stands → drains → tips onto the carriage → rides the rail
    const tip = tw(abs, 169.25, 170.35, E.inOutCubic);
    const along = polyAt(RAIL, trip * 0.985);
    const pos = trip > 0 ? proj(along.x, along.y) : proj(PAD[0], PAD[1] + 20);
    const ahead = polyAt(RAIL, Math.min(1, trip * 0.985 + 0.02)), ap = proj(ahead.x, ahead.y);
    const railAng = Math.atan2(ap.y - pos.y, ap.x - pos.x);
    const h = 230 * pos.s * lerp(Math.sin(tilt), 1, tip) * 0.95;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    // carriage
    const carA = tw(abs, 168.9, 169.4);
    if (carA > 0) {
      ctx.save(); ctx.rotate(railAng); ctx.globalAlpha = carA;
      ctx.fillStyle = '#2B3A50'; ctx.strokeStyle = rgba(C.blueprintLine, 0.9); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(-h * 0.08, -8 * pos.s, h * 1.05, 16 * pos.s, 4); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // rotate from vertical (−90°) to lie along the rail direction (pointing back along the rail)
    const ang = lerp(0, railAng + Math.PI / 2 + Math.PI, tip);
    ctx.rotate(ang);
    drawR16(ctx, 0, 0, h, { light: 0.6, warm: '#FFC77A', warmAmt: 0.35, xray: 1, fill: { f1: 1 - drain, o1: 1 - drain * 1.05, f2: 1 - drain, o2: clamp(1 - drain * 1.1) } });
    ctx.restore();
    // rule labels
    const L1 = abs - 167.25, L2 = abs - 169.25, L3 = abs - 170.65;
    const out1 = tw(abs, 169.0, 169.3, E.in), out2 = tw(abs, 170.4, 170.7, E.in);
    ctx.save(); ctx.globalAlpha = 1 - out1; ruleLabel(ctx, L1, '01', 'DRAIN', 1180, 330, {}); ctx.restore();
    ctx.save(); ctx.globalAlpha = 1 - out2; ruleLabel(ctx, L2, '02', 'REMOVE', 1180, 330, {}); ctx.restore();
    if (L3 > 0) {
      ruleLabel(ctx, L3, '03', 'SEND FOR REPAIRS', 150, 860, { size: 74 });
      const lp = proj(MIK[0] + 100, MIK[1] - 200);
      monoTag(ctx, 'MIK · ASSEMBLY & TESTING', lp.x, lp.y - 140 * lp.s, { size: 26, align: 'center', p: tw(abs, 171.3, 172.0, E.linear) });
    }
    // lead: every safety rule
    leadKey(ctx, abs - 164.75, 150, 230, { lead: 'every', key: 'SAFETY RULE', size: 96, align: 'left', out: 2.3, color: C.cream });
    vignette(ctx, 0.35);
  },
};

// ── S03 · weeks vs the deadline ──────────────────────────────────────────────
const DAY = 64, X0 = 300; // OCT 23 at X0
const dayX = (d) => X0 + d * DAY;
export const s03 = {
  id: 'p2-03-weeks', start: 173.55, end: 177.3,
  transition: { type: 'push', dur: 0.55, dir: [-1, 0] },
  post: { bloom: 0.22, vignette: 0.42 },
  render(ctx, t, S) {
    const abs = 173.55 + t;
    const push = tw(abs, 175.6, 177.3, E.cam);
    const hh = handheld(t, 2.5, 0.4, 5);
    pooledBg(ctx, '#0F1A2C', { cx: 1100, cy: 520, light: 0.1, dark: 0.5 });
    ctx.save();
    // camera: slow pan right, then push toward the deadline page
    const z = lerp(1, 1.28, push);
    const fx = lerp(960, dayX(15) - 40, push);
    ctx.translate(960 + hh.x, 560 + hh.y); ctx.scale(z, z); ctx.translate(-fx - lerp(0, 0, push), -560);
    const yR = 640;
    // ruler: incoming ink line from the map
    ctx.strokeStyle = rgba(C.cream, 0.9); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-200, yR); ctx.lineTo(lerp(X0, dayX(24), tw(abs, 173.55, 174.5, E.out)), yR); ctx.stroke();
    // day ticks
    for (let d = 0; d <= 24; d++) {
      const a = tw(abs, 173.65 + d * 0.025, 173.95 + d * 0.025);
      if (a <= 0) continue;
      const big = d % 7 === 0;
      ctx.strokeStyle = rgba(C.cream, 0.7 * a); ctx.lineWidth = big ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(dayX(d), yR); ctx.lineTo(dayX(d), yR + (big ? 26 : 14) * a); ctx.stroke();
    }
    text(ctx, 'OCT 23', X0, yR + 70, { family: F.COND, size: 44, weight: 700, color: C.cream, align: 'center', alpha: tw(abs, 173.6, 174.0) });
    // the repair bar: "weeks"
    const grow = tw(abs, 174.4, 175.6, E.inOutCubic);
    const bx1 = lerp(X0, dayX(23), grow);
    if (grow > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(X0, yR - 74, bx1 - X0, 50);
      ctx.fillStyle = rgba(C.steel, 0.32); ctx.fill();
      ctx.clip();
      ctx.strokeStyle = rgba(C.steelLight, 0.55); ctx.lineWidth = 2;
      for (let x = X0 - 60; x < bx1 + 60; x += 16) { ctx.beginPath(); ctx.moveTo(x, yR - 24); ctx.lineTo(x + 50, yR - 74); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = rgba(C.steelLight, 0.9); ctx.lineWidth = 2; ctx.strokeRect(X0, yR - 74, bx1 - X0, 50);
      // week brackets
      for (let k = 1; k <= 3; k++) {
        const wx = dayX(k * 7);
        if (bx1 < wx) continue;
        ctx.strokeStyle = rgba(C.cream, 0.7); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(dayX((k - 1) * 7) + 4, yR - 92); ctx.lineTo(dayX((k - 1) * 7) + 4, yR - 100); ctx.lineTo(wx - 4, yR - 100); ctx.lineTo(wx - 4, yR - 92); ctx.stroke();
      }
      monoTag(ctx, 'REPAIR IN MIK', X0 + 10, yR - 130, { size: 24, color: C.steelLight, p: tw(abs, 174.5, 175.1, E.linear) });
    }
    leadKey(ctx, abs - 174.35, 520, 300, { lead: 'that would take', key: 'WEEKS', size: 150, color: C.cream, out: 1.65 });
    // NOV 7 tear-off calendar page: the deadline wall
    const rise = tw(abs, 175.55, 176.25, E.out);
    const hit = clamp((abs - 175.5) / 0.4);
    if (rise > 0) {
      const px = dayX(15), shake = Math.sin(abs * 40) * 6 * (1 - tw(abs, 175.6, 176.4)) * hit;
      ctx.save();
      ctx.translate(px + shake, yR - 20 + (1 - rise) * 260);
      ctx.globalAlpha = rise;
      paperCard(ctx, 0, -190, 250, 300, { color: '#F1E8D6', rot: -0.03, seed: 23, torn: 0.8, fn: (c) => {
        c.fillStyle = C.red; c.fillRect(-125, -150, 250, 70);
        text(c, 'NOVEMBER', 0, -102, { family: F.COND, size: 40, weight: 800, color: C.cream, align: 'center', tracking: 3 });
        text(c, '7', 0, 92, { family: F.DISPLAY, size: 190, weight: 800, color: C.red, align: 'center' });
        text(c, '1960', 0, 136, { family: F.MONO, size: 22, weight: 600, color: C.ink, align: 'center', tracking: 6 });
      } });
      ctx.restore();
      // deadline line
      ctx.strokeStyle = rgba(C.red, 0.9 * rise); ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.moveTo(px, yR - 360); ctx.lineTo(px, yR + 40); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, 'DEADLINE', px, yR + 100, { family: F.COND, size: 54, weight: 800, color: C.red, align: 'center', tracking: 4, alpha: tw(abs, 175.9, 176.3) });
      // overshoot zone tint
      if (grow > 0.65) { ctx.fillStyle = rgba(C.red, 0.25 * tw(abs, 175.9, 176.4)); ctx.fillRect(px, yR - 74, Math.max(0, bx1 - px), 50); }
    }
    ctx.restore();
    motes(ctx, t, { count: 30, seed: 3, alpha: 0.15 });
    vignette(ctx, 0.4);
  },
};
