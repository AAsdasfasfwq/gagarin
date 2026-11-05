// ─────────────────────────────────────────────────────────────────────────────
// components.js — the film's SIGNATURE graphic devices. Use these so the whole
// film shares one typographic voice. All are pure functions of local time t
// (seconds since the element's own start). Style them via opts, don't fork them.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, E, tw } from './math.js';
import { C, rgba } from './palette.js';
import { F, font, setText, maskRise, staggerText } from './type.js';
import { inkLine, scratchCanvas } from './draw.js';

// 1) DATE / TIME-JUMP CARD — big condensed numerals, a rule line that draws,
//    italic serif sub-line. Layout centred at (x,y). t: local seconds.
//    dateCard(ctx, t, { big: 'OCT 23', top: '1960', sub: 'Tyuratam test range', color, accent })
export function dateCard(ctx, t, { x = 960, y = 540, big = '', top = '', sub = '', color = C.cream, accent = C.orange, size = 190, out = null } = {}) {
  const o = out != null ? 1 - tw(t, out, out + 0.35, E.in) : 1;
  if (o <= 0) return;
  ctx.save();
  ctx.globalAlpha *= o;
  // small top line (year / chapter)
  if (top) staggerText(ctx, top, x, y - size * 0.72, t - 0.05, { family: F.MONO, size: 26, weight: 500, color: accent, align: 'center', tracking: 10, stagger: 0.035, dur: 0.4, mode: 'fade' });
  maskRise(ctx, big, x, y + size * 0.32, tw(t, 0.08, 0.75, E.linear), { family: F.COND, size, weight: 800, color, align: 'center', tracking: size * 0.02 });
  // rule line
  const lw = tw(t, 0.35, 1.05, E.outQuint);
  ctx.strokeStyle = rgba(color, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 260 * lw, y + size * 0.46);
  ctx.lineTo(x + 260 * lw, y + size * 0.46);
  ctx.stroke();
  if (sub) staggerText(ctx, sub, x, y + size * 0.46 + 58, t - 0.6, { family: F.SERIF, size: 40, italic: true, color: rgba(color, 0.9), align: 'center', stagger: 0.02, dur: 0.5, mode: 'rise' });
  ctx.restore();
}

// 2) NAME TAG — for introducing a person. Ink tick + CONDENSED NAME + italic role.
//    nameTag(ctx, t, 140, 860, { name: 'SERGEI KOROLEV', role: 'Chief Designer' })
export function nameTag(ctx, t, x, y, { name = '', role = '', color = C.cream, accent = C.orange, size = 64, align = 'left', out = null } = {}) {
  const o = out != null ? 1 - tw(t, out, out + 0.3, E.in) : 1;
  if (o <= 0) return;
  ctx.save();
  ctx.globalAlpha *= o;
  const dir = align === 'right' ? -1 : 1;
  const bar = tw(t, 0, 0.45, E.outQuint);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y - size * 0.95, dir * 8, size * 1.45 * bar);
  const tx = x + dir * 26;
  maskRise(ctx, name, tx, y, tw(t, 0.12, 0.7, E.linear), { family: F.COND, size, weight: 800, color, align, tracking: 2 });
  if (role) staggerText(ctx, role, tx, y + size * 0.62, t - 0.45, { family: F.SERIF, size: size * 0.55, italic: true, color: rgba(color, 0.85), align, stagger: 0.02, dur: 0.45, mode: 'rise' });
  ctx.restore();
}

// 3) TELEMETRY CALLOUT — dot on the object, elbow leader, mono label in brackets.
//    callout(ctx, t, objX, objY, labelX, labelY, 'LOX TANK', { sub: '−183 °C' })
export function callout(ctx, t, x0, y0, x1, y1, label, { sub = '', color = C.cream, accent = C.orange, size = 22, out = null } = {}) {
  const o = out != null ? 1 - tw(t, out, out + 0.25, E.in) : 1;
  if (o <= 0) return;
  ctx.save();
  ctx.globalAlpha *= o;
  const p = tw(t, 0, 0.55, E.outQuint);
  // pulse ring
  ctx.strokeStyle = rgba(accent, (1 - tw(t, 0, 0.9, E.out)) * 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x0, y0, 6 + 26 * tw(t, 0, 0.9, E.out), 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(x0, y0, 5 * clamp(p * 3), 0, Math.PI * 2); ctx.fill();
  const mx = x1, my = y0 + (y1 - y0);
  const pts = [[x0, y0], [lerp(x0, mx, 0.35), my], [mx, my]];
  ctx.strokeStyle = rgba(color, 0.85);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const total = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) + Math.abs(pts[2][0] - pts[1][0]);
  let rem = total * p;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 3 && rem > 0; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const k = Math.min(1, rem / (seg || 1));
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
    rem -= seg;
  }
  ctx.stroke();
  const right = x1 >= x0;
  const lx = x1 + (right ? 14 : -14);
  setText(ctx, { family: F.MONO, size, weight: 600, color, align: right ? 'left' : 'right', baseline: 'middle', tracking: 2 });
  const shown = Math.floor((`[ ${label} ]`.length) * tw(t, 0.3, 0.75, E.linear));
  ctx.fillText(`[ ${label} ]`.slice(0, shown), lx, my);
  if (sub) {
    setText(ctx, { family: F.SERIF, size: size * 1.35, italic: true, color: rgba(color, 0.85), align: right ? 'left' : 'right', baseline: 'top' });
    ctx.globalAlpha *= tw(t, 0.6, 1.0, E.out);
    ctx.fillText(sub, lx + (right ? 4 : -4), my + size * 0.75);
  }
  ctx.restore();
}

