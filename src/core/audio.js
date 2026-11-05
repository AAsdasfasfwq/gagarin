// ─────────────────────────────────────────────────────────────────────────────
// audio.js — procedural score + sound-design kit (Web Audio, OfflineAudioContext).
//
// Each part exports `audio = { build(A) {…} }`. The engine renders the part's
// window [start-pre, end+tail] offline into TWO STEMS (music, sfx). ALL times
// you pass to the kit are ABSOLUTE film seconds (same clock as the VO).
//
// LEVELS (critical): the score sits UNDER narration. The mixer ducks music
// under the VO automatically, but write it quiet: typical vel 0.2–0.6, beds
// low. SFX are accents: whooshes/hits subtle; nothing harsh above 4 kHz.
// ─────────────────────────────────────────────────────────────────────────────
import { rng, clamp } from './math.js';

const NOTE_IX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function midi(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error('bad note ' + n);
  return NOTE_IX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const freq = (n) => mtof(midi(n));
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
  wholetone: [0, 2, 4, 6, 8, 10], dim: [0, 2, 3, 5, 6, 8, 9, 11], penta: [0, 2, 4, 7, 9], minPenta: [0, 3, 5, 7, 10],
};
// chord('D', 'min7', 3) → midi numbers
const CHORDS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], min9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], min6: [0, 3, 7, 9], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], five: [0, 7, 12], cluster: [0, 1, 2] };
export function chord(root, type = 'maj', oct = 3, inv = 0) {
  const r = midi(root + oct);
  let ns = (CHORDS[type] || CHORDS.maj).map((i) => r + i);
  for (let i = 0; i < inv; i++) ns = [...ns.slice(1), ns[0] + 12];
  return ns;
}
// THE LEITMOTIF ("Poyekhali theme"). Scale degrees in 1-based steps of a mode,
// with beat durations. Hopeful in major, haunted in minor. Use A.motif(...).
export const MOTIF = {
  degrees: [1, 5, 4, 3, 2, 3, 5, 8],
  beats: [1, 1.5, 0.5, 1, 1, 0.5, 0.5, 3],
};

