// ─────────────────────────────────────────────────────────────────────────────
// P2 · 155.00–305.72 · "Launch Site 41" — the Nedelin catastrophe.
// See PLAN.md for the beat sheet. Scenes tile the window exactly.
// ─────────────────────────────────────────────────────────────────────────────
import s01 from './scenes/s01_pad.js';
import { s02, s03 } from './scenes/s02_rules.js';
import { buildAudio } from './audio.js';
import { C } from '../../core/palette.js';
import { pooledBg } from '../../core/draw.js';
import { F, text } from '../../core/type.js';

const START = 155.0, END = 305.72;
const built = [s01, s02, s03];

// temporary filler for not-yet-built ranges (dev only)
function filler(a, b) {
  return { id: `p2-todo-${a}`, start: a, end: b, render(ctx, t, S) { pooledBg(ctx, C.ink); text(ctx, `p2 TODO ${S.abs.toFixed(2)}`, 120, 540, { family: F.MONO, size: 40, color: C.steel }); } };
}
const scenes = [];
let cur = START;
for (const s of built.sort((a, b) => a.start - b.start)) {
  if (s.start > cur + 1e-6) scenes.push(filler(cur, s.start));
  scenes.push(s);
  cur = s.end;
}
if (cur < END - 1e-6) scenes.push(filler(cur, END));

export default {
  id: 'p2', start: START, end: END, title: 'Launch Site 41',
  scenes,
  audio: { pre: 0.5, tail: 5, build: buildAudio },
};
