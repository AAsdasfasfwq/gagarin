// ─────────────────────────────────────────────────────────────────────────────
// main.js — boots the film. Exposes window.film for render.js / tools.
//   ?render=1          → headless render mode (no UI, exact 1920×1080 canvas)
//   ?t=123.4           → open preview at a time
// ─────────────────────────────────────────────────────────────────────────────
import { Engine, FPS } from './core/engine.js';
import { loadFonts } from './core/type.js';
import { SCRIPT } from './core/script.js';
import { PARTS, DURATION } from './parts/registry.js';
import { renderPartAudio, encodeWav } from './core/audio.js';

const qs = new URLSearchParams(location.search);
const RENDER = qs.has('render');
const out = document.getElementById('out');
if (!RENDER) document.body.classList.add('preview');

// Safety net: Math.random is forbidden in scenes. Make it deterministic per frame
// so accidental use can't break parallel rendering (it will still look wrong).
let __mr = 1;
Math.random = () => { __mr = (__mr * 16807) % 2147483647; return (__mr - 1) / 2147483646; };

const film = (window.film = {
  fps: FPS, duration: DURATION, frames: Math.round(DURATION * FPS),
  parts: PARTS.map((p) => ({ id: p.id, start: p.start, end: p.end, title: p.title || '' })),
  errors: [],
});
window.addEventListener('error', (e) => film.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => film.errors.push(String(e.reason && (e.reason.stack || e.reason))));

film.ready = (async () => {
  await loadFonts();
  await SCRIPT.load();
  const engine = new Engine({ parts: PARTS, duration: DURATION, outCanvas: out });
  film.engine = engine;
  film.warnings = engine.warnings || [];
  film.seek = async (frame) => { __mr = (frame | 0) + 1; return engine.seek(frame); };
  film.capture = (type = 'image/jpeg', q = 0.95) => out.toDataURL(type, q);
  // ── audio export (chunked base64 transfer for puppeteer) ──
  const audioStore = new Map();
  film.renderAudio = async (partId) => {
    const part = PARTS.find((p) => p.id === partId);
    if (!part) throw new Error('no part ' + partId);
    const r = await renderPartAudio(part);
    const music = encodeWav(r.music, r.sr), sfx = encodeWav(r.sfx, r.sr);
    audioStore.set(partId, { music, sfx });
    return { t0: r.t0, sr: r.sr, musicBytes: music.length, sfxBytes: sfx.length };
  };
  film.audioChunk = (partId, stem, offset, len) => {
    const bytes = audioStore.get(partId)[stem].subarray(offset, offset + len);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  film.freeAudio = (partId) => audioStore.delete(partId);
  film.partAudioBuffers = async (partId) => renderPartAudio(PARTS.find((p) => p.id === partId));
  return true;
})();

// ── interactive preview ──────────────────────────────────────────────────────
if (!RENDER) {
  const vo = document.getElementById('vo');
  const scrub = document.getElementById('scrub');
  const tc = document.getElementById('tc');
  const info = document.getElementById('info');
  const playBtn = document.getElementById('play');
  const scoreBtn = document.getElementById('score');
  const partsEl = document.getElementById('parts');
  let playing = false, busy = false, wantFrame = 0, scoreOn = false;
  let ac = null; const scoreCache = new Map(); let scoreNodes = [];
  const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  film.ready.then(async () => {
    scrub.max = film.frames - 1;
    film.parts.forEach((p) => {
      const b = document.createElement('button');
      b.textContent = p.id; b.title = `${p.title} ${fmt(p.start)}–${fmt(p.end)}`;
      b.onclick = () => go(Math.round(p.start * FPS));
      partsEl.appendChild(b);
    });
    const t = parseFloat(qs.get('t') || '0');
    await go(Math.round(t * FPS));
    if (film.warnings.length) console.warn(film.warnings);
  });
  async function draw(frame) {
    if (busy) { wantFrame = frame; return; }
    busy = true;
    const r = await film.seek(frame);
    busy = false;
    scrub.value = frame;
    tc.textContent = `${fmt(frame / FPS)}  f${frame}`;
    info.textContent = r ? (r.from ? `${r.from} → ${r.scene}  ${(r.p * 100) | 0}%` : r.scene) : '';
    if (wantFrame !== null && wantFrame !== frame && !playing) { const w = wantFrame; wantFrame = null; draw(w); }
  }
  async function go(frame) { wantFrame = null; vo.currentTime = frame / FPS; await draw(frame); }
  scrub.oninput = () => { if (playing) stop(); go(+scrub.value); };
  async function ensureScore(t) {
    ac ||= new AudioContext({ sampleRate: 48000 });
    for (const p of film.parts) {
      if (p.end + 6 < t || p.start > t + 400) continue;
      if (!scoreCache.has(p.id)) {
        info.textContent = `rendering score ${p.id}…`;
        const r = await film.partAudioBuffers(p.id);
        const mk = (st) => { const b = ac.createBuffer(2, st[0].length, r.sr); b.copyToChannel(st[0], 0); b.copyToChannel(st[1], 1); return b; };
        scoreCache.set(p.id, { t0: r.t0, music: mk(r.music), sfx: mk(r.sfx) });
      }
    }
  }
  async function start() {
    const t = +scrub.value / FPS;
    if (scoreOn) {
      await ensureScore(t);
      await ac.resume();
      const now = ac.currentTime + 0.05;
      for (const [, s] of scoreCache) for (const st of ['music', 'sfx']) {
        const src = ac.createBufferSource(); src.buffer = s[st];
        const g = ac.createGain(); g.gain.value = st === 'music' ? 0.7 : 0.8;
        src.connect(g); g.connect(ac.destination);
        const off = t - s.t0;
        if (off > src.buffer.duration) continue;
        if (off >= 0) src.start(now, off); else src.start(now - off);
        scoreNodes.push(src);
      }
    }
    vo.currentTime = t;
    await vo.play();
    playing = true; playBtn.textContent = '❚❚ pause'; tick();
  }
  function stop() {
    playing = false; vo.pause(); playBtn.textContent = '▶ play';
    scoreNodes.forEach((n) => { try { n.stop(); } catch {} }); scoreNodes = [];
  }
  function tick() {
    if (!playing) return;
    const f = Math.floor(vo.currentTime * FPS);
    if (!busy) draw(f);
    requestAnimationFrame(tick);
  }
  playBtn.onclick = () => (playing ? stop() : start());
  scoreBtn.onclick = () => { scoreOn = !scoreOn; scoreBtn.textContent = `score: ${scoreOn ? 'on' : 'off'}`; scoreBtn.classList.toggle('on', scoreOn); if (playing) { stop(); start(); } };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); playing ? stop() : start(); }
    if (e.code === 'ArrowRight') { if (playing) stop(); go(+scrub.value + (e.shiftKey ? 30 : 1)); }
    if (e.code === 'ArrowLeft') { if (playing) stop(); go(+scrub.value - (e.shiftKey ? 30 : 1)); }
  });
}
