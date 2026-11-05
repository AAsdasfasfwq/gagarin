// ─────────────────────────────────────────────────────────────────────────────
// P1 · 0.00–155.00 · "The Arms Race"
// coldwar → archive → toxic. See PLAN.md for the beat sheet.
// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../core/palette.js';
import { F, text } from '../../core/type.js';
import { pooledBg } from '../../core/draw.js';
import { SCRIPT } from '../../core/script.js';
import s01 from './scenes/s01_globe.js';
import s02 from './scenes/s02_poster.js';
import { buildAudio } from './audio.js';

const START = 0.0, END = 155.0;
const built = [s01, s02];

// dev filler for not-yet-built ranges (removed once the window is complete)
function filler(start, end) {
  return {
    id: `p1-dev-${start.toFixed(2)}`, start, end,
    render(ctx, t, S) {
      pooledBg(ctx, C.ink);
      const seg = SCRIPT.segments.find((s) => S.abs >= s.start && S.abs < s.end + 0.6);
      if (seg) text(ctx, seg.text, 120, 560, { family: F.SERIF, size: 40, italic: true, color: C.cream });
      text(ctx, S.abs.toFixed(2), 120, 980, { family: F.MONO, size: 28, color: C.steel });
    },
  };
}
const scenes = [];
let cur = START;
for (const s of [...built].sort((a, b) => a.start - b.start)) {
  if (s.start > cur + 1e-6) scenes.push(filler(cur, s.start));
  scenes.push(s);
  cur = s.end;
}
if (cur < END - 1e-6) scenes.push(filler(cur, END));

export default {
  id: 'p1', start: START, end: END, title: 'The Arms Race',
  scenes,
  audio: { pre: 0, tail: 4, build: buildAudio },
};
