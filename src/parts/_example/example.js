// ─────────────────────────────────────────────────────────────────────────────
// _example/example.js — REFERENCE IMPLEMENTATION of the scene contract.
// Not part of the film. Shows: 2.5D camera with parallax + DOF, signature
// components, a true-3D insert with real materials, a custom mask transition,
// word-synced type, deterministic particles, character usage, audio cues.
// Mount for testing by pointing a part's index.js at exampleScenes(start).
// ─────────────────────────────────────────────────────────────────────────────
import { E, tw, kf, clamp, handheld, rng, lerp } from '../../core/math.js';
import { C, rgba } from '../../core/palette.js';
import { F, text } from '../../core/type.js';
import { Cam25, paperBg, pooledBg, contactShadow, shadeSphere, glow, particles, smokePlume, tex, fillTexture, W, H } from '../../core/draw.js';
import { dateCard, nameTag, callout, bigNumber, leadKey, trajectory } from '../../core/components.js';
import { drawCharacter, idle } from '../../core/characters.js';
import { R3, THREE, canvasTexture, lightRig, lathe } from '../../core/three.js';
import { loadGeo, ortho, PLACES, greatCircle } from '../../core/geo.js';

export function exampleScenes(t0) {
  return [
    {
      id: 'ex-01-globe',
      start: t0, end: t0 + 6,
      async init(S) { S.state.geo = await loadGeo('110m'); },
      render(ctx, t, S) {
        pooledBg(ctx, C.ink, { light: 0.08 });
        const hh = handheld(t, 3);
        const G = S.state.geo;
        const proj = ortho({ cx: 960 + hh.x, cy: 560 + hh.y, r: 420 + t * 8, lon0: 30 + t * 4, lat0: 35 });
        // ocean disc with volume
        ctx.beginPath(); ctx.arc(960 + hh.x, 560 + hh.y, 420 + t * 8, 0, Math.PI * 2);
        shadeSphere(ctx, 960 + hh.x, 560 + hh.y, 420 + t * 8, '#1A2B44', { rim: C.halo, spec: 0.1 });
        G.draw(ctx, proj, { fill: '#2C4057', stroke: rgba(C.steelLight, 0.35), width: 1 });
        G.draw(ctx, proj, { rings: G.ussr, fill: rgba(C.red, 0.55) });
        G.draw(ctx, proj, { rings: G.usa, fill: rgba(C.steel, 0.5) });
        const arc = greatCircle(PLACES.baikonur, PLACES.washington, 80).map(([lo, la]) => { const p = proj(lo, la); return [p.x, p.y]; });
        trajectory(ctx, arc, tw(t, 1.5, 4.5, E.inOut), { color: C.cream, glowCol: C.red });
        leadKey(ctx, t - 0.6, 960, 190, { lead: 'it was an', key: 'ARMS RACE', size: 120 });
      },
    },
    {
      id: 'ex-02-depth',
      start: t0 + 6, end: t0 + 12,
      transition: { type: 'mask', dur: 0.9, mask(m, p) { m.beginPath(); m.arc(960, 540, p * 1200, 0, Math.PI * 2); m.fill(); } },
      render(ctx, t, S) {
        const cam = new Cam25({ x: kf(t, [[0, -120], [6, 120]]), y: 0, z: kf(t, [[0, -1000], [6, -760, E.cam]]), focus: 0, aperture: 1.4 });
        paperBg(ctx, C.paper);
        cam.plane(ctx, 900, (c) => { c.fillStyle = rgba(C.steel, 0.5); for (let i = -6; i < 7; i++) c.fillRect(i * 260, -200, 140, 600); });
        cam.plane(ctx, 0, (c) => {
          contactShadow(c, 0, 330, 520);
          drawCharacter(c, 'gagarin', { x: 0, y: 330, s: 46, yaw: kf(t, [[0, -0.3], [3, 0.25]]), crop: 'full', outfit: 'spacesuit', helmet: 0, expr: { smile: tw(t, 2, 3), teeth: tw(t, 2.5, 3), ...idle(t) }, armR: { a: 0.3, b: tw(t, 1, 1.6) * 2.4, hand: 'wave' } });
        });
        cam.plane(ctx, -500, (c) => { c.fillStyle = rgba(C.ink, 0.8); c.beginPath(); c.ellipse(-700, 420, 260, 120, 0, 0, Math.PI * 2); c.fill(); });
        nameTag(ctx, t - 1.2, 130, 900, { name: 'YURI GAGARIN', role: 'Senior Lieutenant, 27', color: C.ink });
      },
    },
    {
      id: 'ex-03-3d',
      start: t0 + 12, end: t0 + 18,
      transition: { type: 'whip', dur: 0.5, dir: [1, 0] },
      init(S) {
        const scene = new THREE.Scene();
        scene.environment = R3.env;
        const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
        lightRig(scene, { shadows: false });
        const metal = new THREE.MeshStandardMaterial({ color: 0xb9c2c6, metalness: 0.75, roughness: 0.38, map: canvasTexture((c, w, h) => { c.fillStyle = '#bbb'; c.fillRect(0, 0, w, h); fillTexture(c, tex.metal('#C3D0D6'), { w, h }); }, 512, 512) });
        const body = new THREE.Mesh(lathe([[0, -3], [0.55, -2.9], [0.6, 1.5], [0.35, 2.8], [0, 3.4]]), metal);
        scene.add(body);
        Object.assign(S.state, { scene, cam, body });
      },
      render(ctx, t, S) {
        const { scene, cam, body } = S.state;
        pooledBg(ctx, C.blueprint);
        cam.position.set(Math.sin(t * 0.3) * 9, 1 + t * 0.2, Math.cos(t * 0.3) * 9);
        cam.lookAt(0, 0.4, 0);
        body.rotation.y = t * 0.2;
        ctx.drawImage(R3.render(scene, cam), 0, 0);
        callout(ctx, t - 1, 1010, 380, 1300, 260, 'PAYLOAD', { sub: 'several tons' });
        bigNumber(ctx, t - 2.5, 520, 640, { value: 108, from: 0, dur: 1, unit: 'MINUTES', size: 200 });
        particles(ctx, t, { count: 60, seed: 3, emit: { x: 960, y: 900, w: 300, h: 10 }, vy: [-140, -60], size: [1, 2.5], color: C.fire4 });
      },
    },
  ];
}

export const exampleAudio = (t0) => (A) => {
  A.chordOn('pad', t0, A.chord('D', 'min9', 3), 6, { vel: 0.35, colour: 'cold' });
  A.timpani(t0 + 1.5, 'D2', { vel: 0.4 });
  A.whoosh(t0 + 5.6, { vel: 0.2 });
  A.motif(t0 + 6, { inst: 'celesta', bpm: 96, vel: 0.35 });
  A.riser(t0 + 10, 2, { vel: 0.2 });
  A.impact(t0 + 12, { vel: 0.3 });
};
