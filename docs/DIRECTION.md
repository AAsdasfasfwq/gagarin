# LET'S GO — Director's Bible

> A 21:46 motion-design documentary about the 108 minutes of Vostok 1 — and everything that
> nearly killed the man before, during and after them.
> **Format:** 1920×1080 · 16:9 · 30 fps · YouTube master · English VO (`assets/audio/voiceover.mp3`, 1303.9 s).
> **Every scene is code**: Canvas 2D + 2.5D camera + Three.js inserts + WebGL post. No stock, no footage.

This bible is binding for all eight part directors. Read it fully before planning.
Each director owns ONE time window end-to-end (picture, transitions, music, SFX) — see §12.

---

## 1. Creative direction (four axes)

| Axis | Position | Why |
|---|---|---|
| Tone register | **Professional, with provocative edges** | Restrained narration of horror and triumph; irony allowed where the script is ironic (centrifuge liars, FAI cover-up, the bus wheel). |
| Aesthetic philosophy | **Controlled maximalist** | Rich, crafted frames — every element intentional. Never busy for its own sake. |
| Audience relationship | **Companion** | We walk beside Gagarin. The viewer should *feel* g-force, silence, heat, relief. |
| Sensory ambition | **Resonant** | The film should leave a lump in the throat at the letter, the silence of orbit, and the final smile. |

**Synthesis.** The film reads like a premium editorial documentary (think the craft of a studio reel crossed
with a Vox explainer): tactile paper, ink and halftone for history; cold blueprint for engineering; hot,
physical VFX for fire and re-entry; a deep indigo silence for orbit. One warm colour — **the orange of
Gagarin's suit** — threads through a cold machine world.

**Rejection list.** No stock icons. No capsule people. No white untextured 3D. No PowerPoint cards.
No subtitles-as-visuals. No rainbow hues. No pure #000 grounds. No glow on everything. No same
transition twice in a row. No static frame longer than ~1 s without *something* living.

---

## 2. Reference study (what we take from the supplied videos)

**Studio showreels (ref 2, ref 3, ~0.8–1.0 s per shot, 120+ cuts in 2 min).** Lesson: radical variety of
visual language (3D product, 2D cel, editorial illustration, typography, VFX) held together by finish
quality, lighting and rhythm. Every shot has one hero, strong silhouette, real material and light.
We use showreel pacing only at PEAKS (explosion, launch, re-entry, celebration, finale recap).

**Editorial explainer shorts (refs _1–_4, 3–5 s per beat, few hard cuts).** Lesson: the *camera* moves
through one connected world instead of cutting; objects sit on textured paper with soft contact shadows;
typography is word-synced to the VO and paired — **small italic serif lead-in + big bold key word**;
thin ink connector lines; spotlight cones; shape-match transitions (eye → circle → brain on a pitch).
This is our DEFAULT grammar for explanation beats.

**Ref 4 (3D character reel).** Bold colour blocking, objects with personality, typography wrapping
around objects in depth. We borrow the idea of type living IN the scene (on surfaces, in perspective).

**Character references.** Cartoon/caricature acting with weight, squash, anticipation, follow-through.
Faces must emote. Never rigid "paper cut-out sliding on X".

---

## 3. Motion thesis

> A cold war machine, drawn in steel blue and archive paper, is slowly revealed to carry one warm human
> being. The **trajectory ink-line** is the film's spine: ballistic arc → fuse → orbit → plasma trail →
> parachute line → the road home. **Circles** carry us between worlds (porthole, sphere, Earth, clock,
> gold star, smile). Light means life: fire is death, sunlight in the porthole is wonder, the smile is
> "pure, absolute light". The camera always lives; it moves only to reveal, compare, change scale or
> follow cause → effect. The film refuses decoration: every effect must explain or make us feel.

---

## 4. Visual system

### 4.1 Palette (src/core/palette.js — use tokens, not random hex)
Chapter colour states — related, never monochrome without reason:

