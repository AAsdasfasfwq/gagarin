// ─────────────────────────────────────────────────────────────────────────────
// type.js — typography system + text drawing on canvas.
// Families are loaded locally from assets/fonts/fonts.css (no system fonts).
//
//   DISPLAY  Unbounded              — wide constructivist display: big numbers, title words
//   COND     Big Shoulders Display  — condensed industrial: dates, headlines, labels
//   STENCIL  Big Shoulders Stencil  — rocket markings, military stamps, classified
//   SERIF    Instrument Serif       — editorial voice: small italic lead-ins, quotes, emotion
//   FRAUNCES Fraunces               — heavier soft serif for newspaper mastheads / headlines
//   MONO     Martian Mono           — telemetry, coordinates, technical tags
//   TYPE     Special Elite          — typewriter: secret documents, reports
//   HAND     La Belle Aurore        — handwriting (letter to Valentina)
//   HAND2    Homemade Apple         — alt handwriting (notes, flight log)
//   RUS      Oranienbaum            — Cyrillic serif for period Russian words (ТАСС, etc.)
//   (Unbounded and Martian Mono also have Cyrillic.)
//
// Rule of thumb from the references: pair a SMALL italic SERIF lead-in with a
// BIG condensed/display key word. Show 1–5 words, never the full sentence.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, E, tw } from './math.js';

export const F = {
  DISPLAY: "'Unbounded'",
  COND: "'Big Shoulders Display'",
  STENCIL: "'Big Shoulders Stencil Display'",
  SERIF: "'Instrument Serif'",
  FRAUNCES: "'Fraunces'",
  MONO: "'Martian Mono'",
  TYPE: "'Special Elite'",
  HAND: "'La Belle Aurore'",
  HAND2: "'Homemade Apple'",
  RUS: "'Oranienbaum'",
};

// font string: font(F.COND, 120, 800) / font(F.SERIF, 64, 400, true)
export function font(family, size, weight = 400, italic = false, stretch = '') {
  return `${italic ? 'italic ' : ''}${weight} ${stretch ? stretch + ' ' : ''}${size}px ${family}`;
}

export async function loadFonts() {
  const specs = [
    font(F.DISPLAY, 40, 200), font(F.DISPLAY, 40, 500), font(F.DISPLAY, 40, 900),
    font(F.COND, 40, 300), font(F.COND, 40, 700), font(F.COND, 40, 900),
    font(F.STENCIL, 40, 800), font(F.SERIF, 40, 400), font(F.SERIF, 40, 400, true),
    font(F.FRAUNCES, 40, 400), font(F.FRAUNCES, 40, 900), font(F.FRAUNCES, 40, 400, true),
    font(F.MONO, 40, 400), font(F.MONO, 40, 700), font(F.TYPE, 40, 400),
    font(F.HAND, 40, 400), font(F.HAND2, 40, 400), font(F.RUS, 40, 400),
  ];
  const samples = ['Aa1', 'Яя'];
  await Promise.all(specs.flatMap((s) => samples.map((txt) => document.fonts.load(s, txt).catch(() => null))));
  await document.fonts.ready;
}

// Set text state on ctx in one call
export function setText(ctx, { family = F.COND, size = 48, weight = 400, italic = false, color = '#fff', align = 'left', baseline = 'alphabetic', tracking = 0 } = {}) {
  ctx.font = font(family, size, weight, italic);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.letterSpacing = `${tracking}px`;
}

export function measure(ctx, text, opts) {
  ctx.save();
  setText(ctx, opts);
  const m = ctx.measureText(text);
  ctx.restore();
  return m.width;
}

// Draw text (single line) with options. Returns width.
export function text(ctx, str, x, y, opts = {}) {
  ctx.save();
  setText(ctx, opts);
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow.color || 'rgba(0,0,0,.35)';
    ctx.shadowBlur = opts.shadow.blur ?? 20;
    ctx.shadowOffsetX = opts.shadow.x ?? 0;
    ctx.shadowOffsetY = opts.shadow.y ?? 8;
  }
  if (opts.stroke) {
    ctx.lineWidth = opts.stroke.width || 2;
    ctx.strokeStyle = opts.stroke.color || '#000';
    ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
  }
  if (!opts.strokeOnly) ctx.fillText(str, x, y);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

