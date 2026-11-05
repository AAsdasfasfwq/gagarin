// ─────────────────────────────────────────────────────────────────────────────
// P7 · "Fire and Earth" · 972.42 – 1127.00 — re-entry inferno → ice-calm →
// the cable burns → the sphere rights itself → ejection at 23,000 ft → the FAI
// cover-up → two canopies → the suffocating valve → a plowed field near Smelovka.
// See PLAN.md for the beat sheet.
// ─────────────────────────────────────────────────────────────────────────────
import { infernoScenes, infernoScenes2 } from './scenes/inferno.js';
import { buildScore } from './audio.js';
import { placeholder } from '../placeholder.js';

const START = 972.42, END = 1127.0;

const built = [...infernoScenes, ...infernoScenes2];
// temporary filler while building (removed when the window is fully covered)
const lastEnd = built.length ? built[built.length - 1].end : START;
const filler = lastEnd < END - 1e-6 ? placeholder('p7', lastEnd, END, 'Fire and Earth (wip)').scenes.map((s) => ({ ...s, id: 'p7-wip' })) : [];

export default {
  id: 'p7',
  start: START,
  end: END,
  title: 'Fire and Earth',
  scenes: [...built, ...filler],
  audio: { pre: 0.5, tail: 5, build: buildScore },
};
