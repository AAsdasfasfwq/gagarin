// 30.22–38.06 · An orbit is drawn for people — it snaps into a ballistic arc → INTERCONTINENTAL BALLISTIC MISSILES
import { clamp, lerp, E, tw, kf, rng, noise, TAU, handheld, shake, polyAt } from '../../../core/math.js';
import { C, rgba, shade, mixColor } from '../../../core/palette.js';
import { F, setText, staggerText } from '../../../core/type.js';
import { tex, glow, shadeSphere, inkLine } from '../../../core/draw.js';
import { leadKey } from '../../../core/components.js';
import { loadGeo, ortho } from '../../../core/geo.js';
import { slideWord, tag, motes, env, W, H } from '../lib.js';

const EX = 720, EY = 800, ER = 290;           // Earth (polar view)
const OX = 720, OY = 700, ORX = 560, ORY = 240, OROT = -0.06; // orbit ellipse
const N = 120;
const ellipseAt = (u) => { // u 0..1 starting at the right side, going over the top (counter-clockwise on screen)
  const a = -u * TAU;
  const x = Math.cos(a) * ORX, y = Math.sin(a) * ORY;
  return [OX + x * Math.cos(OROT) - y * Math.sin(OROT), OY + x * Math.sin(OROT) + y * Math.cos(OROT)];
};

