// ─────────────────────────────────────────────────────────────────────────────
// p4/lib.js — local craft helpers for "The Night Before" (477.08–649.76).
// Lighting passes for characters, handwriting, pseudo-cursive, wood, sepia,
// indicator lamps, hex nuts, the hatch, the R-7 silhouette, reticles.
// Everything deterministic; heavy canvases cached via cached().
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, rng, noise, makeNoise, TAU, E, tw, smoothstep } from '../../core/math.js';
import { C, rgba, shade, mixColor, hexToRgb } from '../../core/palette.js';
import { F, font } from '../../core/type.js';
import { makeCanvas, scratchCanvas, cached, W, H, shadeSphere, glow, contactShadow } from '../../core/draw.js';

// ── word times (absolute s, from assets/script.json) ─────────────────────────
export const WT = {
  april11: 477.08, eve: 480.76, silence: 482.44, baikonur: 483.52,
  evening: 484.9, yuri: 485.88, wrote: 486.56, farewell: 486.92, letter: 487.32, valentina: 488.58,
  itwas: 489.48, chances: 491.92, complete: 492.7, clarity: 493.28,
  ifsome: 493.88, happens: 494.88, ask: 496.18, especially: 497.58, valyusha: 498.8, not: 499.64, grief: 500.6, destroy: 500.94, you1: 501.4,
  life: 502.3, lifeis2: 503.26, afterall: 503.82, noone: 504.94, guaranteed: 505.56, hit: 506.58, car: 507.06, tomorrow: 507.32,
  please: 508.48, takecare: 509.14, girls: 509.92, love: 510.7, asido: 511.54, raise: 513.32, real: 514.24, people: 514.66,
  pampered: 515.78, hands: 517.68, dirty: 518.04, cling: 519.24, mother: 519.88,
  ifyou: 520.96, receive: 521.8, returned: 524.18, iwant: 525.14, loved: 526.86, very: 527.64, much: 528.12,
  vgagarina: 529.14, seven: 531.88, years: 532.28, later: 532.64, die: 534.64, training: 535.42, flight: 535.68,
  april61: 536.9, y1961: 537.4, never: 539.18, readit: 539.68,
  gagarin2: 540.3, titov: 541.86, spent: 542.5, small: 544.18, finnish: 544.82, house: 545.36, range: 546.32,
  doctors: 547.28, dozens: 548.3, sensors: 549.04, pulse1: 550.88, breathing: 551.52, slept: 552.28,
  korolev: 553.48, awake: 554.22, allnight: 554.54, walked: 556.1, house2: 556.74, took: 557.48, heart: 557.7, drops: 558.68,
  smoked: 559.64, endlessly: 560.08, chief: 561.66, nervous: 562.92, cosmonauts: 563.6, themselves: 564.26,
  sensors2: 566.04, peacefully: 567.88, perfect: 569.14, pulse2: 569.58,
  morning: 570.82, april12: 571.3, awakened: 572.84, five30: 573.52, breakfast: 575.34, tubes: 576.0,
  orange: 578.56, spacesuits: 578.98, suits: 580.54, color: 581.42, spot: 583.48, air: 584.1, landing: 584.74, anywhere: 585.1,
  snow: 586.48, taiga: 587.28, desert: 588.02,
  bus: 589.04, pad: 590.2, famous: 591.38, driver: 593.38, stop: 593.84, urinate: 595.26, wheel: 595.98, tradition: 596.96, today: 599.06,
  then: 599.76, base: 601.22, enormous: 601.84, r7: 602.36, rocket: 603.08, vapor: 604.02, oxygen: 605.74,
  goodbye: 607.4, people: 608.1, elevator: 610.04, top: 610.72, climbs: 611.54, cramped: 612.86, capsule: 613.28,
  hatch: 614.52, closes: 614.8, delay: 617.04, seal: 618.42, sensor: 618.68, activate: 619.56,
  contact: 620.38, n32: 621.2, fails: 621.72, lightup: 622.52, depress: 624.76, vacuum: 625.82, killing: 627.26,
  absolute: 628.84, silence2: 629.42, hiss: 631.58, valves: 632.56, oleg: 634.14, ivanovsky: 634.58, workers: 636.32,
  frantically: 636.72, unscrew: 637.38, n30: 637.94, nuts: 638.66, adjust: 639.36, troublesome: 639.88, contact2: 640.18,
  tighten: 641.22, again: 641.92, thistime: 642.52, light: 643.96, comeson: 644.16, airtight: 646.2,
  only: 647.14, minutes: 647.6, remain: 648.02, launch: 648.7, end: 649.76,
};

