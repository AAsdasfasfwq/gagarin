// ─────────────────────────────────────────────────────────────────────────────
// P5 · "Poyekhali!" — 649.76 → 817.94. Launch, Korolev's commands, LET'S GO,
// ascent & g-forces, staging, engine-cutoff silence, weightlessness, first view
// of Earth. Director-animator: P5. See PLAN.md for the beat sheet.
// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../core/palette.js';
import { F, text } from '../../core/type.js';
import { pooledBg } from '../../core/draw.js';
import { SCRIPT } from '../../core/script.js';
import { s01 } from './scenes/s01_capsule.js';
import { s02, s03, s04, s05 } from './scenes/s02_launch.js';
import { buildAudio } from './audio.js';

const START = 649.76, END = 817.94;
const built = [s01, s02, s03, s04, s05];

// dev filler: covers any not-yet-built span so the part always tiles
function filler(id, start, end) {
  return {
    id, start, end,
    render(ctx, t, S) {
      pooledBg(ctx, C.ink);
      const seg = SCRIPT.segments.find((s) => S.abs >= s.start && S.abs < s.end + 0.6);
      if (seg) text(ctx, seg.text, 120, 560, { family: F.SERIF, size: 46, italic: true, color: C.cream });
      text(ctx, `${id} ${S.abs.toFixed(2)}`, 120, 980, { family: F.MONO, size: 28, color: C.steel });
    },
  };
}
const scenes = [];
let cur = START;
for (const s of [...built].sort((a, b) => a.start - b.start)) {
  if (s.start > cur + 1e-6) scenes.push(filler(`p5-todo-${cur.toFixed(2)}`, cur, s.start));
  scenes.push(s);
  cur = s.end;
}
if (cur < END - 1e-6) scenes.push(filler(`p5-todo-${cur.toFixed(2)}`, cur, END));

export default {
  id: 'p5', start: START, end: END, title: 'Poyekhali!',
  scenes,
  audio: { pre: 0, tail: 5, build: buildAudio },
};
