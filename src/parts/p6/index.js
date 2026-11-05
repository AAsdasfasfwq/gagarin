// P6 · "One Orbit" · 817.94–972.42 — see PLAN.md
import s01 from './scenes/s01_orbit.js';
import { C } from '../../core/palette.js';
import { pooledBg } from '../../core/draw.js';
import { F, text } from '../../core/type.js';

const START = 817.94, END = 972.42;
const scenes = [s01];
// temporary filler until all scenes exist
const last = scenes[scenes.length - 1].end;
if (last < END) scenes.push({ id: 'p6-zz-todo', start: last, end: END, render(ctx, t, S) { pooledBg(ctx, C.ink); text(ctx, 'P6 TODO ' + S.abs.toFixed(2), 120, 540, { family: F.MONO, size: 40, color: C.cream }); } });

export default {
  id: 'p6', start: START, end: END, title: 'One Orbit',
  scenes,
  audio: { pre: 0, tail: 4, build() {} },
};
