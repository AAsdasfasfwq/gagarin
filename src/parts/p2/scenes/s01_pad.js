// S01 · 155.00–164.55 · OCT 23 → the fuelled R-16 at night → torches find the faults
import { E, tw, kf, clamp, lerp, handheld, rng } from '../../../core/math.js';
import { C, rgba } from '../../../core/palette.js';
import { glow, lightCone, brackets, haze, W, H } from '../../../core/draw.js';
import { dateCard, callout } from '../../../core/components.js';
import { R3 } from '../../../core/three.js';
import { nightSky, motes, sparks, UDMH, NITRIC, vignette, torch } from '../lib.js';
import { buildSet, toScreen, aim, DECKS } from '../set3d.js';

const T0 = 155.0;
// camera keys (local t): [t, pos, look]
const CAM = [
  [0.0, [13, 3.0, 38], [1, 36, 0]],
  [1.9, [13, 3.2, 37], [1, 33, 0]],
  [3.5, [12, 5.0, 33], [-1.6, 10.0, 0]],
  [9.6, [7.6, 9.0, 16.2], [-0.9, 9.5, 0]],
];
const LEAK = [Math.cos(0.42) * 1.0, 6.25, Math.sin(0.42) * 1.0];
const FAULT = [Math.cos(0.75) * 1.05, 13.6, Math.sin(0.75) * 1.05];

function camAt(t) {
  const pos = kf(t, CAM.map(([tt, p], i) => [tt, p, i === 2 ? E.cam : E.inOutSine]));
  const look = kf(t, CAM.map(([tt, , l], i) => [tt, l, i === 2 ? E.cam : E.inOutSine]));
  const hh = handheld(t, 0.06, 0.4, 3);
  return { pos: [pos[0] + hh.x, pos[1] + hh.y, pos[2]], look };
}