| State | Used for | Ground | Ink | Accent |
|---|---|---|---|---|
| `coldwar` | arms race, missiles | ink navy | steel light | red alarm |
| `archive` | history, secrecy, documents | paper cream | ink | vermilion |
| `toxic` | propellants, pressure | olive black | acid | toxic chartreuse |
| `disaster` | Nedelin fire | fire ramp | fire4 | fire3 |
| `ash` | aftermath, memorial | warm grey | paper | red |
| `blueprint` | Vostok engineering | blueprint | line cyan | orange |
| `editorial` | selection, people | light paper | ink | red |
| `night` | eve of launch, letter | night blue | cream | tungsten gold |
| `dawn` | morning, the pad | dawn coral | ink | orange |
| `ascent` | launch | sky → indigo | cream | fire |
| `orbit` | weightless, Earth | space indigo | cream | halo cyan |
| `warning` | malfunctions | dark slate | cream | amber |
| `reentry` | plasma | ember | plasma2 | plasma0 |
| `spring` | landing, field | spring sky | soil | orange |
| `triumph` | celebration | red | cream | gold |
| `coda` | legacy, death, finale | dusk violet | cream | gold |

**THE ORANGE (`C.orange`) is reserved for Gagarin / human courage.** It may appear as a single dot,
a suit, a trajectory head, a highlighted word. Never as decoration.
**Black** only when the moment demands it (seconds before the explosion; engine cutoff silence). Even then:
a tinted `C.inkDeep`, and something still lives (a breath of grain, a dust mote, a faint glow).

### 4.2 Typography (src/core/type.js — local fonts only)
- `F.COND` Big Shoulders — headlines, dates, labels (our workhorse, UPPERCASE).
- `F.DISPLAY` Unbounded — giant numbers & hero words (108, 1-2-5, 10 G, ПОЕХАЛИ).
- `F.SERIF` Instrument Serif *italic* — small lead-ins, quotes, emotion.
- `F.MONO` Martian Mono — telemetry callouts `[ LOX TANK ]`, coordinates, timecodes.
- `F.TYPE` Special Elite — classified documents. `F.STENCIL` — military markings, stamps.
- `F.HAND` La Belle Aurore — the letter to Valentina. `F.HAND2` — flight-log scribbles.
- `F.FRAUNCES` — newspaper mastheads. `F.RUS`/Unbounded — period Russian words (СССР, ТАСС, ПОЕХАЛИ).

Rules: **1–5 words on screen per beat**. Only names, dates, numbers, places, key terms, short quotes.
Never the narrated sentence. Text enters word-synced (±3 frames of the spoken word, use `SCRIPT.find`).
Correct spellings on screen even when the VO mispronounces: **YANGEL** (VO "Yangl"), **TYURATAM**,
**GHERMAN TITOV**, **LEVITAN**, **SMELOVKA**, **ANNA TAKHTAROVA**, **OLEG IVANOVSKY**, **FAI**.
Safe area: keep text inside x∈[120,1800], y∈[90,990]. Minimum on-screen text size 26 px (mono labels) —
test at phone size.

### 4.3 Signature components (src/core/components.js — use them, style via options)
`dateCard` (time jumps) · `nameTag` (people) · `callout` (telemetry labels) · `bigNumber` (hero stats) ·
`leadKey` (serif lead-in + condensed key word) · `trajectory` (the ink-line motif) · `caption`.
Using the same devices across parts is what makes the film one film.

### 4.4 Texture, light, depth
- Every ground has temperature and texture: `paperBg`, `pooledBg`, `tex.paper/concrete/metal/grit`,
  halftone for print/propaganda. Film grain/vignette/CA/bloom are global (post.js) — tune per scene with
  `post: {…}` (e.g. `{ bloom: .5, bloomThreshold: .7 }` for fire, `{ saturation: .6 }` for archive).
- Light is a design tool: `glow`, `lightCone`, `godRays`, rim light on characters (`rim:`).
- Depth: use `Cam25` (true perspective parallax + depth-of-field) for 2.5D. At least 3 planes:
  foreground (blurred, close), subject, background, + atmosphere (`haze`, smoke, dust particles).
- Volume on 2D objects: `shadeSphere`, `shadeCylinder`, `contactShadow`, `withShadow`. Nothing flat
  without reason. Objects get bevel highlights, contact shadows, texture overlays (`texturePath`).

### 4.5 2D / 2.5D / 3D budget (whole film)
**2D ≈ 50% · 2.5D ≈ 35% · 3D ≈ 15%.** Motion-design/infographic/typography ≥ 60% of runtime.
Character-animation scenes ≈ 15–20% of runtime (they are the seasoning, not the meal).
3D only where real geometry/lighting/occlusion matters (R-7, Vostok, Earth, re-entry sphere, globe).

---

## 5. Motion language (one hand for the whole film)

