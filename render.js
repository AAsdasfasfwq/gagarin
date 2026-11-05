#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// render.js — renders the film frame-by-frame with Puppeteer and muxes the
// final YouTube master (1920×1080, 30 fps, H.264 + AAC).
//
//   npm install                       # installs three + puppeteer (with Chrome)
//   node render.js                    # full film → out/lets-go.mp4
//
// Options:
//   --workers N      parallel browser workers (default: CPU cores / 2, max 6)
//   --from S --to S  render only a time range in seconds (e.g. --from 650 --to 700)
//   --gpu            use the GPU for WebGL (faster; default = SwiftShader, works everywhere)
//   --crf N          x264 quality (default 16; lower = better)
//   --preset P       x264 preset (default 'medium')
//   --png            lossless PNG frame transfer (slower, max quality)
//   --audio-only     only (re)build the soundtrack
//   --video-only     skip soundtrack, keep silent video
//   --music-gain dB  extra gain on the score (default 0)
//   --sfx-gain dB    extra gain on sound design (default 0)
//   --out FILE       output path (default out/lets-go.mp4)
//   CHROME_PATH=/path/to/chrome node render.js   to use a specific Chrome.
// Segments are cached in build/segments — re-running resumes where it stopped.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { serve, launch, openFilm, parseArgs, ROOT } from './tools/lib.js';

const a = parseArgs(process.argv.slice(2));
const BUILD = path.join(ROOT, 'build');
const SEG = path.join(BUILD, 'segments');
const AUD = path.join(BUILD, 'audio');
const OUT = path.resolve(ROOT, a.out || 'out/lets-go.mp4');
for (const d of [BUILD, SEG, AUD, path.dirname(OUT)]) fs.mkdirSync(d, { recursive: true });

function ffmpegOk() { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } }
if (!ffmpegOk()) { console.error('ffmpeg not found in PATH — please install ffmpeg.'); process.exit(1); }

const { server, port } = await serve();
const fmtT = (s) => `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m${String(Math.floor(s % 60)).padStart(2, '0')}s`;

// ── probe film ──
const probeBrowser = await launch({ gpu: !!a.gpu });
const probe = await openFilm(probeBrowser, port);
const film = await probe.evaluate(() => ({ fps: film.fps, frames: film.frames, duration: film.duration, parts: film.parts, warnings: film.warnings }));
if (film.warnings?.length) console.log('Timeline warnings:\n  ' + film.warnings.join('\n  '));
const FPS = film.fps;
const f0 = Math.max(0, Math.round((a.from ? parseFloat(a.from) : 0) * FPS));
const f1 = Math.min(film.frames, Math.round((a.to ? parseFloat(a.to) : film.duration) * FPS));
const partial = a.from || a.to;
console.log(`Film: ${film.duration}s @ ${FPS}fps = ${film.frames} frames. Rendering frames ${f0}–${f1 - 1}.`);

