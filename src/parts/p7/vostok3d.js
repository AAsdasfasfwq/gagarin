// ─────────────────────────────────────────────────────────────────────────────
// p7/vostok3d.js — true-3D Vostok re-entry assembly: ablative descent sphere,
// biconical instrument module (gas-bottle ring, louvres, TDU nozzle) and the
// "ill-fated" cable bundle that holds them together. Built once per scene in
// init(); rendered at reduced size and composited with 2D plasma VFX.
// ─────────────────────────────────────────────────────────────────────────────
import { R3, THREE, canvasTexture, lathe } from '../../core/three.js';
import { makeNoise, rng, clamp } from '../../core/math.js';

const RS = 1.15; // descent sphere radius (2.3 m)

// charred ablative skin texture (equirect) — hatch rings, portholes, seams, soot streaks
function sphereTex(charred) {
  return canvasTexture((c, w, h) => {
    const nz = makeNoise(77);
    const img = c.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const n = nz.fbm2(u * 18, v * 9, 5) * 0.5 + 0.5;
      const s = nz.fbm2(u * 3 + 4, v * 40, 3) * 0.5 + 0.5; // flow streaks (run along v)
      const pit = nz.n2(u * 260, v * 130) > 0.72 ? -0.18 : 0;
      let k = 0.55 + n * 0.35 + (s - 0.5) * 0.25 + pit;
      const i = (y * w + x) * 4;
      if (charred) { d[i] = 46 * k + 14; d[i + 1] = 34 * k + 10; d[i + 2] = 28 * k + 9; }
      else { d[i] = 120 * k + 30; d[i + 1] = 104 * k + 26; d[i + 2] = 86 * k + 22; }
      d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // panel seams
    c.strokeStyle = 'rgba(12,8,6,.28)'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo((i / 4 + 0.06) * w, h * 0.08); c.lineTo((i / 4 + 0.06) * w, h * 0.92); c.stroke(); }
    for (let j = 1; j < 3; j++) { c.beginPath(); c.moveTo(0, (j / 3) * h); c.lineTo(w, (j / 3) * h); c.stroke(); }
    // ejection hatch (big ring) + parachute hatch + portholes
    const ring = (cx, cy, rx, ry, lw, col) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.stroke(); };
    ring(w * 0.25, h * 0.42, w * 0.07, w * 0.07, 6, 'rgba(10,6,4,.8)');
    ring(w * 0.25, h * 0.42, w * 0.075, w * 0.075, 2, 'rgba(160,140,120,.25)');
    ring(w * 0.72, h * 0.3, w * 0.05, w * 0.05, 5, 'rgba(10,6,4,.75)');
    // porthole glass (dark, slightly blue) — two windows
    [[0.47, 0.5, 0.028], [0.06, 0.62, 0.024]].forEach(([px, py, pr]) => {
      const g = c.createRadialGradient(px * w - 4, py * h - 4, 2, px * w, py * h, pr * w);
      g.addColorStop(0, '#5a6f82'); g.addColorStop(0.6, '#1d2733'); g.addColorStop(1, '#0d1218');
      c.fillStyle = g; c.beginPath(); c.ellipse(px * w, py * h, pr * w, pr * w, 0, 0, Math.PI * 2); c.fill();
      ring(px * w, py * h, pr * w * 1.18, pr * w * 1.18, 6, 'rgba(84,74,64,.95)');
      ring(px * w, py * h, pr * w * 1.32, pr * w * 1.32, 2, 'rgba(20,14,10,.9)');
    });
    // soot streaks (flow direction)
    const r = rng(9);
    for (let i = 0; i < 90; i++) {
      const x = r() * w, y = r() * h, L = 30 + r() * 140;
      const g = c.createLinearGradient(x, y, x, y + L);
      g.addColorStop(0, `rgba(10,6,4,${0.25 + r() * 0.3})`); g.addColorStop(1, 'rgba(10,6,4,0)');
      c.fillStyle = g; c.fillRect(x, y, 2 + r() * 6, L);
    }
  }, 1024, 512);
}