| Property | Rule |
|---|---|
| Easing | Entrances/landings `E.out` (outQuint). Exits `E.in`, 60 % of the entrance duration. Camera travel `E.cam` (inOutQuart). Impacts `E.snap`. `E.back`/springs ONLY on comic beats (centrifuge liars, bus, farmwoman). Never `linear` except continuous drifts. |
| Base unit | 0.4 s. Micro 0.2 · enter 0.4–0.6 · big move 0.8–1.6 · camera travel 1.2–3 s. |
| Stagger | 0.03 s/char, 0.06–0.1 s/element. Nothing enters all at once. |
| Hold | ≥ 0.3 s stillness of the hero after each landed beat — but the frame keeps breathing (handheld 2–4 px, dust, flicker). |
| Hero | Exactly one hero per frame. Support elements smaller/faster/dimmer. |
| Camera | Always alive (`handheld`). Moves are motivated: push-in for tension, pull-out for scale, orbit for objects, track for journeys, crane for the rocket, rack-focus for attention shifts, shake only for physical force. No endless zoom; vary moves. |
| Holds per shot | Visual beats ~2–6 s (avg ≈ 3.5 s). Peaks may go 0.5–1.5 s. Nothing static > 1 s. |
| On twos | Hand-drawn/collage material may animate on twos (`onTwos(t)`) for tactile charm; camera and VFX stay smooth. |

**Transitions** (engine `transition: {type, dur}` on the incoming scene): `cut` (default), `crossfade`,
`dip`, `wipe`, `iris`, `push`, `zoom`, `whip`, `flash`, `burn`, `glitch`, `ink`, `mask` (custom shape
via `mask(m,p)`), `blur` (rack-focus), `blinds`, `clock`, `lumaWipe`. **Best transitions happen inside a
scene** (object → infographic, map → environment, a circle becoming a porthole, type becoming a scene).
Rules: never the same transition type twice in a row; ≥ 8 different transition mechanisms per part;
≥ 40 % of scene changes are motivated match/morph/in-scene moves; hard cuts on beats for energy.

---

## 6. Characters (src/core/characters.js — the model sheet)

Use `drawCharacter(ctx, who, pose)`. Cast: `gagarin`, `titov`, `korolev`, `nedelin`, `anna`, `rita`,
`valentina`, `engineer` (generic crew: outfits `overalls|labcoat|soldier`). Gagarin outfits:
`spacesuit` (+`helmet`, `visor`), `uniform` (+`medal:true`), `flight`, `training`, `shirt`.
Korolev: `coat`/`suit`, `hat:'fedora'`. Nedelin: `marshal` (cap + Gold Star).
Heads are true 3D surfaces: keep `|yaw| ≤ 0.75` (no full profiles). Expressions via `expr`
(smile, teeth, open, frown, worry, brow, squint, cheeksPull (g-force), pale, sweat, tear, blink, look).
Arms: `a` = upper-arm from straight-down (+ outward), `b` = elbow fold (+ inward/up, − outward/up).
Examples: hand on chest `{a:.15,b:2.0}` · wave `{a:1.0,b:-1.3}` · triumph `{a:2.6,b:.2}` ·
hands on hips `{a:.6,b:1.9}` · point sideways `{a:1.5,b:0}`. `prop:(ctx,x,y,ang,s)=>…` draws a held object.
`idle(t)` → blink/breath/look; `talk(t,t0,t1)` → mouth open for lip-flap.

**Acting rules.** Anticipation before big moves, overlap/follow-through (`wobble`, `spring`), weight
shifts, eye-darts before head turns, blinks on thought changes. Characters live in environments with
depth (Cam25 planes, foreground objects, light). Avoid sliding cut-outs; move them in depth (z), scale
with perspective, lean, turn. You may wrap the rig with local helpers in your part folder for extra
props/hair/poses — do NOT edit `src/core/characters.js`.
Valentina and the Gagarin daughters appear only in a framed photo / memory. The Queen: show as an
elegant silhouette/hand & teacup/camera flash — no caricature of a real living-era monarch.

---

## 7. Infographics & explanation

Data is part of the composition, never a slide. Use object-scaling, silhouettes, counters, timelines,
paths, exploded views, cutaways, schematic mode, 3D infographics. Reveal complex ideas in sequence:
object → first number → camera shift → comparison → transformation. Enumerations: each item gets its
own visual idea (camera travels between objects, one evolving scene, transformations) — never
icon + label × N. Every number on screen = the number in the VO (no invented statistics).