// ── 1) SOUNDTRACK ───────────────────────────────────────────────────────────
async function buildAudio() {
  console.log('\n[audio] rendering score + sound design per part…');
  const stems = [];
  for (const p of film.parts) {
    const t = Date.now();
    const meta = await probe.evaluate((id) => film.renderAudio(id), p.id);
    for (const stem of ['music', 'sfx']) {
      const total = meta[stem + 'Bytes'], chunks = [];
      for (let off = 0; off < total; off += 4 << 20) chunks.push(Buffer.from(await probe.evaluate((id, s, o) => film.audioChunk(id, s, o, 4 << 20), p.id, stem, off), 'base64'));
      const file = path.join(AUD, `${p.id}-${stem}.wav`);
      fs.writeFileSync(file, Buffer.concat(chunks));
      stems.push({ stem, file, t0: meta.t0 });
    }
    await probe.evaluate((id) => film.freeAudio(id), p.id);
    console.log(`  ${p.id}  t0=${meta.t0.toFixed(2)}s  (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  }
  const mg = parseFloat(a['music-gain'] || 0), sg = parseFloat(a['sfx-gain'] || 0);
  const inputs = ['-i', path.join(ROOT, 'assets/audio/voiceover.mp3')];
  stems.forEach((s) => inputs.push('-i', s.file));
  const music = stems.map((s, i) => ({ ...s, idx: i + 1 })).filter((s) => s.stem === 'music');
  const sfx = stems.map((s, i) => ({ ...s, idx: i + 1 })).filter((s) => s.stem === 'sfx');
  const dl = (s) => `[${s.idx}:a]aresample=48000,adelay=${Math.round(s.t0 * 1000)}:all=1[d${s.idx}]`;
  const fc = [
    '[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,loudnorm=I=-16:TP=-2:LRA=9,asplit=2[vo][key]',
    ...music.map(dl), ...sfx.map(dl),
    `${music.map((s) => `[d${s.idx}]`).join('')}amix=inputs=${music.length}:normalize=0:dropout_transition=0,volume=${mg}dB[mus]`,
    `${sfx.map((s) => `[d${s.idx}]`).join('')}amix=inputs=${sfx.length}:normalize=0:dropout_transition=0,volume=${sg}dB[fx]`,
    // duck the score under the narration (gentle, musical)
    '[mus][key]sidechaincompress=threshold=0.035:ratio=4:attack=25:release=650:makeup=1[musd]',
    '[vo][musd][fx]amix=inputs=3:normalize=0:dropout_transition=0,alimiter=limit=0.89:attack=4:release=60,apad[mix]',
  ];
  const mixFile = path.join(AUD, 'soundtrack.wav');
  console.log('[audio] mixing VO + score + sfx (ducking, loudness, limiter)…');
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', fc.join(';'), '-map', '[mix]', '-t', String(film.duration), '-c:a', 'pcm_s16le', '-ar', '48000', mixFile], { stdio: 'inherit' });
  const r = (() => { try { return execFileSync('ffmpeg', ['-hide_banner', '-i', mixFile, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); } catch (e) { return String(e.stderr); } })();
  console.log(`[audio] soundtrack: ${/I:\s+(-?[\d.]+) LUFS/.exec(r)?.[1]} LUFS integrated → ${mixFile}`);
  return mixFile;
}

// ── 2) VIDEO ────────────────────────────────────────────────────────────────
async function renderChunk(id, from, to, onFrame) {
  const file = path.join(SEG, `seg_${String(from).padStart(6, '0')}_${String(to).padStart(6, '0')}.mp4`);
  const done = file + '.done';
  if (fs.existsSync(done)) { for (let f = from; f < to; f++) onFrame(); return file; }
  const browser = await launch({ gpu: !!a.gpu });
  const page = await openFilm(browser, port, { log: id === 0 });
  const mime = a.png ? 'image/png' : 'image/jpeg';
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', a.png ? 'png' : 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', a.preset || 'medium', '-crf', String(a.crf || 16), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-r', String(FPS), '-g', String(FPS * 2), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = from; f < to; f++) {
    await page.evaluate((fr) => film.seek(fr), f);
    const url = await page.evaluate((m) => film.capture(m, 0.96), mime);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    onFrame();
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  const errs = await page.evaluate(() => film.errors);
  if (errs.length) console.log(`\n[worker ${id}] page errors:\n  ` + errs.slice(0, 10).join('\n  '));
  await browser.close();
  fs.writeFileSync(done, '');
  return file;
}

async function buildVideo() {
  const workers = Math.max(1, Math.min(parseInt(a.workers || Math.max(1, Math.floor(os.cpus().length / 2)), 10), 12));
  // chunks of ~20 s so work balances and resume is granular
  const CH = FPS * 20;
  const chunks = [];
  for (let f = f0; f < f1; f += CH) chunks.push([f, Math.min(f1, f + CH)]);
  console.log(`\n[video] ${chunks.length} chunks × ≤${CH} frames on ${workers} workers…`);
  let doneFrames = 0;
  const total = f1 - f0, t0 = Date.now();
  const tick = () => {
    doneFrames++;
    if (doneFrames % 30 === 0 || doneFrames === total) {
      const el = (Date.now() - t0) / 1000, rate = doneFrames / el, eta = (total - doneFrames) / Math.max(rate, 1e-6);
      process.stdout.write(`\r  ${doneFrames}/${total} frames  ${(100 * doneFrames / total).toFixed(1)}%  ${rate.toFixed(2)} fps  ETA ${fmtT(eta)}   `);
    }
  };
  const files = new Array(chunks.length);
  let next = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    while (next < chunks.length) {
      const i = next++;
      files[i] = await renderChunk(w, chunks[i][0], chunks[i][1], tick);
    }
  }));
  console.log('\n[video] concatenating segments…');
  const list = path.join(BUILD, 'segments.txt');
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const vid = path.join(BUILD, partial ? 'video_partial.mp4' : 'video.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', vid], { stdio: 'inherit' });
  return vid;
}

let audioFile = path.join(AUD, 'soundtrack.wav');
if (!a['video-only']) audioFile = await buildAudio();
if (a['audio-only']) { await probeBrowser.close(); server.close(); console.log('done.'); process.exit(0); }
await probeBrowser.close();
const videoFile = await buildVideo();

// ── 3) MUX ──────────────────────────────────────────────────────────────────
console.log('[mux] writing', OUT);
const ss = (f0 / FPS).toFixed(3), dur = ((f1 - f0) / FPS).toFixed(3);
const args = ['-v', 'error', '-y', '-i', videoFile];
if (!a['video-only'] && fs.existsSync(audioFile)) args.push('-ss', ss, '-t', dur, '-i', audioFile, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
args.push('-c:v', 'copy', '-movflags', '+faststart', '-t', dur, OUT);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
server.close();
console.log(`\n✔ done → ${OUT}`);
