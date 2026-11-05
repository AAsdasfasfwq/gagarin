// ─────────────────────────────────────────────────────────────────────────────
// registry.js — the film's parts. Each part is owned end-to-end by ONE director
// (visuals + transitions + music + sfx) for its time window. Boundaries are
// fixed to VO sentence starts — do not change them.
// ─────────────────────────────────────────────────────────────────────────────
import p1 from './p1/index.js';
import p2 from './p2/index.js';
import p3 from './p3/index.js';
import p4 from './p4/index.js';
import p5 from './p5/index.js';
import p6 from './p6/index.js';
import p7 from './p7/index.js';
import p8 from './p8/index.js';

export const DURATION = 1306.0; // VO = 1303.93s + end hold
export const BOUNDS = {
  p1: [0, 155.0],
  p2: [155.0, 305.72],
  p3: [305.72, 477.08],
  p4: [477.08, 649.76],
  p5: [649.76, 817.94],
  p6: [817.94, 972.42],
  p7: [972.42, 1127.0],
  p8: [1127.0, DURATION],
};
export const PARTS = [p1, p2, p3, p4, p5, p6, p7, p8].map((p) => {
  const [s, e] = BOUNDS[p.id];
  if (Math.abs(p.start - s) > 1e-6 || Math.abs(p.end - e) > 1e-6) console.warn(`[registry] ${p.id} bounds ${p.start}-${p.end} differ from ${s}-${e}`);
  return p;
});