---

## 8. Sound — score & design (src/core/audio.js)

The VO is the master clock. Music is almost always present but **changes with the story**: genre,
instrumentation and tempo follow the mood (thriller, horror, sly/ironic, intimate, epic, ethereal,
festive, elegiac). Use the kit voices (pad, strings, solo, pizz, pluck, balalaika, piano, celesta,
glock, musicbox, vibes, bell, tubular, brass/horn (mute), choir, bass, arp, flute, clarinet, bassoon,
organ) + percussion (kick, snare, roll, timpani, timpRoll, taiko, tom, hat, shaker, swell, crash, gong,
woodblock, triangle, anvil, heartbeat) + design (whoosh, swish, impact, subHit, tonalHit, riser,
reverse, click, beep, telemetry, typewriter, stamp, paper, shimmer, rumble, wind, hiss, fire, explosion,
engine, radioStatic, servo, metal, breath, crowd, applause, shutter, geiger, klaxon).
Sub-buses: `A.bus({radio:true})` for headphone/radio colour, `lp/hp` for muffled scenes.

**Leitmotif "Poyekhali"** = `A.motif(t, {key:'D', mode, inst, bpm})` (degrees 1-5-4-3-2-3-5-8).
Hopeful (`major`) when about human courage, haunted (`minor`/`phrygian`) in danger, triumphant
(`horn`/`brass` + strings) at "Let's go!" and the finale. Hint it, fragment it, don't overplay it.

**Levels (critical — VO sits on top).** Write the score at `vel` 0.15–0.5; peaks only where narration
pauses. The mixer ducks music under the VO and trims globally — never fight it. Target per-part stems
(measured by `tools/snap.js --audio`): music ≈ −22…−26 LUFS integrated, sfx ≈ −26…−30 LUFS.
SFX are subtle accents — 2–3 frames BEFORE the visual hit; whoosh into cuts; impact ON big reveals;
tick/click on numbers; nothing harsh > 4 kHz; never stack > 3 SFX at once.
Silence is a tool: engine cutoff (≈755 s), seconds before the Nedelin explosion, the death in 1968.

---

## 9. Determinism & tech contract (MUST)

- Scene API: see header of `src/core/engine.js`. Times are ABSOLUTE film seconds. Scenes in your part
  must tile `[part.start, part.end)` exactly (no gaps/overlaps). Overlay scenes (`overlay:true`) may span.
- `render(ctx, t, S)` = pure function of t. No `Math.random`, `Date`, `performance.now`, timers, CSS
  animation. Randomness: `rng(seed)` created per call or in init with fixed seeds; noise: `noise.*`.
- Build heavy things once in `init(S)` (textures, paths, Three scenes) and store in `S.state`.
- Paint a FULL opaque frame. Your render may be called with t > dur during the next scene's transition.
- **Performance budget:** ≤ ~1.2 s per frame in `tools/snap.js` on this machine. Avoid per-frame
  `ctx.filter` blur on many draws (blur once on a scratch canvas), avoid per-frame `getImageData`/pixel
  loops at full res, keep particle counts sane (< 1500), Three scenes < 300k tris, no per-frame
  geometry rebuilds. `Cam25.plane` with aperture blurs each blurred plane once — fine.
- Only edit files inside `src/parts/<yourPart>/` (+ your QA output under `qa/<yourPart>/`). Never edit
  `src/core/*`, other parts, registry, render.js. Need a helper? Write it locally in your folder.
- Part module: `export default { id, start, end, title, scenes:[…], audio:{ pre, tail, build(A){…} } }`.

**QA loop (mandatory, from the skills: render → look → fix → re-render):**
1. `node tools/snap.js --from <a> --to <b> --step 0.5 --out qa/<part>/sheetN` → view the contact sheets.
2. `node tools/snap.js --at 12.3,15.0 --out qa/<part>/stills` → full-res stills of key frames & transitions.
3. `node tools/snap.js --part <part> --audio --out qa/<part>/audio` → stems + spectrogram + LUFS.
4. Check: no page errors, no timeline warnings, every VO sentence has a matching visual within ±0.3 s,
   one hero per frame, readable at thumbnail size, nothing touching frame edges, no repeated transition,
   no AI-template look. Fix and re-render until clean.

---

## 10. Recurring motifs (cross-part continuity)

