// S02 · 315.18–320.86 · "The descent module was a perfect sphere, slightly more than six and a half
// feet in diameter." A drafting compass swings a perfect circle on the blueprint board; the circle
// inflates into the shaded sphere; a floor line + perspective grid appear; a dimension line lands
// 6½ FT; Gagarin (orange suit) walks in at true scale and looks up at it.
import { E, kf, clamp, lerp, TAU, noise } from '../../../core/math.js';
import { C, rgba, shade } from '../../../core/palette.js';
import { F, setText, staggerText } from '../../../core/type.js';
import { contactShadow, glow } from '../../../core/draw.js';
import { drawCharacter, idle } from '../../../core/characters.js';
import { blueprintBg, drawSphere2D, dimLine, at, env, cam2D, W, H } from '../lib.js';

const T0 = 315.18;
const CX = 800, CY = 585, R = 240, FLOOR = CY + R;

function compass(ctx, cx, cy, qx, qy, lift) {
  // top-down drafting compass: needle at (cx,cy), pencil at (qx,qy), knurled head offset
  const mx = (cx + qx) / 2, my = (cy + qy) / 2;
  const dx = qx - cx, dy = qy - cy, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const hx = mx + nx * L * 0.42 - 30 * lift, hy = my + ny * L * 0.42 - 80 * lift;
  const leg = (x0, y0, x1, y1, w0, w1, col) => {
    const a = Math.atan2(y1 - y0, x1 - x0), px = -Math.sin(a), py = Math.cos(a);
    ctx.beginPath();
    ctx.moveTo(x0 + px * w0, y0 + py * w0); ctx.lineTo(x1 + px * w1, y1 + py * w1);
    ctx.lineTo(x1 - px * w1, y1 - py * w1); ctx.lineTo(x0 - px * w0, y0 - py * w0); ctx.closePath();
    const g = ctx.createLinearGradient(x0 + px * w0, y0 + py * w0, x0 - px * w0, y0 - py * w0);
    g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.5));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(10,20,30,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  };
  ctx.save();
  // shadow on the board
  ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(16 + lift * 40, 22 + lift * 60);
  ctx.strokeStyle = '#050D18'; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.lineTo(qx, qy); ctx.stroke(); ctx.restore();
  leg(hx, hy, cx, cy - lift * 30, 11, 2.5, '#AEB8BD');
  leg(hx, hy, qx, qy - lift * 30, 11, 4, '#9EA9AF');
  // pencil holder clamp on the pencil leg
  { const kx = lerp(hx, qx, 0.72), ky = lerp(hy, qy, 0.72); ctx.fillStyle = '#7C878D'; ctx.beginPath(); ctx.arc(kx, ky, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#E2E8EA'; ctx.beginPath(); ctx.arc(kx - 2, ky - 2, 3, 0, TAU); ctx.fill(); }
  // pencil lead
  ctx.fillStyle = '#2B2B2B'; ctx.beginPath(); ctx.arc(qx, qy - lift * 30, 4, 0, TAU); ctx.fill();
  // grip stem (foreshortened, pointing at the viewer) + knurled head
  const gx = hx + nx * 34 - 10, gy = hy + ny * 34 - 26;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3A444B'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(gx, gy); ctx.stroke();
  ctx.strokeStyle = '#C3CCD0'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(gx, gy); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,40,46,.5)'; ctx.lineWidth = 1.2;
  for (let k = 0.2; k < 1; k += 0.16) { const kx = lerp(hx, gx, k), ky = lerp(hy, gy, k); ctx.beginPath(); ctx.moveTo(kx - ny * 5, ky + nx * 5); ctx.lineTo(kx + ny * 5, ky - nx * 5); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(hx, hy, 16, 0, TAU);
  const hg = ctx.createRadialGradient(hx - 5, hy - 6, 2, hx, hy, 16); hg.addColorStop(0, '#F1F4F5'); hg.addColorStop(1, '#5B666C');
  ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = '#1D2730'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#C9A24A'; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, TAU); ctx.fill();
  ctx.restore();
}

function fraction(ctx, x, y, size, color, alpha) {
  // "6½ FT" composed by hand (no font fallback risk); x = centre, y = baseline
  ctx.save();
  ctx.globalAlpha *= alpha;
  setText(ctx, { family: F.DISPLAY, size, weight: 800, color, align: 'left', tracking: -size * 0.03 });
  const w6 = ctx.measureText('6').width;
  setText(ctx, { family: F.DISPLAY, size: size * 0.42, weight: 700, color, align: 'left' });
  const wf = ctx.measureText('1').width * 2.4;
  setText(ctx, { family: F.COND, size: size * 0.62, weight: 800, color: C.orange, align: 'left', tracking: 4 });
  const wu = ctx.measureText('FT').width;
  const total = w6 + wf + 24 + wu;
  let px = x - total / 2;
  setText(ctx, { family: F.DISPLAY, size, weight: 800, color, align: 'left', tracking: -size * 0.03 });
  ctx.fillText('6', px, y); px += w6 + 4;
  setText(ctx, { family: F.DISPLAY, size: size * 0.42, weight: 700, color, align: 'left' });
  ctx.fillText('1', px, y - size * 0.42);
  ctx.fillText('2', px + wf * 0.5, y);
  ctx.strokeStyle = color; ctx.lineWidth = size * 0.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px + wf * 0.06, y - size * 0.02); ctx.lineTo(px + wf * 0.92, y - size * 0.62); ctx.stroke();
  px += wf + 24;
  setText(ctx, { family: F.COND, size: size * 0.62, weight: 800, color: C.orange, align: 'left', tracking: 4 });
  ctx.fillText('FT', px, y);
  ctx.restore();
}

