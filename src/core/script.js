// ─────────────────────────────────────────────────────────────────────────────
// script.js — word-level timings from the voice-over transcript
// (assets/script.json). Use them to sync text/visual beats exactly to speech.
//   import { SCRIPT } from '../../core/script.js';
//   SCRIPT.find('Let\'s go', 690)  → {start, end, text} first match at/after t=690
//   SCRIPT.wordsIn(470, 480)       → [{text,start,end}, ...]
// ─────────────────────────────────────────────────────────────────────────────
export const SCRIPT = {
  words: [],
  segments: [],
  async load(url = './assets/script.json') {
    const d = await (await fetch(url)).json();
    this.segments = d.segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }));
    this.words = d.segments.flatMap((s) => (s.words || []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end })));
    return this;
  },
  wordsIn(a, b) {
    return this.words.filter((w) => w.start >= a - 1e-6 && w.start < b);
  },
  norm(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
  },
  // find phrase (sequence of words) starting at or after time `after`
  find(phrase, after = 0) {
    const target = this.norm(phrase).split(' ');
    const ws = this.words;
    for (let i = 0; i < ws.length; i++) {
      if (ws[i].start < after - 1e-6) continue;
      let ok = true;
      for (let j = 0; j < target.length; j++) {
        if (!ws[i + j] || this.norm(ws[i + j].text) !== target[j]) { ok = false; break; }
      }
      if (ok) return { start: ws[i].start, end: ws[i + target.length - 1].end, text: phrase };
    }
    return null;
  },
};