1. **The trajectory ink-line** (`trajectory()`, cream ink, orange head): P1 ballistic arcs · P2 the fuse
   / flame path · P5 ascent path · P6 orbit ellipse · P7 descent path & parachute lines · P8 world-tour
   routes & the final line that becomes the horizon.
2. **Circles**: sphere, porthole, Earth, clock, gold star, the smile. Use for match-cuts.
3. **Classified paper**: typewriter, stamps `СОВЕРШЕННО СЕКРЕТНО`, redaction bars (P1, P2, P7).
4. **Telemetry tags** in Martian Mono `[ … ]` for every technical fact.
5. **The orange dot** = Gagarin, from the first frame (a tiny warm dot in the cold arsenal map) to the last.
6. **The clock**: Nov 7 deadline (P2) · 18:45 (P2) · 05:30, 09:07 (P4–P5) · 108:00 (P6) · 10:25 (P6).

---

## 11. Seams between parts (handoff contracts)

The incoming part owns the transition (declare it on its first scene) and the downbeat; the outgoing
part owns the build-up into the seam (visual + riser). Match the described frames exactly.

| Seam | Outgoing last ~1 s | Incoming first scene | Sound |
|---|---|---|---|
| **155.00** P1→P2 | Two droplets (acid chartreuse + amber) meet centre-frame (960,540) and SPARK. | `flash` 0.5 s (warm white) → date card **OCT 23 · 1960** on night blue. | P1 riser peaks at 155.0; P2 starts on an impact + ticking-clock thriller bed. |
| **305.72** P2→P3 | Ash palette; slow push into a dark soot-black CIRCLE centred (960,540), r≈300 px. | `crossfade` 0.8 s shape-match into the Vostok sphere at (960,540), r≈300 (blueprint state). | P2 requiem tail decays (no hit); P3 enters with a soft analog arpeggio. |
| **477.08** P3→P4 | Gagarin's smile radiates warm light filling frame centre. | `flash` 0.6 s warm [1,.92,.8] → **APRIL 11 · 1961** typographic card, night. | P3 resolves on D major; P4 opens hushed: single low piano note. |
| **649.76** P4→P5 | Closed hatch centred, indicator **32** glowing green, minutes ticking. | `zoom` 0.7 s centred (.5,.5) → inside the capsule with Gagarin, headphones. | P4 ticking stops on the seam; P5 starts with a filtered love song (radio bus). |
| **817.94** P5→P6 | Night-side Earth fills lower half (city lights = sleeping America), horizon arc, indigo space. | `crossfade` 1.0 s into the same Earth, which pulls out into the orbit infographic. | P5 ends on a sustained D-lydian pad; P6 continues same key, celesta "108". |
| **972.42** P6→P7 | Porthole circle centred, orange glow building outside. | `burn` 0.8 s (plasma orange colour) → exterior plasma sheath. | P6 rising roar/riser; P7 hits on full plasma roar + taiko. |
| **1127.00** P7→P8 | Plowed spring field in perspective, orange figure + parachute settling mid-left, morning sky. | `crossfade` 0.6 s, same field world → farmwoman scene. | P7 resolves pastoral (wind, gentle strings); P8 enters with plucked folk strings. |

---

## 12. Part briefs (each director plans the micro-beats; these are the anchors)

Ranges are absolute seconds. Read `docs/script_timed.txt` (all 489 timed VO lines). Key beats below are
*minimums*, not limits — invent better ideas when you can. Emotional curve of the film:
calm dread → rising thriller → **explosion (peak 1)** → horror/silence → curious tech → comedy & warmth →
intimate night (letter) → tension (contact 32) → **launch "Let's go!" (peak 2)** → silence & wonder →
creeping dread → chaotic spin → **re-entry inferno (peak 3)** → relief & comedy → triumph → elegy →
**finale (peak 4)**.

### P1 · 0.00–155.00 · "The Arms Race" (states: coldwar → archive → toxic)
- 0–6 Cold open: early-60s world, Cold War "chilling madness" — a strong first frame within 1 s (globe /
  map of steel; the iron curtain; one red pulse). Title idea: the film title **LET'S GO** / ПОЕХАЛИ may
  land around "romantic wonder" (≈18–24 s) as a romantic space-poster that is then TORN to reveal the
  military blueprint beneath ("nothing to do with dreams… an arms race").
- 6–18 Two superpowers, thousands of warheads pointed at each other, radioactive ash → designed warhead
  fields/arcs between continents (real map: `loadGeo`), ash/burn.
