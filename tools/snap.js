#!/usr/bin/env node
// QA tool: render stills / contact sheets for a time range, and/or audio stems.
//   node tools/snap.js --from 305.7 --to 330 --step 0.5 --out qa/p3  [--sheet] [--scale 0.5]
//   node tools/snap.js --at 312.4,315.0 --out qa/p3            (exact moments, full-res PNG)
//   node tools/snap.js --part p3 --audio --out qa/p3             (render stems + spectrogram)
//   node tools/snap.js --clip --from 690 --to 700 --out qa/p5    (mp4 preview of a range, 30fps)
// Prints scene id per frame + any page errors / timeline warnings.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { serve, launch, openFilm, parseArgs, ROOT } from './lib.js';

const a = parseArgs(process.argv.slice(2));
const out = path.resolve(ROOT, a.out || 'qa/snap');
fs.mkdirSync(out, { recursive: true });
const { server, port } = await serve();
const browser = await launch({ gpu: !!a.gpu });
const page = await openFilm(browser, port);
const film = await page.evaluate(() => ({ fps: film.fps, frames: film.frames, warnings: film.warnings, parts: film.parts }));
if (film.warnings?.length) console.log('TIMELINE WARNINGS:\n  ' + film.warnings.join('\n  '));
const fps = film.fps;
const scale = parseFloat(a.scale || (a.at ? 1 : 0.5));

async function grab(frame, file, type = 'image/jpeg') {
  const t0 = Date.now();
  const info = await page.evaluate((f) => film.seek(f), frame);
  const url = await page.evaluate((ty) => film.capture(ty, 0.92), type);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync(file, buf);
  if (scale !== 1) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `scale=${Math.round(1920 * scale)}:-2`, file + '.tmp.jpg']), fs.renameSync(file + '.tmp.jpg', file);
  return { info, ms: Date.now() - t0 };
}

if (a.audio) {
  const partId = a.part;
  console.log('rendering audio for', partId, '…');
  const meta = await page.evaluate((p) => film.renderAudio(p), partId);
  for (const stem of ['music', 'sfx']) {
    const total = meta[stem + 'Bytes'];
    const chunks = [];
    for (let off = 0; off < total; off += 4 << 20) chunks.push(Buffer.from(await page.evaluate((p, s, o) => film.audioChunk(p, s, o, 4 << 20), partId, stem, off), 'base64'));
    fs.writeFileSync(path.join(out, `${partId}-${stem}.wav`), Buffer.concat(chunks));
  }
  // preview mix: VO + music(ducked-ish) + sfx, from t0
  const part = film.parts.find((p) => p.id === partId);
  const dur = (part.end - meta.t0 + 3).toFixed(2);
  const mixFile = path.join(out, `${partId}-mix.wav`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(meta.t0), '-t', dur, '-i', path.join(ROOT, 'assets/audio/voiceover.mp3'),
    '-i', path.join(out, `${partId}-music.wav`), '-i', path.join(out, `${partId}-sfx.wav`),
    '-filter_complex', '[0:a]aresample=48000,volume=2.2,asplit=2[vo][sc];[1:a][sc]sidechaincompress=threshold=0.04:ratio=5:attack=20:release=450[m];[vo][m][2:a]amix=inputs=3:normalize=0[o]', '-map', '[o]', mixFile]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mixFile, '-lavfi', 'showspectrumpic=s=1800x500:legend=1:scale=log', path.join(out, `${partId}-spectrogram.png`)]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(out, `${partId}-music.wav`), '-filter_complex', 'showwavespic=s=1800x240:split_channels=0:colors=#F26B1D', '-frames:v', '1', path.join(out, `${partId}-music-wave.png`)]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(out, `${partId}-sfx.wav`), '-filter_complex', 'showwavespic=s=1800x240:split_channels=0:colors=#6FC3E3', '-frames:v', '1', path.join(out, `${partId}-sfx-wave.png`)]);
  for (const stem of ['music', 'sfx', 'mix']) {
    const r = spawnSync(['-hide_banner', '-i', path.join(out, `${partId}-${stem}.wav`), '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const I = /I:\s+(-?[\d.]+) LUFS/.exec(r)?.[1], P = /Peak:\s+(-?[\d.]+) dBFS/.exec(r)?.[1];
    console.log(`${stem}: integrated ${I} LUFS, true peak ${P} dBFS`);
  }
  console.log(`audio t0=${meta.t0}s → files in ${out} (mix aligned to film time ${meta.t0})`);
}

function spawnSync(args) {
  try { return execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); } catch (e) { return String(e.stderr || e.stdout || ''); }
}

if (a.at) {
  for (const s of String(a.at).split(',')) {
    const t = parseFloat(s);
    const f = Math.round(t * fps);
    const file = path.join(out, `at_${t.toFixed(2)}.png`);
    const { info, ms } = await grab(f, file, 'image/png');
    console.log(`${t.toFixed(2)}s f${f} ${JSON.stringify(info)} ${ms}ms → ${file}`);
  }
}

if (a.from !== undefined && !a.clip) {
  const from = parseFloat(a.from), to = parseFloat(a.to ?? from + 10), step = parseFloat(a.step || 1);
  const files = [];
  for (let t = from; t <= to + 1e-6; t += step) {
    const f = Math.round(t * fps);
    const file = path.join(out, `f_${String(f).padStart(6, '0')}.jpg`);
    const { info, ms } = await grab(f, file);
    files.push(file);
    console.log(`${t.toFixed(2)}s f${f} ${info?.scene || ''}${info?.from ? ' ← ' + info.from + ' ' + Math.round(info.p * 100) + '%' : ''} (${ms}ms)`);
  }
  if (a.sheet !== 'false') {
    const cols = parseInt(a.cols || 5, 10);
    const sheetBase = path.join(out, `sheet_${from.toFixed(1)}-${to.toFixed(1)}`);
    const perSheet = cols * 4;
    for (let i = 0; i < files.length; i += perSheet) {
      const group = files.slice(i, i + perSheet);
      const listFile = path.join(out, `list_${i}.txt`);
      fs.writeFileSync(listFile, group.map((f) => `file '${f}'`).join('\n'));
      const sheet = `${sheetBase}_${String(i / perSheet).padStart(2, '0')}.jpg`;
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `scale=480:-2,tile=${cols}x4:padding=4:color=0x111111`, '-frames:v', '1', sheet]);
      fs.unlinkSync(listFile);
      console.log('sheet →', sheet);
    }
  }
}

if (a.clip) {
  const from = parseFloat(a.from), to = parseFloat(a.to);
  const file = path.join(out, `clip_${from.toFixed(1)}-${to.toFixed(1)}.mp4`);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-ss', '0', '-i', path.join(ROOT, 'assets/audio/voiceover.mp3'), '-filter_complex', `[1:a]atrim=start=${from}:end=${to},asetpts=PTS-STARTPTS[a]`,
    '-map', '0:v', '-map', '[a]', '-vf', `scale=${Math.round(1920 * scale)}:-2`, '-c:v', 'libx264', '-crf', '22', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-shortest', file]);
  for (let f = Math.round(from * fps); f < Math.round(to * fps); f++) {
    await page.evaluate((fr) => film.seek(fr), f);
    const url = await page.evaluate(() => film.capture('image/jpeg', 0.9));
    if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('clip →', file);
}

const errs = await page.evaluate(() => film.errors);
if (errs.length) console.log('PAGE ERRORS:\n  ' + errs.join('\n  '));
await browser.close();
server.close();
