// S03 · 320.86–331.80 · "Its exterior was covered in a thick layer of ablative protection, a special
// material designed to melt and vaporize during re-entry, carrying away the extraordinary excess heat."
// 3D: a wedge slice lifts out of the sphere (exploded view) revealing the shell layers; the camera
// pushes into the cut face. 2D macro: plasma flows over the coat, it chars, bubbles, melts, vaporizes;
// the vapour stream carries the heat (and the word HEAT) away while the inside stays cool.
import { E, kf, clamp, lerp, rng, noise, TAU } from '../../../core/math.js';
import { C, rgba, ramp, PLASMA_RAMP, FIRE_RAMP } from '../../../core/palette.js';
import { F, setText, staggerText } from '../../../core/type.js';
import { glow, makeCanvas, cached, tintedSmoke, tex } from '../../../core/draw.js';
import { callout } from '../../../core/components.js';
import { R3, THREE, canvasTexture } from '../../../core/three.js';
import { blueprintBg, ablativeTex, at, env, W, H } from '../lib.js';

const T0 = 320.86;
const GAP_C = (3 * Math.PI) / 4, GAP_W = 1.75;
const dir = (phi) => new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));

function fibreTex(base = '#3A2E27') {
  return canvasTexture((c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    // concentric laminations (follow the shell in ring UV space)
    for (let r = w * 0.43; r < w * 0.5; r += 2.2) {
      c.strokeStyle = `rgba(${120 + noise.n2(r, 1) * 60},${95 + noise.n2(r, 2) * 40},${80},${0.25 + 0.2 * noise.n2(r * 0.3, 5)})`;
      c.lineWidth = 1 + Math.abs(noise.n2(r, 9)) * 1.5;
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    }
    const img = c.getImageData(0, 0, w, h); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (noise.n2((i / 4) % w / 3, Math.floor(i / 4 / w) / 3) * 0.5 + 0.5) * 30 - 15; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    c.putImageData(img, 0, 0);
  }, 1024, 1024);
}

function buildShell() {
  const root = new THREE.Group();
  const body = new THREE.Group(), wedge = new THREE.Group();
  root.add(body, wedge);
  const abl = canvasTexture((c, w, h) => { c.drawImage(ablativeTex(), 0, 0, w, h); c.drawImage(ablativeTex(), w / 2, 0, w / 2, h); }, 1024, 512);
  const skin = new THREE.MeshStandardMaterial({ map: abl, roughness: 0.9, metalness: 0.08, color: 0xd6ccc4 });
  const ablCut = new THREE.MeshStandardMaterial({ map: fibreTex(), roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const hullCut = new THREE.MeshStandardMaterial({ color: 0xc9d2d6, roughness: 0.25, metalness: 0.95, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  const insCut = new THREE.MeshStandardMaterial({ color: 0x8c7d58, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0x3c4a4e, roughness: 0.8, metalness: 0.1, side: THREE.BackSide });
  const layers = [[1.0, 1.15, ablCut], [0.982, 1.0, hullCut], [0.95, 0.982, insCut]];
  const add = (grp, phiStart, phiLen, faces) => {
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 96, 64, phiStart, phiLen), skin));
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 64, 48, phiStart, phiLen), inner));
    for (const phi of faces) for (const [r0, r1, m] of layers) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96, 1, -Math.PI / 2, Math.PI), m);
      ring.rotation.y = Math.PI + phi;
      grp.add(ring);
    }
  };
  const p1 = GAP_C - GAP_W / 2, p2 = GAP_C + GAP_W / 2;
  add(body, p2, TAU - GAP_W, [p1, p2]);
  add(wedge, p1, GAP_W, [p1, p2]);
  return { root, body, wedge, p1, p2 };
}