export default {
  id: 'p2-01-pad', start: 155.0, end: 164.55,
  transition: { type: 'flash', dur: 0.5, color: [1, 0.93, 0.8] },
  post: (t) => ({ bloom: 0.32, bloomThreshold: 0.72, vignette: 0.42, saturation: 0.95, exposure: t < 2 ? 0.05 : 0 }),
  init(S) {
    S.state.set = buildSet({ burned: false, crewCount: 14 });
    S.state.set.scene.traverse((o) => { if (o.isMesh && o.material) o.material.envMapIntensity = 0.12; });
  },
  render(ctx, t, S) {
    const { set } = S.state;
    const abs = T0 + t;
    const c = camAt(t);
    aim(set.cam, c.pos, c.look, 38);
    // horizon for the 2D sky
    const dx = c.look[0] - c.pos[0], dz = c.look[2] - c.pos[2], dl = Math.hypot(dx, dz);
    const hz = toScreen(set.cam, c.pos[0] + (dx / dl) * 600, 0, c.pos[2] + (dz / dl) * 600);
    const tilt = tw(t, 1.9, 3.5, E.cam);
    nightSky(ctx, { horizon: clamp(hz.y, -400, 1500), t, offY: (1 - tilt) * -260, glowX: 760, starsAlpha: 0.85 });
    // date card lives in the sky: it rises out of frame as we tilt down
    const cardY = 470 - tilt * 900;
    if (cardY > -200) {
      ctx.save();
      dateCard(ctx, t - 0.12, { x: 960, y: cardY, big: 'OCT 23', top: '1960', sub: 'Tyuratam · Launch Site 41', size: 200, color: C.cream, accent: C.gold });
      ctx.restore();
    }
    // the 3D pad (state set BEFORE rendering — deterministic)
    set.workLamps.forEach((l, i) => { l.material.opacity = 0.65 + 0.3 * Math.sin(t * (3 + i) + i * 2.1); });
    ctx.drawImage(R3.render(set.scene, set.cam, { exposure: 0.85 }), 0, 0);

    // floodlight beams (volumetric) toward the rocket
    const beamA = tw(t, 1.2, 3.0, E.out);
    if (beamA > 0) {
      [[26, 28.5, 20], [-22, 28.5, 26]].forEach(([x, y, z], i) => {
        const a = toScreen(set.cam, x, y, z), b = toScreen(set.cam, 0, 8 + i * 2, 0);
        if (a.z < 1 && b.z < 1) {
          lightCone(ctx, a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), 0.22, Math.hypot(b.x - a.x, b.y - a.y) * 1.25, '#FFD9A0', 0.07 * beamA, { soft: 0.8 });
          glow(ctx, a.x, a.y, 120, '#FFD08A', 0.35 * beamA);
        }
      });
      motes(ctx, t, { count: 50, seed: 7, alpha: 0.22 * beamA, color: '#FFE6BE' });
    }

    // x-ray fuel fill ("the rocket was fueled") — a scan line sweeps up, revealing the two propellants
    const scanU = tw(abs, 157.45, 158.75, E.inOutSine), xr = tw(abs, 157.45, 157.7) * (1 - tw(abs, 160.2, 161.2, E.in));
    if (xr > 0.01) {
      const yScan = lerp(1.2, 19.5, scanU);
      const tank = (y0, y1, col) => {
        const yt = Math.min(y1, yScan);
        if (yt <= y0) return;
        const bl = toScreen(set.cam, -0.9, y0, 0.2), br = toScreen(set.cam, 0.9, y0, 0.2);
        const tl = toScreen(set.cam, -0.9, yt, 0.2), tr = toScreen(set.cam, 0.9, yt, 0.2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, tl.y, 0, bl.y);
        g.addColorStop(0, rgba(col, 0.32 * xr)); g.addColorStop(0.15, rgba(col, 0.1 * xr)); g.addColorStop(1, rgba(col, 0.06 * xr));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y); ctx.closePath(); ctx.fill();
        // fill line (meniscus) only once the scan passed the top
        if (yScan > y1) { ctx.strokeStyle = rgba(col, 0.85 * xr); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.stroke(); }
        ctx.restore();
      };
      tank(1.9, 6.0, UDMH); tank(6.3, 11.0, NITRIC); tank(12.2, 14.0, UDMH); tank(14.2, 16.5, NITRIC);
      if (scanU < 1) {
        const a = toScreen(set.cam, -1.6, yScan, 0.2), b = toScreen(set.cam, 1.6, yScan, 0.2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(C.blueprintLine, 0.8 * xr); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
        glow(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, 90, C.blueprintLine, 0.25 * xr);
      }
      const lab = toScreen(set.cam, 1.0, 8.0, 0);
      callout(ctx, abs - 157.75, lab.x + 8, lab.y, lab.x + 250, lab.y - 130, 'FUELLED', { accent: UDMH, size: 26, out: 2.4 });
    }
    // engineers' torches scanning the hull
    const scan = tw(abs, 158.6, 159.4, E.out);
    if (scan > 0) {
      // torch A on deck 3 → scans up to the cable raceway
      const aSrc = toScreen(set.cam, Math.cos(1.05) * 2.45, DECKS[2] + 1.2, Math.sin(1.05) * 2.45);
      const sy = kf(abs, [[158.6, 10.8], [160.2, 12.6, E.inOutSine], [161.2, 11.9, E.inOutSine], [162.15, FAULT[1], E.out]]);
      const sa = kf(abs, [[158.6, 0.2], [160.2, 0.5], [161.2, 0.95], [162.15, 0.75, E.out]]);
      const aT = toScreen(set.cam, Math.cos(sa) * 1.05, sy, Math.sin(sa) * 1.05);
      torch(ctx, aSrc.x, aSrc.y, aT.x, aT.y, { alpha: 0.42 * scan, spread: 0.12 });
      // torch B on deck 1 → scans to the leaking seam
      const bSrc = toScreen(set.cam, Math.cos(0.95) * 2.5, DECKS[0] + 1.25, Math.sin(0.95) * 2.5);
      const by = kf(abs, [[159.0, 3.0], [160.6, 5.0, E.inOutSine], [162.0, 7.6, E.inOutSine], [163.25, LEAK[1], E.out]]);
      const ba = kf(abs, [[159.0, 0.9], [161.0, 0.3], [163.25, 0.42, E.out]]);
      const bT = toScreen(set.cam, Math.cos(ba) * 1.0, by, Math.sin(ba) * 1.0);
      torch(ctx, bSrc.x, bSrc.y, bT.x, bT.y, { alpha: 0.38 * tw(abs, 159.0, 159.6), spread: 0.12 });
    }
    // electrical fault — sparks on the raceway
    const fp = toScreen(set.cam, ...FAULT);
    if (abs > 162.2) {
      sparks(ctx, abs - 162.2, fp.x, fp.y, { seed: 5, alpha: 1, len: 70 });
      callout(ctx, abs - 162.3, fp.x + 6, fp.y, fp.x + 300, fp.y - 120, 'ELECTRICAL FAULT', { accent: C.red, size: 28 });
    }
    // fuel leak — a drop forms on the seam and falls to the concrete
    const lp = toScreen(set.cam, ...LEAK);
    if (abs > 163.0) {
      const form = tw(abs, 163.0, 163.5, E.out);
      const fall = clamp((abs - 163.5) / 1.0);
      const yW = LEAK[1] - (LEAK[1] - 0.9) * fall * fall;
      const dp = toScreen(set.cam, LEAK[0] + 0.05, yW, LEAK[2] + 0.05);
      // seep stain
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, lp.x, lp.y, 26 * form, UDMH, 0.5);
      ctx.strokeStyle = rgba(UDMH, 0.7 * form); ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lp.x - 2, lp.y - 4); ctx.lineTo(lp.x + 1, lp.y + 16 * form); ctx.stroke();
      ctx.restore();
      if (fall < 1) {
        const rr = 4 + 3 * form;
        ctx.save(); ctx.translate(dp.x + 1, dp.y + 16 * form); ctx.scale(1, 1 + fall * 0.8);
        ctx.fillStyle = UDMH; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,240,.8)'; ctx.beginPath(); ctx.arc(-rr * 0.35, -rr * 0.3, rr * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        glow(ctx, dp.x, dp.y + 16 * form, 22, UDMH, 0.45);
      } else {
        const sp = toScreen(set.cam, LEAK[0] + 0.05, 0.9, LEAK[2] + 0.05);
        const k = clamp((abs - 164.5) / 0.3);
        glow(ctx, sp.x, sp.y, 40 + 60 * k, UDMH, 0.6 * (1 - k * 0.5));
      }
      callout(ctx, abs - 163.85, lp.x - 6, lp.y, lp.x - 330, lp.y - 70, 'FUEL LEAK', { accent: C.toxic, size: 28 });
    }
    // diagnostic framing
    const hud = tw(abs, 158.7, 159.4) * (1 - tw(abs, 164.2, 164.55));
    if (hud > 0) {
      const top = toScreen(set.cam, 0, 19.6, 0), bot = toScreen(set.cam, 0, 1.2, 0);
      ctx.save(); ctx.globalAlpha = hud * 0.7;
      brackets(ctx, top.x - 150, top.y - 20, 300, bot.y - top.y + 40, { len: 34, color: C.blueprintLine, width: 2, p: hud });
      ctx.restore();
    }
    haze(ctx, hz.y - 140, hz.y + 160, '#8C7A88', 0.18);
    vignette(ctx, 0.35);
  },
};
