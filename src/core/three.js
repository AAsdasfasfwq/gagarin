// ─────────────────────────────────────────────────────────────────────────────
// three.js — shared Three.js renderer for true-3D shots (≈15% of the film).
// One WebGL renderer is shared by all scenes (context limits!). A scene builds
// its THREE.Scene/camera in init(), then in render() calls
//   const img = R3.render(scene, camera)  → canvas to drawImage() into the layer.
// Rules: real materials (MeshStandard/Physical with roughness/metalness maps
// from canvas textures), real light rigs, never untextured white primitives.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, H, makeCanvas } from './draw.js';

export { THREE };

let _r = null, _env = null;
export const R3 = {
  get renderer() {
    if (!_r) {
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      _r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      _r.setPixelRatio(1);
      _r.setSize(W, H, false);
      _r.outputColorSpace = THREE.SRGBColorSpace;
      _r.toneMapping = THREE.ACESFilmicToneMapping;
      _r.toneMappingExposure = 1.0;
      _r.shadowMap.enabled = true;
      _r.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    return _r;
  },
  // studio environment map for believable metal/plastic reflections
  get env() {
    if (!_env) {
      const pm = new THREE.PMREMGenerator(this.renderer);
      _env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    }
    return _env;
  },
  // Render and return the renderer canvas (valid until next R3.render call —
  // drawImage it immediately). size: optional {w,h} for cheaper inserts.
  render(scene, camera, { w = W, h = H, exposure = 1.0, clear = null } = {}) {
    const r = this.renderer;
    if (r.domElement.width !== w || r.domElement.height !== h) r.setSize(w, h, false);
    r.toneMappingExposure = exposure;
    if (clear) { r.setClearColor(clear, 1); } else r.setClearColor(0x000000, 0);
    r.render(scene, camera);
    return r.domElement;
  },
};

// Canvas → texture helper (draw procedural textures with the 2D toolkit)
export function canvasTexture(drawFn, w = 1024, h = 1024, { srgb = true, repeat = null } = {}) {
  const { c, ctx } = makeCanvas(w, h);
  drawFn(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Classic three-point rig with warm key / cool fill / rim
export function lightRig(scene, { key = 0xfff1dc, fill = 0x8fb3d9, rim = 0xffc58a, keyI = 3.2, fillI = 0.8, rimI = 2.0, ambient = 0.18, shadows = true } = {}) {
  const k = new THREE.DirectionalLight(key, keyI);
  k.position.set(-5, 7, 6);
  if (shadows) {
    k.castShadow = true;
    k.shadow.mapSize.set(2048, 2048);
    k.shadow.camera.near = 0.5; k.shadow.camera.far = 60;
    const s = 12; Object.assign(k.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
    k.shadow.bias = -0.0004;
  }
  const f = new THREE.DirectionalLight(fill, fillI);
  f.position.set(6, 2, 4);
  const r = new THREE.DirectionalLight(rim, rimI);
  r.position.set(2, 4, -7);
  const a = new THREE.AmbientLight(0xffffff, ambient);
  scene.add(k, f, r, a);
  return { key: k, fill: f, rim: r, ambient: a };
}

// Lathe helper for rocket bodies, nozzles, capsules: profile = [[radius, y], ...]
export function lathe(profile, segments = 96) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}