export default {
  id: 'p1-03-orbit',
  start: 30.22, end: 38.06,
  transition: { type: 'zoom', dur: 0.6, center: [0.62, 0.45] },
  post: (t, S) => ({ contrast: 1.06, saturation: 0.9, bloom: 0.2 + 0.3 * env(S.abs, 35.3, 35.5, 35.7, 36.6), bloomThreshold: 0.8, vignette: 0.36 }),
  async init(S) { S.state.G = await loadGeo('110m'); },
  render(ctx, t, S) {
    const T = S.abs;
    const G = S.state.G;
    const hh = handheld(T, 3, 0.3, 7);
    const sk = shake(T, 35.55, 10, 4.5);
    // ground
    const g0 = ctx.createRadialGradient(960, 600, 0, 960, 600, 1250);
    g0.addColorStop(0, '#18253A'); g0.addColorStop(0.6, C.ink); g0.addColorStop(1, C.inkDeep);
    ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(tex.stars({ seed: 21, count: 700, big: 18 }), 0, 0);
    ctx.save();
    const z = kf(T, [[30.2, 1.18], [32.4, 1.0, E.out], [37.0, 1.05], [38.6, 1.12]]);
    ctx.translate(960 + hh.x + sk.x, 600 + hh.y + sk.y); ctx.scale(z, z); ctx.translate(-960, -600);

    // ── Earth (polar war-room view, continuity with the opening) ──
    const lon0 = -12 + (T - 30) * 0.6;
    const proj = ortho({ cx: EX, cy: EY, r: ER, lon0, lat0: 72 });
    glow(ctx, EX, EY, ER * 1.4, C.halo, 0.12);
    ctx.beginPath(); ctx.arc(EX, EY, ER, 0, TAU);
    shadeSphere(ctx, EX, EY, ER, '#1A2C40', { rim: C.halo, spec: 0.06 });
    ctx.save();
    ctx.beginPath(); ctx.arc(EX, EY, ER, 0, TAU); ctx.clip();
    ctx.globalAlpha = 0.15; ctx.strokeStyle = C.steelLight; ctx.lineWidth = 0.8;
    ctx.beginPath(); for (let y = EY - ER; y < EY + ER; y += 4.5) { ctx.moveTo(EX - ER, y); ctx.lineTo(EX + ER, y); } ctx.stroke();
    ctx.globalAlpha = 1;
    G.draw(ctx, proj, { fill: '#55697A' });
    G.draw(ctx, proj, { rings: G.ussr, fill: rgba(C.red, 0.55) });
    G.draw(ctx, proj, { rings: G.usa, fill: rgba('#9FB7C9', 0.5) });
    G.draw(ctx, proj, { stroke: 'rgba(8,14,22,.5)', width: 0.8 });
    const tg = ctx.createRadialGradient(EX - ER * 0.4, EY - ER * 0.5, ER * 0.2, EX, EY, ER * 1.05);
    tg.addColorStop(0, 'rgba(255,250,240,0.1)'); tg.addColorStop(0.6, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(4,8,16,0.6)');
    ctx.fillStyle = tg; ctx.fillRect(EX - ER, EY - ER, ER * 2, ER * 2);
    ctx.restore();

    // launch & target points
    const L = proj(63.3, 45.9), Tg = proj(-77, 38.9);
    // ── 1) a rocket climbs from the launch site to orbit (30.4–31.9) ──
    const climbPts = [];
    const ins = ellipseAt(0.0);
    for (let i = 0; i <= 40; i++) { const u = i / 40; climbPts.push([lerp(L.x, ins[0], u) + Math.sin(u * Math.PI) * 40, lerp(L.y, ins[1], E.outSine(u)) - Math.sin(u * Math.PI) * 30]); }
    const cp = tw(T, 30.5, 31.9, E.inOutCubic);
    const fadeClimb = 1 - tw(T, 32.6, 33.4);
    if (cp > 0 && fadeClimb > 0) {
      ctx.save(); ctx.globalAlpha = fadeClimb * 0.8;
      inkLine(ctx, climbPts, cp, { width: 2.2, color: C.cream, dash: [6, 7], seed: 3 });
      ctx.restore();
    }
    // ── 2) the orbit is drawn by the capsule (31.6–33.0) then 3) snaps into a ballistic arc ──
    const op = tw(T, 31.7, 33.0, E.inOutSine); // drawn fraction of the ellipse
    const m = tw(T, 33.05, 34.3, E.inOutCubic); // morph to ballistic arc
    const arcPts = [], orbPts = [];
    const apex = { x: (L.x + Tg.x) / 2, y: 180 };
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      orbPts.push(ellipseAt(u * 0.5)); // upper half (right → left over the top)
      const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      arcPts.push([a * L.x + b * apex.x + c * Tg.x, a * L.y + b * (apex.y * 2 - (L.y + Tg.y) / 2) + c * Tg.y]);
    }
    const lower = []; for (let i = 0; i <= N; i++) lower.push(ellipseAt(0.5 + (i / N) * 0.5));
    const pts = orbPts.map((p, i) => [lerp(p[0], arcPts[i][0], m) + Math.sin(m * Math.PI) * noise.n2(i * 0.2, 3) * 18, lerp(p[1], arcPts[i][1], m)]);
    // travelling head: capsule → warhead
    const travel = T < 33.0 ? op * 0.5 : 0; // fraction of whole ellipse
    if (op > 0) {
      // upper half
      const upP = m > 0 ? 1 : clamp(op * 2);
      const flightU = tw(T, 34.1, 35.55, E.inQuad); // warhead flight along the arc
      ctx.save();
      ctx.globalAlpha = 0.25; ctx.globalCompositeOperation = 'lighter';
      inkLine(ctx, pts, m > 0 ? 1 : upP, { width: 9, color: m > 0.5 ? '#E05A40' : '#8FB8D8', wobble: 0.3, taper: false, seed: 2 });
      ctx.restore();
      inkLine(ctx, pts, m > 0 ? 1 : upP, { width: 3, color: mixColor(C.cream, '#FFC9BC', m), seed: 5, taper: false });
      // lower half: drawn, then crumbles away
      const lowP = clamp(op * 2 - 1);
      const crumble = tw(T, 33.0, 33.9);
      if (lowP > 0 && crumble < 1) {
        const lp = lower.map(([x, y], i) => [x, y + crumble * crumble * (60 + noise.n2(i * 0.3, 1) * 50)]);
        ctx.save(); ctx.globalAlpha = 1 - crumble;
        inkLine(ctx, lp, lowP, { width: 3, color: C.cream, seed: 6, taper: false, dash: crumble > 0 ? [14, 8 + crumble * 30] : null });
        ctx.restore();
      }
      // the head
      let hp, col, isWar = false;
      if (T < 33.0) { hp = op < 0.5 ? polyAt(pts, op * 2) : polyAt(lower, op * 2 - 1); col = C.orange; }
      else if (T < 34.1) { hp = polyAt(pts, m > 0.5 ? 0 : 1); hp = { x: lerp(pts[N][0], pts[0][0], m), y: lerp(pts[N][1], pts[0][1], m), a: 0 }; col = mixColor(C.orange, C.red, m); isWar = m > 0.5; }
      else { hp = polyAt(pts, flightU); col = C.red; isWar = true; }
      const alive = 1 - tw(T, 35.55, 35.6);
      if (alive > 0) {
        glow(ctx, hp.x, hp.y, 34, col, 0.7);
        ctx.save(); ctx.translate(hp.x, hp.y);
        if (isWar && T >= 34.1) {
          ctx.rotate(hp.a);
          ctx.fillStyle = '#F2E6D6';
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.quadraticCurveTo(0, -8, -10, -7); ctx.lineTo(-10, 7); ctx.quadraticCurveTo(0, 8, 14, 0); ctx.fill();
          ctx.fillStyle = C.red; ctx.fillRect(-10, -7, 4, 14);
        } else {
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU);
          shadeSphere(ctx, 0, 0, 9, '#D9D2C4', { spec: 0.5 });
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(2, -1, 3.2, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      // snap flash at the break point
      const sn = env(T, 32.95, 33.05, 33.1, 33.7);
      if (sn > 0) { const p = lower[0]; glow(ctx, p[0], p[1], 90, C.cream, 0.8 * sn); }
    }
    // impact flash on the far continent
    const imp = tw(T, 35.55, 36.8, E.out);
    if (imp > 0 && imp < 1) {
      glow(ctx, Tg.x, Tg.y, 60 + imp * 160, C.fire5, 0.95 * (1 - imp));
      glow(ctx, Tg.x, Tg.y, 90 + imp * 260, C.fire2, 0.5 * (1 - imp));
      ctx.strokeStyle = rgba(C.fire4, 0.8 * (1 - imp)); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(Tg.x, Tg.y, 10 + imp * 170, (10 + imp * 170) * 0.55, 0, 0, TAU); ctx.stroke();
    }
    if (imp >= 1 || imp > 0.3) { ctx.fillStyle = rgba(C.fire2, 0.6 * tw(T, 35.7, 36.2)); ctx.beginPath(); ctx.arc(Tg.x, Tg.y, 6, 0, TAU); ctx.fill(); }
    ctx.restore();

    // tags
    tag(ctx, T - 32.24, 'ORBIT', 1330, 640, { size: 26, color: C.cream, accent: C.orange, alpha: 1 - tw(T, 32.9, 33.2) });
    motes(ctx, T, { count: 40, seed: 9, color: '#DDE8F0', alpha: 0.22, speed: 5 });

    // ── typography ──
    // not for SCIENCE — the key cracks and drops when the orbit snaps
    {
      const cr = tw(T, 34.4, 34.9, E.in);
      if (T > 33.1 && cr < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - cr;
        staggerText(ctx, 'not developed for', 1790, 214, T - 33.2, { family: F.SERIF, size: 44, italic: true, color: rgba(C.cream, 0.9), stagger: 0.025, dur: 0.45, align: 'right' });
        const kp = tw(T, 33.85, 34.4, E.linear);
        ctx.translate(0, cr * 40);
        slideWord(ctx, 'SCIENCE', 1790, 340, kp, { size: 130, align: 'right', color: C.cream, tracking: 4 });
        ctx.restore();
      }
    }
    // INTERCONTINENTAL / BALLISTIC / MISSILES
    {
      const words = [['INTERCONTINENTAL', 35.88, C.cream], ['BALLISTIC', 36.76, C.cream], ['MISSILES', 37.24, '#FF6A55']];
      const out = tw(T, 38.0, 38.4, E.in);
      if (T > 34.9) staggerText(ctx, 'they were built as', 1790, 160, T - 35.0, { family: F.SERIF, size: 40, italic: true, color: rgba(C.cream, 0.9 * (1 - out)), stagger: 0.025, dur: 0.45, align: 'right' });
      words.forEach(([w, at, col], i) => {
        slideWord(ctx, w, 1790, 262 + i * 98, tw(T, at - 0.05, at + 0.45, E.linear), { size: 104, align: 'right', color: col, tracking: 3, out });
      });
    }
  },
};