// 4) BIG NUMBER — hero statistic with unit; counts if `from` given.
//    bigNumber(ctx, t, 960, 600, { value: 108, from: 0, dur: 1.2, unit: 'MINUTES', lead: 'just' })
export function bigNumber(ctx, t, x, y, { value = 0, from = null, dur = 1.0, decimals = 0, unit = '', lead = '', color = C.cream, accent = C.orange, size = 260, family = F.DISPLAY, weight = 800, sep = ',', align = 'center', out = null } = {}) {
  const o = out != null ? 1 - tw(t, out, out + 0.3, E.in) : 1;
  if (o <= 0) return;
  ctx.save();
  ctx.globalAlpha *= o;
  const v = from == null ? value : from + (value - from) * E.outCubic(clamp(t / dur));
  let s = typeof value === 'string' ? value : v.toFixed(decimals);
  if (sep && typeof value !== 'string') { const [i, d] = s.split('.'); s = i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (d ? '.' + d : ''); }
  if (lead) staggerText(ctx, lead, x, y - size * 0.82, t, { family: F.SERIF, size: size * 0.2, italic: true, color: rgba(color, 0.9), align, stagger: 0.025, dur: 0.4 });
  ctx.font = font(family, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = `${-size * 0.03}px`;
  ctx.globalAlpha *= tw(t, 0, 0.25, E.out);
  const sc = lerp(1.08, 1, tw(t, 0, 0.6, E.outQuint));
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.fillText(s, 0, 0);
  ctx.restore();
  if (unit) {
    ctx.save();
    ctx.globalAlpha *= o;
    staggerText(ctx, unit, x, y + size * 0.36, t - 0.3, { family: F.COND, size: size * 0.24, weight: 700, color: accent, align, tracking: size * 0.03, stagger: 0.03, dur: 0.45 });
    ctx.restore();
  }
}

// 5) LEAD-IN + KEY WORD — the editorial pairing from the references:
//    a small italic serif lead-in above a big condensed key word.
//    leadKey(ctx, t, 960, 540, { lead: 'it was an', key: 'ARMS RACE' })
export function leadKey(ctx, t, x, y, { lead = '', key = '', color = C.cream, keyColor = null, size = 150, align = 'center', family = F.COND, weight = 800, out = null, leadAt = 0, keyAt = 0.25 } = {}) {
  const o = out != null ? 1 - tw(t, out, out + 0.3, E.in) : 1;
  if (o <= 0) return;
  ctx.save();
  ctx.globalAlpha *= o;
  if (lead) staggerText(ctx, lead, x, y - size * 0.82, t - leadAt, { family: F.SERIF, size: size * 0.34, italic: true, color: rgba(color, 0.92), align, stagger: 0.025, dur: 0.45, mode: 'rise' });
  maskRise(ctx, key, x, y, tw(t, keyAt, keyAt + 0.6, E.linear), { family, size, weight, color: keyColor || color, align, tracking: size * 0.01 });
  ctx.restore();
}

// 6) TRAJECTORY — the recurring ink-line motif (ballistic arc → orbit → descent).
//    Thin wrapper around draw.inkLine with the house style.
export function trajectory(ctx, pts, p, { color = C.cream, width = 3.5, head = true, glowCol = null, seed = 7 } = {}) {
  if (glowCol) {
    // render the glow once into a scratch layer, blur once (per-segment filters are very slow)
    const sc = scratchCanvas('trajectory-glow', 960, 540);
    sc.ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
    const m = ctx.getTransform();
    sc.ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    inkLine(sc.ctx, pts, p, { width: width * 3, color: glowCol, alpha: 0.6, seed, taper: false });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(5px)';
    ctx.drawImage(sc.c, 0, 0, 1920, 1080);
    ctx.restore();
  }
  return inkLine(ctx, pts, p, { width, color, seed, head });
}

// 7) SOURCE / CAPTION STRIP — tiny mono caption bottom-left (archival/illustrative labels)
export function caption(ctx, t, text, { x = 120, y = 990, color = C.cream, out = null } = {}) {
  const o = (out != null ? 1 - tw(t, out, out + 0.3, E.in) : 1) * tw(t, 0, 0.4, E.out);
  if (o <= 0) return;
  ctx.save();
  ctx.globalAlpha *= o * 0.75;
  setText(ctx, { family: F.MONO, size: 18, weight: 400, color, tracking: 3 });
  ctx.fillText(text, x, y);
  ctx.restore();
}
