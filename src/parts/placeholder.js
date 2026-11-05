// Placeholder part used until a director delivers the real one.
import { C } from '../core/palette.js';
import { F, text } from '../core/type.js';
import { SCRIPT } from '../core/script.js';
import { pooledBg } from '../core/draw.js';
export function placeholder(id, start, end, title) {
  return {
    id, start, end, title,
    scenes: [{
      id: `${id}-placeholder`, start, end,
      render(ctx, t, S) {
        pooledBg(ctx, C.ink);
        text(ctx, `${id.toUpperCase()} · ${title}`, 120, 160, { family: F.COND, size: 64, weight: 800, color: C.orange });
        const seg = SCRIPT.segments.find((s) => S.abs >= s.start && S.abs < s.end + 0.6);
        if (seg) text(ctx, seg.text, 120, 560, { family: F.SERIF, size: 46, italic: true, color: C.cream });
        text(ctx, S.abs.toFixed(2), 120, 980, { family: F.MONO, size: 28, color: C.steel });
      },
    }],
    audio: { build() {} },
  };
}
