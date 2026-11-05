// P4 · "The Night Before" — 477.08–649.76 (see PLAN.md)
import { C } from '../../core/palette.js';
import { pooledBg } from '../../core/draw.js';
import { sEve, sDesk } from './scenes/eve.js';
import { buildAudio } from './audio.js';

const tmp = (id, start, end) => ({ id, start, end, render(ctx) { pooledBg(ctx, C.ink); } });

export default {
  id: 'p4', start: 477.08, end: 649.76, title: 'The Night Before',
  scenes: [sEve, sDesk, tmp('p4-tmp', 489.48, 649.76)],
  audio: { pre: 0, tail: 5, build: (A) => buildAudio(A) },
};
