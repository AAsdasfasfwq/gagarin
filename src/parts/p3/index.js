// ─────────────────────────────────────────────────────────────────────────────
// P3 · 305.72–477.08 · "The Sphere and the Chosen One"
// Vostok 1 → ablative skin → cramped interior → the doctors' fears → 1-2-5 →
// 20 pilots → 2 → Gagarin chosen → the centrifuge → the smile (seam → P4).
// See PLAN.md for the beat sheet.
// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../core/palette.js';
import { F, text } from '../../core/type.js';
import { pooledBg } from '../../core/draw.js';
import { s01 } from './scenes/s01_vostok.js';
import { s02 } from './scenes/s02_sphere.js';
import { s03 } from './scenes/s03_ablative.js';
import { buildAudio } from './audio.js';

const START = 305.72, END = 477.08;
const built = [s01, s02, s03];
// development filler (removed once all scenes exist)
const last = built[built.length - 1].end;
const scenes = last < END ? [...built, { id: 'p3-zz-todo', start: last, end: END, render(ctx, t, S) { pooledBg(ctx, C.ink); text(ctx, 'P3 TODO ' + S.abs.toFixed(2), 120, 540, { family: F.MONO, size: 40, color: C.cream }); } }] : built;

export default {
  id: 'p3', start: START, end: END,
  title: 'The Sphere and the Chosen One',
  scenes,
  audio: { pre: 0, tail: 5, build: buildAudio },
};
