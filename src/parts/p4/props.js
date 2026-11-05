// ─────────────────────────────────────────────────────────────────────────────
// p4/props.js — crafted props: the family photo, tea glass, desk lamp, night
// window, envelope, tubes, alarm clock, period bus, ashtray, dropper bottle.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, rng, noise, TAU, E, tw } from '../../core/math.js';
import { C, rgba, shade, mixColor } from '../../core/palette.js';
import { F, font } from '../../core/type.js';
import { makeCanvas, cached, glow, contactShadow, shadeSphere, shadeCylinder, W, H } from '../../core/draw.js';
import { drawCharacter } from '../../core/characters.js';
import { toned, woodTex, pattern, r7Silhouette, starField } from './lib.js';

// ── the family photograph (Valentina, little Lena, baby Galya) — sepia ──────
export function photoCanvas() {
  return cached('p4:photo', () => {
    const w = 448, h = 592;
    const { c, ctx } = makeCanvas(w, h);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.35, 20, w * 0.5, h * 0.45, h * 0.8);
    bg.addColorStop(0, '#D9D2C4'); bg.addColorStop(1, '#5E574C');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // studio drape
    ctx.fillStyle = 'rgba(40,36,30,.25)';
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(30 + i * 70, h * 0.3, 18, h * 0.6, 0.05, 0, TAU); ctx.fill(); }
    drawCharacter(ctx, 'valentina', { x: 250, y: 300, s: 60, crop: 'bust', anchor: 'neck', yaw: -0.18, tilt: 0.06, expr: { smile: 0.65, lookX: 0.1 }, arms: false });
    // baby bundle in her arms
    ctx.save();
    ctx.translate(268, 452);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#F2ECDD'; ctx.strokeStyle = '#6B6255'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 112, 58, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,80,70,.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-20 + i * 26, 10, 50, -2.4, -1.2); ctx.stroke(); }
    ctx.fillStyle = '#EDC3A2'; ctx.strokeStyle = '#7A5A48'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(-70, -8, 30, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5A4038'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-80, -10, 5, 0.2, 2.9); ctx.stroke(); ctx.beginPath(); ctx.arc(-62, -12, 5, 0.2, 2.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(-71, 4, 4, 0.3, 2.8); ctx.stroke();
    ctx.restore();
    // her arm around the bundle
    ctx.fillStyle = '#6C7E9C'; ctx.strokeStyle = '#4A4038'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(330, 470, 70, 34, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#EFC0A0'; ctx.beginPath(); ctx.ellipse(212, 492, 26, 18, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
    // little Lena in front-left
    drawCharacter(ctx, 'rita', { x: 112, y: 438, s: 44, crop: 'bust', anchor: 'neck', yaw: 0.28, expr: { smile: 0.8, teeth: 0.3 }, arms: false });
    const out = toned(c, '#8C6A44', { amt: 1 });
    const o2 = out.getContext('2d');
    // print grain + vignette + slight fade
    const r = rng(9);
    o2.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 2500; i++) { o2.fillStyle = `rgba(70,50,30,${r() * 0.18})`; o2.fillRect(r() * w, r() * h, 1.5, 1.5); }
    o2.globalCompositeOperation = 'source-over';
    const vg = o2.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    vg.addColorStop(0, 'rgba(60,40,20,0)'); vg.addColorStop(1, 'rgba(60,40,20,.45)');
    o2.fillStyle = vg; o2.fillRect(0, 0, w, h);
    o2.fillStyle = 'rgba(240,225,200,.10)'; o2.fillRect(0, 0, w, h);
    return out;
  });
}