// ── small timing helpers ─────────────────────────────────────────────────────
export const env = (t, a, b, c, d, eIn = E.out, eOut = E.in) => tw(t, a, b, eIn) * (1 - tw(t, c, d, eOut));
export const between = (t, a, b) => t >= a && t < b;

// ── procedural texture from pixel fn (cached by key) ─────────────────────────
export function texFn(key, w, h, fn) {
  return cached('p4:' + key, () => {
    const { c, ctx } = makeCanvas(w, h);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = fn(x, y);
      d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3] ?? 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}

// Wood grain (walnut desk / timber planks)
export function woodTex(color = '#5A3A24', { w = 512, h = 512, seed = 3, ring = 1, horizontal = true } = {}) {
  const [R, G, B] = hexToRgb(color);
  const nz = makeNoise(seed);
  return texFn(`wood:${color}:${w}:${h}:${seed}:${ring}:${horizontal}`, w, h, (x, y) => {
    const u = horizontal ? x : y, v = horizontal ? y : x;
    const warp = nz.fbm2(u / 260, v / 60, 3) * 9;
    const g = Math.sin((v / 7 + warp) * ring) * 0.5 + 0.5;
    const fine = nz.n2(u / 2.2, v / 0.9) * 0.5 + 0.5;
    const k = 0.78 + g * 0.16 + fine * 0.07 + nz.fbm2(u / 90, v / 30, 2) * 0.08;
    return [R * k, G * k, B * k, 255];
  });
}

// Plaster / painted wall
export function plasterTex(color = '#3A3530', { w = 512, h = 512, seed = 5 } = {}) {
  const [R, G, B] = hexToRgb(color);
  const nz = makeNoise(seed);
  return texFn(`plaster:${color}:${w}:${seed}`, w, h, (x, y) => {
    const k = 0.9 + nz.fbm2(x / 70, y / 70, 4) * 0.12 + nz.n2(x / 1.7, y / 1.7) * 0.03;
    return [R * k, G * k, B * k, 255];
  });
}

export function pattern(ctx, img, scale = 1, offX = 0, offY = 0) {
  const p = ctx.createPattern(img, 'repeat');
  p.setTransform(new DOMMatrix().translate(offX, offY).scale(scale));
  return p;
}

// ── character lighting pass ─────────────────────────────────────────────────
// Draw anything (usually drawCharacter) through a scratch layer, then light it:
// shadow wedge away from the key, a warm key pool, and an optional rim colour.
// Coordinates of key/rim are in the CURRENT ctx transform space.
export function lit(ctx, draw, { key = [0, 0], keyR = 600, keyCol = '#FFC77A', keyA = 0.35, dir = [1, 0.2], shadowCol = '#0B1222', shadowA = 0.55, span = 400, rimCol = null, rimA = 0.5, rimDir = [1, 0], center = [0, 0], tint = null, tintA = 0.0 } = {}) {
  const sc = scratchCanvas('p4-lit');
  const s = sc.ctx;
  s.setTransform(ctx.getTransform());
  s.save();
  draw(s);
  s.restore();
  s.save();
  s.globalCompositeOperation = 'source-atop';
  // shadow across the form, away from the key
  const [cx, cy] = center;
  const g = s.createLinearGradient(cx - dir[0] * span, cy - dir[1] * span, cx + dir[0] * span, cy + dir[1] * span);
  g.addColorStop(0, rgba(shadowCol, 0));
  g.addColorStop(0.45, rgba(shadowCol, shadowA * 0.25));
  g.addColorStop(1, rgba(shadowCol, shadowA));
  s.fillStyle = g;
  s.fillRect(cx - 4000, cy - 4000, 8000, 8000);
  if (tint && tintA > 0) { s.fillStyle = rgba(tint, tintA); s.fillRect(cx - 4000, cy - 4000, 8000, 8000); }
  // warm key pool
  if (keyA > 0) {
    const k = s.createRadialGradient(key[0], key[1], 0, key[0], key[1], keyR);
    k.addColorStop(0, rgba(keyCol, keyA));
    k.addColorStop(1, rgba(keyCol, 0));
    s.fillStyle = k;
    s.fillRect(cx - 4000, cy - 4000, 8000, 8000);
  }
  s.restore();
  if (rimCol) {
    // rim: shifted copy difference → bright edge on the rim side
    s.save();
    s.globalCompositeOperation = 'source-atop';
    const rg = s.createLinearGradient(cx - rimDir[0] * span * 0.9, cy - rimDir[1] * span * 0.9, cx + rimDir[0] * span, cy + rimDir[1] * span);
    rg.addColorStop(0, rgba(rimCol, 0));
    rg.addColorStop(0.78, rgba(rimCol, 0));
    rg.addColorStop(1, rgba(rimCol, rimA));
    s.fillStyle = rg;
    s.fillRect(cx - 4000, cy - 4000, 8000, 8000);
    s.restore();
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(sc.c, 0, 0);
  ctx.restore();
}

// Tone a canvas to sepia/ink-wash (returns new canvas). colour = mid tone.
export function toned(src, colour = '#8A6A45', { amt = 1, paper = null } = {}) {
  const { c, ctx } = makeCanvas(src.width, src.height);
  if (paper) { ctx.fillStyle = paper; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = amt;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  ctx.drawImage(src, 0, 0);
  return c;
}

// ── handwriting ──────────────────────────────────────────────────────────────
export const INK = '#33285E'; // Soviet violet fountain-pen ink
// Reveal a handwritten string left→right up to p (0..1) with a pen nib at the edge.
export function handwrite(ctx, str, x, y, p, { size = 64, color = INK, family = F.HAND, nib = true, align = 'left', alpha = 1, seed = 1, slant = 0 } = {}) {
  ctx.save();
  ctx.font = font(family, size, 400);
  const w = ctx.measureText(str).width;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const pp = clamp(p);
  const edge = x0 + w * pp;
  ctx.globalAlpha *= alpha;
  if (pp > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - size, y - size * 1.6, w * pp + size, size * 2.6);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    if (slant) { ctx.translate(x0, y); ctx.transform(1, 0, slant, 1, 0, 0); ctx.translate(-x0, -y); }
    ctx.fillText(str, x0, y);
    ctx.restore();
    // wet ink sheen on the last few letters
    if (pp < 1) {
      const g = ctx.createLinearGradient(edge - size * 1.2, 0, edge, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(120,100,200,0.25)');
      ctx.save();
      ctx.beginPath(); ctx.rect(edge - size * 1.2, y - size * 1.4, size * 1.2, size * 2.2); ctx.clip();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.restore();
    }
  }
  ctx.restore();
  let nibPos = null;
  if (nib && pp > 0 && pp < 1) {
    const wob = noise.n2(pp * 40 + seed, seed * 3.1);
    nibPos = { x: edge, y: y - size * (0.32 + 0.22 * wob) };
  }
  return { w, x0, edge, nib: nibPos };
}

// Fountain pen seen from above at nib point (x,y), angle a (rad, pointing to the nib)
export function fountainPen(ctx, x, y, a = -2.2, s = 1, { shadow = true, shadowOff = [26, 30] } = {}) {
  const body = (c, dark = false) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    // nib (gold) → section → barrel (pointing along +x from nib)
    const L = 520 * s, R = 15 * s;
    if (dark) {
      c.fillStyle = 'rgba(8,10,20,0.35)';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(46 * s, -9 * s); c.lineTo(L, -R); c.lineTo(L + 20 * s, 0); c.lineTo(L, R); c.lineTo(46 * s, 9 * s); c.closePath(); c.fill();
      c.restore(); return;
    }
    // nib
    const ng = c.createLinearGradient(0, -8 * s, 0, 8 * s);
    ng.addColorStop(0, '#F7E2A0'); ng.addColorStop(0.5, '#C99A3E'); ng.addColorStop(1, '#7A5418');
    c.fillStyle = ng;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(50 * s, -9 * s); c.lineTo(50 * s, 9 * s); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,40,10,.8)'; c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(4 * s, 0); c.lineTo(34 * s, 0); c.stroke();
    c.fillStyle = '#3A2810'; c.beginPath(); c.arc(30 * s, 0, 1.8 * s, 0, TAU); c.fill();
    // section
    const sg = c.createLinearGradient(0, -R, 0, R);
    sg.addColorStop(0, '#5A5F6A'); sg.addColorStop(0.35, '#2A2E36'); sg.addColorStop(1, '#0F1116');
    c.fillStyle = sg;
    c.beginPath(); c.moveTo(48 * s, -10 * s); c.lineTo(110 * s, -R * 0.95); c.lineTo(110 * s, R * 0.95); c.lineTo(48 * s, 10 * s); c.closePath(); c.fill();
    // barrel (deep maroon bakelite)
    const bg = c.createLinearGradient(0, -R, 0, R);
    bg.addColorStop(0, '#B4655A'); bg.addColorStop(0.25, '#6E2A24'); bg.addColorStop(0.6, '#3E1512'); bg.addColorStop(1, '#1C0907');
    c.fillStyle = bg;
    c.beginPath(); c.roundRect(108 * s, -R, L - 108 * s, R * 2, R * 0.9); c.fill();
    // gold ring + clip
    c.fillStyle = '#D6AE52'; c.fillRect(112 * s, -R, 10 * s, R * 2);
    c.fillStyle = 'rgba(255,240,220,.28)'; c.fillRect(130 * s, -R * 0.62, L - 150 * s, R * 0.22);
    c.restore();
  };
  if (shadow) { ctx.save(); ctx.translate(shadowOff[0] * s, shadowOff[1] * s); ctx.filter = 'blur(6px)'; body(ctx, true); ctx.restore(); }
  body(ctx);
}

// ── pseudo-cursive (illegible handwriting rows) ─────────────────────────────
// Returns a cached canvas with `lines` rows of cursive scribble + per-line widths.
export function cursiveSheet(key, { w = 900, lines = 8, lineH = 64, size = 26, color = INK, seed = 4, indent = 0, short = [] } = {}) {
  return cached('p4:cursive:' + key, () => {
    const { c, ctx } = makeCanvas(w + 40, lines * lineH + 40);
    const r = rng(seed);
    const widths = [];
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let li = 0; li < lines; li++) {
      const base = 20 + (li + 0.75) * lineH;
      let x = 20 + (li === 0 ? indent : 0);
      const maxW = short.includes(li) ? w * (0.35 + r() * 0.25) : w * (0.88 + r() * 0.1);
      const pts = [];
      while (x < maxW) {
        const letters = 2 + Math.floor(r() * 6);
        const word = [];
        for (let k = 0; k < letters; k++) {
          const kind = r();
          const lw = size * (0.42 + r() * 0.35);
          const hh = kind < 0.16 ? -size * (1.05 + r() * 0.3) : kind < 0.26 ? size * (0.75 + r() * 0.3) : -size * (0.42 + r() * 0.18);
          // a letter: up-stroke to hh, loop back down to baseline
          word.push([x, base], [x + lw * 0.35, base + hh], [x + lw * 0.7, base + (hh < 0 ? hh * 0.25 : -size * 0.1)], [x + lw, base]);
          x += lw;
        }
        pts.push(word);
        x += size * (0.5 + r() * 0.5);
      }
      widths.push(x - 20);
      ctx.lineWidth = Math.max(1.6, size * 0.075);
      for (const wd of pts) {
        ctx.beginPath();
        ctx.moveTo(wd[0][0], wd[0][1]);
        for (let i = 1; i < wd.length - 2; i++) {
          const mx = (wd[i][0] + wd[i + 1][0]) / 2, my = (wd[i][1] + wd[i + 1][1]) / 2;
          ctx.quadraticCurveTo(wd[i][0], wd[i][1], mx, my);
        }
        ctx.lineTo(wd[wd.length - 1][0], wd[wd.length - 1][1]);
        ctx.stroke();
        // occasional dot / crossbar
        if (r() < 0.35) { ctx.beginPath(); const q = wd[Math.floor(r() * wd.length)]; ctx.moveTo(q[0] - size * 0.2, q[1] - size * 0.55); ctx.lineTo(q[0] + size * 0.25, q[1] - size * 0.6); ctx.stroke(); }
      }
    }
    return { c, widths, lineH, pad: 20 };
  });
}
// draw a cursive sheet revealed up to `p` (0..1 over all lines), at x,y (top-left)
export function drawCursive(ctx, sheet, x, y, p, { alpha = 1, fromLine = 0 } = {}) {
  const n = sheet.widths.length;
  const total = sheet.widths.reduce((a, b) => a + b, 0);
  let rem = clamp(p) * total;
  ctx.save();
  ctx.globalAlpha *= alpha;
  let nibX = null, nibY = null;
  for (let i = 0; i < n; i++) {
    const wl = sheet.widths[i];
    const vis = Math.min(wl, rem);
    rem -= wl;
    if (i < fromLine) continue;
    if (vis <= 0) break;
    const sy = sheet.pad + i * sheet.lineH;
    ctx.drawImage(sheet.c, 0, sy, sheet.pad + vis, sheet.lineH, x - sheet.pad, y + i * sheet.lineH, sheet.pad + vis, sheet.lineH);
    if (vis < wl) { nibX = x + vis; nibY = y + (i + 0.6) * sheet.lineH; }
  }
  ctx.restore();
  return nibX != null ? { x: nibX, y: nibY } : null;
}

