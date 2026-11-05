// ─────────────────────────────────────────────────────────────────────────────
// p1/lib.js — local craft helpers for part 1 ("The Arms Race").
// Pure functions of their inputs; heavy textures cached.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, E, tw, rng, noise, TAU, makeNoise } from '../../core/math.js';
import { C, rgba, shade, mixColor } from '../../core/palette.js';
import { F, font, setText } from '../../core/type.js';
import { makeCanvas, cached, scratchCanvas, tex, W, H, poly } from '../../core/draw.js';

export { W, H };

// in/out envelope on absolute time
export const env = (T, a, b, c, d, ein = E.out, eout = E.in) => tw(T, a, b, ein) * (1 - tw(T, c, d, eout));
export const seg = (T, a, b, ease = E.out) => tw(T, a, b, ease);

// ── camera helper: 2D camera around a focus point ───────────────────────────
// fx,fy = world point placed at screen centre (cx,cy); zoom; rot
export function cam2(ctx, { fx = 960, fy = 540, zoom = 1, rot = 0, cx = 960, cy = 540, sx = 0, sy = 0 } = {}) {
  ctx.translate(cx + sx, cy + sy);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-fx, -fy);
}

// ── grounds ──────────────────────────────────────────────────────────────────
// Blueprint sheet: textured paper in blueprint blue with a fine & major grid.
export function blueprintSheet(base = C.blueprint, line = C.blueprintLine, { w = 2600, h = 1600, grid = 40, seed = 3 } = {}) {
  return cached(`p1bp:${base}:${line}:${w}:${h}:${grid}:${seed}`, () => {
    const { c, ctx } = makeCanvas(w, h);
    ctx.drawImage(tex.paper(base, { w: 960, h: 540, seed, fiber: 0.6, stain: 1.2 }), 0, 0, w, h);
    ctx.strokeStyle = rgba(line, 0.07);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += grid) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = 0; y <= h; y += grid) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = rgba(line, 0.13);
    ctx.beginPath();
    for (let x = 0; x <= w; x += grid * 5) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = 0; y <= h; y += grid * 5) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
    // blotches (ammonia print unevenness)
    const nz = makeNoise(seed + 40);
    for (let i = 0; i < 70; i++) {
      const r = rng(seed * 100 + i);
      const x = r() * w, y = r() * h, rr = 80 + r() * 260;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      const a = 0.05 + 0.05 * (nz.n2(x / 300, y / 300) + 1);
      g.addColorStop(0, r() < 0.5 ? `rgba(255,255,255,${a * 0.5})` : `rgba(0,10,25,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    return c;
  });
}
// draw a cached sheet with a camera pan (sheet centred at world 960,540)
export function drawSheet(ctx, sheet, { x = 0, y = 0, zoom = 1 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = sheet.width * zoom, h = sheet.height * zoom;
  ctx.drawImage(sheet, 960 - w / 2 - x * zoom, 540 - h / 2 - y * zoom, w, h);
  ctx.restore();
}
export function vignetteRect(ctx, color = '#000', a = 0.5, inner = 0.45) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(960, 540, 1100 * inner, 960, 540, 1150);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── frost (edge ice crystals) ───────────────────────────────────────────────
function frostCanvas() {
  return cached('p1frost', () => {
    const { c, ctx } = makeCanvas(W, H);
    const r = rng(77);
    ctx.lineCap = 'round';
    // fern frost: dense feathery fronds (short 60° barbs on curved stems)
    const fern = (x, y, a, len, w, depth) => {
      let px = x, py = y, ang = a;
      const sl = depth > 0 ? 7 : 4;
      const segs = Math.max(2, Math.round(len / sl));
      const bend = (r() - 0.5) * 0.05;
      for (let i = 0; i < segs; i++) {
        ang += bend + (r() - 0.5) * 0.08;
        const nx = px + Math.cos(ang) * sl, ny = py + Math.sin(ang) * sl;
        const k = 1 - i / segs;
        ctx.lineWidth = Math.max(0.45, w * (0.3 + 0.7 * k));
        ctx.strokeStyle = `rgba(230,241,248,${(depth > 0 ? 0.22 : 0.13) + 0.25 * k})`;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        if (depth > 0) {
          const bl = len * 0.2 * k * (0.5 + r() * 0.7);
          if (bl > 3) for (const s of [-1, 1]) if (r() < 0.9) fern(nx, ny, ang + s * (Math.PI / 3) * (0.9 + r() * 0.2), bl, w * 0.5, depth - 1);
        }
        px = nx; py = ny;
      }
    };
    for (let i = 0; i < 170; i++) {
      // bias seeds toward the corners
      const corner = i % 4;
      const u = Math.pow(r(), 1.8);
      const alongX = r() < 0.5;
      let x, y, a;
      const cx = corner % 2 ? W : 0, cy = corner > 1 ? H : 0;
      if (alongX) { x = cx ? W - u * W * 0.45 : u * W * 0.45; y = cy ? H + 2 : -2; a = cy ? -Math.PI / 2 : Math.PI / 2; }
      else { y = cy ? H - u * H * 0.5 : u * H * 0.5; x = cx ? W + 2 : -2; a = cx ? Math.PI : 0; }
      const toward = Math.atan2(540 - y, 960 - x);
      a = a * 0.5 + toward * 0.5 + (r() - 0.5) * 0.9;
      fern(x, y, a, (50 + r() * 160) * (1.3 - u * 0.6), 1.5, 1);
    }
    // milky frost crust along the edges
    const sm = tex.smoke({ seed: 23 });
    for (let i = 0; i < 46; i++) {
      const side = i % 4, u = r();
      const x = side === 1 ? W : side === 3 ? 0 : u * W, y = side === 0 ? 0 : side === 2 ? H : u * H;
      const s = 220 + r() * 260;
      ctx.globalAlpha = 0.18 + r() * 0.16;
      ctx.drawImage(sm, x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(960, 540, 560, 960, 540, 1150);
    g.addColorStop(0, 'rgba(220,234,244,0)');
    g.addColorStop(1, 'rgba(220,234,244,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return c;
  });
}
// amt 0..1 — frost grows from edges inward
export function frost(ctx, amt, alpha = 1) {
  if (amt <= 0.01) return;
  const sc = scratchCanvas('p1frost-mask');
  sc.ctx.drawImage(frostCanvas(), 0, 0);
  sc.ctx.globalCompositeOperation = 'destination-in';
  const inner = lerp(1180, 600, clamp(amt));
  const g = sc.ctx.createRadialGradient(960, 540, inner, 960, 540, inner + 260);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  sc.ctx.fillStyle = g;
  sc.ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(sc.c, 0, 0);
  ctx.restore();
}

// ── dust motes (slow, depth-varied) ─────────────────────────────────────────
export function motes(ctx, t, { count = 60, seed = 5, color = '#F4EBD6', alpha = 0.35, speed = 12, size = [0.6, 2.2], area = [0, 0, W, H] } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const [ax, ay, aw, ah] = area;
  for (let i = 0; i < count; i++) {
    const x0 = r() * aw, y0 = r() * ah, s = lerp(size[0], size[1], Math.pow(r(), 2)), ph = r() * 100, sp = 0.4 + r();
    const x = ax + ((x0 + noise.n2(ph, t * 0.05) * 80 + t * speed * sp * 0.3) % aw + aw) % aw;
    const y = ay + ((y0 + noise.n2(ph + 7, t * 0.05) * 60 - t * speed * sp) % ah + ah) % ah;
    const tw_ = 0.55 + 0.45 * Math.sin(t * (1 + r()) + ph);
    ctx.globalAlpha = alpha * tw_ * (0.3 + 0.7 * s / size[1]);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ── ink / type helpers ───────────────────────────────────────────────────────
// big word revealed by a mask that slides (direction dir: 'up'|'down'|'left'), with optional exit
export function slideWord(ctx, str, x, y, p, { size = 120, family = F.COND, weight = 800, color = C.cream, align = 'center', tracking = 0, italic = false, out = 0, dir = 'up', alpha = 1 } = {}) {
  if (p <= 0 || out >= 1) return 0;
  ctx.save();
  setText(ctx, { family, size, weight, color, align, tracking, italic });
  const w = ctx.measureText(str).width;
  const ax = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.beginPath();
  ctx.rect(ax - size * 0.3, y - size * 1.05, w + size * 0.6, size * 1.35);
  ctx.clip();
  const e = E.outQuint(clamp(p)), o = E.inCubic(clamp(out));
  const dy = dir === 'up' ? (1 - e) * size * 1.1 - o * size * 1.1 : dir === 'down' ? -(1 - e) * size * 1.1 + o * size * 1.1 : 0;
  const dx = dir === 'left' ? (1 - e) * w * 0.3 : 0;
  ctx.globalAlpha *= alpha * clamp(p * 3);
  ctx.fillText(str, x + dx, y + dy);
  ctx.restore();
  return w;
}

// stencil/stamp-like word on a dark ground (no multiply), distressed with grit
export function inkStamp(ctx, label, x, y, p, { color = C.red, size = 80, rot = -0.08, family = F.STENCIL, box = true, seed = 4, alpha = 0.92, tracking = 0.08 } = {}) {
  if (p <= 0) return;
  const k = E.outQuint(clamp(p));
  const sc = lerp(1.7, 1, k);
  const s = scratchCanvas('p1stamp', 1600, 420);
  s.ctx.translate(800, 210);
  s.ctx.font = `900 ${size}px ${family}`;
  s.ctx.textAlign = 'center';
  s.ctx.textBaseline = 'middle';
  s.ctx.letterSpacing = `${size * tracking}px`;
  const w = s.ctx.measureText(label).width;
  s.ctx.fillStyle = color; s.ctx.strokeStyle = color;
  s.ctx.fillText(label, 0, 4);
  if (box) { s.ctx.lineWidth = size * 0.08; s.ctx.strokeRect(-w / 2 - size * 0.35, -size * 0.72, w + size * 0.7, size * 1.44); }
  s.ctx.globalCompositeOperation = 'destination-out';
  s.ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pat = s.ctx.createPattern(tex.grit(0.6, { seed, alpha: 255 }), 'repeat');
  s.ctx.globalAlpha = 0.5;
  s.ctx.fillStyle = pat;
  s.ctx.fillRect(0, 0, 1600, 420);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  ctx.globalAlpha *= clamp(p * 4) * alpha;
  ctx.drawImage(s.c, -800, -210);
  ctx.restore();
}

// mono telemetry tag (no leader), typed on
export function tag(ctx, t, str, x, y, { size = 26, color = C.cream, align = 'left', accent = null, dur = 0.5, alpha = 1 } = {}) {
  if (t <= 0) return;
  const full = `[ ${str} ]`;
  const n = Math.ceil(full.length * clamp(t / dur));
  ctx.save();
  ctx.globalAlpha *= alpha;
  setText(ctx, { family: F.MONO, size, weight: 600, color, align, baseline: 'middle', tracking: 2 });
  ctx.fillText(full.slice(0, n), x, y);
  if (accent) {
    const w = ctx.measureText(full).width;
    const ax = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(ax - 16, y, 5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// four-point sparkle star
export function sparkle(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();
  ctx.restore();
}

// jagged torn-paper polyline between two points (seeded)
export function tearLine(x0, y0, x1, y1, { n = 70, amp = 16, fine = 4, seed = 9 } = {}) {
  const nz = makeNoise(seed);
  const r = rng(seed);
  const pts = [];
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const o = (nz.n2(u * 4.2, 1.3) * amp + (r() - 0.5) * fine * 2) * Math.min(1, u * 8, (1 - u) * 8 + 0.2);
    pts.push([x0 + dx * u + nx * o, y0 + dy * u + ny * o]);
  }
  return pts;
}

// halftone dot pattern tile (cached)
export function dotPattern(ctx, cell = 7, color = '#000', size = 0.36) {
  return ctx.createPattern(tex.halftoneDots(cell, color, { size }), 'repeat');
}

// shaded metal cylinder rect (x,y,w,h) with bands — rocket bodies in 2D
export function metalBody(ctx, x, y, w, h, base, { lx = -0.4, spec = 0.5, rim = null } = {}) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  const hl = clamp(0.5 + lx * 0.4, 0.15, 0.85);
  g.addColorStop(0, shade(base, -0.55));
  g.addColorStop(Math.max(0.02, hl - 0.25), shade(base, -0.1));
  g.addColorStop(hl, shade(base, 0.25 * spec + 0.1));
  g.addColorStop(Math.min(0.98, hl + 0.12), base);
  g.addColorStop(0.88, shade(base, -0.38));
  g.addColorStop(1, rim ? mixColor(shade(base, -0.4), rim, 0.6) : shade(base, -0.6));
  return g;
}

// simple seeded value in [a,b]
export const rr = (seed, a = 0, b = 1) => a + (b - a) * rng(seed)();

export { clamp, lerp, E, tw, rng, noise, TAU, C, rgba, shade, mixColor, F, font, setText, makeCanvas, cached, scratchCanvas, tex, poly };

// ── blueprint rocket (side elevation) ───────────────────────────────────────
// spec.profile: [[x, r], ...] along the axis from tail (x=0) to nose; units px.
// spec.joints: x positions of stage joints; spec.tanks: [[x0, x1, label]]; spec.nose: x where warhead starts
// Drawn horizontally, nose to +x, axis at y=0 (rotate ctx for vertical).
export function bpRocket(ctx, spec, { p = 1, color = C.blueprintLine, width = 2, accent = C.red, hot = 0, labels = true, labelSize = 18, t = 0 } = {}) {
  const prof = spec.profile;
  const L = prof[prof.length - 1][0];
  const upto = L * clamp(p);
  const rAt = (x) => {
    for (let i = 1; i < prof.length; i++) if (x <= prof[i][0]) { const k = (x - prof[i - 1][0]) / ((prof[i][0] - prof[i - 1][0]) || 1); return lerp(prof[i - 1][1], prof[i][1], k); }
    return prof[prof.length - 1][1];
  };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // warhead fill (hatched, accent) — the hero of the drawing
  if (spec.nose != null && upto > spec.nose) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(spec.nose, -rAt(spec.nose));
    for (let x = spec.nose; x <= Math.min(upto, L); x += 4) ctx.lineTo(x, -rAt(x));
    for (let x = Math.min(upto, L); x >= spec.nose; x -= 4) ctx.lineTo(x, rAt(x));
    ctx.closePath();
    ctx.fillStyle = rgba(accent, 0.22 + 0.35 * hot);
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = rgba(accent, 0.75 + 0.25 * hot); ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let k = -200; k < 600; k += 9) { ctx.moveTo(spec.nose + k, -200); ctx.lineTo(spec.nose + k + 200, 200); }
    ctx.stroke();
    ctx.restore();
  }
  // centre line (dash-dot)
  ctx.strokeStyle = rgba(color, 0.45); ctx.lineWidth = 1;
  ctx.setLineDash([26, 6, 4, 6]);
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(Math.min(upto + 40, L + 60), 0); ctx.stroke();
  ctx.setLineDash([]);
  // outline
  ctx.strokeStyle = color; ctx.lineWidth = width;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    for (let x = 0; x <= upto; x += 3) { const y = s * rAt(x); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, -rAt(0)); ctx.lineTo(0, rAt(0)); ctx.stroke();
  // joints
  ctx.lineWidth = width * 0.7;
  for (const j of spec.joints || []) if (j < upto) { ctx.beginPath(); ctx.moveTo(j, -rAt(j)); ctx.lineTo(j, rAt(j)); ctx.stroke(); }
  // engine bells at tail
  if (spec.bells) {
    for (const b of spec.bells) {
      ctx.beginPath();
      ctx.moveTo(0, b.y - b.r0); ctx.quadraticCurveTo(-b.len * 0.5, b.y - b.r0, -b.len, b.y - b.r1);
      ctx.lineTo(-b.len, b.y + b.r1); ctx.quadraticCurveTo(-b.len * 0.5, b.y + b.r0, 0, b.y + b.r0);
      ctx.stroke();
    }
  }
  // fins
  if (spec.fins && upto > 0) {
    for (const s of [-1, 1]) {
      const f = spec.fins;
      ctx.beginPath(); ctx.moveTo(f.x0, s * rAt(f.x0)); ctx.lineTo(f.x0 - f.sweep, s * (rAt(f.x0) + f.span)); ctx.lineTo(f.x1 - f.sweep, s * (rAt(f.x0) + f.span)); ctx.lineTo(f.x1, s * rAt(f.x1)); ctx.stroke();
    }
  }
  // tanks (hidden lines, dashed)
  ctx.setLineDash([10, 7]);
  ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(color, 0.7);
  for (const [x0, x1] of spec.tanks || []) {
    if (x0 > upto) continue;
    const xe = Math.min(x1, upto);
    const r0 = rAt(x0) * 0.86, r1 = rAt(xe) * 0.86, cap = Math.min(r0, 30);
    ctx.beginPath();
    ctx.moveTo(x0 + cap, -r0); ctx.lineTo(xe - cap, -r1);
    ctx.quadraticCurveTo(xe, -r1, xe, 0); ctx.quadraticCurveTo(xe, r1, xe - cap, r1);
    ctx.lineTo(x0 + cap, r0); ctx.quadraticCurveTo(x0, r0, x0, 0); ctx.quadraticCurveTo(x0, -r0, x0 + cap, -r0);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (labels) {
    setText(ctx, { family: F.MONO, size: labelSize, weight: 500, color: rgba(color, 0.85), align: 'center', baseline: 'middle', tracking: 2 });
    for (const [x0, x1, lab] of spec.tanks || []) if (lab && x1 < upto) ctx.fillText(lab, (x0 + x1) / 2, 0);
  }
  ctx.restore();
  return { L, rAt };
}

// dimension line with arrows + label (blueprint)
export function dimLine(ctx, x0, y0, x1, y1, label, p = 1, { color = C.blueprintLine, size = 16, off = 0 } = {}) {
  if (p <= 0) return;
  const e = E.outCubic(clamp(p));
  const xm = lerp(x0, x1, 0.5), ym = lerp(y0, y1, 0.5);
  const xa = lerp(xm, x0, e), ya = lerp(ym, y0, e), xb = lerp(xm, x1, e), yb = lerp(ym, y1, e);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.strokeStyle = rgba(color, 0.8); ctx.fillStyle = rgba(color, 0.8); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
  const arrow = (x, y, ang) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang - 0.3) * 10, y - Math.sin(ang - 0.3) * 10); ctx.lineTo(x - Math.cos(ang + 0.3) * 10, y - Math.sin(ang + 0.3) * 10); ctx.closePath(); ctx.fill(); };
  if (e > 0.95) { arrow(xb, yb, a); arrow(xa, ya, a + Math.PI); }
  if (label && e > 0.6) {
    ctx.globalAlpha *= clamp((e - 0.6) * 3);
    setText(ctx, { family: F.MONO, size, weight: 500, color: rgba(color, 0.9), align: 'center', baseline: 'bottom', tracking: 1 });
    ctx.translate(xm, ym); ctx.rotate(Math.abs(a) > Math.PI / 2 ? a + Math.PI : a);
    ctx.fillText(label, 0, -6 + off);
  }
  ctx.restore();
}
