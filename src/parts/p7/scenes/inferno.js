// ─────────────────────────────────────────────────────────────────────────────
// p7 · chapter A "INFERNO" (972.42 – 996.70)
//   01 sheath   — 3D Vostok in the plasma sheath, 17,400 MPH
//   02 shock    — cross-section: air → shock layer → plasma, thousands of degrees
//   03 window   — porthole from inside: ablative coating melts across the glass, smoke
//   04 metal    — macro exterior skin: streams of liquid metal
// ─────────────────────────────────────────────────────────────────────────────
import { THREE } from '../../../core/three.js';
import { kf, handheld, shake, polyAt } from '../../../core/math.js';
import { F, text, staggerText, maskRise, setText } from '../../../core/type.js';
import { bigNumber, callout, leadKey } from '../../../core/components.js';
import { Cam25, tex, makeCanvas, glow, lightCone, smokePlume, fillTexture, texturePath, contactShadow, shadeSphere, scratchCanvas, W, H } from '../../../core/draw.js';
import { buildVostok, renderVostok, project3 } from '../vostok3d.js';
import {
  T, L, clamp, lerp, rng, noise, TAU, E, tw, smoothstep, C, rgba, shade, mixColor, ramp, PLASMA_RAMP,
  plasmaSheath, shockGlow, embers, heatWarp, softGlow, flameSprite, dotSprite, tag, emberGround, tinted,
} from '../lib.js';