// Ink blot blooming (organic radial blob with feathered rim)
export function inkBlot(ctx, x, y, r, { color = INK, seed = 3, t = 0 } = {}) {
  if (r <= 0.5) return;
  ctx.save();
  const pts = [];
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + noise.n2(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 + t * 0.1) * 0.22 + noise.n2(a * 3 + seed, 4) * 0.06;
    pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]);
  }
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.2);
  g.addColorStop(0, rgba(shade(color, -0.3), 0.95));
  g.addColorStop(0.7, rgba(color, 0.9));
  g.addColorStop(1, rgba(color, 0.55));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(160,140,255,0.12)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.15, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ── night sky ────────────────────────────────────────────────────────────────
export function nightSky(ctx, { top = '#070D1C', mid = '#12203A', horizon = '#26365A', hy = 640, stars = 1, t = 0, seed = 4, glowCol = null } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, top); g.addColorStop(0.6, mid); g.addColorStop(1, horizon);
  ctx.fillStyle = g;
  ctx.fillRect(-200, -400, W + 400, hy + 400);
  if (stars > 0) {
    const st = starField(seed);
    ctx.save();
    ctx.globalAlpha *= stars;
    ctx.drawImage(st, 0, 0, W, hy, 0, 0, W, hy);
    // twinkle a few bright ones
    const r = rng(seed + 7);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = r() * hy * 0.9, ph = r() * 9;
      const k = 0.5 + 0.5 * Math.sin(t * (1.3 + r()) + ph);
      ctx.globalAlpha = stars * k * 0.6;
      ctx.fillStyle = '#F4EBD6';
      ctx.fillRect(x - 0.8, y - 5, 1.6, 10); ctx.fillRect(x - 5, y - 0.8, 10, 1.6);
    }
    ctx.restore();
  }
  if (glowCol) {
    const hg = ctx.createLinearGradient(0, hy - 220, 0, hy);
    hg.addColorStop(0, rgba(glowCol, 0)); hg.addColorStop(1, rgba(glowCol, 0.35));
    ctx.fillStyle = hg; ctx.fillRect(-200, hy - 220, W + 400, 220);
  }
}
export function starField(seed = 4) {
  return cached('p4:stars:' + seed, () => {
    const { c, ctx } = makeCanvas(W, H);
    const r = rng(seed);
    // milky band
    ctx.save();
    ctx.translate(W * 0.5, H * 0.35); ctx.rotate(-0.35);
    for (let i = 0; i < 1400; i++) {
      const x = (r() - 0.5) * W * 1.6, y = r.gauss() * 70;
      ctx.globalAlpha = 0.15 + r() * 0.35;
      ctx.fillStyle = r() < 0.2 ? '#FFE8C8' : '#DCE6FF';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
    for (let i = 0; i < 1100; i++) {
      const x = r() * W, y = r() * H, s = Math.pow(r(), 3) * 1.5 + 0.3;
      ctx.globalAlpha = 0.25 + r() * 0.7;
      ctx.fillStyle = r() < 0.15 ? '#FFE2C0' : r() > 0.85 ? '#CFE3FF' : '#F4F1EA';
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    }
    return c;
  });
}

// ── distant R-7 silhouette on its pad (2D), base at (x,y), height h ──────────
export function r7Silhouette(ctx, x, y, h, { color = '#0B1322', lights = 1, t = 0, frost = null, gantry = true, glowCol = '#FFE2B0' } = {}) {
  const u = h / 100;
  ctx.save();
  ctx.translate(x, y);
  // floodlight glow behind
  if (lights > 0) glow(ctx, 0, -h * 0.45, h * 0.9, glowCol, 0.22 * lights);
  ctx.fillStyle = color;
  // gantry / service towers
  if (gantry) {
    ctx.fillRect(-26 * u, -62 * u, 4 * u, 62 * u);
    ctx.fillRect(22 * u, -58 * u, 4 * u, 58 * u);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.8, 0.9 * u);
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-26 * u, -i * 9 * u); ctx.lineTo(-22 * u, -(i + 1) * 9 * u); ctx.moveTo(22 * u, -i * 8 * u); ctx.lineTo(26 * u, -(i + 1) * 8 * u); ctx.stroke(); }
    // support arms
    ctx.beginPath(); ctx.moveTo(-22 * u, -34 * u); ctx.lineTo(-6 * u, -38 * u); ctx.moveTo(22 * u, -32 * u); ctx.lineTo(6 * u, -38 * u); ctx.stroke();
  }
  // boosters (two visible) + core
  ctx.beginPath();
  ctx.moveTo(-12 * u, 0); ctx.lineTo(-9 * u, -10 * u); ctx.lineTo(-6 * u, -30 * u); ctx.lineTo(-4.2 * u, -38 * u); ctx.lineTo(-4.2 * u, -66 * u);
  ctx.lineTo(-3.6 * u, -72 * u); ctx.lineTo(-3.6 * u, -80 * u); ctx.lineTo(-2.4 * u, -84 * u); ctx.lineTo(-2.4 * u, -92 * u); ctx.lineTo(0, -100 * u);
  ctx.lineTo(2.4 * u, -92 * u); ctx.lineTo(2.4 * u, -84 * u); ctx.lineTo(3.6 * u, -80 * u); ctx.lineTo(3.6 * u, -72 * u); ctx.lineTo(4.2 * u, -66 * u); ctx.lineTo(4.2 * u, -38 * u);
  ctx.lineTo(6 * u, -30 * u); ctx.lineTo(9 * u, -10 * u); ctx.lineTo(12 * u, 0); ctx.closePath();
  ctx.fill();
  if (frost) {
    ctx.fillStyle = frost;
    ctx.fillRect(-3.4 * u, -64 * u, 6.8 * u, 10 * u);
  }
  // lights on the structure
  if (lights > 0) {
    const r = rng(77);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const lx = (r() - 0.5) * 56 * u, ly = -r() * 64 * u;
      const k = 0.6 + 0.4 * Math.sin(t * 2 + i);
      ctx.globalAlpha = lights * k;
      ctx.fillStyle = r() < 0.2 ? '#FF9A6A' : '#FFE9C4';
      ctx.beginPath(); ctx.arc(lx, ly, Math.max(0.8, 0.7 * u), 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ── indicator lamp (bakelite bezel + glass lens) ─────────────────────────────
export function lampBulb(ctx, x, y, r, on = 0, { col = '#7CFF9A', off = '#2A3330', label = null, labelCol = '#C9C2AE', flick = 0 } = {}) {
  ctx.save();
  // bezel
  const bz = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.2, x, y, r * 1.45);
  bz.addColorStop(0, '#5A5F66'); bz.addColorStop(0.6, '#2B2F35'); bz.addColorStop(1, '#121417');
  ctx.fillStyle = bz;
  ctx.beginPath(); ctx.arc(x, y, r * 1.38, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath(); ctx.arc(x, y, r * 1.3, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
  // lens
  const k = clamp(on);
  const lensC = mixColor(off, col, k);
  const lg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
  lg.addColorStop(0, mixColor(lensC, '#FFFFFF', 0.25 + k * 0.5));
  lg.addColorStop(0.5, lensC);
  lg.addColorStop(1, shade(lensC, -0.45));
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  // fresnel rings on the lens
  ctx.strokeStyle = rgba('#FFFFFF', 0.08 + 0.12 * k); ctx.lineWidth = Math.max(0.6, r * 0.04);
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(x, y, r * i / 4, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.14, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
  if (k > 0.02) glow(ctx, x, y, r * (3 + 3 * k), col, 0.4 * k);
  if (label) {
    ctx.save();
    ctx.font = font(F.MONO, Math.max(10, r * 0.62), 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = labelCol;
    ctx.fillText(label, x, y + r * 2.15);
    ctx.restore();
  }
}

// ── hex nut (seen face-on), rotation rot, light upper-left ───────────────────
export function hexNut(ctx, x, y, r, rot = 0, { col = '#A9B2B8', lift = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (lift > 0) { ctx.fillStyle = `rgba(5,8,14,${0.35 * Math.min(1, lift)})`; ctx.beginPath(); ctx.ellipse(r * 0.35 * lift, r * 0.5 * lift, r * 1.05, r * 1.0, 0, 0, TAU); ctx.fill(); }
  // bolt stud under
  ctx.fillStyle = '#4A4F55';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(-lift * r * 0.25, -lift * r * 0.3);
  ctx.scale(1 + lift * 0.12, 1 + lift * 0.12);
  ctx.rotate(rot);
  const hex = new Path2D();
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; i ? hex.lineTo(Math.cos(a) * r, Math.sin(a) * r) : hex.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  hex.closePath();
  // facets: each face shaded by its normal vs light
  for (let i = 0; i < 6; i++) {
    const a0 = i * TAU / 6, a1 = (i + 1) * TAU / 6, am = (a0 + a1) / 2 + rot;
    const lum = 0.5 + 0.5 * Math.cos(am - (-2.3));
    ctx.fillStyle = shade(col, lerp(-0.55, 0.3, lum));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r); ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r); ctx.closePath(); ctx.fill();
  }
  // chamfer top face
  const tg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 0.85);
  tg.addColorStop(0, shade(col, 0.35)); tg.addColorStop(1, shade(col, -0.15));
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(10,12,16,.55)'; ctx.lineWidth = Math.max(0.8, r * 0.06); ctx.stroke(hex);
  // threaded hole
  ctx.fillStyle = '#23272C';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(200,210,220,.25)'; ctx.lineWidth = Math.max(0.6, r * 0.04);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0.3, 2.6); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ── the Vostok hatch seen face-on: metal disc, seal ring, 30 nuts ────────────
// nut(i) → { out: 0..1 (0 = seated), rot }, highlight(i) → 0..1
export function hatchDisc(ctx, cx, cy, r, { nut = null, glowSeal = 0, sealCol = '#7CFF9A', highlight = null, tilt = 0, t = 0, dark = 0 } = {}) {
  const tex = metalDisc();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 1 - tilt * 0.25);
  // outer frame ring (part of the sphere)
  const fr = ctx.createRadialGradient(-r * 0.4, -r * 0.5, r * 0.2, 0, 0, r * 1.32);
  fr.addColorStop(0, '#9AA4AA'); fr.addColorStop(0.7, '#4D565D'); fr.addColorStop(1, '#22282E');
  ctx.fillStyle = fr;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, TAU); ctx.fill();
  // seal groove
  ctx.fillStyle = '#15191E';
  ctx.beginPath(); ctx.arc(0, 0, r * 1.02, 0, TAU); ctx.fill();
  if (glowSeal > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(sealCol, 0.55 * glowSeal); ctx.lineWidth = r * 0.025;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.01, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // lid
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.drawImage(tex, -r, -r, r * 2, r * 2);
  const lg = ctx.createRadialGradient(-r * 0.45, -r * 0.55, r * 0.05, 0, 0, r * 1.1);
  lg.addColorStop(0, 'rgba(255,250,240,.35)'); lg.addColorStop(0.5, 'rgba(255,250,240,0)'); lg.addColorStop(1, 'rgba(5,8,14,.55)');
  ctx.fillStyle = lg; ctx.fillRect(-r, -r, r * 2, r * 2);
  // concentric machining
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
  for (let i = 4; i < 20; i++) { ctx.beginPath(); ctx.arc(0, 0, r * i / 20, 0, TAU); ctx.stroke(); }
  // inner boss + handle
  ctx.fillStyle = '#3A4248'; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, TAU); ctx.fill();
  const hg = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.3);
  hg.addColorStop(0, '#C9D0D4'); hg.addColorStop(1, '#5E676E');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(-r * 0.42, -r * 0.06, r * 0.84, r * 0.12, r * 0.06); ctx.fill();
  ctx.fillStyle = '#2A3036'; ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, TAU); ctx.fill();
  if (dark > 0) { ctx.fillStyle = `rgba(6,9,15,${dark})`; ctx.fillRect(-r, -r, r * 2, r * 2); }
  ctx.restore();
  // nuts ring
  const N = 30;
  const nr = r * 1.155;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * TAU;
    const st = nut ? nut(i) : { out: 0, rot: 0 };
    const out = st.out || 0;
    const px = Math.cos(a) * nr, py = Math.sin(a) * nr;
    // stud
    ctx.fillStyle = '#2C3238'; ctx.beginPath(); ctx.arc(px, py, r * 0.034, 0, TAU); ctx.fill();
    if (out >= 1) continue;
    const ox = Math.cos(a) * out * r * 0.35, oy = Math.sin(a) * out * r * 0.35;
    hexNut(ctx, px + ox, py + oy, r * 0.062, (st.rot || 0) + a, { lift: out * 2.2, alpha: 1 - smoothstep(0.7, 1, out) });
    const hl = highlight ? highlight(i) : 0;
    if (hl > 0) glow(ctx, px, py, r * 0.14, '#9CFFB5', 0.5 * hl);
  }
  ctx.restore();
}
export function metalDisc() {
  return cached('p4:metaldisc', () => {
    const s = 512;
    const nz = makeNoise(31);
    const c = texFn('metaldisc-src', s, s, (x, y) => {
      const dx = x - s / 2, dy = y - s / 2;
      const rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const brushed = nz.n2(rr / 1.4, a * 2) * 0.5 + 0.5;
      const blotch = nz.fbm2(x / 60, y / 60, 3) * 0.5 + 0.5;
      const k = 0.72 + brushed * 0.12 + blotch * 0.12;
      return [146 * k, 156 * k, 162 * k, 255];
    });
    return c;
  });
}