- 31–48 Rockets built as ICBMs; deliver a several-ton thermonuclear warhead to another continent before
  the enemy presses the button → schematic/exploded missile, ballistic arc, the button-vs-clock race.
- 48–71 **Korolev** (character intro + `nameTag`), "hid humanity's greatest dream inside a military
  machine" (a glowing human dream inside the warhead bay), persuading the party (satellite → human),
  "proof of superiority" (propaganda typography, balance of power).
- 71–92 R-7 = gigantic barrel of hundreds of tons of fuel + LOX; temperamental, dangerous, unpredictable
  → 3D R-7 cutaway (the iconic packet of 4 strap-on boosters + core), tank callouts, 3 words 3 visuals.
- 92–107 Courage; an event 6 months before Gagarin's flight, kept secret for decades → timeline rewind
  APR 1961 → OCT 1960; classified stamp.
- 107–155 OCT 1960, Tyuratam (later Baikonur) map zoom; R-16 on the pad at night; not Korolev's —
  YANGEL's bureau, same industry & people (network); deadline: anniversary of the October Revolution
  (Nov 7) "at any cost"; frantic haste; toxic propellants (UDMH + nitric acid) ignite on contact →
  chemistry motion piece ending on the SEAM (two droplets meet → spark).
Music: cold dread (low drones, timpani, clock-like ostinato, Soviet-tinged brass minor), a fragile glass
motif hint for "dream", sly pizzicato for political pressure, toxic dissonant synths, riser into 155.

### P2 · 155.00–305.72 · "Launch Site 41" (states: night → disaster → ash)
- Date card OCT 23 (seam). Fuelling; electrical faults + fuel leak (diagnostic HUD); safety rule = drain,
  remove, send to the assembly building (site-map path) — weeks; deadline looming.
- **Marshal Nedelin** (character + nameTag), the fatal decision: repair on the pad, fully fuelled; the
  chair 56 ft from the base of the "66-foot bomb" (measurement graphics); dozens on the scaffolding.
- OCT 24, 18:45 (clock card) — commands from the panel, second stage fires uncommanded, flame burns
  through first-stage tanks (cutaway) → **EXPLOSION** ("ocean of fire", "hell on earth"): the film's
  first big VFX peak — fireball, shockwave, smoke columns, debris, camera shake, showreel-fast cuts.
- 5,400 °F; metal flowed like water; shadows left on concrete; boiling acid — handle with restraint and
  dignity (silhouettes, shadows, abstraction; no gore).
- Nedelin died; what remained: melted Gold Star + safe keys (quiet still-life, single light).
- 74–126 dead (memorial infographic with the uncertainty range), elite of Soviet rocketry.
- Classified; relatives told "plane crash" (typewriter telegram, stamps, redaction); impossible to hide
  from staff and cosmonauts — Gagarin, Titov knew; soot-blackened pad; "no safe airplane — a dragon
  that could devour you" (the flame/smoke becomes a dragon — illustrative highlight); "they continued
  training" → SEAM dark circle.
Music: ticking thriller → unbearable tension → sudden silence → explosion → horror/requiem (low choir,
reverse swells, sparse bells) → cold typewriter rhythm for the cover-up → ominous brass "dragon".

### P3 · 305.72–477.08 · "The Sphere and the Chosen One" (states: blueprint → editorial)
- Vostok 1 (true 3D, real materials) vs the modern idea of a shuttle; descent sphere "a little more
  than 6.5 ft" (scale with human silhouette); ablative coating explained (layer cutaway, heat carried
  away); cramped interior: ejection seat, life support, control panel (exploded view, each a real
  drawing).
- Doctors terrified of weightlessness — insanity / catatonic stupor / panic pressing every button
  (3 distinct visual ideas, slightly ironic) → fully automated; "passenger, not pilot".
- Code lock: **1-2-5** in a sealed envelope (hero kinetic-type moment; keypad; unlock).
- 20 pilots → 2: **GAGARIN** and **GHERMAN TITOV** (characters); Gagarin chosen. Why? Peasant
  background (propaganda poster) + psychological stability + complete honesty.
- **The centrifuge story** (comic character scene, sly music): others: "Great! Ready to fly!" —
  Gagarin, white as a sheet: "I feel awful. I'm nauseated and my head is splitting." Korolev needed a
  man who'd report problems honestly.