// ── kit ──────────────────────────────────────────────────────────────────────
export function createKit(ctx, { t0 = 0, seed = 1 } = {}) {
  const sr = ctx.sampleRate;
  const R = rng(seed);
  const T = (abs) => Math.max(0, abs - t0);
  const now0 = (abs) => abs - t0; // may be negative

  // ── shared noise buffers ──
  const mkBuf = (sec, fn, ch = 1) => {
    const b = ctx.createBuffer(ch, Math.max(1, Math.round(sec * sr)), sr);
    for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); fn(d, c); }
    return b;
  };
  const nr = rng(seed + 99);
  const WHITE = mkBuf(4, (d) => { for (let i = 0; i < d.length; i++) d[i] = nr() * 2 - 1; }, 2);
  const PINK = mkBuf(4, (d) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = nr() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  }, 2);
  const BROWN = mkBuf(4, (d) => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (nr() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }, 2);

  // ── reverb IRs ──
  const ir = (sec, decay = 3, { bright = 0.5, pre = 0.01 } = {}) => mkBuf(sec, (d, c) => {
    const r2 = rng(seed + 7 + c * 13);
    let lp = 0;
    const preN = Math.round(pre * sr);
    for (let i = 0; i < d.length; i++) {
      if (i < preN) { d[i] = 0; continue; }
      const x = (i - preN) / sr;
      const w = r2() * 2 - 1;
      const k = 0.15 + bright * 0.8 * Math.exp(-x * 1.5);
      lp = lp + k * (w - lp);
      d[i] = lp * Math.pow(1 - x / sec, decay) * 0.9;
    }
  }, 2);

  // ── buses / stems ──
  const merger = ctx.createChannelMerger(4);
  merger.connect(ctx.destination);
  const stem = (ch0) => {
    const inGain = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.35;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
    const split = ctx.createChannelSplitter(2);
    inGain.connect(comp); comp.connect(lim); lim.connect(split);
    split.connect(merger, 0, ch0); split.connect(merger, 1, ch0 + 1);
    return inGain;
  };
  const musicOut = stem(0), sfxOut = stem(2);
  const mkVerb = (buf, dest, wet) => {
    const cv = ctx.createConvolver(); cv.buffer = buf;
    const g = ctx.createGain(); g.gain.value = wet;
    cv.connect(g); g.connect(dest);
    return cv;
  };
  const hallIR = ir(3.6, 3.2, { bright: 0.45, pre: 0.02 });
  const roomIR = ir(1.2, 2.5, { bright: 0.6 });
  const spaceIR = ir(8, 2.2, { bright: 0.35, pre: 0.04 });
  const music = ctx.createGain(); music.connect(musicOut);
  const sfx = ctx.createGain(); sfx.connect(sfxOut);
  const verb = { hall: mkVerb(hallIR, musicOut, 1), room: mkVerb(roomIR, sfxOut, 1), space: mkVerb(spaceIR, musicOut, 1), sfxHall: mkVerb(hallIR, sfxOut, 1) };

  // A "send": connect node → bus + reverb at amount
  const route = (node, { bus = 'music', rev = 0.25, revType = null, pan = 0 } = {}) => {
    let out = node;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); out = p; }
    const dest = bus === 'sfx' ? sfx : bus && bus.connect ? bus : music;
    out.connect(dest);
    if (rev > 0) {
      const g = ctx.createGain(); g.gain.value = rev;
      out.connect(g);
      const rt = revType || (bus === 'sfx' ? 'sfxHall' : 'hall');
      g.connect(verb[rt]);
    }
    return out;
  };

  // ADSR on a gain param
  const adsr = (param, t, dur, { a = 0.01, d = 0.1, s = 0.7, r = 0.3, peak = 1 } = {}) => {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.setTargetAtTime(peak * s, t + a, Math.max(0.001, d / 3));
    const rel = t + Math.max(a, dur);
    param.setTargetAtTime(0, rel, Math.max(0.001, r / 4));
    return rel + r * 1.5;
  };
  const osc = (type, f, t, stop, detune = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.start(t); o.stop(stop); return o;
  };
  const noiseSrc = (t, stop, kind = 'white') => {
    const s = ctx.createBufferSource();
    s.buffer = kind === 'pink' ? PINK : kind === 'brown' ? BROWN : WHITE;
    s.loop = true;
    s.start(t, R() * 3.5); s.stop(stop);
    return s;
  };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const shaper = (amt = 2) => {
    const ws = ctx.createWaveShaper(); const n = 2048; const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * amt) / Math.tanh(amt); }
    ws.curve = c; ws.oversample = '2x'; return ws;
  };
  const vibrato = (param, t, stop, { rate = 5.2, depth = 8, delay = 0.25 } = {}) => {
    const l = ctx.createOscillator(); l.frequency.value = rate * (0.95 + R() * 0.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(depth, t + delay + 0.3);
    l.connect(g); g.connect(param); l.start(t); l.stop(stop);
  };

  // ── buffer instruments (generated in JS, cached) ──
  const bufCache = new Map();
  const genBuf = (key, sec, fn) => {
    if (!bufCache.has(key)) bufCache.set(key, mkBuf(sec, fn, 1));
    return bufCache.get(key);
  };
  // Karplus–Strong plucked string
  const ksBuf = (m, { decay = 0.996, bright = 0.5, sec = 3 } = {}) => genBuf(`ks:${m}:${decay}:${bright}:${sec}`, sec, (d) => {
    const f = mtof(m), N = Math.max(2, Math.round(sr / f));
    const r2 = rng(m * 31 + 7);
    const line = new Float32Array(N);
    for (let i = 0; i < N; i++) line[i] = (r2() * 2 - 1) * (1 - bright * 0.5) + (i < N / 2 ? bright * 0.5 : -bright * 0.5);
    let idx = 0, last = 0;
    for (let i = 0; i < d.length; i++) {
      const cur = line[idx];
      const nxt = (cur + last) * 0.5 * decay;
      last = cur; line[idx] = nxt; d[i] = cur;
      idx = (idx + 1) % N;
    }
  });
  // Additive piano tone with inharmonicity, string detune and hammer
  const pianoBuf = (m) => genBuf(`pno:${m}`, 6, (d) => {
    const f0 = mtof(m), B = 0.0004 * Math.pow(2, (m - 60) / 24);
    const partials = 14;
    const r2 = rng(m + 5);
    const amps = [], fr = [], dec = [], ph = [];
    for (let k = 1; k <= partials; k++) {
      const fk = k * f0 * Math.sqrt(1 + B * k * k);
      if (fk > sr / 2.2) break;
      amps.push((1 / Math.pow(k, 1.15)) * (k === 1 ? 1 : 0.8) * (1 - 0.3 * Math.sin(k * 0.9)));
      fr.push(fk); dec.push(0.6 + k * 0.9 + (m - 40) * 0.035); ph.push(r2() * 6.28);
    }
    const det = 1.0009;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      let s = 0;
      for (let k = 0; k < fr.length; k++) {
        const e = Math.exp(-t * dec[k]) * (0.7 + 0.3 * Math.exp(-t * 0.4));
        s += amps[k] * e * (Math.sin(6.2832 * fr[k] * t + ph[k]) + 0.6 * Math.sin(6.2832 * fr[k] * det * t + ph[k] * 1.3));
      }
      const hammer = t < 0.02 ? (r2() * 2 - 1) * (1 - t / 0.02) * 0.25 : 0;
      d[i] = (s * 0.28 + hammer) * Math.min(1, t * 900);
    }
  });
  // Inharmonic bell / celesta / glock
  const BELLS = {
    bell: { ratios: [0.5, 1, 1.19, 1.56, 2, 2.51, 2.66, 3.01, 4.1], dec: [0.5, 0.9, 1.4, 1.6, 2, 2.6, 3, 3.5, 5], sec: 7 },
    celesta: { ratios: [1, 2, 3.98, 5.2], dec: [2.2, 4, 7, 10], sec: 3 },
    glock: { ratios: [1, 2.76, 5.4, 8.93], dec: [1.2, 3, 6, 9], sec: 3.5 },
    musicbox: { ratios: [1, 3.9, 9.1, 15.3], dec: [3, 6, 11, 16], sec: 2.2 },
    vibes: { ratios: [1, 4, 10.1], dec: [0.9, 2.5, 6], sec: 4 },
    tubular: { ratios: [1, 2.756, 5.404, 8.933, 13.34], dec: [0.35, 0.6, 1, 1.6, 2.4], sec: 8 },
  };
  const bellBuf = (kind, m) => genBuf(`bell:${kind}:${m}`, BELLS[kind].sec, (d) => {
    const b = BELLS[kind], f0 = mtof(m);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr; let s = 0;
      for (let k = 0; k < b.ratios.length; k++) {
        const fk = f0 * b.ratios[k];
        if (fk > sr / 2.2) continue;
        s += Math.sin(6.2832 * fk * t + k) * Math.exp(-t * b.dec[k]) / (1 + k * 0.6);
      }
      d[i] = s * 0.35 * Math.min(1, t * 2000);
    }
  });
  const playBuf = (buf, abs, { rate = 1, gain = 1, dur = null, release = 0.25, bus = 'music', rev = 0.2, revType, pan = 0, lp = null, hp = null } = {}) => {
    const t = now0(abs);
    if (t < -buf.duration) return null;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = ctx.createGain();
    const st = Math.max(0, t), off = Math.max(0, -t) * rate;
    g.gain.setValueAtTime(gain, st);
    let end = st + buf.duration / rate;
    if (dur != null) { const e = Math.max(st, t + dur); g.gain.setTargetAtTime(0, e, release / 4); end = Math.min(end, e + release * 2); }
    let node = s;
    if (lp) { const f = filt('lowpass', lp); node.connect(f); node = f; }
    if (hp) { const f = filt('highpass', hp); node.connect(f); node = f; }
    node.connect(g);
    s.start(st, off); s.stop(end + 0.05);
    route(g, { bus, rev, revType, pan });
    return g;
  };

  // ── synth voices ──
  const voices = {
    // lush detuned pad. colour: 'warm' | 'cold' | 'dark' | 'glass'
    pad(abs, n, dur, { vel = 0.3, colour = 'warm', a = 1.2, r = 2.5, cutoff = null, pan = 0, rev = 0.45, bus } = {}) {
      const t = T(abs), stop = t + dur + r * 2;
      const f = freq(n);
      const g = ctx.createGain();
      const lp = filt('lowpass', cutoff || (colour === 'dark' ? 700 : colour === 'cold' ? 2400 : colour === 'glass' ? 4200 : 1500), 0.6);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12 + R() * 0.1;
      const lg = ctx.createGain(); lg.gain.value = (cutoff || 1500) * 0.25; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(stop);
      const types = colour === 'cold' || colour === 'glass' ? ['triangle', 'sawtooth', 'triangle'] : ['sawtooth', 'sawtooth', 'triangle'];
      [-9, 0, 8].forEach((dt, i) => { const o = osc(types[i], f * (colour === 'glass' && i === 2 ? 2 : 1), t, stop, dt + (R() - 0.5) * 4); const og = ctx.createGain(); og.gain.value = i === 2 ? 0.5 : 0.35; o.connect(og); og.connect(lp); });
      lp.connect(g);
      adsr(g.gain, t, dur, { a, d: 0.5, s: 0.85, r, peak: vel * 0.16 });
      route(g, { bus, rev, pan });
    },
    // string ensemble (legato) — stacc:true for short bows
    strings(abs, n, dur, { vel = 0.35, a = 0.35, r = 0.9, stacc = false, bright = 1, pan = 0, rev = 0.35, bus, voices: nv = 5 } = {}) {
      const t = T(abs), f = freq(n);
      const A_ = stacc ? 0.02 : a, R_ = stacc ? 0.18 : r, D = stacc ? Math.min(dur, 0.18) : dur;
      const stop = t + D + R_ * 2;
      const g = ctx.createGain();
      const bp = filt('lowpass', 2200 * bright + f * 1.5, 0.5);
      const body = filt('peaking', 900, 1.2); body.gain.value = 3;
      for (let i = 0; i < nv; i++) {
        const o = osc('sawtooth', f, t, stop, (i - (nv - 1) / 2) * 7 + (R() - 0.5) * 5);
        vibrato(o.detune, t, stop, { rate: 4.8 + R() * 1.2, depth: stacc ? 0 : 9, delay: 0.35 });
        const og = ctx.createGain(); og.gain.value = 1 / nv; o.connect(og); og.connect(bp);
      }
      bp.connect(body); body.connect(g);
      adsr(g.gain, t, D, { a: A_, d: 0.2, s: 0.9, r: R_, peak: vel * 0.22 });
      route(g, { bus, rev, pan });
    },
    // solo cello / violin (expressive, single voice)
    solo(abs, n, dur, { vel = 0.4, a = 0.25, r = 0.8, pan = 0, rev = 0.4, bus, vib = 14 } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + r * 2;
      const o = osc('sawtooth', f, t, stop);
      vibrato(o.detune, t, stop, { rate: 5.4, depth: vib, delay: 0.3 });
      const f1 = filt('bandpass', Math.min(4000, f * 3), 0.8), f2 = filt('lowpass', 3200, 0.7);
      const body = filt('peaking', 450, 1.5); body.gain.value = 6;
      const g = ctx.createGain();
      o.connect(f1); f1.connect(body); body.connect(f2); f2.connect(g);
      const o2 = osc('sawtooth', f, t, stop, 5); const g2 = ctx.createGain(); g2.gain.value = 0.4; o2.connect(g2); g2.connect(f2);
      adsr(g.gain, t, dur, { a, d: 0.2, s: 0.85, r, peak: vel * 0.5 });
      route(g, { bus, rev, pan });
    },
    pizz(abs, n, dur = 0.4, { vel = 0.5, pan = 0, rev = 0.25, bus } = {}) {
      const m = midi(n);
      playBuf(ksBuf(m, { decay: 0.985, bright: 0.25, sec: 1.4 }), abs, { gain: vel * 0.9, dur: Math.max(0.25, dur), release: 0.2, lp: 2500, bus, rev, pan });
    },
    pluck(abs, n, dur = 1, { vel = 0.5, bright = 0.6, decay = 0.996, pan = 0, rev = 0.25, bus, lp = 6000 } = {}) {
      playBuf(ksBuf(midi(n), { decay, bright, sec: 3 }), abs, { gain: vel * 0.8, dur, release: 0.3, lp, bus, rev, pan });
    },
    // balalaika / domra tremolo picking (folk colour)
    balalaika(abs, n, dur = 1, { vel = 0.45, rate = 11, pan = 0, rev = 0.2, bus } = {}) {
      const m = midi(n); const b = ksBuf(m, { decay: 0.99, bright: 0.75, sec: 1 });
      const k = Math.max(1, Math.round(dur * rate));
      for (let i = 0; i < k; i++) playBuf(b, abs + i / rate + (R() - 0.5) * 0.006, { gain: vel * 0.55 * (i % 2 ? 0.8 : 1), dur: 1 / rate + 0.05, release: 0.06, lp: 5000, hp: 180, bus, rev, pan });
    },
    piano(abs, n, dur = 1.5, { vel = 0.5, pan = 0, rev = 0.35, bus, release = 0.6 } = {}) {
      const m = midi(n);
      playBuf(pianoBuf(m), abs, { gain: vel * 0.9, dur, release, lp: 1800 + vel * 5000, bus, rev, pan });
    },
    bell(abs, n, dur = 4, opts = {}) { playBuf(bellBuf(opts.kind || 'bell', midi(n)), abs, { gain: (opts.vel ?? 0.4) * 0.7, dur, release: opts.release ?? 1.5, bus: opts.bus, rev: opts.rev ?? 0.5, pan: opts.pan || 0 }); },
    celesta(abs, n, dur = 2, opts = {}) { voices.bell(abs, n, dur, { ...opts, kind: 'celesta' }); },
    glock(abs, n, dur = 2, opts = {}) { voices.bell(abs, n, dur, { ...opts, kind: 'glock' }); },
    musicbox(abs, n, dur = 1.5, opts = {}) { voices.bell(abs, n, dur, { ...opts, kind: 'musicbox' }); },
    vibes(abs, n, dur = 2, opts = {}) { voices.bell(abs, n, dur, { ...opts, kind: 'vibes' }); },
    tubular(abs, n, dur = 5, opts = {}) { voices.bell(abs, n, dur, { ...opts, kind: 'tubular' }); },
    brass(abs, n, dur, { vel = 0.4, a = 0.06, r = 0.35, mute = false, pan = 0, rev = 0.35, bus, scoop = true } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + r * 2;
      const g = ctx.createGain();
      const lp = filt('lowpass', 400, 1.2);
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.linearRampToValueAtTime(900 + vel * 3500, t + a + 0.08);
      lp.frequency.setTargetAtTime(700 + vel * 2000, t + a + 0.1, 0.3);
      [0, 6, -5].forEach((dt, i) => {
        const o = osc(i === 2 ? 'square' : 'sawtooth', f, t, stop, dt);
        if (scoop) { o.detune.setValueAtTime(dt - 40, t); o.detune.linearRampToValueAtTime(dt, t + 0.09); }
        vibrato(o.detune, t, stop, { rate: 5, depth: 6, delay: 0.5 });
        const og = ctx.createGain(); og.gain.value = i === 2 ? 0.18 : 0.4; o.connect(og); og.connect(lp);
      });
      let out = lp;
      if (mute) { const bp = filt('bandpass', 1400, 2.5); lp.connect(bp); out = bp; }
      out.connect(g);
      adsr(g.gain, t, dur, { a, d: 0.15, s: 0.8, r, peak: vel * (mute ? 0.5 : 0.24) });
      route(g, { bus, rev, pan });
    },
    horn(abs, n, dur, opts = {}) { voices.brass(abs, n, dur, { a: 0.12, ...opts, vel: (opts.vel ?? 0.4) * 0.7 }); },
    choir(abs, n, dur, { vel = 0.3, vowel = 'ah', a = 0.8, r = 1.6, pan = 0, rev = 0.5, bus } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + r * 2;
      const F = { ah: [700, 1220, 2600], oo: [320, 870, 2250], ee: [300, 2300, 3000], oh: [500, 900, 2400] }[vowel] || [700, 1220, 2600];
      const g = ctx.createGain();
      const mixN = ctx.createGain(); mixN.gain.value = 1;
      for (let i = 0; i < 6; i++) {
        const o = osc('sawtooth', f, t, stop, (i - 2.5) * 6 + (R() - 0.5) * 6);
        vibrato(o.detune, t, stop, { rate: 4.5 + R(), depth: 10, delay: 0.4 });
        o.connect(mixN);
      }
      F.forEach((ff, k) => { const bp = filt('bandpass', ff, 6 + k * 2); const fg = ctx.createGain(); fg.gain.value = [1, 0.5, 0.25][k]; mixN.connect(bp); bp.connect(fg); fg.connect(g); });
      adsr(g.gain, t, dur, { a, d: 0.4, s: 0.9, r, peak: vel * 0.35 });
      route(g, { bus, rev, pan });
    },
    bass(abs, n, dur, { vel = 0.5, a = 0.01, r = 0.25, drive = 1.2, cutoff = 600, pan = 0, rev = 0.05, bus } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + r * 2;
      const g = ctx.createGain();
      const sub = osc('sine', f, t, stop); const sg = ctx.createGain(); sg.gain.value = 0.7; sub.connect(sg); sg.connect(g);
      const sw = osc('sawtooth', f, t, stop, 4); const lp = filt('lowpass', cutoff, 1.1);
      lp.frequency.setValueAtTime(cutoff * 2, t); lp.frequency.setTargetAtTime(cutoff, t, 0.08);
      const sh = shaper(drive); sw.connect(lp); lp.connect(sh); const swg = ctx.createGain(); swg.gain.value = 0.35; sh.connect(swg); swg.connect(g);
      adsr(g.gain, t, dur, { a, d: 0.2, s: 0.8, r, peak: vel * 0.45 });
      route(g, { bus, rev, pan });
    },
    // analog sequencer pulse (tech / Kraftwerk-ish)
    arp(abs, n, dur = 0.2, { vel = 0.35, wave = 'square', cutoff = 2400, res = 6, pan = 0, rev = 0.25, bus } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + 0.3;
      const o = osc(wave, f, t, stop); const lp = filt('lowpass', cutoff, res);
      lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.15), t + dur);
      const g = ctx.createGain(); o.connect(lp); lp.connect(g);
      adsr(g.gain, t, dur, { a: 0.003, d: dur * 0.6, s: 0.3, r: 0.08, peak: vel * 0.22 });
      route(g, { bus, rev, pan });
    },
    flute(abs, n, dur, { vel = 0.35, pan = 0, rev = 0.4, bus } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + 1;
      const o = osc('sine', f, t, stop); const o2 = osc('triangle', f * 2, t, stop);
      vibrato(o.detune, t, stop, { rate: 5, depth: 10, delay: 0.25 });
      const g = ctx.createGain(); const g2 = ctx.createGain(); g2.gain.value = 0.12; o2.connect(g2); g2.connect(g); o.connect(g);
      const nz = noiseSrc(t, stop); const bp = filt('bandpass', f * 2, 4); const ng = ctx.createGain(); ng.gain.value = 0.08; nz.connect(bp); bp.connect(ng); ng.connect(g);
      adsr(g.gain, t, dur, { a: 0.08, d: 0.1, s: 0.85, r: 0.25, peak: vel * 0.3 });
      route(g, { bus, rev, pan });
    },
    clarinet(abs, n, dur, { vel = 0.35, pan = 0, rev = 0.35, bus } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + 1;
      const o = osc('square', f, t, stop); const lp = filt('lowpass', 1600, 0.9);
      vibrato(o.detune, t, stop, { rate: 4.6, depth: 5, delay: 0.4 });
      const g = ctx.createGain(); o.connect(lp); lp.connect(g);
      adsr(g.gain, t, dur, { a: 0.05, d: 0.1, s: 0.85, r: 0.2, peak: vel * 0.16 });
      route(g, { bus, rev, pan });
    },
    // sly double-reed (bassoon/oboe) — for "ехидная" ironic moments
    bassoon(abs, n, dur, { vel = 0.4, pan = 0, rev = 0.3, bus, stacc = false } = {}) {
      const t = T(abs), f = freq(n), D = stacc ? Math.min(dur, 0.16) : dur, stop = t + D + 1;
      const o = osc('sawtooth', f, t, stop); const o2 = osc('square', f, t, stop, 3);
      const bp = filt('bandpass', 520, 1.6); const lp = filt('lowpass', 2200, 0.7);
      const g = ctx.createGain(); const mixg = ctx.createGain(); mixg.gain.value = 0.5;
      o.connect(mixg); o2.connect(mixg); mixg.connect(bp); bp.connect(lp); lp.connect(g);
      adsr(g.gain, t, D, { a: 0.03, d: 0.1, s: 0.8, r: 0.12, peak: vel * 0.5 });
      route(g, { bus, rev, pan });
    },
    organ(abs, n, dur, { vel = 0.3, pan = 0, rev = 0.45, bus } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + 1;
      const g = ctx.createGain();
      [[1, 0.5], [2, 0.35], [3, 0.2], [4, 0.15], [0.5, 0.3]].forEach(([h, a]) => { const o = osc('sine', f * h, t, stop); const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(g); });
      adsr(g.gain, t, dur, { a: 0.03, d: 0.1, s: 1, r: 0.2, peak: vel * 0.15 });
      route(g, { bus, rev, pan });
    },
  };

  // ── percussion ──
  const perc = {
    kick(abs, { vel = 0.6, tone = 52, bus, rev = 0.05 } = {}) {
      const t = T(abs), stop = t + 0.8;
      const o = osc('sine', tone * 3, t, stop); o.frequency.exponentialRampToValueAtTime(tone, t + 0.06);
      const g = ctx.createGain(); o.connect(g);
      g.gain.setValueAtTime(vel * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      route(g, { bus, rev });
    },
    snare(abs, { vel = 0.4, military = false, bus, rev = 0.2, pan = 0 } = {}) {
      const t = T(abs), stop = t + 0.5;
      const n = noiseSrc(t, stop); const hp = filt('highpass', military ? 1800 : 1200); const bp = filt('peaking', 4200, 1); bp.gain.value = 4;
      const g = ctx.createGain(); n.connect(hp); hp.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + (military ? 0.28 : 0.18));
      const o = osc('triangle', 190, t, stop); o.frequency.exponentialRampToValueAtTime(140, t + 0.05);
      const og = ctx.createGain(); og.gain.setValueAtTime(vel * 0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og);
      route(g, { bus, rev, pan }); route(og, { bus, rev, pan });
    },
    // military snare roll (crescendo)
    roll(abs, dur, { vel = 0.3, cresc = true, rate = 22, bus, rev = 0.2 } = {}) {
      const k = Math.round(dur * rate);
      for (let i = 0; i < k; i++) perc.snare(abs + i / rate + (R() - 0.5) * 0.004, { vel: vel * (cresc ? 0.25 + 0.75 * (i / k) : 1) * (0.8 + R() * 0.2), military: true, bus, rev });
    },
    hat(abs, { vel = 0.2, open = false, bus, rev = 0.1, pan = 0.2 } = {}) {
      const t = T(abs), stop = t + 0.6;
      const n = noiseSrc(t, stop); const hp = filt('highpass', 7000); const g = ctx.createGain(); n.connect(hp); hp.connect(g);
      g.gain.setValueAtTime(vel * 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.4 : 0.05));
      route(g, { bus, rev, pan });
    },
    shaker(abs, { vel = 0.15, bus, pan = -0.2 } = {}) {
      const t = T(abs), stop = t + 0.2;
      const n = noiseSrc(t, stop); const bp = filt('bandpass', 6000, 1.5); const g = ctx.createGain(); n.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      route(g, { bus, rev: 0.1, pan });
    },
    timpani(abs, n = 'D2', { vel = 0.6, bus, rev = 0.4, dur = 2.5 } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur + 0.5;
      const g = ctx.createGain();
      [[1, 1], [1.5, 0.45], [1.98, 0.25], [2.44, 0.12]].forEach(([h, a]) => { const o = osc('sine', f * h * 1.02, t, stop); o.frequency.exponentialRampToValueAtTime(f * h, t + 0.12); const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(g); });
      const nz = noiseSrc(t, t + 0.1, 'pink'); const lp = filt('lowpass', 900); const ng = ctx.createGain(); ng.gain.setValueAtTime(0.6, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08); nz.connect(lp); lp.connect(ng); ng.connect(g);
      g.gain.setValueAtTime(vel * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      route(g, { bus, rev });
    },
    timpRoll(abs, dur, n = 'D2', { vel = 0.5, bus } = {}) {
      const k = Math.round(dur * 16);
      for (let i = 0; i < k; i++) perc.timpani(abs + i / 16, n, { vel: vel * (0.2 + 0.8 * (i / k)) * 0.5, bus, dur: 0.6 });
    },
    taiko(abs, { vel = 0.6, bus, rev = 0.35, tone = 70 } = {}) {
      const t = T(abs), stop = t + 1.5;
      const o = osc('sine', tone * 1.8, t, stop); o.frequency.exponentialRampToValueAtTime(tone, t + 0.1);
      const g = ctx.createGain(); o.connect(g);
      g.gain.setValueAtTime(vel * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      const nz = noiseSrc(t, t + 0.2, 'brown'); const lp = filt('lowpass', 500); const ng = ctx.createGain(); ng.gain.setValueAtTime(vel * 1.2, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15); nz.connect(lp); lp.connect(ng);
      route(g, { bus, rev }); route(ng, { bus, rev });
    },
    tom(abs, { vel = 0.4, tone = 110, bus, rev = 0.25 } = {}) {
      const t = T(abs), stop = t + 0.7;
      const o = osc('sine', tone * 1.5, t, stop); o.frequency.exponentialRampToValueAtTime(tone, t + 0.08);
      const g = ctx.createGain(); o.connect(g); g.gain.setValueAtTime(vel * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      route(g, { bus, rev });
    },
    // cymbal swell (reverse-ish) ending at abs+dur
    swell(abs, dur = 2, { vel = 0.25, bus, rev = 0.4 } = {}) {
      const t = T(abs), stop = t + dur + 0.6;
      const n = noiseSrc(t, stop); const hp = filt('highpass', 3500); const pk = filt('peaking', 8000, 1); pk.gain.value = 5;
      const g = ctx.createGain(); n.connect(hp); hp.connect(pk); pk.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.25, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
      route(g, { bus, rev });
    },
    crash(abs, { vel = 0.3, bus, rev = 0.4 } = {}) {
      const t = T(abs), stop = t + 3.5;
      const n = noiseSrc(t, stop); const hp = filt('highpass', 3000); const g = ctx.createGain(); n.connect(hp); hp.connect(g);
      g.gain.setValueAtTime(vel * 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 3);
      route(g, { bus, rev });
    },
    gong(abs, { vel = 0.5, n = 'A1', bus, rev = 0.6, dur = 7 } = {}) {
      const t = T(abs), f = freq(n), stop = t + dur;
      const g = ctx.createGain();
      [1, 1.47, 2.09, 2.56, 3.14, 4.22, 5.43].forEach((h, k) => { const o = osc('sine', f * h, t, stop, (R() - 0.5) * 20); const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.4 / (1 + k * 0.5), t + 0.05 + k * 0.08); og.gain.exponentialRampToValueAtTime(0.001, t + dur * (1 - k * 0.08)); o.connect(og); og.connect(g); });
      g.gain.value = vel * 0.5;
      route(g, { bus, rev });
    },
    tick(abs, { vel = 0.3, tone = 2600, bus = 'sfx', pan = 0, rev = 0.05 } = {}) {
      const t = T(abs), stop = t + 0.08;
      const o = osc('square', tone, t, stop); const bp = filt('bandpass', tone, 8); const g = ctx.createGain(); o.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(vel * 0.3, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.035);
      route(g, { bus, rev, pan });
    },
    woodblock(abs, { vel = 0.35, tone = 900, bus, pan = 0 } = {}) {
      const t = T(abs), stop = t + 0.2;
      const o = osc('sine', tone, t, stop); const g = ctx.createGain(); o.connect(g);
      g.gain.setValueAtTime(vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      route(g, { bus, rev: 0.15, pan });
    },
    triangle(abs, { vel = 0.25, bus } = {}) { voices.bell(abs, 'E6', 2, { kind: 'glock', vel: vel * 0.6, bus, rev: 0.3 }); },
    anvil(abs, { vel = 0.4, bus = 'sfx', rev = 0.3 } = {}) {
      const t = T(abs), stop = t + 1.5;
      const g = ctx.createGain();
      [1, 2.31, 3.77, 5.2].forEach((h, k) => { const o = osc('sine', 820 * h, t, stop); const og = ctx.createGain(); og.gain.setValueAtTime(0.4 / (k + 1), t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.8 - k * 0.12); o.connect(og); og.connect(g); });
      g.gain.value = vel * 0.4; route(g, { bus, rev });
    },
    heartbeat(abs, { vel = 0.5, bpm = 60, beats = 1, bus = 'sfx' } = {}) {
      for (let i = 0; i < beats; i++) {
        const b = abs + (i * 60) / bpm;
        perc.kick(b, { vel: vel * 0.7, tone: 45, bus, rev: 0.02 });
        perc.kick(b + 0.18, { vel: vel * 0.45, tone: 42, bus, rev: 0.02 });
      }
    },
  };

  // ── sound design ──
  const fx = {
    // airy whoosh: dir -1..1 pan travel; pitch shifts band
    whoosh(abs, { dur = 0.7, vel = 0.25, pitch = 1, dir = 1, bus = 'sfx', rev = 0.2 } = {}) {
      const t = T(abs), stop = t + dur + 0.3;
      const n = noiseSrc(t, stop, 'pink'); const bp = filt('bandpass', 400 * pitch, 1.2);
      bp.frequency.setValueAtTime(300 * pitch, t); bp.frequency.exponentialRampToValueAtTime(2200 * pitch, t + dur * 0.55); bp.frequency.exponentialRampToValueAtTime(500 * pitch, t + dur);
      const g = ctx.createGain(); const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(-0.7 * dir, t); p.pan.linearRampToValueAtTime(0.7 * dir, t + dur);
      n.connect(bp); bp.connect(g); g.connect(p);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.6, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      route(p, { bus, rev });
    },
    swish(abs, opts = {}) { fx.whoosh(abs, { dur: 0.3, pitch: 1.8, ...opts }); },
    // low cinematic impact (hit ON the cut)
    impact(abs, { vel = 0.4, size = 1, bus = 'sfx', rev = 0.35 } = {}) {
      const t = T(abs), stop = t + 3 * size;
      const o = osc('sine', 90, t, stop); o.frequency.exponentialRampToValueAtTime(32, t + 0.5 * size);
      const g = ctx.createGain(); o.connect(g); g.gain.setValueAtTime(vel * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8 * size);
      const n = noiseSrc(t, t + 0.6, 'brown'); const lp = filt('lowpass', 1400); const ng = ctx.createGain();
      ng.gain.setValueAtTime(vel * 0.8, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.35 * size); n.connect(lp); lp.connect(ng);
      route(g, { bus, rev }); route(ng, { bus, rev });
    },
    subHit(abs, { vel = 0.4, bus = 'sfx' } = {}) {
      const t = T(abs), stop = t + 2.5;
      const o = osc('sine', 60, t, stop); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
      const g = ctx.createGain(); o.connect(g); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
      route(g, { bus, rev: 0.1 });
    },
    // tonal hit: impact + pitched ring (for numbers/reveals)
    tonalHit(abs, n = 'D3', { vel = 0.35, bus = 'sfx' } = {}) {
      fx.impact(abs, { vel: vel * 0.6, size: 0.7, bus });
      voices.bell(abs, n, 3, { kind: 'tubular', vel: vel * 0.6, bus, rev: 0.5 });
    },
    // riser that peaks exactly at abs+dur (put the cut there)
    riser(abs, dur = 2, { vel = 0.3, bus = 'sfx', tonal = true, rev = 0.3 } = {}) {
      const t = T(abs), stop = t + dur + 0.1;
      const n = noiseSrc(t, stop, 'pink'); const hp = filt('bandpass', 300, 1.5);
      hp.frequency.setValueAtTime(250, t); hp.frequency.exponentialRampToValueAtTime(6000, t + dur);
      const g = ctx.createGain(); n.connect(hp); hp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.5, t + dur * 0.97); g.gain.linearRampToValueAtTime(0, t + dur + 0.04);
      route(g, { bus, rev });
      if (tonal) {
        const o = osc('sawtooth', 110, t, stop); o.frequency.exponentialRampToValueAtTime(880, t + dur);
        const lp = filt('lowpass', 800, 3); lp.frequency.exponentialRampToValueAtTime(5000, t + dur);
        const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(vel * 0.12, t + dur * 0.97); og.gain.linearRampToValueAtTime(0, t + dur + 0.04);
        o.connect(lp); lp.connect(og); route(og, { bus, rev });
      }
    },
    reverse(abs, dur = 1.5, { vel = 0.3, bus = 'sfx' } = {}) { perc.swell(abs, dur, { vel: vel * 1.5, bus }); },
    click(abs, { vel = 0.25, bus = 'sfx', pan = 0 } = {}) { perc.tick(abs, { vel, tone: 3200, bus, pan }); },
    beep(abs, { n = 'A5', dur = 0.12, vel = 0.2, bus = 'sfx', wave = 'sine', pan = 0 } = {}) {
      const t = T(abs), stop = t + dur + 0.1;
      const o = osc(wave, freq(n), t, stop); const g = ctx.createGain(); o.connect(g);
      adsr(g.gain, t, dur, { a: 0.004, d: 0.02, s: 0.8, r: 0.03, peak: vel * 0.25 });
      route(g, { bus, rev: 0.1, pan });
    },
    // telemetry chatter: n blips over dur
    telemetry(abs, dur = 2, { vel = 0.12, count = 10, bus = 'sfx', seed: sd = 3 } = {}) {
      const r2 = rng(sd);
      for (let i = 0; i < count; i++) fx.beep(abs + r2() * dur, { n: r2.pick(['C6', 'E6', 'G6', 'A5', 'D6']), dur: 0.04 + r2() * 0.05, vel, bus, wave: 'square', pan: r2() - 0.5 });
    },
    typewriter(abs, count = 12, { rate = 9, vel = 0.25, bus = 'sfx', bell = false } = {}) {
      for (let i = 0; i < count; i++) {
        const tt = abs + i / rate + (R() - 0.5) * 0.03;
        const t = T(tt);
        const n = noiseSrc(t, t + 0.06); const bp = filt('bandpass', 2400 + R() * 800, 2); const g = ctx.createGain();
        n.connect(bp); bp.connect(g); g.gain.setValueAtTime(vel * 0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        route(g, { bus, rev: 0.08 });
        perc.woodblock(tt, { vel: vel * 0.25, tone: 300 + R() * 60, bus });
      }
      if (bell) voices.bell(abs + count / rate + 0.1, 'A6', 1, { kind: 'glock', vel: 0.2, bus });
    },
    stamp(abs, { vel = 0.5, bus = 'sfx' } = {}) {
      perc.kick(abs, { vel: vel * 0.6, tone: 70, bus, rev: 0.1 });
      fx.paper(abs, { vel: vel * 0.5, dur: 0.08, bus });
    },
    paper(abs, { vel = 0.25, dur = 0.35, bus = 'sfx' } = {}) {
      const t = T(abs), stop = t + dur + 0.1;
      const n = noiseSrc(t, stop); const bp = filt('bandpass', 3000, 0.8); const g = ctx.createGain();
      const am = ctx.createOscillator(); am.type = 'square'; am.frequency.value = 37 + R() * 30; const amg = ctx.createGain(); amg.gain.value = 0.5; am.connect(amg); amg.connect(g.gain); am.start(t); am.stop(stop);
      n.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.4, t + 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
      route(g, { bus, rev: 0.1 });
    },
    shimmer(abs, { vel = 0.2, root = 'D6', bus = 'sfx', dur = 2 } = {}) {
      const ns = chord(root.replace(/\d/, ''), 'add9', parseInt(root.slice(-1), 10));
      ns.forEach((m, i) => voices.bell(abs + i * 0.06, m, dur, { kind: 'celesta', vel: vel * 0.6, bus, rev: 0.6, pan: (i / ns.length - 0.5) }));
    },
    // continuous beds (dur seconds); `swell` [a, r] fades
    rumble(abs, dur, { vel = 0.3, cutoff = 160, bus = 'sfx', a = 1, r = 1.5 } = {}) {
      const t = T(abs), stop = t + dur + r;
      const n = noiseSrc(t, stop, 'brown'); const lp = filt('lowpass', cutoff, 0.8); const g = ctx.createGain();
      n.connect(lp); lp.connect(g); adsr(g.gain, t, dur, { a, d: 0.1, s: 1, r, peak: vel * 0.9 });
      route(g, { bus, rev: 0.1 });
      return g;
    },
    wind(abs, dur, { vel = 0.2, bus = 'sfx', a = 1.5, r = 2 } = {}) {
      const t = T(abs), stop = t + dur + r;
      const n = noiseSrc(t, stop, 'pink'); const bp = filt('bandpass', 600, 0.9);
      const l = ctx.createOscillator(); l.frequency.value = 0.15; const lg = ctx.createGain(); lg.gain.value = 350; l.connect(lg); lg.connect(bp.frequency); l.start(t); l.stop(stop);
      const g = ctx.createGain(); n.connect(bp); bp.connect(g); adsr(g.gain, t, dur, { a, d: 0.1, s: 1, r, peak: vel * 0.7 });
      route(g, { bus, rev: 0.2 });
    },
    hiss(abs, dur, { vel = 0.15, bus = 'sfx', a = 0.2, r = 0.8, f = 5000 } = {}) {
      const t = T(abs), stop = t + dur + r;
      const n = noiseSrc(t, stop); const hp = filt('highpass', f); const g = ctx.createGain();
      n.connect(hp); hp.connect(g); adsr(g.gain, t, dur, { a, d: 0.1, s: 0.8, r, peak: vel * 0.35 });
      route(g, { bus, rev: 0.2 });
    },
    fire(abs, dur, { vel = 0.35, bus = 'sfx', a = 0.5, r = 2, crackle = 1 } = {}) {
      const t = T(abs), stop = t + dur + r;
      const n = noiseSrc(t, stop, 'brown'); const lp = filt('lowpass', 500); const g = ctx.createGain(); n.connect(lp); lp.connect(g);
      adsr(g.gain, t, dur, { a, d: 0.1, s: 1, r, peak: vel * 0.9 }); route(g, { bus, rev: 0.15 });
      const k = Math.round(dur * 14 * crackle);
      for (let i = 0; i < k; i++) {
        const tt = t + R() * dur; const nn = noiseSrc(tt, tt + 0.03); const hp = filt('highpass', 1500 + R() * 3000); const cg = ctx.createGain();
        cg.gain.setValueAtTime(vel * (0.1 + R() * 0.25), tt); cg.gain.exponentialRampToValueAtTime(0.001, tt + 0.02 + R() * 0.02);
        nn.connect(hp); hp.connect(cg); route(cg, { bus, rev: 0.1, pan: R() - 0.5 });
      }
    },
    // massive explosion: transient + sub + roaring tail + debris
    explosion(abs, { vel = 0.7, dur = 6, bus = 'sfx' } = {}) {
      fx.impact(abs, { vel: vel, size: 2.2, bus });
      fx.subHit(abs, { vel: vel * 0.8, bus });
      const t = T(abs), stop = t + dur + 1;
      const n = noiseSrc(t, stop, 'brown'); const lp = filt('lowpass', 2500); lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(220, t + dur);
      const sh = shaper(3); const g = ctx.createGain(); n.connect(lp); lp.connect(sh); sh.connect(g);
      g.gain.setValueAtTime(vel * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      route(g, { bus, rev: 0.4 });
      fx.fire(abs + 0.3, dur - 1, { vel: vel * 0.6, bus, crackle: 1.5 });
    },
    // rocket engine roar; intensity curve [[abs, 0..1], ...]
    engine(abs, dur, { vel = 0.5, bus = 'sfx', curve = null, r = 1.5 } = {}) {
      const t = T(abs), stop = t + dur + r;
      const n = noiseSrc(t, stop, 'brown'); const n2 = noiseSrc(t, stop, 'pink');
      const lp = filt('lowpass', 900, 0.7); const lp2 = filt('lowpass', 3000); const sh = shaper(2.5);
      const g = ctx.createGain(); const g2 = ctx.createGain(); g2.gain.value = 0.25;
      n.connect(lp); lp.connect(sh); sh.connect(g); n2.connect(lp2); lp2.connect(g2); g2.connect(g);
      const am = ctx.createOscillator(); am.frequency.value = 17; const amg = ctx.createGain(); amg.gain.value = 0.15; am.connect(amg); amg.connect(g.gain); am.start(t); am.stop(stop);
      if (curve) {
        g.gain.setValueAtTime(0, t);
        curve.forEach(([a, v]) => g.gain.linearRampToValueAtTime(vel * v, Math.max(t, T(a))));
        g.gain.linearRampToValueAtTime(0, t + dur + r);
      } else adsr(g.gain, t, dur, { a: 1.5, d: 0.1, s: 1, r, peak: vel });
      route(g, { bus, rev: 0.25 });
    },
    radioStatic(abs, dur, { vel = 0.1, bus = 'sfx' } = {}) {
      const t = T(abs), stop = t + dur + 0.2;
      const n = noiseSrc(t, stop); const bp = filt('bandpass', 2500, 0.6); const g = ctx.createGain();
      n.connect(bp); bp.connect(g); adsr(g.gain, t, dur, { a: 0.05, s: 1, r: 0.15, peak: vel * 0.4 });
      route(g, { bus, rev: 0.05 });
    },
    servo(abs, dur = 1, { vel = 0.15, bus = 'sfx', f0 = 180, f1 = 320 } = {}) {
      const t = T(abs), stop = t + dur + 0.2;
      const o = osc('sawtooth', f0, t, stop); o.frequency.linearRampToValueAtTime(f1, t + dur * 0.5); o.frequency.linearRampToValueAtTime(f0 * 1.1, t + dur);
      const bp = filt('bandpass', 900, 2); const g = ctx.createGain(); o.connect(bp); bp.connect(g);
      adsr(g.gain, t, dur, { a: 0.05, s: 1, r: 0.1, peak: vel * 0.15 }); route(g, { bus, rev: 0.1 });
    },
    metal(abs, { vel = 0.3, bus = 'sfx', creak = false, dur = 1.2 } = {}) {
      const t = T(abs), stop = t + dur + 0.5;
      if (creak) {
        const o = osc('sawtooth', 70, t, stop); o.frequency.linearRampToValueAtTime(110 + R() * 60, t + dur);
        const bp = filt('bandpass', 1200, 8); const g = ctx.createGain(); o.connect(bp); bp.connect(g);
        const am = ctx.createOscillator(); am.frequency.value = 23; const amg = ctx.createGain(); amg.gain.value = 0.5; am.connect(amg); amg.connect(g.gain); am.start(t); am.stop(stop);
        adsr(g.gain, t, dur, { a: 0.1, s: 1, r: 0.2, peak: vel * 0.25 }); route(g, { bus, rev: 0.3 });
      } else perc.anvil(abs, { vel, bus });
    },
    breath(abs, { vel = 0.15, dur = 1.2, inhale = true, bus = 'sfx' } = {}) {
      const t = T(abs), stop = t + dur + 0.2;
      const n = noiseSrc(t, stop, 'pink'); const bp = filt('bandpass', inhale ? 1400 : 900, 1.2); const g = ctx.createGain();
      n.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.35, t + dur * (inhale ? 0.7 : 0.25)); g.gain.linearRampToValueAtTime(0, t + dur);
      route(g, { bus, rev: 0.1 });
    },
    // crowd cheer / roar (approximate): formant noise voices
    crowd(abs, dur, { vel = 0.3, bus = 'sfx', a = 1, r = 2, excite = 1 } = {}) {
      const t = T(abs), stop = t + dur + r;
      const g = ctx.createGain();
      for (let i = 0; i < 10; i++) {
        const n = noiseSrc(t, stop, 'pink');
        const bp = filt('bandpass', 500 + R() * 1500, 3 + R() * 4);
        const l = ctx.createOscillator(); l.frequency.value = 0.3 + R() * 1.5 * excite; const lg = ctx.createGain(); lg.gain.value = 200 + R() * 300; l.connect(lg); lg.connect(bp.frequency); l.start(t); l.stop(stop);
        const vg = ctx.createGain(); vg.gain.value = 0.25;
        n.connect(bp); bp.connect(vg); vg.connect(g);
      }
      adsr(g.gain, t, dur, { a, d: 0.2, s: 1, r, peak: vel * 0.9 });
      route(g, { bus, rev: 0.4 });
    },
    applause(abs, dur, { vel = 0.25, density = 40, bus = 'sfx' } = {}) {
      const k = Math.round(dur * density);
      for (let i = 0; i < k; i++) {
        const tt = abs + R() * dur; const t = T(tt);
        const n = noiseSrc(t, t + 0.03); const bp = filt('bandpass', 1500 + R() * 2500, 1.5); const g = ctx.createGain();
        const env = Math.sin(Math.PI * clamp((tt - abs) / dur));
        g.gain.setValueAtTime(vel * 0.3 * env * (0.4 + R() * 0.6), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        n.connect(bp); bp.connect(g); route(g, { bus, rev: 0.3, pan: R() * 1.6 - 0.8 });
      }
    },
    shutter(abs, { vel = 0.3, bus = 'sfx' } = {}) { perc.tick(abs, { vel, tone: 1800, bus }); perc.tick(abs + 0.05, { vel: vel * 0.7, tone: 1300, bus }); },
    geiger(abs, dur, { rate = 8, vel = 0.2, bus = 'sfx' } = {}) {
      const r2 = rng(Math.round(abs * 10));
      let tt = abs;
      while (tt < abs + dur) { perc.tick(tt, { vel: vel * (0.5 + r2() * 0.5), tone: 4000, bus }); tt += -Math.log(1 - r2() * 0.99) / rate; }
    },
    klaxon(abs, dur = 2, { vel = 0.15, bus = 'sfx', rate = 1.6 } = {}) {
      const t = T(abs), stop = t + dur + 0.2;
      const o = osc('sawtooth', 440, t, stop); const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(stop);
      const lp = filt('lowpass', 1800); const g = ctx.createGain(); o.connect(lp); lp.connect(g);
      adsr(g.gain, t, dur, { a: 0.05, s: 1, r: 0.15, peak: vel * 0.15 }); route(g, { bus, rev: 0.4 });
    },
    // a cut to digital silence: cuts nothing itself, but documents intent
    silence() {},
  };

  // ── helpers for writing music ──
  const A = {
    ctx, sr, t0, T, R, rng, midi, mtof, freq, chord, SCALES, MOTIF,
    music, sfx, route, filt, osc, noiseSrc, shaper, adsr,
    ...voices, ...perc, ...fx,
    voices, perc, fx,
    // play a voice for each note of a chord
    chordOn(inst, abs, notes, dur, opts = {}) {
      notes.forEach((n, i) => voices[inst](abs + (opts.strum || 0) * i, n, dur, { ...opts, pan: opts.pan ?? (i / Math.max(1, notes.length - 1) - 0.5) * 0.5 }));
    },
    // step sequencer: pattern string 'x..x..x.' at bpm (16ths by default)
    pattern(fn, abs, bars, pat, { bpm = 100, div = 4, swing = 0, humanize = 0.004 } = {}) {
      const stepDur = 60 / bpm / div;
      const n = pat.length;
      const total = Math.round((bars * 4 * div));
      for (let i = 0; i < total; i++) {
        const ch = pat[i % n];
        if (ch === '.' || ch === ' ' || ch === '-') continue;
        const sw = i % 2 ? swing * stepDur : 0;
        fn(abs + i * stepDur + sw + (R() - 0.5) * humanize, ch === 'X' ? 1 : ch === 'x' ? 0.7 : 0.45, i);
      }
    },
    // the leitmotif — key 'D', mode 'major'|'minor'|..., oct 4, bpm
    motif(abs, { key = 'D', mode = 'major', oct = 4, bpm = 72, inst = 'strings', vel = 0.4, degrees = MOTIF.degrees, beats = MOTIF.beats, legato = 1.05, opts = {} } = {}) {
      const sc = SCALES[mode] || SCALES.major;
      const root = midi(key + oct);
      let tt = abs;
      degrees.forEach((d, i) => {
        const deg = d - 1, o = Math.floor(deg / sc.length), m = root + sc[((deg % sc.length) + sc.length) % sc.length] + 12 * o;
        const dur = (beats[i] * 60) / bpm;
        voices[inst](tt, m, dur * legato, { vel, ...opts });
        tt += dur;
      });
      return tt;
    },
    // automation helper: ramp a param through [[abs, value], ...]
    automate(param, keys, type = 'linear') {
      keys.forEach(([a, v], i) => {
        const t = T(a);
        if (i === 0) param.setValueAtTime(v, t);
        else if (type === 'exp') param.exponentialRampToValueAtTime(Math.max(1e-4, v), t);
        else param.linearRampToValueAtTime(v, t);
      });
    },
    // create a sub-bus (e.g. a "headphone radio" filter or a ducked group)
    bus({ to = 'music', lp = null, hp = null, gain = 1, radio = false, rev = 0 } = {}) {
      const input = ctx.createGain(); input.gain.value = gain;
      let node = input;
      if (radio) { const a = filt('highpass', 450, 0.7), b = filt('lowpass', 2800, 0.9), s = shaper(1.8); node.connect(a); a.connect(b); b.connect(s); node = s; }
      if (lp) { const f = filt('lowpass', lp); node.connect(f); node = f; }
      if (hp) { const f = filt('highpass', hp); node.connect(f); node = f; }
      route(node, { bus: to, rev });
      input.gainParam = input.gain;
      return input;
    },
  };
  return A;
}

// Render a part's audio offline → { music:[L,R], sfx:[L,R], t0, sr }
export async function renderPartAudio(part, { sr = 48000 } = {}) {
  const pre = part.audio?.pre ?? 2, tail = part.audio?.tail ?? 6;
  const t0 = Math.max(0, part.start - pre);
  const t1 = part.end + tail;
  const len = Math.ceil((t1 - t0) * sr);
  const ctx = new OfflineAudioContext({ numberOfChannels: 4, length: len, sampleRate: sr });
  ctx.destination.channelInterpretation = 'discrete';
  ctx.destination.channelCount = 4;
  const A = createKit(ctx, { t0, seed: part.id.length * 97 + Math.round(part.start) });
  if (part.audio?.build) await part.audio.build(A);
  const buf = await ctx.startRendering();
  return { t0, sr, music: [buf.getChannelData(0), buf.getChannelData(1)], sfx: [buf.getChannelData(2), buf.getChannelData(3)] };
}

// 16-bit PCM WAV encoder (stereo)
export function encodeWav([L, R], sr) {
  const n = L.length, bytes = 44 + n * 4;
  const buf = new ArrayBuffer(bytes), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    o += 4;
  }
  return new Uint8Array(buf);
}