// ── Earth limb seen from re-entry altitude (2D, behind the 3D render) ───────
function earthTexture() {
  const w = 2048, h = 512;
  const { c, ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const nz = noise;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const v = y / h;
    // ocean with depth variation
    const o = nz.fbm2(x / 400, y / 200, 4) * 0.5 + 0.5;
    let r = lerp(28, 52, o), g = lerp(70, 104, o), b = lerp(112, 150, o);
    const land = nz.fbm2(x / 520 + 3, y / 260 + 1, 6);
    if (land > 0.16) {
      const k = 0.85 + nz.fbm2(x / 40, y / 40, 4) * 0.25;
      const m = clamp((land - 0.16) * 8);
      r = lerp(r, 168 * k, m); g = lerp(g, 140 * k, m); b = lerp(b, 98 * k, m);
    }
    const cl = nz.fbm2(x / 150 + 40, y / 46, 6) * 0.5 + 0.5;
    const a = clamp((cl - 0.5) * 2.6) * 0.95;
    r = lerp(r, 236, a); g = lerp(g, 240, a); b = lerp(b, 246, a);
    // atmospheric haze toward the far edge (top of texture = horizon)
    const hz = Math.pow(1 - v, 3) * 0.6;
    d[i] = lerp(r, 150, hz); d[i + 1] = lerp(g, 190, hz); d[i + 2] = lerp(b, 228, hz); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function drawEarth(ctx, t, S, { limbY, tilt = -0.12, glowK = 1 }) {
  const R = 3400;
  const cx = 960 - Math.sin(tilt) * R, cy = limbY + Math.cos(tilt) * R;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
  ctx.save();
  ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(tilt);
  const tx = S.state.earth;
  ctx.drawImage(tx, -2300 - t * 40, -R - 10, 4600, 1150);
  const hg = ctx.createLinearGradient(0, -R, 0, -R + 600);
  hg.addColorStop(0, 'rgba(170,210,240,.55)'); hg.addColorStop(0.2, 'rgba(110,160,210,.18)'); hg.addColorStop(1, 'rgba(20,40,70,.0)');
  ctx.fillStyle = hg; ctx.fillRect(-3000, -R, 6000, 700);
  ctx.restore();
  ctx.restore();
  // scattering limb: smooth radial ring (no hard strokes)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(cx, cy, R - 220, cx, cy, R + 140);
  g.addColorStop(0, 'rgba(124,200,238,0)');
  g.addColorStop(0.5, rgba(C.halo, 0.12 * glowK));
  g.addColorStop(0.6, rgba('#DDF2FF', 0.55 * glowK));
  g.addColorStop(0.64, rgba(C.halo, 0.45 * glowK));
  g.addColorStop(0.8, rgba('#3E6FB8', 0.18 * glowK));
  g.addColorStop(1, 'rgba(40,60,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.max(0, limbY - 400), W, H);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
const s01 = {
  id: 'p7-01-sheath', start: T.start, end: 978.20,
  transition: { type: 'burn', dur: 0.8, color: [1.0, 0.42, 0.1], center: [0.5, 0.5], seed: 4.2 },
  post: (t) => ({ bloom: 0.5, bloomThreshold: 0.74, ca: 0.0018, vignette: 0.45, contrast: 1.07, saturation: 1.04, highTint: [0.07, 0.025, 0.0], grain: 0.06 }),
  init(S) {
    S.state.V = buildVostok({ charred: true, w: 1280, h: 720 });
    S.state.earth = earthTexture();
    S.state.stars = tex.stars({ seed: 71, count: 700, big: 10 });
  },
  render(ctx, t, S) {
    const V = S.state.V;
    const tl = t;
    // tumble ~30°/s, mostly in the picture plane so both bodies stay readable
    const P2 = new THREE.Vector3(6.5, 3.2, 12.5);
    const look2 = new THREE.Vector3(-0.2, -0.9, 0);
    const axis = P2.clone().sub(look2).normalize();
    const vdir = new THREE.Vector3(-0.55, -1, 0.25).normalize();
    const wakePerp = vdir.clone().negate().sub(axis.clone().multiplyScalar(-vdir.dot(axis))).normalize();
    const qBase = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), wakePerp);
    const qSpin = new THREE.Quaternion().setFromAxisAngle(axis, 1.1 - tl * 0.52);
    const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 2.2 + tl * 0.35);
    V.group.quaternion.copy(qSpin).multiply(qBase).multiply(qRoll);
    V.group.updateMatrixWorld(true);
    const sphereW = new THREE.Vector3(); V.sphere.getWorldPosition(sphereW);
    // porthole normal in world (u = .47 on the equirect texture)
    const phi = 0.47 * TAU;
    const nL = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));
    const nW = nL.clone().applyQuaternion(V.sphere.getWorldQuaternion(new THREE.Quaternion())).normalize();
    // camera: from the porthole (seam match) pull back into a 3/4 chase
    const e = tw(tl, 0.1, 3.0, E.cam);
    const P1 = sphereW.clone().add(nW.clone().multiplyScalar(V.RS + 1.25));
    const dir2 = look2.clone().sub(P2).normalize();
    const right2 = new THREE.Vector3().crossVectors(dir2, new THREE.Vector3(0, 1, 0)).normalize();
    const tgt2 = look2.clone().add(right2.multiplyScalar(-2.3)); // frame the bodies right of centre
    const pos = P1.clone().lerp(P2, e);
    pos.y += Math.sin(e * Math.PI) * 1.6;
    const tilt = kf(tl, [[0, 0], [1.2, 0], [3.4, 0.22, E.cam], [5.8, 0.3]]);
    const tgt = sphereW.clone().lerp(tgt2, e).add(new THREE.Vector3(0, -tilt * 2.5, 0));
    const hh = handheld(tl, 1, 0.8, 3);
    V.camera.position.copy(pos).add(new THREE.Vector3(hh.x * 0.02, hh.y * 0.02, 0));
    V.camera.lookAt(tgt);
    V.camera.fov = lerp(44, 30, e);
    V.camera.updateProjectionMatrix();
    V.camera.updateMatrixWorld(true);
    V.plasma.position.copy(sphereW).add(vdir.clone().multiplyScalar(V.RS + 0.7));
    V.plasma.intensity = 22;
    V.sMat.emissiveIntensity = 0.06;
    V.mMat.emissiveIntensity = 0.03;
    V.cMat.emissiveIntensity = 0.25;

    // ── 2D background: space + Earth limb rising as we fall ──
    const sg = ctx.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, '#05081A'); sg.addColorStop(0.7, '#0E1430'); sg.addColorStop(1, '#1C1D3A');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.5; ctx.drawImage(S.state.stars, 0, -tilt * 300, W, H); ctx.globalAlpha = 1;
    const limbY = kf(tl, [[0, 1250], [1.0, 1180], [3.4, 900, E.cam], [5.8, 840]]);
    drawEarth(ctx, tl, S, { limbY, tilt: -0.14 + tl * 0.012 });

    // projections
    const sp = project3(V, sphereW);
    const right = new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 0);
    const sp2 = project3(V, sphereW.clone().add(right.clone().multiplyScalar(V.RS)));
    const r = Math.hypot(sp2.x - sp.x, sp2.y - sp.y);
    const wakeP = project3(V, sphereW.clone().sub(vdir.clone().multiplyScalar(6)));
    const ang = Math.atan2(wakeP.y - sp.y, wakeP.x - sp.x);
    const modW = new THREE.Vector3(); V.mod.localToWorld(modW.set(0, -1.0, 0));
    const mp = project3(V, modW);
    const mp2 = project3(V, modW.clone().add(right.clone().multiplyScalar(1.1)));
    const mr = Math.hypot(mp2.x - mp.x, mp2.y - mp.y);

    // wake behind the bodies (gentler while the lens is right at the window)
    const k = lerp(0.45, 1, e);
    plasmaSheath(ctx, tl, { x: mp.x, y: mp.y, r: mr, ang, k: 0.5 * k, len: 1300, seed: 9, count: 50, shock: 0, bloom: 0.4, speed: 1.4 });
    plasmaSheath(ctx, tl, { x: sp.x, y: sp.y, r, ang, k, len: lerp(900, 1900, e), seed: 3, count: 140, shock: 0, bloom: 0, speed: 1.3 });
    // the real 3D bodies
    ctx.drawImage(renderVostok(V, { exposure: 1.0 }), 0, 0, W, H);
    // heat-soaked leading face of the sphere (2D overlay clipped to its disc)
    ctx.save();
    ctx.beginPath(); ctx.arc(sp.x, sp.y, r * 0.99, 0, TAU); ctx.clip();
    const lx = sp.x - Math.cos(ang) * r, ly = sp.y - Math.sin(ang) * r;
    const hg = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 1.5);
    hg.addColorStop(0, rgba(C.fire4, 0.8 * k)); hg.addColorStop(0.25, rgba(C.plasma0, 0.5 * k)); hg.addColorStop(0.6, rgba(C.fire1, 0.15 * k)); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hg; ctx.fillRect(sp.x - r, sp.y - r, r * 2, r * 2);
    ctx.restore();
    // front: bow shock, glow over the leading face
    plasmaSheath(ctx, tl, { x: sp.x, y: sp.y, r, ang, k, len: 600, seed: 5, count: 22, shock: 1, bloom: lerp(0.4, 0.9, e), speed: 1.6 });
    plasmaSheath(ctx, tl, { x: mp.x, y: mp.y, r: mr, ang, k: 0.4, len: 450, seed: 7, count: 8, shock: 0.5, bloom: 0.4, speed: 1.6 });
    // the seam: P6's window glow fades as we back away from the porthole
    softGlow(ctx, W / 2, H / 2, 900, C.plasma0, 0.4 * (1 - tw(tl, 0, 1.0, E.out)));
    // ionised streaks + embers across frame
    embers(ctx, tl, { x: sp.x, y: sp.y, ang, speed: 1400, count: 90, seed: 11, k: 0.9, size: [1.2, 3.2], stretch: 0.04 });
    heatWarp(ctx, tl, { y0: Math.max(0, sp.y - r * 3.5), y1: Math.min(H, sp.y + r * 1.5), amp: 3.5, speed: 9 });

    // ── 17,400 MPH ──
    const tn = tl - L(S, T.n17400);
    if (tn > -0.2) {
      const sh = shake(tl, L(S, T.n17400), 10, 5, 22, 2);
      ctx.save();
      ctx.translate(sh.x, sh.y);
      // scrim for legibility
      const sc = ctx.createRadialGradient(560, 300, 0, 560, 300, 700);
      sc.addColorStop(0, rgba('#05081A', 0.55 * tw(tn, 0, 0.4))); sc.addColorStop(1, 'rgba(5,8,26,0)');
      ctx.fillStyle = sc; ctx.fillRect(0, 0, 1300, 800);
      tag(ctx, 'DESCENT VELOCITY', 150, 150, tw(tn, 0, 0.6, E.linear), { color: rgba(C.plasma2, 0.9), size: 24 });
      bigNumber(ctx, tn, 140, 360, { value: 17400, from: 0, dur: 1.45, size: 196, align: 'left', color: C.cream, family: F.DISPLAY, weight: 800 });
      const tu = tl - L(S, T.miles);
      if (tu > -0.3) staggerText(ctx, 'MILES PER HOUR', 148, 446, tu + 0.2, { family: F.COND, size: 54, weight: 800, color: C.plasma0, tracking: 6, stagger: 0.03, dur: 0.45 });
      ctx.restore();
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 02 — cross-section: air streams compress into the shock layer → plasma
const SX = 640, SY = 560, SR = 220; // sphere in diagram space
function flowVel(x, y) {
  // potential flow around a cylinder of radius R0 (shock layer envelope), stream from +x to -x
  const R0 = SR * 1.32;
  const dx = x - SX, dy = y - SY;
  const r2 = dx * dx + dy * dy, r4 = r2 * r2;
  const U = -1;
  const u = U * (1 - (R0 * R0 * (dx * dx - dy * dy)) / r4);
  const v = U * (-(2 * R0 * R0 * dx * dy) / r4);
  return [u, v];
}
function buildStreams() {
  const lines = [];
  for (let j = -9; j <= 9; j++) {
    if (j === 0) continue;
    let x = 2100, y = SY + j * 38 + (j > 0 ? 6 : -6);
    const pts = [[x, y]];
    for (let i = 0; i < 900 && x > -200; i++) {
      const [u, v] = flowVel(x, y);
      const sp = Math.hypot(u, v) || 1e-3;
      x += (u / sp) * 4; y += (v / sp) * 4;
      pts.push([x, y]);
    }
    lines.push({ j, pts });
  }
  return lines;
}

const s02 = {
  id: 'p7-02-shock', start: 978.20, end: 984.60,
  transition: { type: 'lumaWipe', dur: 0.7, seed: 2.2 },
  post: { bloom: 0.45, bloomThreshold: 0.72, vignette: 0.4, contrast: 1.06, highTint: [0.06, 0.02, 0], ca: 0.001 },
  init(S) { S.state.lines = buildStreams(); },
  render(ctx, t, S) {
    const tAir = L(S, T.air), tFric = L(S, T.friction), tPl = L(S, T.searing), tTemp = L(S, T.temperature), tSev = L(S, T.several);
    const ign = tw(t, tPl - 0.3, tPl + 0.9, E.out); // ignition of the shock layer
    const heat = tw(t, tTemp, tSev + 0.6, E.inOut);
    // camera: slow push toward the stagnation point, then drift
    const zoom = kf(t, [[0, 1.0], [3.0, 1.08, E.cam], [6.4, 1.14]]);
    const cx = kf(t, [[0, 0], [3.0, 40, E.cam], [6.4, 70]]);
    const hh = handheld(t, 2.5, 0.3, 21);
    emberGround(ctx, t, { cx: 700, cy: 560, heat: 0.4 + ign * 0.6 });
    ctx.save();
    ctx.translate(W / 2 + hh.x, H / 2 + hh.y); ctx.scale(zoom, zoom); ctx.translate(-W / 2 + cx, -H / 2);
    // faint technical grid (schematic mode)
    ctx.strokeStyle = rgba(C.plasma2, 0.05); ctx.lineWidth = 1;
    for (let x = -200; x < 2200; x += 80) { ctx.beginPath(); ctx.moveTo(x, -100); ctx.lineTo(x, 1200); ctx.stroke(); }
    for (let y = -80; y < 1200; y += 80) { ctx.beginPath(); ctx.moveTo(-300, y); ctx.lineTo(2300, y); ctx.stroke(); }
    // streamlines (ink) drawing in from the right
    const draw = tw(t, tAir - 0.1, tFric + 0.6, E.inOut);
    const dimLines = 1 - heat * 0.55;
    for (const { j, pts } of S.state.lines) {
      const n = Math.floor(pts.length * draw);
      if (n < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i += 2) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = rgba(C.cream, (0.28 - Math.abs(j) * 0.012) * dimLines);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    // particles riding the streamlines: cool → white-hot inside the shock layer
    const R = rng(5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 260; i++) {
      const line = S.state.lines[i % S.state.lines.length];
      const ph = R();
      const u = ((t * 0.32 + ph) % 1);
      if (u > draw) continue;
      const p = polyAtFast(line.pts, u);
      const dx = p[0] - SX, dy = p[1] - SY;
      const dist = Math.hypot(dx, dy) - SR;
      const front = dx > -SR * 0.4 ? 1 : 0.5;
      const hot = clamp(1 - dist / (SR * 0.55)) * front * ign;
      const col = hot > 0.02 ? ramp(PLASMA_RAMP, 0.45 + hot * 0.55) : C.cream;
      const s = 2 + hot * 4;
      ctx.globalAlpha = (0.35 + hot * 0.65) * clamp(u * 12);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(p[0], p[1], s * (1 + (1 - hot) * 2.5), s, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // shock layer: glowing crescent in front (right side) of the sphere
    if (ign > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      shockGlow(ctx, t, { x: SX, y: SY, r: SR * 1.02, ang: Math.PI, k: ign, span: 1.3, seed: 2, blur: 9 });
      softGlow(ctx, SX + SR * 1.1, SY, SR * 1.6, C.plasma0, 0.5 * ign);
      // wake flames peeling off the shoulders
      plasmaSheath(ctx, t, { x: SX, y: SY, r: SR, ang: Math.PI, k: ign * 0.75, len: 900, seed: 13, count: 70, shock: 0, bloom: 0, speed: 1.1 });
      ctx.restore();
    }
    // the sphere (section): charred shell, heat-soaked leading face
    ctx.save();
    ctx.beginPath(); ctx.arc(SX, SY, SR, 0, TAU);
    shadeSphere(ctx, SX, SY, SR, '#3A2A24', { lx: 0.6, ly: -0.2, spec: 0.12, rim: C.plasma0 });
    ctx.beginPath(); ctx.arc(SX, SY, SR, 0, TAU);
    texturePath(ctx, tex.grit(0.8, { seed: 4, alpha: 180 }), { alpha: 0.35, op: 'multiply' });
    // ablative layer ring + inner hull line
    ctx.strokeStyle = rgba(C.plasma2, 0.5); ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.arc(SX, SY, SR * 0.86, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const hg = ctx.createRadialGradient(SX + SR, SY, 0, SX + SR, SY, SR * 1.3);
    hg.addColorStop(0, rgba(C.fire4, 0.75 * ign)); hg.addColorStop(0.3, rgba(C.plasma0, 0.45 * ign)); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(SX, SY, SR, 0, TAU); ctx.fillStyle = hg; ctx.globalCompositeOperation = 'lighter'; ctx.fill();
    ctx.restore();
    // the orange dot: a man inside the section
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    softGlow(ctx, SX - 30, SY + 10, 40, C.orange, 0.35 + pulse * 0.2);
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(SX - 30, SY + 10, 9, 0, TAU); ctx.fill();
    ctx.restore();
    // heat-ramp gauge arc around the shock (temperature)
    if (heat > 0) {
      const GR = SR * 1.85, a0 = -0.95, a1 = 0.95;
      ctx.save();
      ctx.lineCap = 'butt';
      ctx.strokeStyle = rgba(C.plasma2, 0.25); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(SX, SY, GR + 18, a0, a1); ctx.stroke();
      const n = 48;
      for (let i = 0; i < n; i++) {
        const u = i / n;
        if (u > heat) break;
        const a = lerp(a1, a0, u);
        ctx.strokeStyle = ramp(PLASMA_RAMP, 0.25 + u * 0.75);
        ctx.lineWidth = 16;
        ctx.beginPath(); ctx.arc(SX, SY, GR, a, a - (a1 - a0) / n * 0.8, true); ctx.stroke();
      }
      // ticks
      ctx.strokeStyle = rgba(C.cream, 0.6); ctx.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        const a = lerp(a1, a0, i / 8);
        ctx.beginPath(); ctx.moveTo(SX + Math.cos(a) * (GR + 12), SY + Math.sin(a) * (GR + 12)); ctx.lineTo(SX + Math.cos(a) * (GR + 28), SY + Math.sin(a) * (GR + 28)); ctx.stroke();
      }
      // needle head
      const ah = lerp(a1, a0, heat);
      const hx = SX + Math.cos(ah) * GR, hy = SY + Math.sin(ah) * GR;
      softGlow(ctx, hx, hy, 60, C.fire4, 0.6 * heat);
      ctx.fillStyle = C.fire5; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // labels (screen space, outside the camera to stay crisp)
    tag(ctx, 'AIR', 1640, 300, tw(t, tAir, tAir + 0.6, E.linear) * (1 - tw(t, tTemp, tTemp + 0.5)), { color: rgba(C.cream, 0.85), size: 26 });
    if (t > tPl - 0.2) callout(ctx, t - tPl, 980, 440, 1180, 250, 'PLASMA', { sub: '', color: C.cream, accent: C.fire3, size: 26, out: tTemp + 0.6 - tPl });
    // temperature: several THOUSAND DEGREES
    const tk = t - tSev;
    if (tk > -0.3) {
      ctx.save();
      const sc = ctx.createLinearGradient(1100, 0, 1920, 0);
      sc.addColorStop(0, 'rgba(14,6,8,0)'); sc.addColorStop(0.4, rgba('#0E0608', 0.6 * tw(tk, 0, 0.5))); sc.addColorStop(1, rgba('#0E0608', 0.75 * tw(tk, 0, 0.5)));
      ctx.fillStyle = sc; ctx.fillRect(1100, 0, 820, H);
      staggerText(ctx, 'several', 1290, 640, tk + 0.25, { family: F.SERIF, size: 60, italic: true, color: rgba(C.plasma2, 0.95), stagger: 0.03, dur: 0.5 });
      maskRise(ctx, 'THOUSAND', 1280, 770, tw(t, L(S, T.thousand) - 0.1, L(S, T.thousand) + 0.5, E.linear), { family: F.COND, size: 136, weight: 900, color: C.cream, tracking: 3 });
      maskRise(ctx, 'DEGREES', 1280, 892, tw(t, L(S, T.degrees) - 0.1, L(S, T.degrees) + 0.5, E.linear), { family: F.COND, size: 136, weight: 900, color: C.fire3, tracking: 3 });
      ctx.restore();
    }
  },
};
function polyAtFast(pts, u) {
  const f = clamp(u) * (pts.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

export const infernoScenes = [s01, s02];

// ─────────────────────────────────────────────────────────────────────────────
// 03 — the porthole from inside: ablative coating melts and flows across the glass
const PW = 300; // porthole world radius (plane z=0)
function buildRivulets() {
  const R = rng(303);
  const out = [];
  for (let i = 0; i < 16; i++) {
    // flow over the hull runs from lower-right to upper-left across the glass
    const a = 0.25 + (R() - 0.5) * 1.3;
    let x = Math.cos(a) * PW * 1.05, y = Math.sin(a) * PW * 1.05;
    const pts = [[x, y]];
    let dir = Math.PI + 0.55 + (R() - 0.5) * 0.25;
    for (let k = 0; k < 140; k++) {
      dir += noise.n2(i * 3.1, k * 0.09) * 0.07;
      x += Math.cos(dir) * 6; y += Math.sin(dir) * 6;
      pts.push([x, y]);
      if (Math.hypot(x, y) > PW * 1.1 && k > 20) break;
    }
    out.push({ pts, t0: 0, w: 5 + R() * 10, speed: 140 + R() * 120, delay: R() });
  }
  return out;
}

function drawPlasmaWindow(ctx, t, k, cam) {
  // churning plasma seen through the glass (flowing up-left over the hull)
  const g = ctx.createRadialGradient(80, 60, 20, 0, 0, PW * 1.3);
  g.addColorStop(0, C.fire5); g.addColorStop(0.35, C.fire4); g.addColorStop(0.7, C.plasma0); g.addColorStop(1, C.fire1);
  ctx.fillStyle = g; ctx.fillRect(-PW * 1.4, -PW * 1.4, PW * 2.8, PW * 2.8);
  const R = rng(41);
  const cols = [C.fire5, C.plasma2, C.fire3, C.plasma0, C.plasma1];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ang = Math.PI + 0.55;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let i = 0; i < 46; i++) {
    const life = 0.5 + R() * 0.5;
    const u = (((t * 1.4 + R() * life) % life) + life) % life / life;
    const off = (R() - 0.5) * PW * 2.4;
    const x = -dx * PW * 1.4 + dx * u * PW * 3 + -dy * off;
    const y = -dy * PW * 1.4 + dy * u * PW * 3 + dx * off;
    const L = 220 + R() * 300, Wd = L * (0.25 + R() * 0.2);
    ctx.globalAlpha = (0.25 + R() * 0.35) * k * Math.sin(Math.PI * u);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.drawImage(flameSprite(cols[i % cols.length], (i % 4) + 1), -L * 0.2, -Wd / 2, L, Wd);
    ctx.restore();
  }
  ctx.restore();
}

const s03 = {
  id: 'p7-03-window', start: 984.60, end: 992.30,
  transition: {
    type: 'mask', dur: 0.85,
    mask(m, p) {
      const e = E.inOutCubic(p);
      m.beginPath(); m.arc(lerp(675, 960, e), lerp(563, 520, e), lerp(251, 1300, E.inCubic(p)), 0, TAU); m.fill();
    },
  },
  post: (t) => ({ bloom: 0.42, bloomThreshold: 0.74, vignette: 0.5, contrast: 1.06, highTint: [0.07, 0.03, 0], ca: 0.0012 }),
  init(S) {
    S.state.riv = buildRivulets();
    S.state.wall = tex.metal('#6F7B6E', { w: 600, h: 400, seed: 15, streak: 0.4 });
  },
  render(ctx, t, S) {
    const tMelt = L(S, T.melting), tFlow = L(S, T.flowing), tCabin = L(S, T.cabin);
    // camera keys (see transition math: porthole starts where the diagram sphere was)
    const sA = 251 / PW, sB = 390 / PW, sC = 0.86;
    const sc = kf(t, [[0, sA], [1.6, sB, E.cam], [L(S, T.cabin) - 0.3, sB * 1.06], [L(S, T.cabin) + 1.6, sC, E.cam], [7.7, sC * 0.96]]);
    const fx = kf(t, [[0, 675], [1.6, 960, E.cam], [L(S, T.cabin) - 0.3, 960], [L(S, T.cabin) + 1.6, 1180, E.cam], [7.7, 1210]]);
    const fy = kf(t, [[0, 563], [1.6, 520, E.cam], [L(S, T.cabin) + 1.6, 470, E.cam]]);
    const hh = handheld(t, 3, 0.5, 31);
    const z = -1000 / sc;
    const cam = new Cam25({ x: -(fx - 960) / sc + hh.x, y: -(fy - 540) / sc + hh.y, z, f: 1000, focus: 0, aperture: 1.4 });
    const flick = 0.85 + 0.15 * noise.n2(t * 7, 3.3);
    // background beyond the wall: plasma (seen only through the glass)
    ctx.fillStyle = '#1A0E0C'; ctx.fillRect(0, 0, W, H);
    // the cabin wall with the porthole cut-out (plane z=0)
    cam.plane(ctx, 0, (c) => {
      // glass: plasma + melt rivulets
      c.save();
      c.beginPath(); c.arc(0, 0, PW, 0, TAU); c.clip();
      drawPlasmaWindow(c, t, flick, cam);
      // melt film darkens as more coating flows over
      const film = tw(t, tMelt, tCabin + 1.5, E.inOut);
      c.fillStyle = rgba('#3A1406', 0.35 * film); c.fillRect(-PW, -PW, PW * 2, PW * 2);
      for (const rv of S.state.riv) {
        const t0 = tMelt + rv.delay * (tCabin - tMelt + 1.2);
        const head = (t - t0) * rv.speed;
        if (head <= 0) continue;
        drawRivulet(c, rv, head, t);
      }
      // glass reflections (cool, from the cabin)
      c.globalCompositeOperation = 'screen';
      const rg = c.createLinearGradient(-PW, -PW, PW * 0.2, PW * 0.3);
      rg.addColorStop(0, 'rgba(180,200,220,.18)'); rg.addColorStop(0.4, 'rgba(180,200,220,0)');
      c.fillStyle = rg; c.fillRect(-PW, -PW, PW * 2, PW * 2);
      c.restore();
      // wall around the window
      c.save();
      c.beginPath(); c.rect(-2600, -1600, 5200, 3200); c.arc(0, 0, PW * 1.32, 0, TAU, true);
      c.fillStyle = '#4C5650'; c.fill('evenodd');
      c.beginPath(); c.rect(-2600, -1600, 5200, 3200); c.arc(0, 0, PW * 1.32, 0, TAU, true);
      c.save(); c.clip('evenodd');
      c.globalAlpha = 0.5; c.globalCompositeOperation = 'multiply';
      const pat = c.createPattern(S.state.wall, 'repeat'); c.fillStyle = pat; c.fillRect(-2600, -1600, 5200, 3200);
      c.restore();
      // quilted padding seams
      c.strokeStyle = 'rgba(20,24,22,.35)'; c.lineWidth = 3;
      for (let x = -2400; x < 2600; x += 240) { if (Math.abs(x) < PW * 1.5) continue; c.beginPath(); c.moveTo(x, -1600); c.lineTo(x, 1600); c.stroke(); }
      for (let y = -1500; y < 1600; y += 240) { c.beginPath(); c.moveTo(-2600, y); c.lineTo(-PW * 1.5, y); c.moveTo(PW * 1.5, y); c.lineTo(2600, y); c.stroke(); }
      // fire light spilling onto the wall
      c.globalCompositeOperation = 'lighter';
      const lg = c.createRadialGradient(0, 0, PW, 0, 0, PW * 4.2);
      lg.addColorStop(0, rgba(C.plasma0, 0.55 * flick)); lg.addColorStop(0.4, rgba(C.fire2, 0.18 * flick)); lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lg; c.fillRect(-PW * 4.5, -PW * 4.5, PW * 9, PW * 9);
      c.restore();
      // porthole frame: thick machined ring with bolts
      c.save();
      c.beginPath(); c.arc(0, 0, PW * 1.32, 0, TAU); c.arc(0, 0, PW, 0, TAU, true);
      const fg = c.createLinearGradient(-PW, -PW, PW, PW);
      fg.addColorStop(0, '#9AA39A'); fg.addColorStop(0.5, '#5E665F'); fg.addColorStop(1, '#2C302D');
      c.fillStyle = fg; c.fill('evenodd');
      c.lineWidth = 4; c.strokeStyle = 'rgba(14,16,15,.8)';
      c.beginPath(); c.arc(0, 0, PW * 1.01, 0, TAU); c.stroke();
      c.beginPath(); c.arc(0, 0, PW * 1.32, 0, TAU); c.stroke();
      // inner bevel catching the fire
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(C.fire3, 0.45 * flick); c.lineWidth = 7;
      c.beginPath(); c.arc(0, 0, PW * 1.04, Math.PI * 0.85, Math.PI * 1.9); c.stroke();
      c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + 0.13;
        const bx = Math.cos(a) * PW * 1.17, by = Math.sin(a) * PW * 1.17;
        c.beginPath(); c.arc(bx, by, 11, 0, TAU);
        shadeSphere(c, bx, by, 11, '#7B827B', { spec: 0.4, bounce: 0 });
      }
      c.restore();
    });
    // cabin smoke drifting in the orange light (the smell of burning)
    const smk = tw(t, tCabin - 0.5, tCabin + 1.2, E.out);
    if (smk > 0) {
      cam.plane(ctx, -160, (c) => {
        smokePlume(c, t, { x: 200, y: 700, count: 22, seed: 18, rise: 70, spread: 1400, size: [260, 700], life: 7, color: '#8E7564', alpha: 0.32 * smk, drift: 40, dirX: -0.4 });
        smokePlume(c, t + 3, { x: -300, y: 500, count: 14, seed: 23, rise: 50, spread: 900, size: [300, 600], life: 8, color: '#C08A5E', alpha: 0.18 * smk, drift: 30, dirX: 0.3, op: 'lighter' });
      });
    }
    // foreground: the panel's "Globus" instrument and a cable, out of focus
    cam.plane(ctx, -520, (c) => {
      const gx = -880, gy = 560;
      c.fillStyle = '#20251F';
      c.beginPath(); c.roundRect(gx - 520, gy - 40, 900, 600, 30); c.fill();
      c.beginPath(); c.arc(gx, gy - 30, 150, 0, TAU);
      shadeSphere(c, gx, gy - 30, 150, '#3C5A6E', { lx: 0.6, ly: -0.6, spec: 0.3, rim: C.plasma0 });
      c.strokeStyle = 'rgba(230,200,160,.35)'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(gx, gy - 30, 150, 50, 0.2, 0, TAU); c.stroke();
      c.strokeStyle = '#141714'; c.lineWidth = 26;
      c.beginPath(); c.moveTo(900, 900); c.bezierCurveTo(700, 600, 1200, 420, 1500, 300); c.stroke();
    });
    // callout on the hull layer around the glass
    const tA = t - L(S, T.ablative);
    if (tA > -0.1) {
      const p = cam.project(PW * 0.72, -PW * 0.7, 0);
      callout(ctx, tA, p.x, p.y, 1430, 210, 'ABLATIVE COATING', { color: C.cream, accent: C.fire3, size: 26, out: L(S, T.flowing) + 0.9 - L(S, T.ablative) });
    }
  },
};
function drawRivulet(c, rv, head, t) {
  const pts = rv.pts;
  const n = Math.min(pts.length - 1, Math.floor(head / 6));
  if (n < 1) return;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // smear film behind the drop
  c.strokeStyle = 'rgba(70,26,8,.35)'; c.lineWidth = rv.w * 2.6;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= n; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
  // molten body
  c.strokeStyle = '#6A2A0C'; c.lineWidth = rv.w;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= n; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
  // glowing edge + specular thread
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(C.fire3, 0.55); c.lineWidth = rv.w * 0.45;
  c.beginPath(); c.moveTo(pts[0][0] + 1.5, pts[0][1] - 1.5); for (let i = 1; i <= n; i++) c.lineTo(pts[i][0] + 1.5, pts[i][1] - 1.5); c.stroke();
  c.strokeStyle = 'rgba(255,240,215,.7)'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(pts[0][0] + 2.5, pts[0][1] - 2.5); for (let i = 1; i <= n; i++) c.lineTo(pts[i][0] + 2.5, pts[i][1] - 2.5); c.stroke();
  // bead at the head
  const h = pts[n];
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#7A300E';
  c.beginPath(); c.arc(h[0], h[1], rv.w * 0.85, 0, TAU); c.fill();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(255,220,170,.8)';
  c.beginPath(); c.arc(h[0] + rv.w * 0.25, h[1] - rv.w * 0.3, rv.w * 0.25, 0, TAU); c.fill();
  c.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 04 — macro: streams of liquid metal running over the spacecraft's skin
function buildStreams2() {
  const R = rng(404);
  const out = [];
  for (let i = 0; i < 9; i++) {
    const x0 = -700 + i * 170 + (R() - 0.5) * 80;
    const pts = [];
    let x = x0, y = 520 + R() * 120;
    for (let k = 0; k < 120; k++) {
      x += noise.n2(i * 2.3, k * 0.08) * 5 + 1.2;
      y -= 7;
      pts.push([x, y]);
    }
    out.push({ pts, w: 7 + R() * 9, speed: 260 + R() * 160, delay: R() * 1.6, hero: i === 4 });
  }
  return out;
}
const SKY_R = 2600; // radius of the sphere's limb in macro world units
const s04 = {
  id: 'p7-04-metal', start: 992.30, end: 996.70,
  post: { bloom: 0.5, bloomThreshold: 0.72, vignette: 0.5, contrast: 1.08, highTint: [0.07, 0.03, 0], ca: 0.0015 },
  init(S) {
    S.state.streams = buildStreams2();
    S.state.skin = tex.concrete('#3A2C24', { w: 800, h: 500, seed: 19 });
  },
  render(ctx, t, S) {
    const tSt = L(S, T.streams), tRun = L(S, T.running);
    const cam = new Cam25({
      x: kf(t, [[0, -160], [4.4, 260, E.inOut]]), y: kf(t, [[0, 60], [4.4, -40, E.inOut]]),
      z: kf(t, [[0, -900], [4.4, -1060, E.inOut]]), f: 1000, focus: 0, aperture: 1.6, rot: -0.08,
    });
    const hh = handheld(t, 4, 0.9, 41);
    cam.x += hh.x; cam.y += hh.y;
    // beyond the limb: the plasma river
    emberGround(ctx, t, { cx: 960, cy: 120, heat: 1, base: '#4A1408' });
    cam.plane(ctx, 900, (c) => {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const R = rng(77);
      for (let i = 0; i < 40; i++) {
        const life = 0.6 + R() * 0.4;
        const u = (((t * 1.2 + R() * life) % life) + life) % life / life;
        const x = -1800 + u * 3800 + (R() - 0.5) * 300, y = -900 + R() * 700;
        const Ls = 500 + R() * 600;
        c.globalAlpha = 0.4 * Math.sin(Math.PI * u);
        c.save(); c.translate(x, y); c.rotate(-0.25);
        c.drawImage(flameSprite([C.fire5, C.fire4, C.plasma0, C.plasma1][i % 4], (i % 4) + 1), -Ls * 0.2, -Ls * 0.15, Ls, Ls * 0.3);
        c.restore();
      }
      c.restore();
    });
    // the skin: a huge curved surface; limb arc across the upper third
    cam.plane(ctx, 0, (c) => {
      const cy = -360 + SKY_R;
      c.save();
      c.beginPath(); c.arc(0, cy, SKY_R, 0, TAU); c.clip();
      c.fillStyle = '#2A1E19'; c.fillRect(-2400, -800, 4800, 2400);
      c.globalAlpha = 0.9; c.globalCompositeOperation = 'multiply';
      const pat = c.createPattern(S.state.skin, 'repeat'); pat.setTransform(new DOMMatrix().scale(1.4));
      c.fillStyle = pat; c.fillRect(-2400, -800, 4800, 2400);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      // hot leading light raking across from the limb
      const lg = c.createLinearGradient(0, -360, 0, 700);
      lg.addColorStop(0, rgba(C.fire3, 0.85)); lg.addColorStop(0.12, rgba(C.plasma0, 0.45)); lg.addColorStop(0.5, rgba(C.fire1, 0.12)); lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = lg; c.fillRect(-2400, -800, 4800, 2400);
      c.globalCompositeOperation = 'source-over';
      // the melting strap: a metal band crossing the skin
      c.fillStyle = '#4E4A46';
      c.beginPath(); c.moveTo(-2400, 640); c.lineTo(2400, 520); c.lineTo(2400, 600); c.lineTo(-2400, 720); c.closePath(); c.fill();
      const sg = c.createLinearGradient(0, 520, 0, 720);
      sg.addColorStop(0, rgba(C.fire4, 0.0)); sg.addColorStop(0.4, rgba(C.fire4, 0.6 * tw(t, tSt - 0.8, tSt + 0.5))); sg.addColorStop(1, rgba(C.fire2, 0.1));
      c.globalCompositeOperation = 'lighter'; c.fillStyle = sg;
      c.beginPath(); c.moveTo(-2400, 640); c.lineTo(2400, 520); c.lineTo(2400, 600); c.lineTo(-2400, 720); c.closePath(); c.fill();
      c.restore();
      // streams of liquid metal running up toward the limb
      for (const st of S.state.streams) {
        const t0 = tSt - 0.4 + st.delay * 0.9;
        const head = (t - t0) * st.speed;
        if (head <= 0) continue;
        drawMetalStream(c, st, head, t);
      }
      // limb rim light
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(C.fire5, 0.7); c.lineWidth = 10;
      c.beginPath(); c.arc(0, cy, SKY_R, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); c.stroke();
      c.strokeStyle = rgba(C.plasma0, 0.35); c.lineWidth = 50;
      c.beginPath(); c.arc(0, cy, SKY_R + 20, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); c.stroke();
      c.restore();
    });
    // droplets tearing off the limb as embers
    const dk = tw(t, tSt, tRun, E.out);
    embers(ctx, t, { x: 960, y: 260, w: 1600, h: 200, ang: -0.35, speed: 700, count: 70, seed: 44, k: dk, size: [2, 5], stretch: 0.05 });
    // foreground blurred skin lip (depth)
    cam.plane(ctx, -400, (c) => {
      c.fillStyle = '#140D0A';
      c.beginPath(); c.ellipse(-300, 1150, 1700, 320, -0.05, 0, TAU); c.fill();
    });
    heatWarp(ctx, t, { y0: 120, y1: 560, amp: 3, speed: 8 });
  },
};
function drawMetalStream(c, st, head, t) {
  const pts = st.pts;
  const n = Math.min(pts.length - 1, Math.floor(head / 7));
  if (n < 1) return;
  const w = st.w;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // pooled glow under the stream
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(C.fire2, 0.35); c.lineWidth = w * 3.5;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= n; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
  // molten body: wobbling width (bulges travel along)
  for (let i = 1; i <= n; i++) {
    const bul = 1 + 0.35 * Math.sin(i * 0.5 - t * 14);
    c.strokeStyle = ramp([[0, C.fire3], [0.6, C.fire4], [1, C.fire5]], clamp(i / n));
    c.lineWidth = w * bul;
    c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
  }
  // specular highlight thread
  c.strokeStyle = 'rgba(255,252,240,.95)'; c.lineWidth = Math.max(1.2, w * 0.22);
  c.beginPath(); c.moveTo(pts[0][0] - w * 0.2, pts[0][1]); for (let i = 1; i <= n; i++) c.lineTo(pts[i][0] - w * 0.2, pts[i][1]); c.stroke();
  // head bead
  const h = pts[n];
  c.fillStyle = C.fire5;
  c.beginPath(); c.ellipse(h[0], h[1], w * 0.9, w * 1.3, 0, 0, TAU); c.fill();
  c.restore();
}

export const infernoScenes2 = [s03, s04];