// ── tea glass in a metal podstakannik (side view), base at (x,y) ────────────
export function teaGlass(ctx, x, y, s = 1, { t = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  contactShadow(ctx, 0, 0, 170, { alpha: 0.5 });
  // glass body
  const gw = 62, gh = 190;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-gw, -gh); ctx.lineTo(gw, -gh); ctx.lineTo(gw * 0.86, 0); ctx.lineTo(-gw * 0.86, 0); ctx.closePath();
  ctx.fillStyle = 'rgba(200,220,230,.12)'; ctx.fill();
  // tea
  ctx.clip();
  const tg = ctx.createLinearGradient(-gw, 0, gw, 0);
  tg.addColorStop(0, '#5A2208'); tg.addColorStop(0.35, '#B4561A'); tg.addColorStop(0.7, '#7A2E0C'); tg.addColorStop(1, '#3A1405');
  ctx.fillStyle = tg; ctx.fillRect(-gw, -gh * 0.78, gw * 2, gh);
  ctx.fillStyle = 'rgba(255,200,140,.35)'; ctx.fillRect(-gw, -gh * 0.78, gw * 2, 5);
  // spoon
  ctx.strokeStyle = '#C8CDD2'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-20, -gh * 0.2); ctx.lineTo(34, -gh - 70); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(230,240,245,.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-gw, -gh); ctx.lineTo(-gw * 0.86, 0); ctx.moveTo(gw, -gh); ctx.lineTo(gw * 0.86, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-gw * 0.7, -gh * 0.95, 7, gh * 0.85);
  // spoon top
  ctx.strokeStyle = '#D8DDE2'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(34, -gh); ctx.lineTo(48, -gh - 90); ctx.stroke();
  // podstakannik: ornamented nickel holder over lower 70%
  const hy = -gh * 0.72;
  ctx.beginPath(); ctx.moveTo(-gw * 0.92, hy); ctx.lineTo(gw * 0.92, hy); ctx.lineTo(gw * 0.9, -6); ctx.lineTo(gw * 1.02, 0); ctx.lineTo(-gw * 1.02, 0); ctx.lineTo(-gw * 0.9, -6); ctx.closePath();
  shadeCylinder(ctx, -gw, gw * 2, '#A7A193', { lx: -0.6, spec: 0.6 });
  // filigree cut-outs
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(40,20,10,.55)';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const cx = -gw * 0.6 + i * gw * 0.4, cy = hy + 24 + j * 38;
    ctx.beginPath(); ctx.ellipse(cx, cy, 8, 13, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#6A6458'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-gw * 0.92, hy); ctx.lineTo(gw * 0.92, hy); ctx.stroke();
  // handle
  ctx.strokeStyle = '#8D877A'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(gw * 0.92, hy + 12); ctx.bezierCurveTo(gw * 1.7, hy + 4, gw * 1.7, -30, gw * 0.95, -22); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,235,.4)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(gw * 0.98, hy + 8); ctx.bezierCurveTo(gw * 1.6, hy + 2, gw * 1.6, -36, gw * 1.0, -28); ctx.stroke();
  // steam
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `rgba(255,235,210,${0.08 + 0.04 * Math.sin(t * 2 + k)})`; ctx.lineWidth = 9;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) { const yy = -gh - 10 - i * 9; ctx.lineTo(-20 + k * 20 + Math.sin(i * 0.5 + t * 1.6 + k) * 10, yy); }
    ctx.stroke();
  }
  ctx.restore();
}

