// S01 · 305.72–315.18 · "Vostok 1 … far removed from our modern image of comfortable space shuttles."
// True 3D Vostok 1 on a blueprint sheet. Seam: P2's soot circle crossfades into the dark ablative
// sphere centred at (960,540) r≈300; the camera then pulls back to reveal the whole craft. A ghost
// ink drawing of a winged shuttle (the "modern image") assembles and then blows away.
import { E, kf, clamp, lerp, rng, noise, TAU } from '../../../core/math.js';
import { C, rgba } from '../../../core/palette.js';
import { F, setText, staggerText, maskRise } from '../../../core/type.js';
import { glow, inkLine, tex, fillTexture } from '../../../core/draw.js';
import { R3, THREE, canvasTexture, lathe } from '../../../core/three.js';
import { blueprintBg, at, env, W, H } from '../lib.js';

const T0 = 305.72;

function buildVostok() {
  const g = new THREE.Group();
  // ablative skin texture (equirect)
  const ablMap = canvasTexture((c, w, h) => {
    const img = c.createImageData(w, h); const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const n = noise.fbm2(u * 18, v * 9, 5) * 0.5 + 0.5;
      const m = noise.n2(u * 160, v * 80) * 0.5 + 0.5;
      const streak = noise.fbm2(u * 4 + 2, v * 40, 3) * 0.5 + 0.5;
      const k = 0.5 + n * 0.42 + (m - 0.5) * 0.12 + (streak - 0.5) * 0.1;
      const i = (y * w + x) * 4;
      d[i] = 86 * k + 8; d[i + 1] = 79 * k + 6; d[i + 2] = 74 * k + 5; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // panel seams (latitude & meridians)
    c.strokeStyle = 'rgba(20,16,14,.55)'; c.lineWidth = 2;
    c.strokeStyle = 'rgba(20,16,14,.32)';
    for (const v of [0.22, 0.5, 0.78]) { c.beginPath(); c.moveTo(0, v * h); c.lineTo(w, v * h); c.stroke(); }
    for (let k = 0; k < 6; k++) { const x = (k / 6) * w + 40; c.beginPath(); c.moveTo(x, 0.22 * h); c.lineTo(x, 0.78 * h); c.stroke(); }
    c.strokeStyle = 'rgba(190,180,165,.18)'; c.lineWidth = 1;
    for (const v of [0.18, 0.32, 0.5, 0.68, 0.82]) { c.beginPath(); c.moveTo(0, v * h + 2); c.lineTo(w, v * h + 2); c.stroke(); }
  }, 1024, 512);
  const roughMap = canvasTexture((c, w, h) => {
    const img = c.createImageData(w, h); const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = noise.fbm2(x / 40, y / 40, 4) * 0.5 + 0.5;
      const i = (y * w + x) * 4; const v = 150 + n * 100;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, 256, 256, { srgb: false });
  const skin = new THREE.MeshStandardMaterial({ map: ablMap, roughnessMap: roughMap, bumpMap: roughMap, bumpScale: 0.6, roughness: 0.92, metalness: 0.08 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.15, 96, 64), skin);
  g.add(sphere);
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3a7, metalness: 0.85, roughness: 0.36, envMapIntensity: 0.8 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x5b6266, metalness: 0.7, roughness: 0.45 });
  const warm = new THREE.MeshBasicMaterial({ color: 0x0b1620 });
  // straps: 4 bands over the sphere
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x8c9498, metalness: 0.8, roughness: 0.42, envMapIntensity: 0.7 });
  for (let k = 0; k < 2; k++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.168, 0.018, 8, 140, 4.4), strapMat);
    band.rotation.order = 'YXZ';
    band.rotation.set(0, Math.PI / 4 + k * (Math.PI / 2), -0.63);
    g.add(band);
  }
  const clasp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 32), steel);
  clasp.position.set(0, 1.17, 0); g.add(clasp);
  // portholes / hatch placed by spherical coords
  const onSphere = (lon, lat, rr = 1.15) => new THREE.Vector3(Math.cos(lat) * Math.sin(lon) * rr, Math.sin(lat) * rr, Math.cos(lat) * Math.cos(lon) * rr);
  const place = (mesh, lon, lat, rr = 1.15) => {
    const p = onSphere(lon, lat, rr);
    mesh.position.copy(p);
    mesh.lookAt(p.clone().multiplyScalar(2));
    g.add(mesh);
    return mesh;
  };
  const port = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 16, 48), steel);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), warm); inner.position.z = 0.004;
  port.add(ring, inner);
  place(port, 0.35, 0.28, 1.16);
  const port2 = port.clone(); place(port2, -1.9, -0.25, 1.16);
  const hatch = new THREE.Group();
  hatch.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 16, 64), steel));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.04, 64), darkSteel); cap.rotation.x = Math.PI / 2; hatch.add(cap);
  for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), steel); const a = (i / 16) * TAU; b.position.set(Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0.03); hatch.add(b); }
  place(hatch, -0.75, 0.05, 1.15);
  // whip antennas
  const ant = new THREE.MeshStandardMaterial({ color: 0xd8dde0, metalness: 0.9, roughness: 0.25 });
  [[0.35, 0.25], [-0.35, -0.2]].forEach(([tx, tz]) => {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.014, 1.7, 8), ant);
    a.position.set(tx * 1.9, 1.05 + 0.72, tz * 1.9);
    a.rotation.set(tz * 1.5, 0, -tx * 1.5);
    g.add(a);
  });
  // joint ring + gas bottles
  const joint = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 12, 64), steel); joint.rotation.x = Math.PI / 2; joint.position.y = -1.08; g.add(joint);
  const paint = canvasTexture((c, w, h) => {
    c.fillStyle = '#5F6B66'; c.fillRect(0, 0, w, h);
    fillTexture(c, tex.metal('#5F6B66', { seed: 12 }), { w, h, alpha: 0.9 });
    // radiator louvres band
    for (let i = 0; i < 64; i++) { const x = (i / 64) * w; c.fillStyle = i % 2 ? 'rgba(30,36,38,.35)' : 'rgba(255,255,255,.08)'; c.fillRect(x, h * 0.42, w / 64 - 1, h * 0.3); }
    c.strokeStyle = 'rgba(40,46,48,.5)'; c.lineWidth = 3;
    for (const v of [0.2, 0.4, 0.74, 0.9]) { c.beginPath(); c.moveTo(0, v * h); c.lineTo(w, v * h); c.stroke(); }
  }, 1024, 256);
  const modMat = new THREE.MeshStandardMaterial({ map: paint, metalness: 0.2, roughness: 0.62, envMapIntensity: 0.35 });
  const bottleMat = new THREE.MeshStandardMaterial({ color: 0x5d6a64, metalness: 0.3, roughness: 0.5, envMapIntensity: 0.4 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), bottleMat);
    b.position.set(Math.cos(a) * 0.9, -1.32, Math.sin(a) * 0.9); g.add(b);
  }
  const module = new THREE.Mesh(lathe([[0.001, -1.12], [0.72, -1.12], [0.82, -1.25], [1.22, -2.25], [1.24, -2.4], [1.18, -2.5], [0.62, -3.3], [0.4, -3.38], [0.001, -3.38]], 96), modMat);
  g.add(module);
  const nozzle = new THREE.Mesh(lathe([[0.12, -3.38], [0.16, -3.5], [0.3, -3.85], [0.33, -3.9]], 48), darkSteel);
  g.add(nozzle);
  // small attitude thruster pods
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.22, 16), darkSteel); p.position.set(Math.cos(a) * 1.25, -2.38, Math.sin(a) * 1.25); g.add(p); }
  return { g, warm, portholeAnchor: onSphere(0.35, 0.28, 1.2) };
}