export const s02 = {
  id: 'p3-02-sphere', start: T0, end: 320.86,
  transition: { type: 'blur', dur: 0.6 },
  post: { bloom: 0.2, vignette: 0.36 },
  render(ctx, t, S) {
    const a = T0 + t;
    const zoom = kf(a, [[T0, 1.08], [317.6, 1.0, E.cam], [320.9, 0.97, E.linear]]);
    const camx = kf(a, [[T0, -40], [317.6, 0], [320.9, 60, E.inOut]]);
    blueprintBg(ctx, { ox: camx * 0.4, zoom: 1 + (zoom - 1) * 0.4, light: 0.24, cx: 860, cy: 520 });
    ctx.save();
    cam2D(ctx, a, { x: camx, zoom, hh: 2.5, seed: 2 });

    // perspective floor grid (appears with the floor line)
    const fl = at(a, 317.3, 318.2);
    if (fl > 0) {
      ctx.save();
      ctx.globalAlpha = fl;
      ctx.strokeStyle = rgba(C.blueprintLine, 0.85); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(lerp(CX, 120, fl), FLOOR); ctx.lineTo(lerp(CX, 1820, fl), FLOOR); ctx.stroke();
      ctx.lineWidth = 1;
      const vx = CX + 160, vy = FLOOR - 520;
      for (let i = -14; i <= 22; i++) {
        const x0 = CX + i * 110;
        const ex = lerp(x0, vx, -0.9), ey = lerp(FLOOR, vy, -0.9);
        ctx.strokeStyle = rgba(C.blueprintLine, 0.14 * fl);
        ctx.beginPath(); ctx.moveTo(x0, FLOOR); ctx.lineTo(ex, ey); ctx.stroke();
      }
      for (let k = 1; k < 7; k++) {
        const y = FLOOR + Math.pow(k / 7, 1.6) * 330;
        ctx.strokeStyle = rgba(C.blueprintLine, 0.12 * fl);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();
    }

    // compass draws the perfect circle
    const sweep = at(a, T0 + 0.25, 316.95, E.inOutCubic);
    const th0 = -Math.PI * 0.75;
    const th = th0 + sweep * TAU;
    // inflated sphere (volume) appears as the line closes
    const inflate = at(a, 316.7, 317.7, E.out);
    if (inflate > 0) {
      contactShadow(ctx, CX, FLOOR + 4, R * 1.7 * inflate, { alpha: 0.5 * inflate, color: '#030A14' });
      drawSphere2D(ctx, CX, CY, R * lerp(0.985, 1, inflate), { alpha: inflate, rotY: 0.2 + (a - T0) * 0.06, rim: C.blueprintLine, spec: 0.25 });
    }
    // ink circle
    if (sweep > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(C.cream, 0.9 * (1 - inflate * 0.55)); ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(CX, CY, R, th0, th); ctx.stroke();
      ctx.restore();
      // centre mark
      ctx.save(); ctx.globalAlpha = 0.7 * (1 - inflate); ctx.strokeStyle = C.cream; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(CX - 14, CY); ctx.lineTo(CX + 14, CY); ctx.moveTo(CX, CY - 14); ctx.lineTo(CX, CY + 14); ctx.stroke(); ctx.restore();
    }
    const lift = at(a, 316.95, 317.7, E.in);
    if (a < 317.75 && a > T0 + 0.05) {
      ctx.save();
      ctx.globalAlpha = 1 - lift;
      ctx.translate(lift * 180, -lift * 240);
      compass(ctx, CX, CY, CX + Math.cos(th) * R, CY + Math.sin(th) * R, lift);
      ctx.restore();
    }

    // dimension line + 6½ FT
    const dl = at(a, 317.95, 318.75, E.out);
    if (dl > 0) {
      const yy = CY - R - 62;
      ctx.save();
      ctx.globalAlpha = dl;
      ctx.strokeStyle = rgba(C.blueprintLine, 0.55); ctx.lineWidth = 1.3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(CX - R, CY - 10); ctx.lineTo(CX - R, yy - 18); ctx.moveTo(CX + R, CY - 10); ctx.lineTo(CX + R, yy - 18); ctx.stroke();
      ctx.restore();
      dimLine(ctx, CX - R, yy, CX + R, yy, dl, { color: C.cream, width: 2.4 });
      const nIn = at(a, 318.72, 319.2, E.snap);
      if (nIn > 0) {
        ctx.save();
        const sc = lerp(1.15, 1, nIn);
        ctx.translate(CX, yy - 38); ctx.scale(sc, sc);
        fraction(ctx, 0, 0, 104, C.cream, nIn);
        ctx.restore();
      }
      staggerText(ctx, 'slightly more than', CX, yy - 168, a - 317.95, { family: F.SERIF, size: 40, italic: true, color: rgba(C.cream, 0.9), align: 'center', stagger: 0.02, dur: 0.4 });
    }

    // Gagarin walks in at scale (sphere 2.3 m vs 1.57 m)
    const walkIn = at(a, 318.05, 319.55, E.outCubic);
    if (walkIn > 0) {
      const gx = lerp(1720, 1268, walkIn);
      const phase = (a - 318.05) * 9.2;
      const walking = 1 - at(a, 319.25, 319.7, E.out);
      const stepA = Math.sin(phase) * 0.36 * walking;
      const bob = Math.abs(Math.cos(phase)) * 6 * walking;
      const look = at(a, 319.6, 320.2, E.out);
      const id = idle(a, 3);
      ctx.save();
      drawCharacter(ctx, 'gagarin', {
        x: gx, y: FLOOR - bob + 2, s: 29.5, crop: 'full', outfit: 'spacesuit', helmet: 1,
        yaw: lerp(-0.55, -0.32, look), bodyYaw: lerp(-0.45, -0.3, look), pitch: lerp(0, -0.3, look), lean: 0.03 * walking,
        legL: { a: stepA, b: Math.max(0, -stepA) * 0.8 }, legR: { a: -stepA, b: Math.max(0, stepA) * 0.8 },
        armL: { a: 0.12 - stepA * 0.5, b: 0.3 }, armR: { a: 0.12 + stepA * 0.5, b: 0.3 + look * 0.2 },
        expr: { smile: 0.35 + look * 0.2, brow: look * 0.6, eyeOpen: 1 + look * 0.15, lookY: -look * 0.6, lookX: -look * 0.4, blink: id.blink },
        breathe: a, rim: C.blueprintLine, light: { x: -0.6, y: -0.6 },
      });
      ctx.restore();
    }
    ctx.restore();
  },
};
