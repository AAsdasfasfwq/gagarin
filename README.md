# LET'S GO — a motion-design documentary in code

A 21:46 documentary about Yuri Gagarin's flight (English VO), built entirely in code:
Canvas 2D illustration, a 2.5D perspective camera with depth of field, Three.js 3D inserts,
WebGL transitions and film post-processing, and a procedural score + sound design (Web Audio).
Every frame is a pure function of time, so the film renders deterministically and in parallel.

**Output:** 1920×1080 · 16:9 · 30 fps · H.264 + AAC 320k (YouTube master).

## Render the film

Requirements: Node 18+ and `ffmpeg` in `PATH`.

```bash
npm install
```

```bash
node render.js
```

The result is `out/lets-go.mp4`. Useful options:

```bash
node render.js --workers 6 --gpu
```

| Option | Meaning |
|---|---|
| `--workers N` | parallel browser workers (default: CPU cores / 2) |
| `--gpu` | use the GPU for WebGL (much faster). Without it Chrome uses SwiftShader (slower, works everywhere) |
| `--from S --to S` | render only a time range (seconds) |
| `--crf N`, `--preset P` | x264 quality (default 16 / medium) |
| `--png` | lossless frame transfer (slower) |
| `--audio-only`, `--video-only` | build only one half |
| `--music-gain dB`, `--sfx-gain dB` | trim the score / sound design under the voice |
| `--out FILE` | output path |

`CHROME_PATH=/path/to/chrome node render.js` uses a specific Chrome/Chromium.
Rendering is resumable: finished 20-second segments are cached in `build/segments`
(the cache is cleared automatically when sources change).

### How the soundtrack is made
Each part's score and sound design are rendered offline in the browser (`OfflineAudioContext`)
into two stems (music, sfx). `render.js` then mixes them with the voice-over in ffmpeg:
the VO is loudness-normalised to −16 LUFS, the score is side-chain-ducked under the narration,
and a limiter keeps peaks safe.

## Preview interactively

```bash
npm run preview
```

Open the printed URL: space = play/pause (with the VO), ←/→ = frame step (shift = 1 s),
part buttons jump between chapters, "score" renders and plays the music + SFX in sync.

## Project layout

```
index.html, src/main.js     film page (window.film API for the renderer)
src/core/                   engine, post FX & transitions, 2.5D camera, textures, type system,
                            components, palette, character rigs, Three.js helper, maps, audio kit
src/parts/p1…p8/            the eight parts (≈3 min each) — scenes + score + sound design
docs/DIRECTION.md           the director's bible (motion thesis, palette, type, rules, beat plan)
docs/script_timed.txt       timed VO script
render.js                   Puppeteer renderer + ffmpeg mux
tools/                      preview server, QA snapshots (snap.js), model-sheet page
assets/                     voice-over, script JSON with word timings, fonts
```
