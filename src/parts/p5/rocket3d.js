// ─────────────────────────────────────────────────────────────────────────────
// p5/rocket3d.js — true-3D Vostok-K / R-7 for the liftoff & staging shots.
// Units: metres. Origin = centre of the core's nozzle-exit plane, +y up.
// Real materials (painted metal with panel lines, soot, dark nozzle bells).
// Boosters hang on tip pivots so they can swing out as the "Korolev cross".
// Nozzle markers (Object3D) give world positions for 2D flame VFX.
// ─────────────────────────────────────────────────────────────────────────────
import { THREE, R3, canvasTexture, lathe } from '../../core/three.js';
import { tex, fillTexture } from '../../core/draw.js';
import { rng } from '../../core/math.js';

const V2 = (r, y) => [r, y];

function paintTex(seed, { base = '#D6D6CF', bands = [], seams = 8, soot = 0.5, star = false } = {}) {
  return canvasTexture((c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    fillTexture(c, tex.metal(base, { seed, w: 512, h: 512, streak: 0.6 }), { w, h, alpha: 0.55, op: 'multiply' });
    fillTexture(c, tex.grit(1, { seed: seed + 3, alpha: 40 }), { w, h, alpha: 0.6, op: 'multiply' });
    // horizontal panel rings (v along profile: canvas y = (1-v)*h)
    c.strokeStyle = 'rgba(40,44,50,.38)'; c.lineWidth = 3;
    for (const v of bands) { c.beginPath(); c.moveTo(0, (1 - v) * h); c.lineTo(w, (1 - v) * h); c.stroke(); }
    // vertical seams
    c.strokeStyle = 'rgba(40,44,50,.22)'; c.lineWidth = 2;
    for (let i = 0; i < seams; i++) { const x = (i / seams) * w; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    // rivet rows
    c.fillStyle = 'rgba(40,44,50,.25)';
    for (const v of bands) for (let x = 0; x < w; x += 9) { c.beginPath(); c.arc(x, (1 - v) * h + 6, 1.2, 0, 6.3); c.fill(); }
    // soot near the base
    const g = c.createLinearGradient(0, h, 0, h * (1 - 0.25));
    g.addColorStop(0, `rgba(35,30,26,${soot})`); g.addColorStop(1, 'rgba(35,30,26,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // streaks of frost/vapour stains
    const r = rng(seed);
    c.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 26; i++) c.fillRect(r() * w, r() * h, 2 + r() * 6, 40 + r() * 160);
  }, 1024, 1024);
}

export function buildR7() {
  const root = new THREE.Group();
  const bodyMat = (seed, opts) => new THREE.MeshStandardMaterial({ map: paintTex(seed, opts), roughness: 0.55, metalness: 0.28, envMapIntensity: 0.7 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.42, metalness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  const throatMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.8, metalness: 0.4, side: THREE.DoubleSide });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6, metalness: 0.7 });
  const nozzles = [];
  const bellGeo = lathe([V2(0.16, 0), V2(0.2, -0.15), V2(0.3, -0.55), V2(0.43, -1.15)], 28);
  const smallBell = lathe([V2(0.07, 0), V2(0.1, -0.1), V2(0.17, -0.5)], 16);
  const addBell = (parent, x, z, small = false, group = 'core') => {
    const m = new THREE.Mesh(small ? smallBell : bellGeo, nozzleMat);
    m.position.set(x, 0, z);
    parent.add(m);
    const throat = new THREE.Mesh(new THREE.CircleGeometry(small ? 0.06 : 0.15, 12), throatMat);
    throat.rotation.x = Math.PI / 2; throat.position.set(x, -0.02, z); parent.add(throat);
    const mk = new THREE.Object3D(); mk.position.set(x, small ? -0.5 : -1.15, z); parent.add(mk);
    nozzles.push({ mk, small, group });
  };
  // ── core (Block A)
  const coreProf = [V2(0.001, 0.0), V2(1.2, 0.0), V2(1.32, 0.3), V2(1.48, 2), V2(1.48, 12.5), V2(1.12, 17.5), V2(1.05, 19.3), V2(1.32, 22), V2(1.48, 25.4), V2(1.48, 26.6), V2(1.25, 27.0), V2(0.001, 27.0)];
  const core = new THREE.Mesh(lathe(coreProf, 72), bodyMat(11, { bands: [0.08, 0.2, 0.33, 0.46, 0.62, 0.78, 0.92], seams: 12, soot: 0.65 }));
  root.add(core);
  [0, 1, 2, 3].forEach((i) => { const a = Math.PI / 4 + i * Math.PI / 2; addBell(root, Math.cos(a) * 0.62, Math.sin(a) * 0.62, false, 'core'); });
  [0, 1, 2, 3].forEach((i) => { const a = i * Math.PI / 2; addBell(root, Math.cos(a) * 1.18, Math.sin(a) * 1.18, true, 'core'); });
  // ── upper: truss + third stage (Block E) + fairing (two halves) + Vostok sphere
  const upper = new THREE.Group(); root.add(upper);
  const truss = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.2, 1.0, 24, 1, true), new THREE.MeshStandardMaterial({
    map: canvasTexture((c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 18; for (let i = -8; i < 16; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64 + 64, h); c.moveTo(i * 64 + 64, 0); c.lineTo(i * 64, h); c.stroke(); } c.fillRect(0, 0, w, 24); c.fillRect(0, h - 24, w, 24); }, 512, 128, { srgb: false }),
    color: 0x2b2f33, metalness: 0.7, roughness: 0.5, alphaTest: 0.5, side: THREE.DoubleSide,
  }));
  truss.material.alphaMap = truss.material.map; truss.material.map = null; truss.material.transparent = false;
  truss.position.y = 27.5; upper.add(truss);
  const third = new THREE.Group(); upper.add(third);
  const thirdMesh = new THREE.Mesh(lathe([V2(0.001, 28.0), V2(1.3, 28.0), V2(1.3, 31.0), V2(1.2, 31.15), V2(0.001, 31.15)], 64), bodyMat(13, { bands: [0.15, 0.5, 0.85], seams: 10, soot: 0.15 }));
  third.add(thirdMesh);
  const thirdNoz = new THREE.Group(); thirdNoz.position.y = 28.0; third.add(thirdNoz);
  addBell(thirdNoz, 0, 0, false, 'third');
  nozzles[nozzles.length - 1].mk.position.y = -1.15;
  const sphereMat = new THREE.MeshStandardMaterial({ map: canvasTexture((c, w, h) => { c.fillStyle = '#B8A88A'; c.fillRect(0, 0, w, h); fillTexture(c, tex.grit(0.8, { seed: 9, alpha: 90 }), { w, h, alpha: 0.8, op: 'multiply' }); c.fillStyle = '#20262E'; c.beginPath(); c.arc(w * 0.25, h * 0.45, 26, 0, 6.3); c.fill(); c.beginPath(); c.arc(w * 0.62, h * 0.58, 22, 0, 6.3); c.fill(); }, 512, 256), roughness: 0.75, metalness: 0.15 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 32), sphereMat);
  sphere.position.y = 32.6; third.add(sphere);
  const fairProf = [V2(1.33, 31.0), V2(1.33, 33.6), V2(1.2, 35.0), V2(0.86, 36.4), V2(0.42, 37.4), V2(0.08, 37.9), V2(0.001, 37.95)];
  const fairMat = bodyMat(17, { base: '#E0DFD8', bands: [0.42], seams: 2, soot: 0.0 });
  fairMat.side = THREE.DoubleSide;
  const fairL = new THREE.Group(), fairR = new THREE.Group();
  const halfGeo = (start) => new THREE.LatheGeometry(fairProf.map(([r, y]) => new THREE.Vector2(r, y)), 40, start, Math.PI);
  const fl = new THREE.Mesh(halfGeo(0), fairMat), fr = new THREE.Mesh(halfGeo(Math.PI), fairMat);
  // pivot the halves at their base edge so they can peel open
  fairL.position.set(0, 31.0, 0); fl.position.y = -31.0; fairL.add(fl);
  fairR.position.set(0, 31.0, 0); fr.position.y = -31.0; fairR.add(fr);
  third.add(fairL, fairR);
  // ── boosters (Blocks B, V, G, D) on tip pivots
  const bProf = [V2(0.001, 0), V2(1.2, 0), V2(1.34, 0.4), V2(1.3, 3), V2(0.98, 12.5), V2(0.62, 17.4), V2(0.36, 19.0), V2(0.08, 19.75), V2(0.001, 19.8)];
  const bGeo = lathe(bProf, 56);
  const boosters = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 1.42, 19.15, Math.sin(a) * 1.42);
    pivot.rotation.y = -a;
    const swing = new THREE.Group(); pivot.add(swing);
    swing.rotation.z = 0.072; // natural lean: tip in, base out
    const body = new THREE.Group(); body.position.y = -19.2; swing.add(body);
    body.add(new THREE.Mesh(bGeo, bodyMat(21 + i, { bands: [0.1, 0.3, 0.55, 0.78], seams: 8, soot: 0.7 })));
    // air rudder fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.9), darkMat);
    fin.position.set(1.42, 0.6, 0); body.add(fin);
    for (let k = 0; k < 4; k++) { const na = Math.PI / 4 + k * Math.PI / 2; addBell(body, Math.cos(na) * 0.58, Math.sin(na) * 0.58, false, 'booster' + i); }
    for (const sd of [-1, 1]) addBell(body, 0.95, sd * 0.75, true, 'booster' + i);
    root.add(pivot);
    boosters.push({ pivot, swing, body, a });
  }
  return { root, core, upper, third, sphere, fairL, fairR, boosters, nozzles };
}