// ── foreground desk lamp (shade seen from the side, lit opening) ─────────────
export function deskLampSide(ctx, x, y, s = 1, { t = 0, on = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // arm going up out of frame
  ctx.strokeStyle = '#1C2522'; ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(40, -60); ctx.lineTo(120, -420); ctx.stroke();
  // conical shade (green enamel outside)
  ctx.beginPath(); ctx.moveTo(-40, -90); ctx.lineTo(70, -110); ctx.lineTo(190, 70); ctx.lineTo(-170, 120); ctx.closePath();
  const g = ctx.createLinearGradient(-170, 0, 190, 0);
  g.addColorStop(0, '#0E1F18'); g.addColorStop(0.35, '#2F5A45'); g.addColorStop(0.5, '#5E8C72'); g.addColorStop(0.7, '#244637'); g.addColorStop(1, '#0B1510');
  ctx.fillStyle = g; ctx.fill();
  // lit opening (rim ellipse) + bulb
  ctx.save();
  ctx.translate(10, 95); ctx.rotate(-0.14);
  ctx.beginPath(); ctx.ellipse(0, 0, 182, 36, 0, 0, TAU);
  const og = ctx.createRadialGradient(0, -6, 4, 0, 0, 182);
  og.addColorStop(0, `rgba(255,248,225,${on})`); og.addColorStop(0.35, `rgba(255,214,150,${on})`); og.addColorStop(1, 'rgba(180,120,60,1)');
  ctx.fillStyle = og; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#C9CFC8'; ctx.stroke();
  ctx.restore();
  ctx.restore();
  if (on > 0) glow(ctx, x + 10 * s, y + 100 * s, 360 * s, '#FFCF8A', 0.35 * on);
}

// ── night window seen from inside: frame, mullions, curtain, steppe + rocket ─
export function windowNight(ctx, x, y, w, h, { t = 0, rocket = 1, reflect = 0, reflFn = null } = {}) {
  ctx.save();
  // outside view
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#0A1224'); g.addColorStop(0.62, '#1C2B4C'); g.addColorStop(0.66, '#0B111E'); g.addColorStop(1, '#070B14');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.8;
  ctx.drawImage(starField(11), 0, 0, 900, 560, x, y, w, h * 0.62);
  ctx.globalAlpha = 1;
  if (rocket > 0) r7Silhouette(ctx, x + w * 0.62, y + h * 0.645, h * 0.2, { lights: rocket, t, color: '#060A14' });
  if (reflect > 0 && reflFn) { ctx.save(); ctx.globalAlpha = reflect; ctx.globalCompositeOperation = 'screen'; reflFn(ctx); ctx.restore(); }
  // glass sheen
  const sh = ctx.createLinearGradient(x, y, x + w, y + h);
  sh.addColorStop(0, 'rgba(140,170,220,.08)'); sh.addColorStop(0.5, 'rgba(140,170,220,0)'); sh.addColorStop(1, 'rgba(140,170,220,.06)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h);
  ctx.restore();
  // frame + mullions (painted wood)
  ctx.strokeStyle = '#2A2420'; ctx.lineWidth = 34; ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h * 0.36); ctx.lineTo(x + w, y + h * 0.36); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,190,120,.18)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x - 17, y + h + 17); ctx.lineTo(x - 17, y - 17); ctx.lineTo(x + w + 17, y - 17); ctx.stroke();
  // sill
  ctx.fillStyle = '#3A3028'; ctx.fillRect(x - 60, y + h + 14, w + 120, 36);
  ctx.fillStyle = 'rgba(255,200,140,.18)'; ctx.fillRect(x - 60, y + h + 14, w + 120, 6);
  // curtain (left), folds
  ctx.save();
  const cw = w * 0.32;
  for (let i = 0; i < 7; i++) {
    const fx = x - 70 + (i / 7) * cw;
    const cg = ctx.createLinearGradient(fx, 0, fx + cw / 7, 0);
    cg.addColorStop(0, '#3C2A2A'); cg.addColorStop(0.5, '#6A4A40'); cg.addColorStop(1, '#2E2020');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(fx, y - 60); ctx.lineTo(fx + cw / 7 + 2, y - 60);
    ctx.quadraticCurveTo(fx + cw / 7 + 10 + Math.sin(i) * 8, y + h * 0.6, fx + cw / 7 + 30, y + h + 30); ctx.lineTo(fx + 26, y + h + 30);
    ctx.quadraticCurveTo(fx + 8, y + h * 0.6, fx, y - 60); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

// ── envelope (front), centred at x,y, size w×h, flap 0 (open) → 1 (sealed) ─
export function envelope(ctx, x, y, w, h, { flap = 1, addr = '', rot = 0, paper = '#E6DAC0', lift = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.shadowColor = 'rgba(5,6,10,.45)'; ctx.shadowBlur = 24 * lift; ctx.shadowOffsetX = 8 * lift; ctx.shadowOffsetY = 16 * lift;
  ctx.fillStyle = paper; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = 'transparent';
  // back folds
  ctx.strokeStyle = rgba(shade(paper, -0.35), 0.6); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(0, h * 0.02); ctx.lineTo(w / 2, h / 2); ctx.stroke();
  // flap
  const fh = h * 0.55 * lerp(-1, 1, flap);
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, -h / 2 + fh); ctx.lineTo(w / 2, -h / 2); ctx.closePath();
  ctx.fillStyle = shade(paper, flap > 0 ? -0.06 : -0.15); ctx.fill();
  ctx.strokeStyle = rgba(shade(paper, -0.4), 0.7); ctx.stroke();
  ctx.restore();
}

// ── alarm clock face (circle → clock), centred at x,y, radius r ──────────────
export function clockFace(ctx, x, y, r, { h = 5, m = 30, bells = 1, ring = 0, t = 0 } = {}) {
  ctx.save();
  ctx.translate(x + (ring ? Math.sin(t * 70) * 3 * ring : 0), y);
  ctx.rotate(ring ? Math.sin(t * 55) * 0.02 * ring : 0);
  if (bells > 0) {
    ctx.globalAlpha *= bells;
    [-1, 1].forEach((sd) => {
      ctx.save(); ctx.translate(sd * r * 0.62, -r * 0.92); ctx.rotate(sd * 0.5);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.32, Math.PI, 0); ctx.closePath();
      shadeSphere(ctx, 0, -r * 0.05, r * 0.32, '#C7CBD0', { spec: 0.5 });
      ctx.restore();
    });
    ctx.fillStyle = '#8A8F96'; ctx.fillRect(-r * 0.06, -r * 1.25, r * 0.12, r * 0.3);
    ctx.globalAlpha = 1;
  }
  // case
  ctx.beginPath(); ctx.arc(0, 0, r * 1.08, 0, TAU);
  shadeSphere(ctx, 0, 0, r * 1.08, '#B8BEC4', { spec: 0.45, rim: '#FFE2C0' });
  // dial
  const dg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  dg.addColorStop(0, '#FBF6EA'); dg.addColorStop(1, '#E0D4BA');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2A2A2E';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU, big = i % 5 === 0;
    ctx.lineWidth = big ? r * 0.025 : r * 0.009;
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * r * (big ? 0.78 : 0.84), -Math.cos(a) * r * (big ? 0.78 : 0.84)); ctx.lineTo(Math.sin(a) * r * 0.9, -Math.cos(a) * r * 0.9); ctx.stroke();
  }
  ctx.fillStyle = '#1F2024'; ctx.font = font(F.COND, r * 0.17, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * TAU; ctx.fillText(String(i), Math.sin(a) * r * 0.64, -Math.cos(a) * r * 0.64); }
  // hands
  const ha = ((h % 12) + m / 60) / 12 * TAU, ma = (m / 60) * TAU;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#15161A'; ctx.lineWidth = r * 0.055;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ha) * r * 0.45, -Math.cos(ha) * r * 0.45); ctx.stroke();
  ctx.lineWidth = r * 0.035;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ma) * r * 0.74, -Math.cos(ma) * r * 0.74); ctx.stroke();
  ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(0, 0, r * 0.05, 0, TAU); ctx.fill();
  // glass glare
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.35, r * 0.14, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// ── aluminium food tube lying on a tray; squeeze 0..1 ────────────────────────
export function foodTube(ctx, x, y, s = 1, { rot = 0, squeeze = 0, band = '#C8352B', paste = '#7A3F22', out = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  contactShadow(ctx, 10, 46, 420, { alpha: 0.45, h: 40 });
  const L = 360, R = 44;
  // body (flattened crimped end at left), pinched where squeezed
  const pinch = squeeze * 0.55;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -R * 0.9);
  ctx.lineTo(-L / 2 + 30, -R);
  ctx.quadraticCurveTo(0, -R * (1 - pinch) , L / 2 - 40, -R);
  ctx.lineTo(L / 2 - 10, -R * 0.45);
  ctx.lineTo(L / 2 - 10, R * 0.45);
  ctx.lineTo(L / 2 - 40, R);
  ctx.quadraticCurveTo(0, R * (1 - pinch), -L / 2 + 30, R);
  ctx.lineTo(-L / 2, R * 0.9);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -R, 0, R);
  g.addColorStop(0, '#E9EDF0'); g.addColorStop(0.25, '#FFFFFF'); g.addColorStop(0.5, '#AEB6BC'); g.addColorStop(0.8, '#7C858C'); g.addColorStop(1, '#C3CAD0');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(60,66,72,.55)'; ctx.lineWidth = 2; ctx.stroke();
  // crimp ridges
  ctx.strokeStyle = 'rgba(80,86,92,.5)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-L / 2 + 6 + i * 4, -R * 0.85); ctx.lineTo(-L / 2 + 6 + i * 4, R * 0.85); ctx.stroke(); }
  // printed band (label stripe) + wrinkles from the squeeze
  ctx.save(); ctx.clip();
  ctx.fillStyle = band; ctx.globalAlpha = 0.85; ctx.fillRect(-60, -R, 70, R * 2);
  ctx.fillStyle = shade(band, 0.5); ctx.fillRect(-60, -R, 70, 6);
  ctx.globalAlpha = 1;
  if (squeeze > 0) {
    ctx.strokeStyle = `rgba(40,46,52,${0.5 * squeeze})`; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-40 + i * 12, -R); ctx.quadraticCurveTo(-30 + i * 12, 0, -40 + i * 12, R); ctx.stroke(); }
  }
  ctx.restore();
  // shoulder + cap
  ctx.fillStyle = '#9BA3A9'; ctx.beginPath(); ctx.moveTo(L / 2 - 10, -R * 0.45); ctx.lineTo(L / 2 + 14, -R * 0.24); ctx.lineTo(L / 2 + 14, R * 0.24); ctx.lineTo(L / 2 - 10, R * 0.45); ctx.closePath(); ctx.fill();
  // paste ribbon squeezed out
  if (out > 0) {
    ctx.strokeStyle = paste; ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(L / 2 + 14, 0);
    for (let i = 1; i <= 12; i++) { const k = i / 12 * out; ctx.lineTo(L / 2 + 14 + k * 160, Math.sin(k * 7) * 16 * k); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,180,.35)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(L / 2 + 14, -6);
    for (let i = 1; i <= 12; i++) { const k = i / 12 * out; ctx.lineTo(L / 2 + 14 + k * 160, Math.sin(k * 7) * 16 * k - 7); }
    ctx.stroke();
  } else {
    const cg = ctx.createLinearGradient(0, -R * 0.4, 0, R * 0.4);
    cg.addColorStop(0, '#3A3F46'); cg.addColorStop(0.4, '#6A717A'); cg.addColorStop(1, '#22262B');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(L / 2 + 12, -R * 0.4, 40, R * 0.8, 6); ctx.fill();
  }
  ctx.restore();
}

