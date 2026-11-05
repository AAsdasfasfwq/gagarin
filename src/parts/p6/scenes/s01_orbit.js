// S01 · 817.94–825.90 · "one orbit … 108 minutes … an eternity"
// Night Earth (seam match with P5) pulls out to the whole globe; the ink-line
// spine becomes the orbit; the orbit grows 108 minute ticks and becomes a dial;
// time dilates into rippling rings and the camera dives into the orange dot.
import { clamp, lerp, E, tw, kf, TAU, handheld } from '../../../core/math.js';
import { C, rgba } from '../../../core/palette.js';
import { F, staggerText, setText } from '../../../core/type.js';
import { W, H, glow } from '../../../core/draw.js';
import { bigNumber } from '../../../core/components.js';
import { spaceBg, drawGlobe, getGeo, strokeOrbit, ellPt, ellNormal, orangeDot, heroWord, vignette } from '../lib.js';

const START = 817.94, END = 825.90;
const L = (abs) => abs - START;

export default {
  id: 'p6-01-orbit',
  start: START, end: END,
  transition: { type: 'crossfade', dur: 1.0 },
  post: { bloom: 0.32, bloomThreshold: 0.78, vignette: 0.38, saturation: 1.0 },
  async init(S) { S.state.G = await getGeo(); },
  render(ctx, t, S) {
    const G = S.state.G;
    const hh = handheld(t, 2.5, 0.3, 11);
    // ── globe camera: giant night horizon → full globe (pull-out) → shift left
    const pull = tw(t, 0.25, L(820.6), E.cam);
    const r = lerp(1480, 238, pull);
    const shiftL = tw(t, L(821.0), L(822.4), E.cam);
    const gx = 960 - 330 * shiftL + hh.x * 0.5;
    const gy = lerp(560 + 1480, 548, pull) + hh.y * 0.5;
    const lon0 = lerp(-97, -38, E.inOutSine(clamp(t / 6))) + t * 0.6;
    const lat0 = lerp(-18, 16, pull);
    const sun = [lerp(0.62, 0.82, pull), lerp(0.3, 0.3, pull), lerp(-0.75, 0.1, pull)];
    // ── dive camera (into the orange dot) at the end
    const orbitE = { cx: gx, cy: gy, rx: r * 1.78, ry: r * 0.5, rot: -0.2 };
    const th0 = Math.PI * 0.62; // where the orbit starts drawing (front-left)
    const drawP = tw(t, L(819.25), L(820.9), E.inOutCubic);
    // dot angle: rides the draw head, then sweeps a fast lap for "108", then slows (eternity)
    const lap = tw(t, L(821.25), L(822.95), E.inOutSine);
    const slow = Math.max(0, t - L(822.95)) * 0.18;
    const dotTh = th0 + TAU * drawP + TAU * lap + slow;
    const [dx, dy] = ellPt(orbitE, dotTh);
    const dive = tw(t, L(824.55), L(826.6), E.inQuint);
    const zoom = 1 + dive * 14;
    const fx = lerp(W / 2, dx, tw(t, L(823.6), L(825.4), E.cam));
    const fy = lerp(H / 2, dy, tw(t, L(823.6), L(825.4), E.cam));

    spaceBg(ctx, t, { ox: -shiftL * 60 - (fx - W / 2) * 0.1 + hh.x, oy: (1 - pull) * 120 + hh.y, zoom: 1 + dive * 2.5, cy: 380, light: 0.08 });

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-fx, -fy);

    // time-dilation ripples (behind the globe) — copies of the dial expanding outward
    const eter = tw(t, L(822.95), L(825.6), E.linear);
    if (eter > 0) {
      for (let k = 0; k < 7; k++) {
        const u = (eter * 1.6 + k / 7) % 1;
        const sc = 1 + u * 2.6;
        const a = Math.sin(Math.PI * u) * 0.55 * clamp(eter * 4);
        const e2 = { ...orbitE, rx: orbitE.rx * sc, ry: orbitE.ry * sc, rot: orbitE.rot - u * 0.18 };
        strokeOrbit(ctx, e2, { color: C.cream, width: 1.6 / Math.sqrt(sc), alpha: a, backAlpha: 0.7 });
        drawTicks(ctx, e2, 108, a * 0.8, 0.6);
      }
    }
    // orbit — back half (behind the Earth)
    if (drawP > 0) {
      strokeOrbit(ctx, orbitE, { th0, span: TAU, p: drawP, part: 'back', color: C.cream, width: 3, backAlpha: 0.5 });
    }
    const ticksA = tw(t, L(821.2), L(821.9), E.out);
    if (ticksA > 0) drawTicks(ctx, orbitE, 108, ticksA, 1, 'back', dotTh, t - L(821.2));

    // the Earth
    drawGlobe(ctx, G, {
      cx: gx, cy: gy, r, lon0, lat0, tilt: lerp(0.06, -0.12, pull), sun, t,
      night: 0.96, lights: 1, clouds: lerp(0.5, 0.85, pull), halo: 1, cloudDrift: t * 1.5,
    });
    // dim the Earth under "108" so the dial reads as a clock
    const dim = tw(t, L(821.3), L(822.0)) * (1 - tw(t, L(823.2), L(824.2)));
    if (dim > 0) {
      ctx.fillStyle = rgba(C.spaceDeep, 0.35 * dim);
      ctx.beginPath(); ctx.arc(gx, gy, r * 1.01, 0, TAU); ctx.fill();
    }

    // orbit — front half
    if (drawP > 0) {
      strokeOrbit(ctx, orbitE, { th0, span: TAU, p: drawP, part: 'front', color: C.cream, width: 3 });
    }
    if (ticksA > 0) drawTicks(ctx, orbitE, 108, ticksA, 1, 'front', dotTh, t - L(821.2));
    // clock hand from the Earth's centre to the dot during "108"
    const hand = tw(t, L(821.25), L(821.6)) * (1 - tw(t, L(822.9), L(823.4)));
    if (hand > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(C.orange, 0.65 * hand);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.restore();
    }
    // the orange dot = Gagarin
    const dotA = tw(t, L(819.25), L(819.6));
    if (dotA > 0) {
      const back = Math.sin(dotTh) < 0 && false;
      orangeDot(ctx, dx, dy, 8.5 * dotA, { glowAmt: back ? 0.4 : 1, ring: tw(t, L(819.4), L(819.9)) * (1 - tw(t, L(821), L(821.4))), t });
    }
    ctx.restore();

    // ── typography (screen space) ──
    const dvOut = 1 - tw(t, L(824.9), L(825.4));
    // "1 ORBIT" label riding near the dot during the draw
    const tagA = tw(t, L(819.9), L(820.3)) * (1 - tw(t, L(821.0), L(821.3)));
    if (tagA > 0) {
      ctx.save();
      ctx.globalAlpha = tagA;
      setText(ctx, { family: F.MONO, size: 28, weight: 600, color: C.cream, align: 'left', baseline: 'middle', tracking: 3 });
      ctx.fillText('[ 1 ORBIT ]', 1235, 300);
      ctx.strokeStyle = rgba(C.cream, 0.5); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(1225, 300); ctx.lineTo(1140, 300); ctx.lineTo(1100, 362); ctx.stroke();
      ctx.restore();
    }
    // 108 MINUTES
    const nT = t - L(821.18);
    if (nT > 0 && nT < 2.4) {
      bigNumber(ctx, nT, 1450, 610, { value: 108, from: 0, dur: 0.7, size: 240, unit: 'MINUTES', color: C.cream, accent: C.orange, out: 1.65, family: F.DISPLAY, weight: 800 });
    }
    // an ETERNITY — tracking slowly widens (time stretches)
    const eT = t - L(824.62);
    if (eT > 0) {
      ctx.save();
      ctx.globalAlpha = dvOut;
      staggerText(ctx, 'those minutes contain an', 1420, 470, t - L(823.3), { family: F.SERIF, size: 46, italic: true, color: rgba(C.cream, 0.92), align: 'center', stagger: 0.02, dur: 0.5, mode: 'rise' });
      heroWord(ctx, eT, 1420, 600, 'ETERNITY', { size: 150, color: C.cream, track0: 0.0, track1: 0.12 });
      ctx.restore();
    } else if (t > L(823.3)) {
      ctx.save();
      ctx.globalAlpha = dvOut;
      staggerText(ctx, 'those minutes contain an', 1420, 470, t - L(823.3), { family: F.SERIF, size: 46, italic: true, color: rgba(C.cream, 0.92), align: 'center', stagger: 0.02, dur: 0.5, mode: 'rise' });
      ctx.restore();
    }
    // warm bloom of the dot as we dive in
    if (dive > 0) glow(ctx, W / 2, H / 2, 200 + dive * 900, C.orange, 0.35 * dive);
    vignette(ctx, 0.35);
  },
};