// ── search reticle (bracket box + crosshair ticks) ───────────────────────────
export function reticle(ctx, x, y, s, { p = 1, lock = 0, col = '#F4EBD6', t = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  const k = E.out(clamp(p));
  const sz = s * lerp(1.6, 1, k) * lerp(1, 0.62, E.out(clamp(lock)));
  ctx.globalAlpha *= clamp(p * 2);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.2;
  const l = sz * 0.32;
  ctx.beginPath();
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
    ctx.moveTo(sx * sz, sy * sz + -sy * l); ctx.lineTo(sx * sz, sy * sz); ctx.lineTo(sx * sz + -sx * l, sy * sz);
  });
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-sz * 1.6, 0); ctx.lineTo(-sz * 1.15, 0); ctx.moveTo(sz * 1.15, 0); ctx.lineTo(sz * 1.6, 0);
  ctx.moveTo(0, -sz * 1.6); ctx.lineTo(0, -sz * 1.15); ctx.moveTo(0, sz * 1.15); ctx.lineTo(0, sz * 1.6);
  ctx.stroke();
  if (lock > 0) {
    ctx.strokeStyle = rgba(C.orange, clamp(lock));
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, sz * 0.55 * (1 + 0.15 * Math.sin(t * 9)), 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ── misc drawing ─────────────────────────────────────────────────────────────
export function vignetteRect(ctx, a = 0.5, col = '#060A12') {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, a));
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
// Dust motes drifting through a light beam (stateless)
export function motes(ctx, t, { x = 960, y = 540, w = 800, h = 600, count = 60, seed = 9, col = '#FFE7B8', alpha = 0.5, size = [0.8, 2.4] } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const px = r(), py = r(), sp = 0.3 + r() * 0.7, ph = r() * 50, sz = lerp(size[0], size[1], r());
    const xx = x + ((px * w + noise.n2(ph, t * 0.08 * sp) * 60 + t * 6 * sp) % w) - w / 2;
    const yy = y + ((py * h + noise.n2(ph + 3, t * 0.07 * sp) * 60 - t * 4 * sp + h * 10) % h) - h / 2;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * sp * 2 + ph)));
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(xx, yy, sz, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// soft text with a halo shadow for legibility over imagery
export function softShadowText(ctx, fn, { color = 'rgba(4,8,16,.55)', blur = 24 } = {}) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetY = 4;
  fn(ctx);
  ctx.restore();
}

// A thin rounded-corner "photo" print with white border; returns nothing
export function photoPrint(ctx, img, x, y, w, h, { rot = 0, border = 18, paper = '#EFE6D2', shadow = true } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (shadow) { ctx.shadowColor = 'rgba(5,6,10,.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 18; }
  ctx.fillStyle = paper;
  ctx.fillRect(-w / 2 - border, -h / 2 - border, w + border * 2, h + border * 2.6);
  ctx.shadowColor = 'transparent';
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export { clamp, lerp, rng, noise, TAU, E, tw, smoothstep, W, H, C, rgba, shade, mixColor, F, font };
