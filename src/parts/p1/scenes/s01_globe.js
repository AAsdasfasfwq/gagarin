// 0.00–17.42 · Steel globe → polar standoff → warhead fields → arcs → ash
import { clamp, lerp, E, tw, kf, rng, noise, TAU, handheld, shake } from '../../../core/math.js';
import { C, rgba, shade, mixColor } from '../../../core/palette.js';
import { F, setText, staggerText } from '../../../core/type.js';
import { makeCanvas, cached, scratchCanvas, glow, shadeSphere, tex, blobPoints, smoothPath, inkLine } from '../../../core/draw.js';
import { leadKey } from '../../../core/components.js';
import { loadGeo, ortho, greatCircle } from '../../../core/geo.js';
import { frost, motes, slideWord, env, W, H } from '../lib.js';

const D = Math.PI / 180;
const orthoV = (lon0, lat0) => {
  const sl = Math.sin(lat0 * D), cl = Math.cos(lat0 * D);
  return (lon, lat) => {
    const la = lat * D, lo = (lon - lon0) * D;
    return [Math.cos(la) * Math.sin(lo), cl * Math.sin(la) - sl * Math.cos(la) * Math.cos(lo), sl * Math.sin(la) + cl * Math.cos(la) * Math.cos(lo)];
  };
};
function inRings(rings, lon, lat) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}
// crafted mini missile sprite (points up)
function missileSprite(body, band) {
  return cached(`p1missile:${body}:${band}`, () => {
    const { c, ctx } = makeCanvas(28, 84);
    const cx = 14;
    const g = ctx.createLinearGradient(cx - 6, 0, cx + 6, 0);
    g.addColorStop(0, shade(body, -0.5)); g.addColorStop(0.35, shade(body, 0.35)); g.addColorStop(0.6, body); g.addColorStop(1, shade(body, -0.6));
    // fins
    ctx.fillStyle = shade(body, -0.35);
    ctx.beginPath(); ctx.moveTo(cx - 5, 62); ctx.lineTo(cx - 11, 80); ctx.lineTo(cx - 5, 76); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 5, 62); ctx.lineTo(cx + 11, 80); ctx.lineTo(cx + 5, 76); ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.bezierCurveTo(cx + 5, 10, cx + 6, 18, cx + 6, 26);
    ctx.lineTo(cx + 6, 78); ctx.lineTo(cx - 6, 78); ctx.lineTo(cx - 6, 26);
    ctx.bezierCurveTo(cx - 6, 18, cx - 5, 10, cx, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,10,18,.75)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = band;
    ctx.fillRect(cx - 6, 24, 12, 4);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(cx - 3, 30, 1.5, 44);
    return c;
  });
}
// ── arcs ──
const ARCS = [
  // [from, to, launch, flight]
  [[63.3, 45.9], [-77.0, 38.9], 12.55, 2.0],
  [[-104.8, 41.1], [37.6, 55.75], 12.75, 2.05],
  [[40.6, 62.9], [-74.0, 40.7], 13.05, 1.9],
  [[-101.3, 47.5], [30.3, 59.9], 13.25, 1.85],
  [[56.0, 58.0], [-87.6, 41.9], 13.5, 1.8],
  [[-111.0, 47.5], [82.9, 55.0], 13.7, 1.9],
  [[84.0, 56.0], [-122.3, 47.6], 13.9, 1.75],
  [[-93.5, 38.7], [60.6, 56.8], 14.05, 1.8],
  [[47.0, 52.0], [-96.0, 41.3], 14.25, 1.65],
  [[-97.0, 44.0], [30.5, 50.45], 14.35, 1.75],
  [[104.0, 52.0], [-118.2, 34.0], 14.5, 1.6],
  [[-120.0, 39.0], [44.0, 43.0], 14.6, 1.55],
];