// 108 minute ticks around the orbit (12 majors × 9)
function drawTicks(ctx, e, n, a, lenK = 1, part = 'all', dotTh = null, tt = 99) {
  ctx.save();
  ctx.strokeStyle = C.cream;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU + Math.PI * 0.62;
    const back = Math.sin(th) < 0;
    if (part === 'back' && !back) continue;
    if (part === 'front' && back) continue;
    // staggered appearance around the ring
    const ap = clamp((tt - (i / n) * 0.55) / 0.2);
    if (ap <= 0) continue;
    const [x, y] = ellPt(e, th);
    const [nx, ny] = ellNormal(e, th);
    const major = i % 9 === 0;
    const len = (major ? 22 : 10) * lenK * ap;
    let lit = 0;
    if (dotTh != null) {
      const d = ((dotTh - th) % TAU + TAU) % TAU;
      lit = d < TAU * 0.04 ? 1 - d / (TAU * 0.04) : 0;
    }
    ctx.globalAlpha = a * (back ? 0.45 : 0.9) * (major ? 1 : 0.7);
    ctx.lineWidth = major ? 2.4 : 1.3;
    ctx.strokeStyle = lit > 0 ? C.orange : C.cream;
    ctx.beginPath();
    ctx.moveTo(x + nx * 6, y + ny * 6);
    ctx.lineTo(x + nx * (6 + len + lit * 8), y + ny * (6 + len + lit * 8));
    ctx.stroke();
  }
  ctx.restore();
}
