// ─────────────────────────────────────────────────────────────────────────────
// engine.js — deterministic film timeline.
//
//   Scene = {
//     id: 'p3-04-codelock',          // unique, prefixed with part id
//     start: 374.06, end: 383.52,    // ABSOLUTE film seconds (VO time)
//     transition: { type, dur, ... } // how THIS scene enters over the previous one (optional = hard cut)
//     post: {…} | (t,S)=>({…}),      // grade overrides (see post.js DEFAULT_POST)
//     motionBlur: 0 | n | (t,S)=>n,  // sub-frame samples for fast moves (costly, use briefly)
//     async init(S) {…},             // build textures/geometry ONCE (S.state is yours)
//     render(ctx, t, S) {…},         // draw FULL opaque frame for local time t (s)
//     dispose(S) {…},                // optional cleanup
//   }
//   Overlay scene = { overlay: true, start, end, render(ctx,t,S) } — transparent layer
//   drawn ABOVE whatever base scene/transition is active (titles across cuts etc).
//
// render() must be a pure function of t (+ state built in init). It may be
// called for t > dur (when the next scene transitions in over this one) and
// in any order (parallel chunked rendering). Never use Math.random/Date.
// ─────────────────────────────────────────────────────────────────────────────
import { W, H, makeCanvas } from './draw.js';
import { Post, DEFAULT_POST, mixPost } from './post.js';
import { clamp, E } from './math.js';

export const FPS = 30;

export class Engine {
  constructor({ parts, duration, outCanvas }) {
    this.fps = FPS;
    this.duration = duration;
    this.frames = Math.round(duration * FPS);
    this.parts = parts;
    this.scenes = [];
    this.overlays = [];
    for (const part of parts) {
      for (const s of part.scenes) {
        s.part = part.id;
        (s.overlay ? this.overlays : this.scenes).push(s);
      }
    }
    this.scenes.sort((a, b) => a.start - b.start);
    this.overlays.sort((a, b) => a.start - b.start);
    this.validate();
    this.layerA = makeCanvas(W, H);
    this.layerB = makeCanvas(W, H);
    this.layerO = makeCanvas(W, H);
    this.layerM = makeCanvas(W, H);
    this.accum = makeCanvas(W, H);
    this.post = new Post(outCanvas, W, H);
    this.states = new Map(); // scene → {S, ready:Promise}
    this.lastFrame = -1;
  }

  validate() {
    const warn = (...m) => { console.warn('[timeline]', ...m); (this.warnings ||= []).push(m.join(' ')); };
    const sc = this.scenes;
    for (let i = 0; i < sc.length; i++) {
      const s = sc[i];
      if (!(s.end > s.start)) warn(`scene ${s.id} has end <= start`);
      if (i > 0) {
        const gap = s.start - sc[i - 1].end;
        if (gap > 1 / FPS + 1e-6) warn(`GAP ${gap.toFixed(3)}s between ${sc[i - 1].id} and ${s.id}`);
        if (gap < -1 / FPS - 1e-6) warn(`OVERLAP ${(-gap).toFixed(3)}s between ${sc[i - 1].id} and ${s.id}`);
      }
    }
    if (sc.length && sc[0].start > 0.001) warn(`first scene starts at ${sc[0].start}`);
  }