// Launch pad: concrete apron with the pit, four "tulip" support arms.
export function buildPad() {
  const g = new THREE.Group();
  const conc = new THREE.MeshStandardMaterial({ map: canvasTexture((c, w, h) => { c.drawImage(tex.concrete('#A39E93', { w: 800, h: 500, seed: 23 }), 0, 0, w, h); c.strokeStyle = 'rgba(40,36,30,.35)'; c.lineWidth = 4; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(i * w / 8, 0); c.lineTo(i * w / 8, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 8); c.lineTo(w, i * h / 8); c.stroke(); } }, 1024, 1024, { repeat: [6, 6] }), roughness: 0.95, metalness: 0.0 });
  const shape = new THREE.Shape();
  shape.moveTo(-120, -120); shape.lineTo(120, -120); shape.lineTo(120, 120); shape.lineTo(-120, 120); shape.closePath();
  const hole = new THREE.Path(); hole.moveTo(-6, -7); hole.lineTo(6, -7); hole.lineTo(6, 14); hole.lineTo(-6, 14); hole.closePath();
  shape.holes.push(hole);
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(shape), conc);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.6;
  g.add(ground);
  // the steppe beyond (big warm plane)
  const steppe = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshStandardMaterial({ color: 0xa8957a, roughness: 1 }));
  steppe.rotation.x = -Math.PI / 2; steppe.position.y = -1.7; g.add(steppe);
  // tulip arms
  const lattice = canvasTexture((c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(5, 0, w - 10, h); for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 64); c.moveTo(w, y); c.lineTo(0, y + 64); c.stroke(); } }, 128, 1024, { srgb: false });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x3c4249, metalness: 0.6, roughness: 0.55, alphaMap: lattice, alphaTest: 0.5, side: THREE.DoubleSide });
  const arms = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 6.2, -1.6, Math.sin(a) * 6.2);
    pivot.rotation.y = -a;
    const tilt = new THREE.Group(); pivot.add(tilt);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 16.5, 0.9), armMat);
    arm.position.y = 8.25; tilt.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.7, roughness: 0.5 }));
    head.position.set(0, 16.4, 0); tilt.add(head);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.4), new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5, roughness: 0.6 }));
    counter.position.set(0, 0.5, 0); tilt.add(counter);
    tilt.rotation.z = 0.255; // lean in to the rocket's waist
    g.add(pivot);
    arms.push({ pivot, tilt });
  }
  return { group: g, arms };
}

export const v3 = () => new THREE.Vector3();
export function projectTo(cam, obj, out = new THREE.Vector3(), W = 1920, H = 1080) {
  obj.getWorldPosition(out);
  const p = out.clone().project(cam);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, z: p.z, dist: out.distanceTo(cam.position) };
}
export function projectPoint(cam, x, y, z, W = 1920, H = 1080) {
  const p = new THREE.Vector3(x, y, z).project(cam);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, z: p.z };
}