- The famous smile; front pages worldwide within days; "that face had to radiate light" → SEAM.
Music: analog arpeggio tech-pulse, quirky ironic woodwinds/pizz for the doctors, playful suspense for
1-2-5, determined march for selection, comic waltz/bassoon for the centrifuge, warm motif for the smile.

### P4 · 477.08–649.76 · "The Night Before" (states: night → dawn)
- APRIL 11, 1961 card; silence over Baikonur (stars, far-away rocket).
- **The letter to Valentina** (intimate character scene: desk lamp, photo of wife & two daughters,
  handwriting with `F.HAND` — only key phrases, synced): "not to let grief destroy you" · "life is life"
  · "take care of our girls" · "love them as I do" · "I loved you all very much". She received it only
  7 years later, after his death (1961→1968 time jump); in 1961 she never read it.
- Finnish-style cottage (dollhouse cutaway): Gagarin & Titov sleeping with sensors; Korolev awake
  all night — pacing, heart drops, endless cigarettes; Gagarin's perfect calm pulse.
- April 12: woken at 5:30, breakfast from tubes, orange suits — why orange (visible from the air in
  snow / taiga / desert: three aerial vignettes with a search reticle).
- Bus to the pad; the wheel tradition (light comedy, tasteful, from behind/at distance).
- At the base of the enormous R-7, LOX vapour; goodbyes; elevator to the top; the cramped capsule;
  hatch closes; **contact No. 32** fails — risk of depressurisation; Ivanovsky & workers unscrew
  **30 nuts** in silence broken by hissing valves; light comes on; airtight; minutes remain → SEAM.
Music: intimate piano + solo cello for the letter (the emotional heart), anxious clarinet/ticks for
Korolev, fresh dawn strings, a cheeky moment for the bus, awe (low brass/choir) at the rocket,
mechanical thriller ticking for contact 32, release when the light turns on.

### P5 · 649.76–817.94 · "Poyekhali!" (states: ascent → orbit) — PEAK
- In the capsule: headphones, love songs (filtered music on a radio bus).
- **09:07** Moscow time; launch command; 20 engines of first & second stages roar (nozzle-cluster
  infographic igniting in sequence); flame trench; the rocket rises "almost reluctantly" (3D hero).
- Korolev's commands as kinetic type, word-synced: IGNITION · PRELIMINARY · MAIN · LIFT OFF.
- Gagarin's voice: cheerful, clear, no panic → **LET'S GO! / ПОЕХАЛИ!** — the biggest type moment of the
  film, with the full heroic leitmotif.
