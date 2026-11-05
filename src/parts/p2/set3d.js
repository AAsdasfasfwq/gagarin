// ─────────────────────────────────────────────────────────────────────────────
// p2/set3d.js — Launch Site 41 in true 3D (metres). The R-16 (20 m = "66-foot")
// on its pad, a lattice service tower with work decks, floodlight masts, crew
// billboards, distant cosmodrome lights. `burned:true` builds the aftermath
// (soot materials, bent members, the rocket gone, debris, scorch).
// Built once per scene in init(); render with R3.render(set.scene, set.cam).
// ─────────────────────────────────────────────────────────────────────────────
import { R3, THREE, canvasTexture, lathe } from '../../core/three.js';
import { tex, fillTexture, W, H, makeCanvas } from '../../core/draw.js';
import { C, rgba, shade, mixColor } from '../../core/palette.js';
import { rng, clamp, TAU } from '../../core/math.js';
import { BODY, drawCrew } from './lib.js';

export const RH = 20; // rocket height (m)
export const TOWER = { x: -4.2, z: 0.0, w: 3.6, h: 23 };
export const DECKS = [4.2, 8.4, 12.6, 16.4];

function bodyTexture(burned) {
  return canvasTexture((c, w, h) => {
    const base = burned ? C.soot : '#7E877C';
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    fillTexture(c, tex.metal(base, { w: 256, h: 256, seed: 7 }), { w, h, alpha: 0.9 });
    c.strokeStyle = rgba(shade(base, -0.5), 0.8); c.lineWidth = 3;
    for (let i = 1; i < 16; i++) { const y = (i / 16) * h; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = rgba(shade(base, -0.4), 0.5); c.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const x = (i / 8) * w; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    if (burned) { const r = rng(4); for (let i = 0; i < 120; i++) { c.fillStyle = rgba(C.inkDeep, 0.3); c.beginPath(); c.arc(r() * w, r() * h, 8 + r() * 40, 0, TAU); c.fill(); } }
  }, 512, 1024, { repeat: [1, 1] });
}
function concreteTexture(burned) {
  return canvasTexture((c, w, h) => {
    c.drawImage(tex.concrete(burned ? '#57534C' : '#8E8A80', { w: 512, h: 512, seed: 11 }), 0, 0, w, h);
    c.strokeStyle = rgba('#3A3833', 0.6); c.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo((i / 4) * w, 0); c.lineTo((i / 4) * w, h); c.moveTo(0, (i / 4) * h); c.lineTo(w, (i / 4) * h); c.stroke(); }
  }, 512, 512, { repeat: [24, 24] });
}
function scorchTexture() {
  return canvasTexture((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(14,12,11,0.98)'); g.addColorStop(0.45, 'rgba(22,19,17,0.9)'); g.addColorStop(0.8, 'rgba(30,26,23,0.45)'); g.addColorStop(1, 'rgba(30,26,23,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const r = rng(8);
    for (let i = 0; i < 260; i++) { const a = r() * TAU, d = Math.pow(r(), 0.6) * w * 0.5; c.fillStyle = `rgba(10,9,8,${0.15 + r() * 0.3})`; c.beginPath(); c.ellipse(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 4 + r() * 22, 2 + r() * 6, a, 0, TAU); c.fill(); }
  }, 512, 512, { srgb: true });
}
function glowTexture(col = '#FFD9A0') {
  return canvasTexture((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.2, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 128, 128);
}
function lampBankTexture() {
  return canvasTexture((c, w, h) => {
    c.fillStyle = '#2A2622'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const x = 12 + i * 60, y = 12 + j * 40;
      const g = c.createRadialGradient(x + 24, y + 16, 2, x + 24, y + 16, 26);
      g.addColorStop(0, '#FFF6E0'); g.addColorStop(0.5, '#FFC77A'); g.addColorStop(1, '#8A5A20');
      c.fillStyle = g; c.fillRect(x, y, 48, 32);
    }
  }, 256, 128);
}
// crew billboard texture
function crewTexture(i, pose) {
  const cw = 160, ch = 320;
  const { c, ctx } = makeCanvas(cw, ch);
  drawCrew(ctx, i, { x: cw / 2, y: ch - 8, s: 22, crop: 'full', ...pose });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSet({ burned = false, crewCount = 14, lamps = true } = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(burned ? 0x55524c : 0x1a2034, burned ? 0.010 : 0.013);
  const cam = new THREE.PerspectiveCamera(38, W / H, 0.2, 900);
  const R = rng(41);
  const metalDark = new THREE.MeshStandardMaterial({ color: burned ? 0x1d1a18 : 0x2b323a, roughness: burned ? 0.95 : 0.6, metalness: burned ? 0.2 : 0.5 });
  const metalRust = new THREE.MeshStandardMaterial({ color: burned ? 0x2a2420 : 0x2e2a2c, roughness: 0.7, metalness: 0.45 });
  const deckMat = new THREE.MeshStandardMaterial({ color: burned ? 0x1f1c19 : 0x3c454e, roughness: 0.8, metalness: 0.35 });

  // ground
  const groundTex = concreteTexture(burned);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0, color: burned ? 0x8a857c : 0x8a867e }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // pad slab + flame trench
  const slab = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 26), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9, color: burned ? 0x6c675f : 0xa29c90 }));
  slab.position.set(0, 0.3, 0); slab.receiveShadow = true; scene.add(slab);
  const trench = new THREE.Mesh(new THREE.BoxGeometry(5, 0.62, 18), new THREE.MeshStandardMaterial({ color: 0x0e0d0c, roughness: 1 }));
  trench.position.set(0, 0.31, 6); scene.add(trench);
  // launch table ring
  const table = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.22, 10, 40), metalDark);
  table.rotation.x = Math.PI / 2; table.position.set(0, 0.95, 0); table.castShadow = true; scene.add(table);
  for (let i = 0; i < 4; i++) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.35), metalDark); const a = i * Math.PI / 2 + Math.PI / 4; leg.position.set(Math.cos(a) * 1.5, 0.6, Math.sin(a) * 1.5); scene.add(leg); }

  // rocket
  const rocket = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ map: bodyTexture(burned), roughness: 0.5, metalness: 0.3, envMapIntensity: 0.2 });
  const noseMat = new THREE.MeshStandardMaterial({ color: burned ? 0x151311 : 0x46555f, roughness: 0.45, metalness: 0.35 });
  const s1 = new THREE.Mesh(lathe([[0, 0.9], [0.98, 0.9], [1.0, 1.1], [1.0, 11.1], [0, 11.1]], 64), bodyMat);
  const s2 = new THREE.Mesh(lathe([[0, 12.1], [1.0, 12.1], [1.0, 16.6], [0, 16.6]], 64), bodyMat);
  const noseProfile = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16; noseProfile.push([0.96 * Math.pow(1 - u, 0.55) + 0.08 * u, 16.6 + u * 3.4]); }
  noseProfile.push([0, 20]);
  const nose = new THREE.Mesh(lathe(noseProfile, 64), noseMat);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.012, 1.012, 0.12, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0xb8302a, roughness: 0.6 }));
  band.position.y = 16.55;
  rocket.add(s1, s2, nose, band);
  // open truss
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU;
    const p0 = new THREE.Vector3(Math.cos(a0) * 0.95, 11.1, Math.sin(a0) * 0.95), p1 = new THREE.Vector3(Math.cos(a1) * 0.95, 12.1, Math.sin(a1) * 0.95);
    const len = p0.distanceTo(p1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 6), metalDark);
    m.position.copy(p0).add(p1).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    rocket.add(m);
  }
  for (let i = -1; i <= 1; i += 2) { const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.8, 16, 1, true), metalDark); nz.position.set(i * 0.4, 11.55, 0); rocket.add(nz); }
  // cable raceway (faces the camera side +x+z)
  const race = new THREE.Mesh(new THREE.BoxGeometry(0.16, 15.5, 0.14), new THREE.MeshStandardMaterial({ color: burned ? 0x1a1816 : 0x8f9a8c, roughness: 0.6, metalness: 0.3 }));
  race.position.set(Math.cos(0.75) * 1.03, 9.1, Math.sin(0.75) * 1.03); race.rotation.y = -0.75;
  rocket.add(race);
  rocket.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  if (!burned) scene.add(rocket);

  // service tower (lattice) — instanced members
  const members = [];
  const T = TOWER, hw = T.w / 2;
  const corners = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
  const bay = 2.3, nb = Math.ceil(T.h / bay);
  const add = (a, b, th = 0.13) => members.push([a, b, th]);
  const bend = (y) => (burned && y > 9 ? Math.pow((y - 9) / 14, 2) * 3.2 : 0);
  const P = (cx, y, cz) => new THREE.Vector3(T.x + cx + bend(y), y, T.z + cz + bend(y) * 0.4);
  for (let k = 0; k < nb; k++) {
    const y0 = k * bay + 0.6, y1 = Math.min(T.h, (k + 1) * bay + 0.6);
    if (burned && y0 > 18) break;
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      add(P(ax, y0, az), P(ax, y1, az), 0.22);
      add(P(ax, y1, az), P(bx, y1, bz));
      if (!(burned && R() < 0.35)) add(P(ax, y0, az), P(bx, y1, bz), 0.09);
      if (!(burned && R() < 0.35)) add(P(bx, y0, bz), P(ax, y1, az), 0.07);
      add(P((ax + bx) / 2, y0, (az + bz) / 2), P((ax + bx) / 2, y1, (az + bz) / 2), 0.06);
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(box, burned ? metalDark : metalRust, members.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  members.forEach(([a, b, th], i) => {
    const d = b.clone().sub(a), len = d.length();
    q.setFromUnitVectors(up, d.normalize());
    m4.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(th, len, th));
    inst.setMatrixAt(i, m4);
  });
  inst.castShadow = true; inst.receiveShadow = true;
  scene.add(inst);

  // work decks wrapping the rocket (C-shaped) + arms to the tower
  const decks = [], workLamps = [];
  const deckGlow = glowTexture('#FFE2B0');
  DECKS.forEach((y, i) => {
    if (burned && i > 1) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.9, 40, 1, Math.PI * 0.45, Math.PI * 1.1), deckMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, y, 0);
    ring.material.side = THREE.DoubleSide;
    const slabD = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 3.0), deckMat);
    slabD.position.set(-2.4 + bend(y) * 0.5, y - 0.07, 0);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.035, 6, 40, Math.PI * 1.1), metalDark);
    rail.rotation.x = -Math.PI / 2; rail.rotation.z = Math.PI * 0.45; rail.position.set(0, y + 1.0, 0);
    [ring, slabD, rail].forEach((m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
    decks.push(y);
    if (!burned) for (let k = 0; k < 3; k++) {
      const a = Math.PI * (0.55 + k * 0.42);
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: deckGlow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
      lamp.scale.set(1.6, 1.6, 1); lamp.position.set(Math.cos(a) * 2.85, y + 1.05, Math.sin(a) * 2.85); scene.add(lamp); workLamps.push(lamp);
    }
  });

  // floodlight masts
  const lampTex = lampBankTexture(), glowTex = glowTexture('#FFD08A');
  const floods = [[26, 0, 20], [-22, 0, 26], [18, 0, -26]];
  const glows = [];
  floods.forEach(([x, , z], i) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 28, 8), metalDark);
    mast.position.set(x, 14, z); scene.add(mast);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.4), new THREE.MeshBasicMaterial({ map: lampTex, color: burned ? 0x333333 : 0xffffff }));
    bank.position.set(x, 28.5, z); bank.lookAt(0, 8, 0); scene.add(bank);
    if (!burned) {
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd08a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
      g.scale.set(14, 14, 1); g.position.set(x, 28.5, z); scene.add(g); glows.push(g);
    }
  });
  // distant cosmodrome lights
  const farGlow = glowTexture('#FFC77A');
  for (let i = 0; i < 40; i++) {
    const a = R() * TAU, d = 120 + R() * 260;
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: farGlow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: burned ? 0 : 0.5 + R() * 0.5 }));
    const s = 2 + R() * 4; g.scale.set(s, s, 1); g.position.set(Math.cos(a) * d, 1 + R() * 6, Math.sin(a) * d); scene.add(g);
  }

  // lights
  const hemi = new THREE.HemisphereLight(burned ? 0x9a948a : 0x2c3c66, burned ? 0x2a2622 : 0x16110d, burned ? 1.2 : 0.3);
  scene.add(hemi);
  const key = new THREE.SpotLight(burned ? 0xd8d2c8 : 0xffa850, burned ? 1.6 : 3.2, 0, 0.36, 0.75, 0);
  key.position.set(burned ? 26 : 34, 26, burned ? 20 : -4); key.target.position.set(0, 9, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.camera.near = 10; key.shadow.camera.far = 90;
  scene.add(key, key.target);
  const fill = new THREE.SpotLight(burned ? 0x8090a0 : 0x9fb4d8, burned ? 0.4 : 0.6, 0, 0.5, 0.8, 0);
  fill.position.set(-14, 20, 34); fill.target.position.set(0, 8, 0); scene.add(fill, fill.target);
  const rimL = new THREE.SpotLight(0x7fa6ff, burned ? 0.2 : 2.0, 0, 0.5, 0.8, 0);
  rimL.position.set(-20, 26, -24); rimL.target.position.set(0, 10, 0); scene.add(rimL, rimL.target);

  // crew billboards on decks
  const crewSprites = [];
  if (!burned) {
    const poses = [
      { armR: { a: 0.9, b: 1.5, hand: 'hold' }, armL: { a: 0.2, b: 0.3 } },
      { armR: { a: 1.3, b: 0.3, hand: 'point' }, armL: { a: 0.15, b: 0.2 }, yaw: 0.3 },
      { armR: { a: 0.3, b: 1.8, hand: 'hold' }, armL: { a: 0.5, b: 1.6, hand: 'hold' }, yaw: -0.3 },
      { armR: { a: 0.15, b: 0.1 }, armL: { a: 0.6, b: 2.0, hand: 'relaxed' }, yaw: 0.5 },
    ];
    for (let i = 0; i < crewCount; i++) {
      const lvl = i % DECKS.length;
      const map = crewTexture(i, { ...poses[i % 4], expr: { smile: 0.1, lookX: (i % 3) - 1 } });
      const mat = new THREE.SpriteMaterial({ map, color: 0x7a6c62, transparent: true, depthWrite: true, alphaTest: 0.3 });
      const sp = new THREE.Sprite(mat);
      sp.center.set(0.5, 0.025);
      sp.scale.set(0.9, 1.8, 1);
      const a = Math.PI * (0.5 + ((Math.floor(i / DECKS.length) * 0.37 + lvl * 0.21) % 1) * 1.0);
      const rr = 1.75 + (i % 2) * 0.7;
      sp.position.set(Math.cos(a) * rr, DECKS[lvl], Math.sin(a) * rr);
      scene.add(sp);
      crewSprites.push({ sp, lvl, a, rr, i });
    }
  }
  // debris (burned)
  if (burned) {
    for (let i = 0; i < 46; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.2 + R() * 1.6, 0.08 + R() * 0.3, 0.2 + R() * 0.9), R() < 0.5 ? metalDark : metalRust);
      const a = R() * TAU, d = 2 + Math.pow(R(), 0.7) * 20;
      g.position.set(Math.cos(a) * d, 0.65 + R() * 0.2, Math.sin(a) * d); g.rotation.set(R() * 0.6, R() * TAU, R() * 0.6);
      g.castShadow = true; scene.add(g);
    }
    // the torn stump of stage 1
    const stump = new THREE.Mesh(lathe([[0, 0.9], [1.0, 0.9], [1.0, 2.6], [0.7, 3.4], [0.0, 3.1]], 24), new THREE.MeshStandardMaterial({ color: 0x1a1715, roughness: 1, metalness: 0.2 }));
    stump.rotation.z = 0.12; stump.castShadow = true; scene.add(stump);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: scorchTexture(), transparent: true, depthWrite: false }));
    sc.rotation.x = -Math.PI / 2; sc.position.y = 0.62; scene.add(sc);
  }
  if (burned) scene.environment = R3.env;
  return { scene, cam, rocket, crewSprites, decks, key, fill, glows, hemi, workLamps };
}

// project a world point to screen px
const _v = new THREE.Vector3();
export function toScreen(cam, x, y, z) {
  _v.set(x, y, z).project(cam);
  return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H, z: _v.z };
}
export function aim(cam, [px, py, pz], [tx, ty, tz], fov = null) {
  cam.position.set(px, py, pz);
  cam.lookAt(tx, ty, tz);
  if (fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
}