// cached plasma streak texture (scrolled each frame)
function plasmaStreaks() {
  return cached('p3:plasmaStreaks', () => {
    const w = 1024, h = 256;
    const { c, ctx } = makeCanvas(w, h);
    const img = ctx.createImageData(w, h); const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = noise.fbm2(x / 260, y / 18, 4) * 0.5 + 0.5;
      const v = Math.pow(clamp(n * 1.3 - 0.15), 2.2);
      const col = ramp(PLASMA_RAMP, 0.3 + v * 0.7);
      const i = (y * w + x) * 4;
      d[i] = parseInt(col.slice(1, 3), 16); d[i + 1] = parseInt(col.slice(3, 5), 16); d[i + 2] = parseInt(col.slice(5, 7), 16); d[i + 3] = 255 * clamp(v * 1.4);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}
function laminateTex() {
  return cached('p3:laminate', () => {
    const w = 1024, h = 512;
    const { c, ctx } = makeCanvas(w, h);
    ctx.fillStyle = '#33281F'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      ctx.strokeStyle = `rgba(${110 + noise.n2(y, 1) * 50},${86 + noise.n2(y, 2) * 30},70,${0.18 + 0.18 * Math.abs(noise.n2(y * 0.2, 5))})`;
      ctx.lineWidth = 1 + Math.abs(noise.n2(y, 9)) * 2;
      ctx.beginPath(); for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + noise.n2(x / 200, y / 40) * 3); ctx.stroke();
    }
    const r = rng(5);
    for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(20,14,10,${r() * 0.5})`; ctx.fillRect(r() * w, r() * h, 2 + r() * 10, 1 + r() * 2); }
    return c;
  });
}

// macro section geometry (screen space)
const SURF = (x, rec) => 400 + Math.pow((x - 960) / 1000, 2) * 140 + rec;
const THICK = 250;

function drawMacro(ctx, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const heat = at(a, 325.0, 326.4, E.inOut) * (1 - 0.35 * at(a, 330.6, 331.8));
  const rec = 46 * at(a, 326.4, 331.6, E.inOutSine);
  // outside: dark → plasma flow
  ctx.fillStyle = '#12080A'; ctx.fillRect(0, 0, W, H);
  const ps = plasmaStreaks();
  const off = (a * 900) % 1024;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = alpha * heat * (0.7 - k * 0.2);
    const yy = 230 + k * 50;
    const o2 = (off * (1 + k * 0.35) + k * 377) % 1024;
    for (let x = -o2; x < W; x += 1024) ctx.drawImage(ps, x, yy, 1024, 200 - k * 30);
  }
  ctx.restore();
  { const dg = ctx.createLinearGradient(0, 0, 0, 420); dg.addColorStop(0, 'rgba(18,8,10,1)'); dg.addColorStop(0.55, 'rgba(18,8,10,.75)'); dg.addColorStop(1, 'rgba(18,8,10,0)'); ctx.fillStyle = dg; ctx.fillRect(0, 0, W, 420); }
  // shock glow along the surface
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createLinearGradient(0, 160, 0, SURF(960, rec) + 10);
  sg.addColorStop(0, 'rgba(255,90,40,0)'); sg.addColorStop(0.75, `rgba(255,120,50,${0.35 * heat})`); sg.addColorStop(1, `rgba(255,220,160,${0.7 * heat})`);
  ctx.fillStyle = sg; ctx.fillRect(0, 160, W, SURF(960, rec) - 150);
  ctx.restore();
  // band path
  const band = new Path2D();
  band.moveTo(0, SURF(0, rec));
  for (let x = 0; x <= W; x += 40) band.lineTo(x, SURF(x, rec) + noise.n2(x / 90, a * 0.6) * 4 * heat);
  band.lineTo(W, SURF(W, 0) + THICK); for (let x = W; x >= 0; x -= 40) band.lineTo(x, SURF(x, 0) + THICK);
  band.closePath();
  // interior below (cool)
  const yIn = SURF(960, 0) + THICK;
  const ig = ctx.createLinearGradient(0, yIn, 0, H);
  ig.addColorStop(0, '#2E4A57'); ig.addColorStop(1, '#0D1A24');
  ctx.fillStyle = ig; ctx.fillRect(0, yIn - 30, W, H - yIn + 30);
  // insulation + hull follow the curve
  const strip = (y0, h, fill) => { ctx.beginPath(); ctx.moveTo(0, SURF(0, 0) + y0); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, SURF(x, 0) + y0); for (let x = W; x >= 0; x -= 40) ctx.lineTo(x, SURF(x, 0) + y0 + h); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  strip(THICK + 22, 46, '#7E6F4C');
  const hg = ctx.createLinearGradient(0, SURF(960, 0) + THICK, 0, SURF(960, 0) + THICK + 28);
  hg.addColorStop(0, '#C9D2D6'); hg.addColorStop(0.5, '#7A868C'); hg.addColorStop(1, '#4A555B');
  strip(THICK, 24, hg);
  // cool inner glow (inside stays cool)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createLinearGradient(0, yIn + 80, 0, H);
  cg.addColorStop(0, `rgba(111,195,227,${0.14})`); cg.addColorStop(1, 'rgba(111,195,227,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, yIn + 60, W, H - yIn);
  ctx.restore();
  // ablative laminate
  ctx.save();
  ctx.clip(band);
  ctx.drawImage(laminateTex(), 0, SURF(960, 0) - 120, W, THICK + 220);
  // heat penetration (shallow!): stacked strokes along the surface, clipped to the coat
  ctx.globalCompositeOperation = 'lighter';
  const surfPath = new Path2D();
  for (let x = -40; x <= W + 40; x += 20) (x < -30 ? surfPath.moveTo(x, SURF(x, rec)) : surfPath.lineTo(x, SURF(x, rec)));
  ctx.lineJoin = 'round';
  [[200, 'rgba(140,30,4,', 0.22], [120, 'rgba(220,70,20,', 0.3], [56, 'rgba(255,150,60,', 0.45], [18, 'rgba(255,225,170,', 0.7]].forEach(([w, c, al]) => {
    ctx.strokeStyle = c + (al * heat) + ')'; ctx.lineWidth = w; ctx.stroke(surfPath);
  });
  ctx.globalCompositeOperation = 'source-over';
  // char crust
  ctx.strokeStyle = `rgba(14,8,6,${0.9 * heat})`; ctx.lineWidth = 10;
  ctx.beginPath(); for (let x = 0; x <= W; x += 30) ctx.lineTo(x, SURF(x, rec) + 4 + noise.n2(x / 50, 3) * 3); ctx.stroke();
  ctx.restore();
  // bubbles / blisters on the surface
  const r = rng(11);
  for (let i = 0; i < 70; i++) {
    const bx = r() * W, birth = 325.6 + r() * 5.8, life = 0.5 + r() * 0.7, sz = 4 + r() * 12;
    const u = (a - birth) / life;
    if (u < 0 || u > 1) continue;
    const by = SURF(bx, rec) - sz * 0.4 * u;
    ctx.beginPath(); ctx.arc(bx + u * 30, by, sz * Math.sin(u * Math.PI) + 1, 0, TAU);
    ctx.fillStyle = `rgba(255,${180 + r() * 60},120,${0.75 * heat})`; ctx.fill();
    ctx.strokeStyle = `rgba(60,20,10,${0.6 * heat})`; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // melt droplets swept along the flow (from 326.8)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) {
    const x0 = r() * W, birth = 326.7 + r() * 4.9, life = 0.9 + r() * 0.8;
    const u = (a - birth) / life;
    if (u < 0 || u > 1) continue;
    const x = x0 + u * 420 * (0.6 + r()), y = SURF(x0, rec) - 6 - u * 40 * r() + Math.sin(u * 6 + i) * 4;
    const s = (3 + r() * 5) * (1 - u * 0.5);
    ctx.strokeStyle = `rgba(255,${150 + r() * 80},70,${0.8 * (1 - u)})`; ctx.lineWidth = s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 40 * (0.5 + u), y + 3); ctx.lineTo(x, y); ctx.stroke();
  }
  ctx.restore();
  // vapour plumes rising + swept right (from 327.3), carrying glow away
  const vap = at(a, 327.2, 328.2);
  if (vap > 0) {
    for (let i = 0; i < 26; i++) {
      const x0 = 80 + r() * 1700, birth = 327.2 + r() * 4.4, life = 1.6 + r() * 1.2;
      const u = (a - birth) / life;
      if (u < 0 || u > 1) continue;
      const x = x0 + u * 700, y = SURF(x0, rec) - 20 - u * 230;
      const sz = 120 + u * 260;
      const hot = 1 - u;
      ctx.save();
      ctx.globalAlpha = alpha * vap * Math.sin(u * Math.PI) * 0.5;
      ctx.translate(x, y); ctx.rotate(i + u);
      ctx.drawImage(tintedSmoke(hot > 0.5 ? '#FFB070' : '#B9A49A', 22), -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
    // hot motes leaving
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) {
      const x0 = r() * W, birth = 327.6 + r() * 4.2, life = 1.2 + r();
      const u = (a - birth) / life;
      if (u < 0 || u > 1) continue;
      const x = x0 + u * 900, y = SURF(x0, rec) - 10 - u * (120 + r() * 220);
      ctx.globalAlpha = alpha * (1 - u) * 0.9;
      ctx.fillStyle = ramp(FIRE_RAMP, 0.95 - u * 0.5);
      ctx.beginPath(); ctx.arc(x, y, 1.5 + r() * 2.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

export const s03 = {
  id: 'p3-03-ablative', start: T0, end: 331.80,
  transition: { type: 'zoom', dur: 0.6, center: [0.44, 0.46] },
  post: (t) => ({ bloom: t > 4.2 ? 0.55 : 0.22, bloomThreshold: t > 4.2 ? 0.62 : 0.85, vignette: 0.42 }),
  init(S) {
    const scene = new THREE.Scene();
    scene.environment = R3.env;
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 100);
    const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(-5, 7, 6);
    const fill = new THREE.DirectionalLight(0x86b4dc, 0.8); fill.position.set(7, 0, 5);
    const rim = new THREE.DirectionalLight(0x9cd6ff, 2.2); rim.position.set(3, 4, -8);
    const into = new THREE.PointLight(0xffe2b8, 6, 6, 1.5); into.position.set(1.4, 0.8, 1.4);
    scene.add(key, fill, rim, into, new THREE.AmbientLight(0xffffff, 0.15));
    const sh = buildShell();
    scene.add(sh.root);
    Object.assign(S.state, { scene, cam, sh });
  },
  render(ctx, t, S) {
    const a = T0 + t;
    const { scene, cam, sh } = S.state;
    const macro = at(a, 325.0, 325.5, E.inOut);
    if (macro < 1) {
      // 3D: wedge lifts out, camera orbits into the cut and pushes onto the cut face
      const out = at(a, 321.2, 323.0, E.inOutCubic);
      const wdir = new THREE.Vector3(1.0, 0.62, 0.25);
      sh.wedge.position.copy(wdir.multiplyScalar(out * 3.2));
      sh.wedge.rotation.set(out * 0.5, out * 0.6, -out * 0.3);
      sh.wedge.visible = out < 0.98;
      const az = kf(a, [[T0, 0.15], [323.0, 0.55, E.cam], [325.1, 1.05, E.inOut]]);
      const el = kf(a, [[T0, 0.12], [323.0, 0.32, E.cam]]);
      const dist = kf(a, [[T0, 7.6], [322.0, 7.2], [323.4, 6.6, E.cam], [325.3, 1.7, E.inCubic]]);
      const tgt = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), dir(sh.p1).multiplyScalar(0.8).add(new THREE.Vector3(0, 0.62, 0)), at(a, 323.6, 325.2, E.inOut));
      cam.position.set(Math.sin(az) * Math.cos(el) * dist + tgt.x, Math.sin(el) * dist + tgt.y, Math.cos(az) * Math.cos(el) * dist + tgt.z);
      cam.lookAt(tgt);
      cam.updateMatrixWorld();
      sh.root.rotation.y = -0.15 + (a - T0) * 0.03;
      sh.root.updateMatrixWorld();
      blueprintBg(ctx, { ox: az * 120, light: 0.22 });
      ctx.drawImage(R3.render(scene, cam, { exposure: 1.0 }), 0, 0, W, H);
      // callout on the ablative cut face
      const anc = dir(sh.p1).multiplyScalar(1.075 * Math.cos(0.55)).add(new THREE.Vector3(0, 1.075 * Math.sin(0.55), 0)).applyMatrix4(sh.root.matrixWorld).project(cam);
      const ax = (anc.x + 1) / 2 * W, ay = (1 - anc.y) / 2 * H;
      const cOut = 1 - at(a, 324.5, 324.9, E.in);
      if (a > 323.55 && cOut > 0) {
        ctx.save(); ctx.globalAlpha = cOut;
        callout(ctx, a - 323.55, ax, ay, Math.min(1500, ax + 330), ay - 170, 'ABLATIVE COAT', { color: C.cream, accent: C.orange, size: 26, sub: 'thick layer' });
        ctx.restore();
      }
    }
    if (macro > 0) {
      drawMacro(ctx, a, macro);
      // labels, word-synced
      const tag = (str, x, y, t0, t1) => {
        const e = env(a, t0, t0 + 0.4, t1, t1 + 0.4);
        if (e <= 0) return;
        ctx.save(); ctx.globalAlpha = e;
        staggerText(ctx, str, x, y, a - t0, { family: F.SERIF, size: 54, italic: true, color: C.cream, stagger: 0.03, dur: 0.4, shadow: null });
        ctx.restore();
      };
      const lt = env(a, 325.4, 325.9, 331.2, 331.7);
      if (lt > 0) {
        ctx.save(); ctx.globalAlpha = lt;
        setText(ctx, { family: F.MONO, size: 24, weight: 600, color: C.cream, align: 'right', baseline: 'middle', tracking: 3 });
        const bx = 1790, y0 = SURF(1790, 0) + 6, y1 = SURF(1790, 0) + THICK - 6;
        ctx.strokeStyle = rgba(C.cream, 0.8); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bx - 12, y0); ctx.lineTo(bx, y0); ctx.lineTo(bx, y1); ctx.lineTo(bx - 12, y1); ctx.stroke();
        ctx.fillText('[ ABLATIVE COAT ]', bx - 26, (y0 + y1) / 2 + 20);
        ctx.fillStyle = rgba(C.steelLight, 0.9); ctx.fillText('[ HULL ]', bx - 26, y1 + 30);
        ctx.restore();
      }
      tag('melt', 170, 640, 326.75, 329.0);
      tag('& vaporize', 330, 640, 327.3, 329.0);
      // "HEAT" set on the surface, then carried off by the vapour stream
      const hIn = at(a, 329.9, 330.4, E.out);
      if (hIn > 0) {
        const away = at(a, 330.7, 331.8, E.inCubic);
        ctx.save();
        setText(ctx, { family: F.COND, size: 190, weight: 800, color: C.fire4, align: 'left', tracking: 10 });
        const chars = [...'HEAT'];
        let cx = 760;
        chars.forEach((ch, i) => {
          const w = ctx.measureText(ch).width + 10;
          const k = clamp(away * 1.6 - i * 0.18);
          ctx.save();
          ctx.globalAlpha = hIn * (1 - k);
          ctx.globalCompositeOperation = 'lighter';
          ctx.translate(cx + k * (520 + i * 90), SURF(cx, 40) - 30 - k * (160 + i * 40));
          ctx.rotate(-k * 0.3);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
          cx += w;
        });
        ctx.restore();
      }
      // inside stays cool
      const cool = env(a, 329.4, 329.9, 331.3, 331.8);
      if (cool > 0) {
        ctx.save(); ctx.globalAlpha = cool;
        setText(ctx, { family: F.MONO, size: 26, weight: 600, color: C.cyan, align: 'left', baseline: 'middle', tracking: 3 });
        ctx.fillText('[ INSIDE · COOL ]', 140, 900);
        ctx.restore();
      }
    }
  },
};