  sceneAt(t) {
    const sc = this.scenes;
    let lo = 0, hi = sc.length - 1, idx = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (sc[m].start <= t + 1e-9) { idx = m; lo = m + 1; } else hi = m - 1;
    }
    return idx;
  }

  ensure(scene) {
    let st = this.states.get(scene);
    if (!st) {
      const S = { state: {}, scene, id: scene.id, dur: scene.end - scene.start, W, H, fps: FPS };
      st = { S, ready: (async () => { if (scene.init) await scene.init(S); })() };
      st.ready.catch((e) => console.error(`[init ${scene.id}]`, e));
      this.states.set(scene, st);
    }
    return st;
  }

  // free scenes far away from t (keeps memory bounded on long renders)
  gc(t) {
    for (const [scene, st] of this.states) {
      if (t < scene.start - 30 || t > scene.end + 30) {
        try { scene.dispose && scene.dispose(st.S); } catch (e) { console.error(e); }
        this.states.delete(scene);
      }
    }
  }

  async drawScene(scene, layer, abs, frame, extra = {}) {
    const st = this.ensure(scene);
    await st.ready;
    const S = st.S;
    const ctx = layer.ctx;
    const t = abs - scene.start;
    const prep = (c) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.filter = 'none';
      c.shadowBlur = 0; c.shadowColor = 'rgba(0,0,0,0)';
      c.letterSpacing = '0px';
    };
    const call = (c, tt, sub) => {
      Object.assign(S, { t: tt, abs: scene.start + tt, p: tt / S.dur, frame, sub, ...extra });
      prep(c);
      c.clearRect(0, 0, W, H);
      c.save();
      scene.render(c, tt, S);
      c.restore();
    };
    let mb = typeof scene.motionBlur === 'function' ? scene.motionBlur(t, S) : scene.motionBlur || 0;
    mb = Math.min(12, Math.max(0, Math.round(mb)));
    if (mb > 1) {
      // average mb sub-frames across a 180° shutter
      const acc = this.accum.ctx;
      prep(acc);
      acc.clearRect(0, 0, W, H);
      for (let i = 0; i < mb; i++) {
        const tt = t - (0.5 / FPS) * (i / (mb - 1));
        call(ctx, tt, i);
        acc.globalAlpha = 1 / (i + 1);
        acc.drawImage(layer.c, 0, 0);
      }
      prep(ctx);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(this.accum.c, 0, 0);
    } else call(ctx, t, 0);
    const post = typeof scene.post === 'function' ? scene.post(t, S) : scene.post;
    return { post: { ...DEFAULT_POST, ...(post || {}) }, S };
  }

  async seek(frame) {
    frame = Math.max(0, Math.min(this.frames - 1, frame | 0));
    const abs = frame / FPS;
    this.gc(abs);
    const i = this.sceneAt(abs);
    if (i < 0) {
      this.layerA.ctx.fillStyle = '#0E1726';
      this.layerA.ctx.fillRect(0, 0, W, H);
      this.post.render({ a: this.layerA.c, frame });
      return;
    }
    const cur = this.scenes[i];
    // prefetch upcoming scene inits (non-blocking)
    const nxt = this.scenes[i + 1];
    if (nxt && nxt.start - abs < 4) this.ensure(nxt);

    const tr = cur.transition;
    const local = abs - cur.start;
    let result;
    if (tr && tr.type && tr.type !== 'cut' && i > 0 && local < (tr.dur ?? 0.5)) {
      const prev = this.scenes[i - 1];
      const dur = tr.dur ?? 0.5;
      const p = (tr.ease || E.inOutCubic)(clamp(local / dur));
      const A = await this.drawScene(prev, this.layerA, abs, frame, { outgoing: true, trP: p });
      const B = await this.drawScene(cur, this.layerB, abs, frame, { outgoing: false, trP: p });
      let mask = null;
      if (tr.type === 'mask' && tr.mask) {
        const m = this.layerM.ctx;
        m.setTransform(1, 0, 0, 1, 0, 0);
        m.globalAlpha = 1; m.globalCompositeOperation = 'source-over'; m.filter = 'none';
        m.clearRect(0, 0, W, H);
        m.fillStyle = '#fff';
        tr.mask(m, p, B.S, local);
        mask = this.layerM.c;
      }
      const over = await this.drawOverlays(abs, frame);
      this.post.render({
        a: this.layerA.c, b: this.layerB.c, mask, over,
        tr: { ...tr, p }, post: mixPost(A.post, B.post, p), frame,
      });
      result = { scene: cur.id, from: prev.id, p };
    } else {
      const A = await this.drawScene(cur, this.layerA, abs, frame, { outgoing: false, trP: 1 });
      const over = await this.drawOverlays(abs, frame);
      this.post.render({ a: this.layerA.c, over, post: A.post, frame });
      result = { scene: cur.id };
    }
    this.lastFrame = frame;
    return result;
  }

  async drawOverlays(abs, frame) {
    const act = this.overlays.filter((o) => abs >= o.start && abs < o.end);
    if (!act.length) return null;
    const ctx = this.layerO.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const o of act) {
      const st = this.ensure(o);
      await st.ready;
      const t = abs - o.start;
      Object.assign(st.S, { t, abs, p: t / st.S.dur, frame });
      ctx.save();
      o.render(ctx, t, st.S);
      ctx.restore();
    }
    // premultiply for the shader's "over" operator
    return this.layerO.c;
  }
}