// ── 1960 PAZ-style bus, SIDE view facing right; (x,y) = ground under centre ──
export function busSide(ctx, x, y, s = 1, { wheelRot = 0, door = 0, pitch = 0, era = 0, body = '#9EC3D6', lower = '#E9E0C8', dust = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  contactShadow(ctx, 0, 6, 900, { alpha: 0.5, h: 40 });
  ctx.save();
  ctx.translate(0, -60);
  ctx.rotate(pitch);
  ctx.translate(0, 60);
  const L = 820, Hh = 330, y0 = -60; // body from y0-Hh to y0
  const bodyPath = new Path2D();
  bodyPath.moveTo(-L / 2, y0);
  bodyPath.lineTo(-L / 2, y0 - Hh + 70);
  bodyPath.quadraticCurveTo(-L / 2 + 6, y0 - Hh, -L / 2 + 90, y0 - Hh);
  bodyPath.lineTo(L / 2 - 120, y0 - Hh);
  bodyPath.quadraticCurveTo(L / 2 - 10, y0 - Hh + 6, L / 2 + 10, y0 - Hh + 150);
  bodyPath.quadraticCurveTo(L / 2 + 40, y0 - 120, L / 2 + 34, y0);
  bodyPath.closePath();
  // lower cream / upper blue
  ctx.save();
  ctx.clip(bodyPath);
  ctx.fillStyle = lower; ctx.fillRect(-L, y0 - Hh - 10, L * 2, Hh + 20);
  ctx.fillStyle = body; ctx.fillRect(-L, y0 - Hh - 10, L * 2, Hh * 0.56);
  // swoosh stripe
  ctx.fillStyle = shade(body, -0.25);
  ctx.beginPath(); ctx.moveTo(-L / 2, y0 - Hh * 0.46); ctx.lineTo(L / 2 + 40, y0 - Hh * 0.42); ctx.lineTo(L / 2 + 40, y0 - Hh * 0.36); ctx.lineTo(-L / 2, y0 - Hh * 0.4); ctx.fill();
  // volume: top light, bottom shadow
  const vg = ctx.createLinearGradient(0, y0 - Hh, 0, y0);
  vg.addColorStop(0, 'rgba(255,250,235,.35)'); vg.addColorStop(0.3, 'rgba(255,250,235,0)'); vg.addColorStop(0.75, 'rgba(10,15,25,.05)'); vg.addColorStop(1, 'rgba(10,15,25,.4)');
  ctx.fillStyle = vg; ctx.fillRect(-L, y0 - Hh - 10, L * 2, Hh + 20);
  // windows
  ctx.fillStyle = '#26334A';
  for (let i = 0; i < 5; i++) {
    const wx = -L / 2 + 40 + i * 118;
    ctx.beginPath(); ctx.roundRect(wx, y0 - Hh + 40, 100, 92, 14); ctx.fill();
  }
  // windshield (front, curved)
  ctx.beginPath(); ctx.moveTo(L / 2 - 120, y0 - Hh + 40); ctx.lineTo(L / 2 - 20, y0 - Hh + 40); ctx.quadraticCurveTo(L / 2 + 14, y0 - Hh + 90, L / 2 + 18, y0 - Hh + 150); ctx.lineTo(L / 2 - 120, y0 - Hh + 132); ctx.closePath(); ctx.fill();
  // window reflections (dawn sky)
  ctx.fillStyle = 'rgba(255,190,150,.25)';
  for (let i = 0; i < 6; i++) { const wx = -L / 2 + 40 + i * 118; ctx.beginPath(); ctx.moveTo(wx + 20, y0 - Hh + 40); ctx.lineTo(wx + 50, y0 - Hh + 40); ctx.lineTo(wx + 20, y0 - Hh + 132); ctx.lineTo(wx - 10, y0 - Hh + 132); ctx.fill(); }
  // door (folding) at front right
  const dx = L / 2 - 200;
  ctx.fillStyle = shade(lower, -0.12); ctx.fillRect(dx, y0 - Hh + 34, 70, Hh - 44);
  if (door > 0) { ctx.fillStyle = '#1A202C'; ctx.fillRect(dx + 4, y0 - Hh + 38, 62 * door, Hh - 52); }
  ctx.strokeStyle = shade(lower, -0.4); ctx.lineWidth = 3; ctx.strokeRect(dx, y0 - Hh + 34, 70, Hh - 44);
  // chrome trims + headlight + bumper
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,46,56,.7)'; ctx.stroke(bodyPath);
  ctx.fillStyle = '#C9CED3'; ctx.fillRect(-L / 2 - 6, y0 - 18, L + 50, 14);
  ctx.beginPath(); ctx.arc(L / 2 + 26, y0 - 90, 18, 0, TAU); ctx.fillStyle = '#FFF2D0'; ctx.fill(); ctx.strokeStyle = '#8A9096'; ctx.stroke();
  // wheels (arches + tyres + hubcaps)
  [[-L / 2 + 150, 0], [L / 2 - 150, 1]].forEach(([wx]) => {
    ctx.fillStyle = '#141820'; ctx.beginPath(); ctx.arc(wx, y0, 92, Math.PI, 0); ctx.fill();
    wheel(ctx, wx, -6, 70, wheelRot, { era });
  });
  ctx.restore();
  if (dust > 0) {
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const k = i / 10;
      ctx.fillStyle = `rgba(210,170,140,${0.12 * dust * (1 - k)})`;
      ctx.beginPath(); ctx.arc(x - (L / 2 + 40 + k * 300) * s, y - (10 + k * 60) * s, (40 + k * 120) * s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
// tyre + hubcap, centre (x,y), radius r. era 0 = 1961 chrome dome; 1 = later styles
export function wheel(ctx, x, y, r, rot = 0, { era = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  const tg = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.3, 0, 0, r);
  tg.addColorStop(0, '#3A3D44'); tg.addColorStop(0.8, '#1A1C20'); tg.addColorStop(1, '#0C0D10');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.rotate(rot);
  // tread blocks
  ctx.fillStyle = '#26292F';
  for (let i = 0; i < 24; i++) { ctx.save(); ctx.rotate(i / 24 * TAU); ctx.fillRect(-r * 0.05, -r, r * 0.1, r * 0.1); ctx.restore(); }
  // rim
  const rimC = era < 0.5 ? '#D5D9DD' : era < 1.5 ? '#3E4650' : '#B9C0C6';
  ctx.fillStyle = shade(rimC, -0.2); ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, TAU);
  shadeSphere(ctx, 0, 0, r * 0.58, rimC, { spec: 0.6 });
  // lug nuts
  ctx.fillStyle = shade(rimC, -0.45);
  const nl = era < 0.5 ? 6 : era < 1.5 ? 8 : 10;
  for (let i = 0; i < nl; i++) { const a = i / nl * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34, r * 0.05, 0, TAU); ctx.fill(); }
  ctx.fillStyle = shade(rimC, 0.3); ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, TAU); ctx.fill();
  ctx.restore();
}