// ── Kinetic reveals ──────────────────────────────────────────────────────────
// Masked line rise: text slides up from behind a mask line (classic editorial).
// p: 0..1 progress. Draws at baseline y.
export function maskRise(ctx, str, x, y, p, opts = {}) {
  const size = opts.size || 48;
  ctx.save();
  setText(ctx, opts);
  const w = ctx.measureText(str).width;
  const ax = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
  ctx.beginPath();
  ctx.rect(ax - size, y - size * 1.25, w + size * 2, size * 1.55);
  ctx.clip();
  const off = (1 - E.outQuint(clamp(p))) * size * 1.3;
  ctx.globalAlpha *= clamp(p * 3);
  ctx.fillText(str, x, y + off);
  ctx.restore();
  return w;
}

// Per-character stagger reveal. mode: 'rise' | 'fade' | 'blur' | 'scale' | 'type'
// t = local seconds since reveal start; stagger = seconds per char; dur = per-char anim.
export function staggerText(ctx, str, x, y, t, opts = {}) {
  const { stagger = 0.03, dur = 0.5, mode = 'rise', size = 48 } = opts;
  ctx.save();
  setText(ctx, { ...opts, align: 'left' });
  const chars = [...str];
  const widths = chars.map((c) => ctx.measureText(c).width + (opts.tracking || 0));
  const total = widths.reduce((a, b) => a + b, 0) - (opts.tracking || 0);
  let cx = opts.align === 'center' ? x - total / 2 : opts.align === 'right' ? x - total : x;
  const baseAlpha = ctx.globalAlpha;
  chars.forEach((c, i) => {
    const p = clamp((t - i * stagger) / dur);
    if (mode === 'type') {
      if (t >= i * stagger) ctx.fillText(c, cx, y);
    } else if (p > 0) {
      const e = E.outQuint(p);
      ctx.save();
      ctx.globalAlpha = baseAlpha * clamp(p * 2.2);
      if (mode === 'rise') ctx.translate(0, (1 - e) * size * 0.6);
      if (mode === 'scale') {
        ctx.translate(cx + widths[i] / 2, y - size * 0.35);
        ctx.scale(0.4 + 0.6 * e, 0.4 + 0.6 * e);
        ctx.translate(-(cx + widths[i] / 2), -(y - size * 0.35));
      }
      if (mode === 'blur' && e < 0.999) ctx.filter = `blur(${(1 - e) * 12}px)`;
      ctx.fillText(c, cx, y);
      ctx.restore();
    }
    cx += widths[i];
  });
  ctx.restore();
  return total;
}

// Word-by-word reveal synced to absolute word times (from script.json).
// words: [{text, at}] where at = absolute seconds; abs = current absolute time.
// Words already revealed are full; current word fades/rises in over `dur`.
export function syncedWords(ctx, words, x, y, abs, opts = {}) {
  const { dur = 0.25, gap = null, size = 48, dim = null } = opts;
  ctx.save();
  setText(ctx, { ...opts, align: 'left' });
  const space = gap ?? ctx.measureText(' ').width;
  const widths = words.map((w) => ctx.measureText(w.text).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let cx = opts.align === 'center' ? x - total / 2 : opts.align === 'right' ? x - total : x;
  const base = ctx.globalAlpha;
  words.forEach((w, i) => {
    const p = clamp((abs - w.at) / dur);
    if (p > 0 || dim) {
      ctx.save();
      if (p <= 0 && dim) { ctx.globalAlpha = base * dim; }
      else ctx.globalAlpha = base * (dim ? dim + (1 - dim) * p : p);
      ctx.translate(0, (1 - E.outQuint(p)) * size * 0.35);
      if (w.color) ctx.fillStyle = w.color;
      ctx.fillText(w.text, cx, y);
      ctx.restore();
    }
    cx += widths[i] + space;
  });
  ctx.restore();
  return total;
}

// Counter: animate a number from a to b between t0..t1 (absolute or local, your choice).
export function countUp(t, t0, t1, a, b, { ease = E.outCubic, decimals = 0, sep = ',' } = {}) {
  const v = a + (b - a) * ease(clamp((t - t0) / (t1 - t0)));
  const fixed = v.toFixed(decimals);
  if (!sep) return fixed;
  const [i, d] = fixed.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (d ? '.' + d : '');
}

// Wrap text into lines that fit maxWidth
export function wrap(ctx, str, maxWidth, opts) {
  ctx.save();
  setText(ctx, opts);
  const words = str.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

// Fades for any element: in at [a,b], out at [c,d]
export const inOut = (t, a, b, c, d) => tw(t, a, b, E.out) * (1 - tw(t, c, d, E.in));