- Ascent: vibration, g-forces (gauges; Gagarin's face pressed — `cheeksPull`), his reports as telemetry
  tags ("vibration increasing · g-forces rising · feeling excellent"); strap-on boosters separate (the
  "Korolev cross", 3D); fairing jettisoned → blinding sunlight through the window; core burns out, third
  stage ignites; last layers of atmosphere (altitude infographic) → engine cutoff → **ABSOLUTE SILENCE**.
- Weightless: body rises against the straps; IN ORBIT; mind clear; the writing pad floats.
- First human to see Earth from outside: curvature, deep black vs bright blue halo — "What a beautiful
  sight!" — oceans, clouds, a sleeping America → SEAM (night-side Earth).
Music: filtered 60s love-song pastiche → countdown riser → epic hybrid orchestra (taiko, brass, choir)
→ motif in full → driving percussion → hard stop to silence at cutoff → ethereal pad, glass bells, wonder.

### P6 · 817.94–972.42 · "One Orbit" (states: orbit → warning)
- One orbit, **108 minutes** — "an eternity" (orbit ellipse + clock).
- Water from a tube, space food, flight log; the pencil floats away behind the panel (small charming
  character beat).
- "A balancing act on the edge of disaster": third-stage cutoff late → apogee **62 miles** too high
  (planned vs actual orbit diagram). TDU retro-rocket failure fallback: drag brings him down in
  **5–7 days** = supplies; too high → **~20 days** → suffocation in an "orbital tomb" (timeline bars).
- **10:25** descent: TDU fires, valve shuts it **1 second** early (thrust timeline); then separation of
  descent sphere from instrument module (exploded diagram) — pyros fire, a thick cable bundle holds;
  unbalanced assembly enters dense atmosphere, **tumbling 30°/s** (3D tumbling; Gagarin in the
  "furious carousel"); glow builds outside the window → SEAM.
Music: continues ethereal (D) → playful celesta (pencil) → unease (detuned pads, pulse) → cold dread
for the orbital tomb → mechanical countdown at 10:25 → chaotic spinning thriller (phasing, toms).

### P7 · 972.42–1127.00 · "Fire and Earth" (states: reentry → spring) — PEAK
- 17,400 mph; searing plasma; thousands of degrees; ablative coating melting over the windows; smell of
  burning; streams of liquid metal (VFX: heat distortion, embers, plasma sheath).
- The MYTH "I'm burning up! Goodbye, comrades!" (styled as a retro rumour, then struck out) — reality:
  no panic, ice-calm, recording **10 G**; vision dims (tunnel vignette), chest crushed.
- The plasma burns through the cable; instrument module breaks away and burns; the sphere rights itself
  (offset centre of gravity — clear physics diagram) and hurtles down.
- **23,000 ft**: hatch blown, ejection (the plan: sphere landing too violent → eject & parachute).
- Cover-up for the **FAI** record (rule: pilot must land in his craft) — sly/ironic; truth admitted
  decades later.
- Seat separation, main chute; reserve opens by itself — two canopies, risk of tangling; suit breathing
  valve trapped under clothing — minutes of suffocation until he opens it.
- Landed: Saratov region, plowed field near **SMELOVKA** (map → field) → SEAM.
Music: inferno (taiko, distorted low brass, roar) → stylised old-radio sting for the myth → heartbeat
calm-in-chaos → release when the cable burns → wind & parachute lightness → sly muted trumpet for the
FAI → breathless tension (valve) → pastoral resolution.

### P8 · 1127.00–1306.00 · "One of You" (states: spring → triumph → coda) — FINALE
- Not generals, doctors or journalists — **ANNA TAKHTAROVA** and her granddaughter planting potatoes.
  Comic character scene: a man from the sky in an orange suit & white helmet; she backs away — American
  spy? alien? — "I'm one of you, comrades! I'm a Soviet citizen! I've come from space!"
- Next days changed history: **LEVITAN** on state radio; crowds pour into streets like Victory Day;
  strangers embrace, homemade signs (Cyrillic placards); against nuclear fear, Cuban crises, spy
  scandals — a glimpse of pure light; victory of humanity over gravity.
- Overnight: unknown senior lieutenant → most famous person on the planet; millions in Moscow; world
  tour **30+ countries** (map routes); the Queen broke etiquette for a photograph: "not a man of earth,
  but of the heavens".
- Fame as a burden: a fighter pilot who longed for the sky, guarded like a treasure, banned from combat
  flying, surrounded by officials — a living monument, a diplomatic weapon; years of struggle to fly
  again; "the sky that made him immortal ultimately took him": **MARCH 1968**, MiG-15UTI, only **34**.
- Finale: 108 minutes — a dividing line between past and future; humanity leaves its cradle; despite
  the brutality, the deadly risks, the burning rockets, the secret bunkers (fast callback montage of
  motifs from all parts) — humanity remembers not a weapon but an ordinary young man with an
  extraordinarily bright smile who looked into the abyss and simply said… **LET'S GO** (final title,
  hold to 1306.0, music resolves).
Music: folk-comic plucked strings (balalaika) → warm theme → festive march, bells, brass → elegant
waltz (Queen) → melancholy (burden) → elegy (1968: solo piano/cello, near-silence) → final full
orchestral statement of the motif → resolution and tail.

---

## 13. Audio seams & ownership (addendum)
- Schedule nothing before your part's `start` (the outgoing part owns the build-up into the seam).
- Your score must settle by `end + 1.5 s` (natural reverb/instrument tails may ring up to `end + 4 s`).
- The downbeat AT the seam belongs to the incoming part (impact, hit, first chord).
- Keep keys compatible at seams: P1 D-minor world · P2 D/G-minor · P3 → resolves D major · P4 D/G ·
  P5 → D major/lydian at the end · P6 starts D lydian · P7 → resolves G/D major pastoral · P8 D major finale.

## 14. Where things are
- Timed VO script: `docs/script_timed.txt` (also `assets/script.json` with word timings → `SCRIPT.find()`).
- Reference implementation of the scene contract: `src/parts/_example/example.js`.
- Character model sheet test page: `tools/modelsheet.html` (`node tools/pageshot.js "tools/modelsheet.html?mode=full" out.png`).
- Interactive preview (for humans): `npm run preview` → http://localhost:8080 (space = play, score toggle).