// Ghost shuttle side-profile (nose → right), length 1000, origin at tail/centre-line.
const SHUTTLE = [[-10, 30], [10, -40], [40, -44], [70, -210], [128, -212], [215, -46], [820, -44], [858, -58], [902, -66], [940, -56], [972, -34], [994, -8], [998, 8], [984, 24], [940, 38], [860, 46], [300, 50], [60, 48], [-10, 30]];
const OMS = [[40, -44], [70, -70], [200, -72], [240, -46]];
const BELLY = [[300, 50], [420, 60], [700, 62], [860, 46]];
function drawShuttle(ctx, x, y, s, p, erase, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s * 1.35);
  const warp = (pts, seed) => pts.map(([px, py], i) => {
    const k = clamp(erase * 1.7 - (1 - px / 1000) * 0.7);
    return [px - k * 280 * (0.5 + 0.5 * noise.n2(i * 0.7, seed)), py + k * 90 * noise.n2(seed, i * 1.3) - k * 70];
  });
  const ink = (pts, pp, w = 2.4, seed = 1, al = 0.85) => inkLine(ctx, warp(pts, seed), pp, { width: w, color: rgba(C.blueprintLine, al * (1 - erase)), wobble: 0.6, seed, taper: false });
  // faint volume wash
  if (erase < 1) {
    ctx.save();
    ctx.globalAlpha = 0.09 * clamp(p * 1.5 - 0.4) * (1 - erase);
    const fill = new Path2D();
    warp(SHUTTLE, 2).forEach(([px, py], i) => (i ? fill.lineTo(px, py) : fill.moveTo(px, py)));
    const g = ctx.createLinearGradient(0, -70, 0, 60); g.addColorStop(0, C.blueprintLine); g.addColorStop(1, 'rgba(156,199,230,0)');
    ctx.fillStyle = g; ctx.fill(fill);
    ctx.restore();
  }
  ink(SHUTTLE, p, 3, 2);
  ink(OMS, clamp(p * 1.3 - 0.25), 2, 4, 0.6);
  ink(BELLY, clamp(p * 1.3 - 0.3), 1.6, 5, 0.45);
  const det = clamp(p * 2 - 0.9) * (1 - erase);
  if (det > 0) {
    ctx.save();
    ctx.globalAlpha *= det;
    ctx.strokeStyle = rgba(C.blueprintLine, 0.8); ctx.lineWidth = 2;
    // engine bells
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-10, -18 + i * 16); ctx.lineTo(-44, -26 + i * 18); ctx.lineTo(-44, -8 + i * 18); ctx.lineTo(-10, -6 + i * 16); ctx.stroke(); }
    // cockpit windows
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(905 + i * 20, -54 + i * 4); ctx.lineTo(921 + i * 20, -52 + i * 5); ctx.lineTo(921 + i * 20, -38 + i * 4); ctx.lineTo(905 + i * 20, -40 + i * 4); ctx.closePath(); ctx.stroke(); }
    // payload bay seam (dashed)
    ctx.setLineDash([10, 8]); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(240, -30); ctx.lineTo(800, -30); ctx.stroke();
    // comfortable cabin cutaway
    ctx.beginPath(); ctx.roundRect(660, -36, 220, 74, 16); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  const seatsP = clamp((a - 312.0) / 1.2) * (1 - erase);
  for (let i = 0; i < 5; i++) {
    const sp = clamp(seatsP * 5 - i);
    if (sp <= 0) continue;
    ctx.save(); ctx.globalAlpha *= sp;
    ctx.strokeStyle = rgba(C.cream, 0.85); ctx.lineCap = 'round'; ctx.lineWidth = 3;
    ctx.translate(690 + i * 40, 28);
    // reclining seat: cushion + backrest + headrest + armrest
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, 0); ctx.quadraticCurveTo(28, -6, 24, -10);
    ctx.moveTo(2, 0); ctx.quadraticCurveTo(-4, -20, -12, -38); ctx.lineTo(-8, -46);
    ctx.moveTo(6, -12); ctx.lineTo(22, -12);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export const s01 = {
  id: 'p3-01-vostok', start: T0, end: 315.18,
  transition: { type: 'crossfade', dur: 0.8 },
  post: { bloom: 0.28, bloomThreshold: 0.8, vignette: 0.38, saturation: 0.95 },
  init(S) {
    const scene = new THREE.Scene();
    scene.environment = R3.env;
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
    const key = new THREE.DirectionalLight(0xfff0dc, 2.8); key.position.set(-6, 6, 7);
    const fill = new THREE.DirectionalLight(0x86b4dc, 0.7); fill.position.set(7, 1, 3);
    const rim = new THREE.DirectionalLight(0x9cd6ff, 2.6); rim.position.set(4, 3, -8);
    const amb = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(key, fill, rim, amb);
    const v = buildVostok();
    scene.add(v.g);
    Object.assign(S.state, { scene, cam, v });
  },
  render(ctx, t, S) {
    const a = T0 + t;
    const { scene, cam, v } = S.state;
    // camera path: close on sphere (r≈300) → pull out & orbit → drift to make room for the ghost
    const dist = kf(a, [[T0, 7.8], [307.2, 8.6, E.out], [310.6, 17.2, E.cam], [315.2, 18.4, E.linear]]);
    const az = kf(a, [[T0, 0.12], [307.2, 0.2], [310.6, 0.78, E.cam], [315.2, 0.98, E.linear]]);
    const el = kf(a, [[T0, 0.1], [310.6, 0.2, E.cam], [315.2, 0.16]]);
    const ly = kf(a, [[T0, 0], [307.2, 0], [310.6, -1.25, E.cam]]);
    const shift = kf(a, [[310.8, 0], [312.4, -2.6, E.cam], [314.4, -2.6], [315.2, -1.2, E.inOut]]);
    const ox = Math.sin(a * 0.37) * 0.04, oy = Math.cos(a * 0.29) * 0.03;
    cam.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist + ly, Math.cos(az) * Math.cos(el) * dist);
    const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    const look = new THREE.Vector3(0, ly, 0).addScaledVector(right, shift + ox);
    look.y += oy;
    cam.position.addScaledVector(right, shift);
    cam.lookAt(look);
    cam.updateMatrixWorld();
    v.g.rotation.y = -0.35 + (a - T0) * 0.035;
    // warm human light in the porthole at "first human"
    v.warm.color.setRGB(0.04, 0.08, 0.12).lerp(new THREE.Color(1.0, 0.55, 0.2), 0.9 * at(a, 309.2, 310.2));

    blueprintBg(ctx, { ox: -shift * 30 + az * 80, oy: ly * 20, zoom: lerp(1.15, 1.0, at(a, 307, 311, E.cam)), light: 0.25 });
    // drafting construction around the sphere at the very start (circle + centre cross)
    const cons = env(a, T0 + 0.2, T0 + 1.0, 307.2, 307.9);
    if (cons > 0) {
      ctx.save();
      ctx.globalAlpha = cons * 0.55;
      ctx.strokeStyle = C.blueprintLine; ctx.lineWidth = 1.5; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(960, 540, 340, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(560, 540); ctx.lineTo(1360, 540); ctx.moveTo(960, 160); ctx.lineTo(960, 920); ctx.stroke();
      ctx.restore();
    }
    // the 3D craft
    const img = R3.render(scene, cam, { exposure: 0.95 });
    ctx.drawImage(img, 0, 0, W, H);
    // porthole glow (2D, projected) once the human is "inside"
    const pa = v.portholeAnchor.clone().applyMatrix4(v.g.matrixWorld).project(cam);
    const hp = at(a, 309.2, 310.2);
    if (hp > 0 && pa.z < 1) {
      const sx = (pa.x + 1) / 2 * W, sy = (1 - pa.y) / 2 * H;
      glow(ctx, sx, sy, 60, C.orange, 0.5 * hp);
    }
    // title VOSTOK 1
    const tIn = a - 305.95;
    const tOut = at(a, 310.4, 310.9, E.in);
    if (tIn > 0 && tOut < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - tOut;
      maskRise(ctx, 'VOSTOK 1', 150, 300, clamp(tIn / 0.7), { family: F.COND, size: 168, weight: 800, color: C.cream, tracking: 6 });
      staggerText(ctx, '[ ВОСТОК-1 ]', 156, 355, tIn - 0.45, { family: F.MONO, size: 26, weight: 600, color: C.blueprintLine, tracking: 4, stagger: 0.03, dur: 0.4, mode: 'fade' });
      // thin rule
      ctx.strokeStyle = rgba(C.orange, 0.9); ctx.lineWidth = 3;
      const lw = at(a, 306.4, 307.2);
      ctx.beginPath(); ctx.moveTo(156, 152); ctx.lineTo(156 + 90 * lw, 152); ctx.stroke();
      ctx.restore();
    }
    // ghost shuttle ("our modern image")
    const sp = at(a, 311.4, 313.0, E.inOut);
    const er = at(a, 314.0, 315.15, E.inCubic);
    if (sp > 0) {
      drawShuttle(ctx, 150, 560, 0.86, sp, er, a);
      const lab = env(a, 312.5, 313.1, 313.9, 314.4);
      if (lab > 0) {
        ctx.save(); ctx.globalAlpha = lab;
        staggerText(ctx, 'our modern image', 150, 330, a - 312.5, { family: F.SERIF, size: 46, italic: true, color: C.cream, stagger: 0.02, dur: 0.45 });
        ctx.restore();
      }
      // drifting ink flecks while it dissolves
      if (er > 0) {
        const r = rng(8);
        ctx.save();
        ctx.fillStyle = C.blueprintLine;
        for (let i = 0; i < 140; i++) {
          const x0 = 120 + r() * 850, y0 = 400 + r() * 260;
          const k = clamp(er * 1.5 - r() * 0.5);
          if (k <= 0 || k >= 1) continue;
          ctx.globalAlpha = (1 - k) * 0.7;
          ctx.fillRect(x0 - k * 300 * (0.4 + r()), y0 - k * 120 * r() + noise.n2(i, a) * 10, 2 + r() * 3, 1.5);
        }
        ctx.restore();
      }
    }
  },
};