function moduleTex() {
  return canvasTexture((c, w, h) => {
    const nz = makeNoise(31);
    const img = c.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = nz.fbm2(x / 60, y / 30, 4) * 0.5 + 0.5;
      const k = 0.7 + n * 0.3;
      const i = (y * w + x) * 4;
      d[i] = 150 * k; d[i + 1] = 154 * k; d[i + 2] = 150 * k; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // thermal louvres (radiator shutters) band
    c.fillStyle = 'rgba(30,32,34,.85)';
    for (let i = 0; i < 48; i++) c.fillRect((i / 48) * w + 2, h * 0.52, w / 48 - 5, h * 0.18);
    c.fillStyle = 'rgba(220,220,214,.25)';
    for (let i = 0; i < 48; i++) c.fillRect((i / 48) * w + 2, h * 0.52, 2, h * 0.18);
    // rivet rows & scorch
    c.fillStyle = 'rgba(40,36,32,.6)';
    for (let j = 0; j < 4; j++) for (let i = 0; i < 96; i++) c.fillRect((i / 96) * w, h * (0.15 + j * 0.22), 2, 2);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(30,18,10,.55)'); g.addColorStop(0.4, 'rgba(30,18,10,0)'); g.addColorStop(1, 'rgba(30,18,10,.35)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 1024, 256);
}

export function buildVostok({ charred = true, w = 1280, h = 720 } = {}) {
  const scene = new THREE.Scene();
  scene.environment = R3.env;
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const group = new THREE.Group();
  scene.add(group);

  // descent sphere
  const sTex = sphereTex(charred);
  const sMat = new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.88, metalness: 0.05, emissive: new THREE.Color(0xff5a1c), emissiveIntensity: 0 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(RS, 96, 64), sMat);
  sphere.rotation.z = 0.2;
  group.add(sphere);
  // instrument module (biconical) hanging below on the cable
  const mod = new THREE.Group();
  const mTex = moduleTex();
  const mMat = new THREE.MeshStandardMaterial({ map: mTex, metalness: 0.55, roughness: 0.45, emissive: new THREE.Color(0xff4a10), emissiveIntensity: 0 });
  const prof = [[0.0, 0.0], [0.62, 0.0], [0.7, -0.08], [1.22, -0.95], [1.22, -1.08], [0.85, -1.85], [0.42, -2.2], [0.0, -2.22]];
  const body = new THREE.Mesh(lathe(prof, 72), mMat);
  mod.add(body);
  // ring of gas bottles
  const bMat = new THREE.MeshStandardMaterial({ color: 0x4a5246, metalness: 0.4, roughness: 0.62 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), bMat);
    b.position.set(Math.cos(a) * 0.86, -0.42, Math.sin(a) * 0.86);
    mod.add(b);
  }
  // TDU nozzle
  const nMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.7, roughness: 0.4 });
  const noz = new THREE.Mesh(lathe([[0.1, 0], [0.16, -0.1], [0.32, -0.42], [0.3, -0.44]], 32), nMat);
  noz.position.y = -2.2;
  mod.add(noz);
  const gap = 0.55;
  mod.position.set(0, -RS - gap, 0);
  group.add(mod);

  // cable bundle (umbilical) from sphere underside to module top — slight sag
  const cablePts = [
    new THREE.Vector3(0.18, -RS * 0.98, 0.1), new THREE.Vector3(0.3, -RS - gap * 0.35, 0.18),
    new THREE.Vector3(0.28, -RS - gap * 0.7, 0.15), new THREE.Vector3(0.24, -RS - gap - 0.02, 0.1),
  ];
  const cGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 24, 0.045, 10, false);
  const cMat = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.6, metalness: 0.3, emissive: new THREE.Color(0xff6a20), emissiveIntensity: 0 });
  const cable = new THREE.Mesh(cGeo, cMat);
  group.add(cable);

  // lights: plasma key (hot, from the leading face), cool space fill, warm rim
  const plasma = new THREE.PointLight(0xff7a30, 60, 30, 1.6);
  scene.add(plasma);
  const fill = new THREE.DirectionalLight(0x6f8fc0, 0.5); fill.position.set(-4, 3, 5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc690, 1.4); rim.position.set(3, 5, -6); scene.add(rim);
  const amb = new THREE.AmbientLight(0xffffff, 0.08); scene.add(amb);

  return { scene, camera, group, sphere, mod, cable, plasma, fill, rim, amb, sMat, mMat, cMat, w, h, RS, gap };
}

// project a world point to 1920×1080 screen coords
export function project3(V, v3) {
  const p = v3.clone().project(V.camera);
  return { x: (p.x * 0.5 + 0.5) * 1920, y: (-p.y * 0.5 + 0.5) * 1080, z: p.z };
}

export function renderVostok(V, { exposure = 1.0 } = {}) {
  V.camera.aspect = V.w / V.h;
  V.camera.updateProjectionMatrix();
  return R3.render(V.scene, V.camera, { w: V.w, h: V.h, exposure });
}

export { RS };
export const clampA = clamp;
