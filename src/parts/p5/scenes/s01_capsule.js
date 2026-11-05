// P5 · 01 — "Inside the rocket, Gagarin puts on music through his headphones to
// pass the time. He listens to love songs."  (649.76 – 657.40)
// Seam-in: zoom from P4's closed hatch into the cabin. 2.5D, 3 planes + rack focus.
import { clamp, lerp, E, tw, kf, handheld, noise, TAU } from '../../../core/math.js';
import { C, rgba } from '../../../core/palette.js';
import { Cam25, W, H, glow, pooledBg } from '../../../core/draw.js';
import { F, staggerText } from '../../../core/type.js';
import { cabinWall, panel, gagarinInSeat } from '../cabin.js';
import { strokePts, motes, tunnel } from '../lib.js';

const T0 = 649.76;
const at = (abs) => abs - T0;

export const s01 = {
  id: 'p5-01-capsule',
  start: 649.76, end: 657.40,
  transition: { type: 'zoom', dur: 0.7, center: [0.5, 0.5] },
  post: { bloom: 0.28, bloomThreshold: 0.78, vignette: 0.45, saturation: 0.95, highTint: [0.07, 0.04, 0.0] },
  render(ctx, t) {
    const hh = handheld(t, 3, 0.3, 11);
    const GX = -230, GY = 170, GS = 100; // Gagarin neck point (world, plane z=0)
    const camZ = kf(t, [[0, -1320], [1.7, -1240, E.out], [3.4, -1180, E.cam], [5.0, -720, E.cam], [7.64, -640, E.linear]]);
    const camX = kf(t, [[0, 60], [1.7, 30], [2.6, 240, E.cam], [3.4, 220], [5.0, -10, E.cam], [7.64, 30]]);
    const camY = kf(t, [[0, 20], [1.7, 30], [2.6, 150, E.cam], [3.4, 140], [5.0, 40, E.cam], [7.64, 30]]);
    const focus = kf(t, [[0, 0], [1.85, 0], [2.4, -460, E.cam], [3.1, -460], [3.7, 0, E.cam]]);
    const cam = new Cam25({ x: camX + hh.x, y: camY + hh.y, z: camZ, rot: hh.r - 0.02, focus, aperture: 1.2 });
    pooledBg(ctx, '#1A1712');
    cam.plane(ctx, 1100, (c) => cabinWall(c, t, { porthole: { x: 1250, y: -420, r: 230 } }));
    const lp = cam.project(-700, -800, 300);
    glow(ctx, lp.x, lp.y, 900 * lp.s, '#FFD9A0', 0.2);
    const knobT = tw(t, at(651.62), at(652.2), E.out);
    const listen = tw(t, at(654.9), at(656.0), E.inOut);
    let head = null;
    cam.plane(ctx, 0, (c) => {
      head = gagarinInSeat(c, t, {
        x: GX, y: GY, s: GS,
        yaw: kf(t, [[0, 0.3], [1.9, 0.26], [2.4, 0.42, E.cam], [3.5, 0.42], [4.4, 0.18, E.cam]]) + Math.sin(t * 1.9) * 0.03 * listen,
        pitch: kf(t, [[0, 0.06], [2.4, 0.2, E.cam], [3.5, 0.2], [4.4, 0.02, E.cam]]),
        tilt: Math.sin(t * 1.9 + 0.4) * 0.05 * listen,
        expr: {
          smile: lerp(0.3, 0.68, listen), eyeOpen: lerp(1, 0.5, listen),
          lookX: kf(t, [[0, 0.15], [1.9, 0.2], [2.3, 0.7], [3.4, 0.7], [3.9, 0.05]]), lookY: kf(t, [[0, 0], [2.3, 0.55], [3.4, 0.55], [3.9, 0]]),
        },
        rim: '#9BE3A8',
      });
      // warm key from the cabin lamp on the helmet
      glow(c, GX - 120, GY - 260, 260, '#FFE2B8', 0.12);
    });
    // foreground instrument panel, bottom-right, angled; racks into focus for the knob
    cam.plane(ctx, -460, (c) => {
      c.save(); c.translate(560, 500); c.rotate(-0.07); c.transform(1, 0, -0.18, 1, 0, 0);
      panel(c, t, { x: 0, y: 0, w: 1500, h: 420, knob: knobT, lamps: [1, 0, 1, knobT > 0.5 ? 1 : 0, 0, 1], globusT: t });
      c.restore();
    });
    // radio waveform: from the panel speaker into the earphone
    const wave = tw(t, at(652.25), at(653.5), E.inOut);
    if (wave > 0 && head) {
      const grille = cam.project(560 + 1500 * 0.25 + 30 - 0.18 * 115, 500 + 420 * 0.24 + 10, -460);
      const ear = cam.project(GX + GS * 1.2, head.headY - GS * 0.05, 0);
      const k = cam.scaleAt(0);
      const pts = [];
      for (let i = 0; i <= 180; i++) {
        const u = i / 180;
        const bx = lerp(grille.x, ear.x, E.inOutSine(u)) + Math.sin(u * Math.PI) * 120 * k;
        const by = lerp(grille.y, ear.y, u) - Math.sin(u * Math.PI) * 260 * k;
        const env = Math.sin(Math.PI * u) * 0.85 + 0.15;
        const v = Math.sin(u * 52 - t * 9) * 0.6 + noise.n2(u * 9, t * 2.5) * 0.5;
        pts.push([bx, by + v * 14 * k * (1 + listen * 0.7) * env]);
      }
      strokePts(ctx, pts, { color: C.cream, width: 2.6, glowCol: '#FFD9A0', alpha: 0.9 * (1 - tw(t, at(656.9), at(657.4), E.in)), p: wave });
    }
    motes(ctx, t, { count: 26, seed: 15, color: '#FFE7C0', alpha: 0.35, speed: 6 });
    // "love songs"
    if (t > at(655.6)) {
      const lt = t - at(655.84);
      ctx.save();
      ctx.globalAlpha *= 1 - tw(t, at(657.0), at(657.38), E.in);
      staggerText(ctx, 'love songs', 1360, 430, lt, { family: F.SERIF, size: 110, italic: true, color: C.cream, align: 'center', stagger: 0.05, dur: 0.6, mode: 'rise' });
      ctx.restore();
    }
    tunnel(ctx, 0.22);
  },
};
