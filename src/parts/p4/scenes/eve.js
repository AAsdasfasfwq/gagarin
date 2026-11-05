// P4 · chapter 1 — the eve: date card → steppe night → the lit window → the desk.
import { E, tw, kf, clamp, handheld, lerp, noise, rng, TAU } from '../../../core/math.js';
import { C, rgba, shade, mixColor } from '../../../core/palette.js';
import { F, text, staggerText, maskRise, setText } from '../../../core/type.js';
import { Cam25, glow, lightCone, contactShadow, tex, W, H, haze, smokePlume } from '../../../core/draw.js';
import { dateCard, callout, nameTag } from '../../../core/components.js';
import { drawCharacter, idle } from '../../../core/characters.js';
import { WT, env, nightSky, r7Silhouette, lit, woodTex, plasterTex, pattern, fountainPen, motes, INK } from '../lib.js';
import { photoCanvas, teaGlass, deskLampSide, windowNight } from '../props.js';

const T0 = 477.08;
const HY = 640; // horizon screen y (= date-card rule line)

// cottage (small timber house) silhouette with one glowing window — used here and later
export function cottageExterior(ctx, x, y, s, { win = 1, t = 0, porch = 0.6 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // body
  ctx.fillStyle = '#0F1626';
  ctx.beginPath(); ctx.moveTo(-160, 0); ctx.lineTo(-160, -110); ctx.lineTo(0, -200); ctx.lineTo(160, -110); ctx.lineTo(160, 0); ctx.closePath(); ctx.fill();
  // plank lines
  ctx.strokeStyle = 'rgba(140,150,175,.10)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(-160, -i * 11); ctx.lineTo(160, -i * 11); ctx.stroke(); }
  // roof rim (moonlit)
  ctx.strokeStyle = 'rgba(170,190,225,.45)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-178, -100); ctx.lineTo(0, -206); ctx.lineTo(178, -100); ctx.stroke();
  // chimney
  ctx.fillStyle = '#0C121F'; ctx.fillRect(70, -190, 26, 60);
  // window glow
  const wx = -70, wy = -95, ww = 62, wh = 56;
  const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
  g.addColorStop(0, mixColor('#FFC977', '#1B2236', 1 - win)); g.addColorStop(1, mixColor('#E8913F', '#141A2A', 1 - win));
  ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = '#0F1626'; ctx.fillRect(wx + ww / 2 - 2.5, wy, 5, wh); ctx.fillRect(wx, wy + wh / 2 - 2.5, ww, 5);
  // second (dim) window
  ctx.fillStyle = 'rgba(255,190,110,.18)'; ctx.fillRect(40, -95, 50, 48);
  ctx.restore();
  if (win > 0) {
    glow(ctx, x + (-70 + 31) * s, y + (-95 + 28) * s, 120 * s, '#FFB560', 0.35 * win);
    // light spill on the ground
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,170,90,${0.08 * win})`;
    ctx.beginPath(); ctx.moveTo(x - 101 * s, y); ctx.lineTo(x - 39 * s, y); ctx.lineTo(x + 10 * s, y + 70 * s); ctx.lineTo(x - 150 * s, y + 70 * s); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (porch > 0) glow(ctx, x + 120 * s, y - 30 * s, 40 * s, '#FFD08A', 0.3 * porch);
  return { winX: x + (-70 + 31) * s, winY: y + (-95 + 28) * s };
}

// ground: dark steppe with subtle texture, horizon at HY
function steppeGround(ctx, hy, { col = '#0C1220', t = 0 } = {}) {
  const g = ctx.createLinearGradient(0, hy, 0, hy + 1400);
  g.addColorStop(0, '#1A2338'); g.addColorStop(0.08, col); g.addColorStop(1, '#05080F');
  ctx.fillStyle = g;
  ctx.fillRect(-5000, hy, 10000, 4000);
  // sparse grass streaks on the ground plane (perspective rows)
  const r = rng(12);
  ctx.strokeStyle = 'rgba(120,135,160,.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const d = Math.pow(r(), 2.2);
    const yy = hy + 4 + d * 1100;
    const xx = -2600 + r() * 5200;
    const l = 6 + d * 40;
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + l, yy - l * 0.15); ctx.stroke();
  }
}

// foreground grass tufts (drawn big, blurred by the camera)
function grassTufts(ctx, t, { seed = 3, y = 520, count = 26, col = '#04070D' } = {}) {
  const r = rng(seed);
  ctx.fillStyle = col;
  for (let i = 0; i < count; i++) {
    const bx = -1300 + r() * 2600, bh = 80 + r() * 220, n = 5 + Math.floor(r() * 7);
    for (let k = 0; k < n; k++) {
      const sway = noise.n2(i * 3.1 + k, t * 0.35) * 14;
      const a = (r() - 0.5) * 0.7;
      const h = bh * (0.5 + r() * 0.6);
      const tipx = bx + Math.sin(a) * h + sway, tipy = y - Math.cos(a) * h;
      ctx.beginPath();
      ctx.moveTo(bx - 5 + k * 2, y + 40);
      ctx.quadraticCurveTo(bx + (tipx - bx) * 0.4, y - h * 0.5, tipx, tipy);
      ctx.quadraticCurveTo(bx + (tipx - bx) * 0.45 + 5, y - h * 0.45, bx + 6 + k * 2, y + 40);
      ctx.fill();
    }
  }
}

// ── S1 ───────────────────────────────────────────────────────────────────────
export const sEve = {
  id: 'p4-01-eve',
  start: T0, end: 484.32,
  transition: { type: 'flash', dur: 0.6, color: [1, 0.92, 0.8] },
  post: (t) => ({ bloom: 0.32, bloomThreshold: 0.78, vignette: 0.42, saturation: 0.92, contrast: 1.06 }),
  render(ctx, t, S) {
    const hh = handheld(t, 2.2, 0.25, 4);
    // camera: hold during the card, then a slow, tense push + drift toward the cottage
    const push = tw(t, 2.6, 7.6, E.inOutSine);
    const cam = new Cam25({ x: lerp(0, 160, tw(t, 4.6, 8.2, E.cam)) + hh.x, y: hh.y, z: lerp(-1000, -880, push) + tw(t, 6.2, 8.2, E.inQuad) * 140, focus: 300, aperture: 0.9 });
    // sky stays (almost) fixed: the horizon line is the card's rule line
    ctx.save();
    ctx.translate(-cam.x * 0.03, 0);
    nightSky(ctx, { hy: HY + 2, t, stars: 0.55 + 0.45 * tw(t, 1.0, 3.5), glowCol: '#3A4C78' });
    ctx.restore();
    const reveal = tw(t, 2.2, 4.2, E.inOut); // landscape details come up as the type leaves
    // far plane: land + distant R-7 complex with floodlights + searchlights
    cam.plane(ctx, 1400, (c, s) => {
      const hyW = (HY - H / 2) / s + cam.y; // world y of the screen horizon at start
      c.save();
      c.globalAlpha = 1;
      steppeGround(c, hyW, {});
      c.restore();
      if (reveal > 0) {
        c.save();
        c.globalAlpha = reveal;
        // low far ridges
        c.fillStyle = '#121A2C';
        c.beginPath(); c.moveTo(-2400, hyW + 2);
        for (let i = 0; i <= 48; i++) { const xx = -2400 + i * 100; c.lineTo(xx, hyW - 6 - Math.abs(noise.n2(i * 0.31, 2.2)) * 26); }
        c.lineTo(2400, hyW + 2); c.closePath(); c.fill();
        // searchlights (slow sweep) behind the rocket
        const rx = -560, ry = hyW;
        for (let k = 0; k < 3; k++) {
          const a = -Math.PI / 2 + (k - 1) * 0.42 + Math.sin(t * 0.22 + k * 1.7) * 0.16;
          lightCone(c, rx + (k - 1) * 90, ry - 10, a, 0.06, 2200, '#BFD3FF', 0.14 * reveal);
        }
        r7Silhouette(c, rx, ry + 1, 520, { lights: reveal, t, color: '#0A111F', frost: 'rgba(200,220,255,.25)' });
        S.state.rocket = cam.project(rx, ry - 330, 1400);
        // vapour from the fuelled rocket drifting
        smokePlume(c, t, { x: rx + 10, y: ry - 330, count: 12, seed: 6, rise: 16, spread: 120, size: [60, 200], life: 7, color: '#9FB2D8', alpha: 0.18 * reveal, drift: 20 });
        // tiny pad lights along the horizon
        const r = rng(5);
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 30; i++) {
          const lx = -1600 + r() * 3200, ly = hyW - r() * 6;
          c.globalAlpha = reveal * (0.3 + 0.5 * r()) * (0.75 + 0.25 * Math.sin(t * 1.7 + i));
          c.fillStyle = r() < 0.3 ? '#FFB27A' : '#FFE8C2';
          c.beginPath(); c.arc(lx, ly, 1.6 + r() * 1.4, 0, TAU); c.fill();
        }
        c.restore();
      }
    });
    haze(ctx, HY - 60, HY + 70, '#2E3E64', 0.35 * reveal);
    // mid plane: the cosmonauts' cottage with its lit window
    cam.plane(ctx, 300, (c, s) => {
      c.save();
      c.globalAlpha = reveal;
      // utility poles receding
      for (let i = 0; i < 5; i++) {
        const px = 260 - i * 230, ph = 260 - i * 34;
        c.fillStyle = '#080C15';
        c.fillRect(px, 175 - ph, 5, ph);
        c.fillRect(px - 18, 175 - ph + 10, 41, 4);
      }
      c.strokeStyle = 'rgba(10,14,24,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(262, 175 - 250); c.quadraticCurveTo(140, -50, 32, 175 - 226); c.quadraticCurveTo(-90, -40, -198, 175 - 192); c.stroke();
      cottageExterior(c, 620, 178, 1.05, { win: reveal, t });
      c.restore();
      S.state.win = cam.project(620 - 39 * 1.05, 178 - 67 * 1.05, 300);
    });
    // near plane: grass (blurred, dark)
    cam.plane(ctx, -380, (c) => grassTufts(c, t, { y: 470, count: 30 }), { alpha: reveal });

    // the line: card rule → horizon
    const lineW = lerp(260, 1100, tw(t, 1.2, 3.4, E.inOutCubic));
    const lineA = 1 - tw(t, 3.2, 5.2, E.inOut) * 0.85;
    ctx.save();
    const lg = ctx.createLinearGradient(960 - lineW, 0, 960 + lineW, 0);
    lg.addColorStop(0, rgba(C.cream, 0)); lg.addColorStop(0.2, rgba(C.cream, 0.7)); lg.addColorStop(0.8, rgba(C.cream, 0.7)); lg.addColorStop(1, rgba(C.cream, 0));
    ctx.strokeStyle = lg; ctx.globalAlpha = lineA * tw(t, 0.35, 1.0); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(960 - lineW, HY); ctx.lineTo(960 + lineW, HY); ctx.stroke();
    ctx.restore();
    // the date card (time-jump interstitial)
    ctx.save();
    const lift = tw(t, 2.3, 3.0, E.in) * -60;
    ctx.translate(0, lift);
    dateCard(ctx, t, { x: 960, y: HY - 190 * 0.46, big: 'APRIL 11', top: '1961', color: C.cream, accent: C.gold, size: 190, out: 2.35 });
    ctx.restore();
    // place tag, synced to "Baikonur"
    const tb = S.abs - WT.baikonur + 0.1;
    if (tb > 0) {
      const rp = S.state.rocket || { x: 700, y: 440 };
      callout(ctx, tb, rp.x, rp.y, rp.x - 220, rp.y - 170, 'BAIKONUR', { sub: '45.92° N · 63.34° E', size: 26, color: C.cream, accent: C.gold });
    }
  },
};
// screen position of the cottage window at the end of S1 (for the zoom transition)
const WIN_CENTER = [1475 / 1920, 1 - 668 / 1080];

// ── S2: interior, the desk, rack focus to the photo ──────────────────────────
export const sDesk = {
  id: 'p4-02-desk',
  start: 484.32, end: 489.48,
  transition: { type: 'zoom', dur: 0.8, center: WIN_CENTER },
  post: { bloom: 0.3, bloomThreshold: 0.8, vignette: 0.48, contrast: 1.07, saturation: 0.95 },
  init(S) { S.state.photo = photoCanvas(); },
  render(ctx, t, S) {
    const abs = S.abs;
    const hh = handheld(t, 2.4, 0.3, 11);
    const rack = tw(abs, WT.valentina - 0.55, WT.valentina + 0.2, E.cam);
    const cam = new Cam25({
      x: lerp(-40, 120, tw(t, 0, 5.4, E.inOutSine)) + hh.x,
      y: lerp(10, -10, tw(t, 0, 5.4, E.inOutSine)) + hh.y,
      z: lerp(-900, -1000, E.out(clamp(t / 1.4))) + tw(t, 1.5, 5.4, E.inOutSine) * 60,
      focus: lerp(0, -260, rack), aperture: 1.25,
    });
    // back wall + window (far)
    cam.plane(ctx, 900, (c) => {
      c.fillStyle = pattern(c, plasterTex('#3B3029'), 2);
      c.fillRect(-2200, -1400, 4400, 2800);
      // lamp pool on the wall
      const g = c.createRadialGradient(-650, -100, 0, -650, -100, 1300);
      g.addColorStop(0, 'rgba(255,190,110,.45)'); g.addColorStop(0.5, 'rgba(255,170,90,.12)'); g.addColorStop(1, 'rgba(10,8,14,.55)');
      c.fillStyle = g; c.fillRect(-2200, -1400, 4400, 2800);
      windowNight(c, 520, -560, 760, 880, { t, rocket: 1 });
    });
    // Gagarin behind the desk, writing; lamp from screen-left, window rim from right
    cam.plane(ctx, 60, (c) => {
      const id = idle(t, 2);
      const scribble = Math.sin(t * 9) * 0.04;
      lit(c, (s) => {
        drawCharacter(s, 'gagarin', {
          x: 170, y: 0, s: 100, crop: 'bust', anchor: 'neck', outfit: 'shirt', arms: false,
          yaw: -0.4 + noise.n2(t * 0.3, 1) * 0.04, pitch: 0.4 + scribble * 0.3, tilt: -0.06,
          expr: { smile: 0.1, lookY: 0.8, lookX: -0.4, blink: id.blink, brow: 0.05 }, breathe: t,
          light: { x: -0.8, y: -0.4 },
        });
      }, { key: [-500, -120], keyR: 900, keyA: 0.32, dir: [1, 0.1], shadowA: 0.62, span: 230, center: [170, -110], rimCol: '#86A8DE', rimA: 0.5, rimDir: [1, -0.25] });
    });
    // desk (in front of him): wood, the letter, his writing hand, tea glass
    cam.plane(ctx, -70, (c) => {
      c.save();
      c.beginPath(); c.moveTo(-1700, 200); c.lineTo(1700, 200); c.lineTo(2100, 900); c.lineTo(-2100, 900); c.closePath();
      c.fillStyle = pattern(c, woodTex('#4A2E1C', { seed: 8 }), 1.6);
      c.fill();
      const g = c.createRadialGradient(-420, 380, 0, -420, 380, 1300);
      g.addColorStop(0, 'rgba(255,196,120,.45)'); g.addColorStop(0.55, 'rgba(255,160,80,.06)'); g.addColorStop(1, 'rgba(5,6,12,.72)');
      c.fillStyle = g; c.fill();
      c.fillStyle = 'rgba(255,210,150,.22)'; c.fillRect(-1700, 198, 3400, 4);
      c.restore();
      // letter paper in perspective
      c.save();
      c.beginPath(); c.moveTo(-330, 236); c.lineTo(250, 230); c.lineTo(400, 560); c.lineTo(-480, 576); c.closePath();
      c.fillStyle = '#EDE3CB'; c.fill();
      const pg = c.createLinearGradient(-500, 0, 400, 0);
      pg.addColorStop(0, 'rgba(255,220,170,.25)'); pg.addColorStop(1, 'rgba(40,30,40,.35)');
      c.fillStyle = pg; c.fill();
      c.clip();
      c.strokeStyle = rgba(INK, 0.6); c.lineWidth = 2.4;
      const rows = Math.floor(lerp(3, 7, tw(t, 0, 4.5, E.linear)));
      for (let i = 0; i < rows; i++) {
        const yy = 262 + i * 40, x0 = -320 - i * 22, x1 = 200 + i * 24;
        c.beginPath();
        for (let k = 0; k <= 70; k++) { const xx = lerp(x0 + 20, x1 - 30, k / 70); c.lineTo(xx, yy + Math.sin(k * 2.3 + i) * 4 + noise.n2(k * 0.4, i) * 3); }
        c.stroke();
      }
      c.restore();
      // forearm (foreshortened sleeve) + writing hand + pen
      const hx = 10 + Math.sin(t * 2.2) * 22, hy = 380 + Math.sin(t * 9) * 3;
      c.save();
      const sg = c.createLinearGradient(hx, hy, 300, 200);
      sg.addColorStop(0, '#F1EBDC'); sg.addColorStop(0.6, '#D9D1BE'); sg.addColorStop(1, '#9E9684');
      c.fillStyle = sg; c.strokeStyle = '#6B5A48'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(190, 196); c.quadraticCurveTo(110, 270, hx + 44, hy - 18); c.lineTo(hx + 74, hy + 34); c.quadraticCurveTo(220, 320, 330, 196); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#E9E3D3'; c.beginPath(); c.ellipse(hx + 58, hy + 8, 18, 34, 0.75, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#E2A982';
      c.beginPath(); c.ellipse(hx + 22, hy + 22, 40, 28, -0.35, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(120,70,50,.6)'; c.lineWidth = 2;
      c.beginPath(); c.arc(hx + 8, hy + 18, 17, 2.4, 4.0); c.stroke();
      c.restore();
      fountainPen(c, hx - 14, hy + 40, -2.45, 0.42, { shadowOff: [10, 14] });
      teaGlass(c, 640, 330, 0.95, { t });
    });
    // the framed photo standing on the desk (rack-focus target)
    cam.plane(ctx, -260, (c) => {
      const ph = S.state.photo;
      const fx = -430, fy = 150;
      c.save();
      c.translate(fx, fy);
      c.rotate(0.05);
      contactShadow(c, 10, 182, 340, { alpha: 0.55 });
      // wooden frame
      c.fillStyle = '#3A2414';
      c.fillRect(-150, -190, 300, 372);
      c.fillStyle = pattern(c, woodTex('#5E3A22', { seed: 4, horizontal: false }), 0.5);
      c.fillRect(-150, -190, 300, 372);
      c.fillStyle = '#E9DFC8'; c.fillRect(-126, -166, 252, 324);
      c.drawImage(ph, -112, -152, 224, 296);
      // glass glare
      const gg = c.createLinearGradient(-150, -190, 150, 182);
      gg.addColorStop(0, 'rgba(255,240,210,.0)'); gg.addColorStop(0.35, 'rgba(255,240,210,.18)'); gg.addColorStop(0.42, 'rgba(255,240,210,.02)'); gg.addColorStop(1, 'rgba(255,240,210,0)');
      c.fillStyle = gg; c.fillRect(-126, -166, 252, 324);
      // lamp light from left
      const lg = c.createLinearGradient(-150, 0, 150, 0);
      lg.addColorStop(0, 'rgba(255,190,110,.18)'); lg.addColorStop(1, 'rgba(8,10,20,.35)');
      c.fillStyle = lg; c.fillRect(-150, -190, 300, 372);
      c.restore();
      S.state.photoAt = cam.project(fx, fy, -260);
    });
    // foreground desk lamp (big, blurred) — the warm source
    cam.plane(ctx, -620, (c) => deskLampSide(c, -300, -190, 0.85, { t }));
    // dust in the lamp beam
    motes(ctx, t, { x: 520, y: 520, w: 900, h: 700, count: 40, seed: 3, alpha: 0.45 });
    // name: Valentina
    const tv = abs - WT.valentina + 0.12;
    if (tv > 0 && S.state.photoAt) {
      const p = S.state.photoAt;
      nameTag(ctx, tv, Math.min(1500, p.x + 230), Math.max(300, p.y - 40), { name: 'VALENTINA', role: 'his wife', color: C.cream, accent: C.gold, size: 64 });
    }
  },
};