export default {
  id: 'p1-01-globe',
  start: 0.0, end: 17.42,
  post: (t) => ({
    saturation: lerp(0.86, 0.7, tw(t, 15, 17)), contrast: 1.07,
    bloom: 0.22 + 0.4 * (tw(t, 14.2, 14.8) * (1 - tw(t, 16.2, 17.4))), bloomThreshold: 0.78,
    vignette: 0.38, grain: 0.06,
  }),
  async init(S) {
    const G = await loadGeo('110m');
    const r = rng(1961);
    const pts = (rings, n, box, seed) => {
      const out = [];
      const rr = rng(seed);
      let guard = 0;
      while (out.length < n && guard++ < 40000) {
        const lon = lerp(box[0], box[1], rr()), lat = lerp(box[2], box[3], rr());
        if (inRings(rings, lon, lat)) out.push({ lon, lat, k: rr(), s: 0.7 + rr() * 0.5 });
      }
      return out;
    };
    const su = pts(G.ussr, 170, [24, 165, 40, 68], 11);
    const us = pts(G.usa, 120, [-124, -68, 26, 49], 12);
    // ash flakes
    const flakes = Array.from({ length: 260 }, (_, i) => ({ a: r() * TAU, d: Math.sqrt(r()), t0: 15.4 + r() * 2.2, v: 40 + r() * 140, s: 1.2 + r() * 3.5, rot: r() * TAU, w: r() * 2 - 1, ember: r() < 0.18 }));
    Object.assign(S.state, { G, su, us, flakes });
  },
  render(ctx, t, S) {
    const T = S.abs;
    const { G, su, us, flakes } = S.state;
    // ── ground: ink navy with a cold pooled light ──
    const lift = tw(T, 16.3, 18.4, E.inOutCubic); // camera tilts up off the ash globe
    const g0 = ctx.createRadialGradient(1150, 420, 0, 1100, 520, 1300);
    g0.addColorStop(0, mixColor('#1A2638', '#2B2A2A', tw(T, 15, 17)));
    g0.addColorStop(0.55, mixColor(C.ink, '#1E1D1D', tw(T, 15, 17)));
    g0.addColorStop(1, C.inkDeep);
    ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
    // faint engraved horizontal hatch in the ground
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = C.steelLight; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 3; y < H; y += 6) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(tex.stars({ seed: 8, count: 500, big: 10 }), 0, 0);

    // ── camera & projection keys ──
    const hh = handheld(T, 3, 0.3);
    let sh = { x: 0, y: 0 };
    for (const a of ARCS) { const s2 = shake(T, a[2] + a[3], 7, 4.5); sh.x += s2.x; sh.y += s2.y; }
    const rot = kf(T, [[0, 0], [6.3, 0], [8.2, 1, E.cam]]); // 0 = europe view, 1 = polar
    const lon0 = lerp(20, -12, rot) + T * 0.3 * (1 - rot) + (T - 8) * 0.25 * rot;
    const lat0 = lerp(46, 74, rot);
    const R = kf(T, [[0, 560], [6.3, 610], [8.2, 452, E.cam], [13, 462], [17.4, 500]]);
    const cx = kf(T, [[0, 1260], [6.3, 1230], [8.2, 1060, E.cam]]) + hh.x + sh.x;
    const cy = kf(T, [[0, 640], [6.3, 650], [8.2, 560, E.cam]]) + hh.y + sh.y + lift * 760;
    const proj = ortho({ cx, cy, r: R, lon0, lat0 });
    const pv = orthoV(lon0, lat0);
    const P = (lon, lat, alt = 0) => { const v = pv(lon, lat); return { x: cx + v[0] * R * (1 + alt), y: cy - v[1] * R * (1 + alt), z: v[2] }; };

    // halo behind the globe
    glow(ctx, cx, cy, R * 1.45, C.halo, 0.10 * (1 - tw(T, 15, 17)));
    // ── the steel globe ──
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
    shadeSphere(ctx, cx, cy, R, '#1A2C40', { rim: C.halo, spec: 0.08, bounce: 0.1 });
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    // engraved ocean hatching
    ctx.globalAlpha = 0.16; ctx.strokeStyle = C.steelLight; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let y = cy - R; y < cy + R; y += 4.5) { ctx.moveTo(cx - R, y); ctx.lineTo(cx + R, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // graticule
    ctx.strokeStyle = rgba(C.steelLight, 0.16); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lat = -60; lat <= 80; lat += 20) { let pen = false; for (let lon = -180; lon <= 180; lon += 4) { const p = proj(lon, lat); if (!p.v) { pen = false; continue; } pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; } }
    for (let lon = -180; lon < 180; lon += 20) { let pen = false; for (let lat = -80; lat <= 90; lat += 4) { const p = proj(lon, lat); if (!p.v) { pen = false; continue; } pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; } }
    ctx.stroke();
    // land: embossed steel
    ctx.save(); ctx.translate(1.6, 2.2); G.draw(ctx, proj, { fill: 'rgba(4,8,14,.65)' }); ctx.restore();
    G.draw(ctx, proj, { fill: '#55697A' });
    ctx.save();
    G.draw(ctx, proj, {}); ctx.clip('evenodd');
    const pat = ctx.createPattern(tex.metal('#C3D0D6', { seed: 3 }), 'repeat');
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = pat; ctx.globalAlpha = 0.9;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // fine engraving on land (diagonal)
    ctx.strokeStyle = 'rgba(10,18,28,.22)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = -R * 2; k < R * 2; k += 5) { ctx.moveTo(cx + k - R, cy - R); ctx.lineTo(cx + k + R, cy + R); }
    ctx.stroke();
    // USA / USSR territory fills (on their words)
    const usaA = tw(T, 7.98, 8.6), ussrA = tw(T, 9.04, 9.7);
    ctx.restore();
    if (usaA > 0) { ctx.save(); G.draw(ctx, proj, { rings: G.usa }); ctx.clip('evenodd'); ctx.fillStyle = rgba('#9FB7C9', 0.55 * usaA); ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.strokeStyle = rgba('#DCE8F0', 0.25 * usaA); ctx.lineWidth = 1; ctx.beginPath(); for (let k = -R * 2; k < R * 2; k += 7) { ctx.moveTo(cx + k - R, cy + R); ctx.lineTo(cx + k + R, cy - R); } ctx.stroke(); ctx.restore(); }
    if (ussrA > 0) { ctx.save(); G.draw(ctx, proj, { rings: G.ussr }); ctx.clip('evenodd'); ctx.fillStyle = rgba(C.red, 0.62 * ussrA); ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.strokeStyle = rgba('#FF8A70', 0.22 * ussrA); ctx.lineWidth = 1; ctx.beginPath(); for (let k = -R * 2; k < R * 2; k += 7) { ctx.moveTo(cx + k - R, cy + R); ctx.lineTo(cx + k + R, cy - R); } ctx.stroke(); ctx.restore(); }
    // coast emboss
    ctx.save(); ctx.translate(-0.8, -0.8); G.draw(ctx, proj, { stroke: 'rgba(220,232,240,.35)', width: 1 }); ctx.restore();
    G.draw(ctx, proj, { stroke: 'rgba(8,14,22,.55)', width: 0.8 });
    // terminator / volume
    const tg = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.2, cx, cy, R * 1.05);
    tg.addColorStop(0, 'rgba(255,250,240,0.10)'); tg.addColorStop(0.55, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(4,8,16,0.62)');
    ctx.fillStyle = tg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    // ── iron curtain (barbed ink line) ──
    const ICUR = [[10.9, 54.0], [10.8, 53.0], [11.3, 52.2], [10.6, 51.6], [10.0, 50.6], [11.9, 50.3], [12.5, 50.4], [13.8, 48.8], [16.0, 48.6], [16.9, 47.8], [16.1, 46.9], [15.0, 46.5], [13.7, 45.7]];
    const icP = tw(T, 2.98, 4.4, E.inOutCubic) * (1 - tw(T, 6.0, 6.8));
    if (icP > 0) {
      const ip = [];
      for (let i = 0; i < ICUR.length - 1; i++) for (let k = 0; k < 6; k++) { const u = k / 6; const p = P(lerp(ICUR[i][0], ICUR[i + 1][0], u), lerp(ICUR[i][1], ICUR[i + 1][1], u)); ip.push([p.x, p.y]); }
      const last = inkLine(ctx, ip, icP, { width: 3.2, color: C.cream, wobble: 0.6, seed: 4, taper: false });
      // barbs
      ctx.strokeStyle = rgba(C.cream, 0.9); ctx.lineWidth = 1.4;
      const n = Math.floor(ip.length * icP);
      for (let i = 2; i < n; i += 3) { const [x, y] = ip[i]; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke(); }
      if (last) glow(ctx, last.x, last.y, 24, C.cream, 0.5);
    }

    // ── missiles: sprout (thousands), then aim across the pole ──
    const sprout = (T0, list, sprite, aimLon, aimLat) => {
      const aimP = P(aimLon, aimLat);
      const aim = tw(T, 12.0, 12.7, E.inOutCubic);
      const vanish = tw(T, 15.0, 16.2);
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const p = P(m.lon, m.lat);
        if (p.z < 0.05) continue;
        const a = tw(T, T0 + m.k * 1.1, T0 + m.k * 1.1 + 0.35, E.outBack);
        if (a <= 0) continue;
        const up = 0;
        const to = Math.atan2(aimP.y - p.y, aimP.x - p.x) + Math.PI / 2;
        let da = to - up; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const ang = up + da * aim + noise.n2(i, T * 0.8) * 0.03;
        const sc = (0.26 + 0.14 * p.z) * m.s * a * (1 - vanish);
        if (sc <= 0.02) continue;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.scale(sc, sc);
        ctx.globalAlpha = clamp(0.5 + p.z * 0.6);
        ctx.drawImage(sprite, -14, -78);
        ctx.restore();
      }
    };
    if (T > 10.2) {
      sprout(10.34, us, missileSprite('#C9D4DA', '#3B5161'), 60, 55);
      sprout(10.6, su, missileSprite('#D7D0C4', C.red), -95, 42);
    }

    // ── the orange dot (the human, near Moscow) ──
    {
      const p = P(38.1, 55.9);
      const a = (1 - tw(T, 14.6, 15.4)) * (p.z > 0 ? 1 : 0);
      if (a > 0) { glow(ctx, p.x, p.y, 16, C.orange, 0.55 * a); ctx.fillStyle = rgba(C.orange, a); ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, TAU); ctx.fill(); }
    }
    // red pulse at "madness" from Moscow
    {
      const k = tw(T, 5.12, 6.7, E.outCubic);
      if (k > 0 && k < 1) {
        const p = P(37.6, 55.75);
        ctx.strokeStyle = rgba('#FF5A44', (1 - k) * 1.0); ctx.lineWidth = 6 * (1 - k) + 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6 + k * 260, 0, TAU); ctx.stroke();
        ctx.strokeStyle = rgba(C.red, (1 - k) * 0.4); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6 + k * 120, 0, TAU); ctx.stroke();
        glow(ctx, p.x, p.y, 60, C.red, 0.8 * (1 - k));
      }
    }

    const impacts = ARCS.filter((a) => T >= a[2] + a[3]).map((a) => ({ b: a[1], t: a[2] + a[3] }));
    // ── ash: burnt blobs spreading from impacts ──
    if (impacts.length) {
      const blobs = [];
      for (const im of impacts) {
        const p = P(im.b[0], im.b[1]);
        const k = tw(T, im.t, im.t + 3.0, E.outCubic);
        blobs.push({ p, rad: 16 + k * R * 0.6 + tw(T, 15.8, 17.2, E.inCubic) * R * 1.8, t: im.t, seed: im.b[0] * 0.1 });
      }
      const cover = tw(T, 16.4, 17.3);
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, TAU); ctx.clip();
      const path = new Path2D();
      for (const bl of blobs) {
        const pts = blobPoints(bl.p.x, bl.p.y, bl.rad, { n: 22, jitter: 0.3, seed: bl.seed, t: 0 });
        const n = pts.length;
        const m = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
        let q = m(n - 1); path.moveTo(q[0], q[1]);
        for (let i = 0; i < n; i++) { q = m(i); path.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
        path.closePath();
      }
      ctx.save();
      ctx.clip(path, 'nonzero');
      ctx.fillStyle = '#4F4B47'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      G.draw(ctx, proj, { fill: '#6E6962' });
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = ctx.createPattern(tex.grit(0.35, { seed: 9, alpha: 170 }), 'repeat');
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.globalCompositeOperation = 'source-over';
      G.draw(ctx, proj, { stroke: 'rgba(30,26,22,.6)', width: 0.8 });
      const sg = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.2, cx, cy, R * 1.05);
      sg.addColorStop(0, 'rgba(255,240,220,0.08)'); sg.addColorStop(0.6, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(10,8,6,0.6)');
      ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      // ember rim along the union boundary (fill union, cut shrunken union)
      if (cover < 1) {
        const sc = scratchCanvas('p1-ember', 960, 540);
        sc.ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
        const inner = new Path2D();
        for (const bl of blobs) {
          const pts = blobPoints(bl.p.x, bl.p.y, Math.max(1, bl.rad - 7), { n: 22, jitter: 0.3, seed: bl.seed, t: 0 });
          const n = pts.length;
          const m = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
          let q = m(n - 1); inner.moveTo(q[0], q[1]);
          for (let i = 0; i < n; i++) { q = m(i); inner.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
          inner.closePath();
        }
        sc.ctx.fillStyle = C.fire2; sc.ctx.fill(path);
        sc.ctx.globalCompositeOperation = 'destination-out'; sc.ctx.fill(inner);
        sc.ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.9 * (1 - cover);
        ctx.filter = 'blur(4px)';
        ctx.drawImage(sc.c, 0, 0, W, H);
        ctx.filter = 'none';
        ctx.globalAlpha = 0.35 * (1 - cover);
        ctx.drawImage(sc.c, 0, 0, W, H);
        ctx.restore();
      }
      ctx.restore();
      // detonation flashes
      for (const bl of blobs) {
        const k = tw(T, bl.t, bl.t + 0.9, E.out);
        if (k <= 0 || k >= 1) continue;
        glow(ctx, bl.p.x, bl.p.y, 40 + k * 110, C.fire5, 0.95 * (1 - k));
        glow(ctx, bl.p.x, bl.p.y, 70 + k * 180, C.fire3, 0.5 * (1 - k));
        ctx.strokeStyle = rgba(C.fire4, 0.8 * (1 - k)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(bl.p.x, bl.p.y, 10 + k * 150, (10 + k * 150) * (0.4 + 0.6 * bl.p.z), 0, 0, TAU); ctx.stroke();
      }
    }

    // ── ballistic arcs crossing the Arctic ──
    ctx.save();
    for (let j = 0; j < ARCS.length; j++) {
      const [a, b, t0, fl] = ARCS[j];
      const u = clamp((T - t0) / fl);
      if (u <= 0) continue;
      const gc = greatCircle(a, b, 48);
      const pts = gc.map(([lo, la], i) => { const k = i / 48; const p = P(lo, la, 0.3 * Math.sin(Math.PI * k)); return [p.x, p.y]; });
      const fade = 1 - tw(T, t0 + fl + 0.6, t0 + fl + 1.8);
      if (fade <= 0) continue;
      const ue = E.inOutSine(u);
      // soft glow under the ink
      ctx.globalAlpha = 0.25 * fade; ctx.globalCompositeOperation = 'lighter';
      inkLine(ctx, pts, ue, { width: 9, color: j % 2 ? '#7FA6C4' : '#E05A40', wobble: 0.3, seed: j, taper: false });
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade;
      const last = inkLine(ctx, pts, ue, { width: 2.6, color: C.cream, wobble: 0.6, seed: j + 3 });
      ctx.globalAlpha = 1;
      if (last && u < 1) { glow(ctx, last.x, last.y, 22, C.fire4, 0.8); ctx.fillStyle = C.fire5; ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, TAU); ctx.fill(); }
      // launch flash
      const lf = env(T, t0, t0 + 0.08, t0 + 0.1, t0 + 0.6);
      if (lf > 0) { const p = P(a[0], a[1]); glow(ctx, p.x, p.y, 40, C.fire3, 0.7 * lf); }
    }
    ctx.restore();

    // ── flakes of ash lifting off (become the stars of the poster) ──
    if (T > 15.3) {
      ctx.save();
      for (const f of flakes) {
        const age = T - f.t0;
        if (age < 0) continue;
        const x = cx + Math.cos(f.a) * f.d * R * 0.95 + noise.n2(f.rot * 9, T * 0.6) * 30 * age + f.w * age * 20;
        const y = cy + Math.sin(f.a) * f.d * R * 0.95 - age * f.v - age * age * 26;
        const a = clamp(age * 2) * (1 - tw(age, 2.6, 3.4));
        if (a <= 0) continue;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(f.rot + age * f.w * 3);
        ctx.globalAlpha = a;
        if (f.ember) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(C.fire3, 0.8); ctx.fillRect(-f.s * 0.5, -f.s * 0.5, f.s, f.s); }
        else { ctx.fillStyle = mixColor('#8C877F', '#CFC8BC', f.w * 0.5 + 0.5); ctx.fillRect(-f.s, -f.s * 0.6, f.s * 2, f.s * 1.2 * Math.abs(Math.cos(age * 3 + f.rot))); }
        ctx.restore();
      }
      ctx.restore();
    }

    // frost creeping from the edges ("chilling madness") — melts when the arcs fly
    frost(ctx, tw(T, 3.2, 6.2, E.inOutSine) * 0.85 + 0.12 * tw(T, 0, 2), 1 - tw(T, 12.4, 15.0));
    motes(ctx, T, { count: 50, seed: 3, color: '#DDE8F0', alpha: 0.28, speed: 6 });

    // ── typography ──
    const TX = 150;
    // EARLY 60s → COLD WAR
    {
      const o = tw(T, 6.0, 6.5, E.in);
      if (o < 1) {
        ctx.save(); ctx.globalAlpha = 1 - o;
        staggerText(ctx, 'imagine the world of the', TX + 4, 430, T - 0.15, { family: F.SERIF, size: 44, italic: true, color: rgba(C.cream, 0.9), stagger: 0.03, dur: 0.5, mode: 'rise' });
        slideWord(ctx, 'EARLY ’60s', TX, 560, tw(T, 1.25, 1.95, E.linear), { size: 150, align: 'left', color: C.cream, out: tw(T, 2.85, 3.2) });
        slideWord(ctx, 'COLD WAR', TX, 560, tw(T, 3.0, 3.7, E.linear), { size: 150, align: 'left', color: mixColor(C.cream, '#CFE3F2', tw(T, 3.5, 5.5)), tracking: lerp(2, 10, tw(T, 3.1, 6, E.out)) });
        // icy rule
        const rl = tw(T, 3.4, 4.4);
        ctx.fillStyle = rgba(C.steelLight, 0.7); ctx.fillRect(TX + 4, 600, 380 * rl, 2);
        ctx.restore();
      }
    }
    // USA / USSR labels
    const label = (str, lon, lat, at, dx, dy) => {
      const a = tw(T, at, at + 0.4) * (1 - tw(T, 13.4, 14.2));
      if (a <= 0) return;
      const p = P(lon, lat);
      const x = p.x + dx, y = p.y + dy;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = rgba(C.cream, 0.7); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x, y + 8); ctx.stroke();
      ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
      ctx.shadowColor = 'rgba(4,8,14,.8)'; ctx.shadowBlur = 14;
      slideWord(ctx, str, x, y, tw(T, at, at + 0.5, E.linear), { size: 66, color: C.cream, tracking: 6 });
      ctx.restore();
    };
    label('USA', -100, 41, 7.98, -10, -40);
    label('USSR', 95, 61, 9.04, 30, -40);
    // thousands of nuclear WARHEADS
    {
      const o = tw(T, 13.6, 14.1, E.in);
      if (T > 10.2 && o < 1) { ctx.save(); ctx.globalAlpha = 1 - o; leadKey(ctx, T - 10.3, TX, 250, { lead: 'thousands of nuclear', key: 'WARHEADS', size: 120, align: 'left', keyAt: 0.9 }); ctx.restore(); }
    }
    // radioactive ASH
    {
      const o = tw(T, 17.3, 17.8, E.in);
      if (T > 15.7 && o < 1) { ctx.save(); ctx.globalAlpha = 1 - o; leadKey(ctx, T - 15.8, TX, 250, { lead: 'into radioactive', key: 'ASH', size: 150, align: 'left', keyAt: 0.62, family: F.STENCIL, keyColor: '#BDB6AA' }); ctx.restore(); }
    }
  },
};
