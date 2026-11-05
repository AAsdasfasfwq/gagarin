// ─────────────────────────────────────────────────────────────────────────────
// post.js — final WebGL2 stage: shot transitions (two layers + optional mask),
// overlay compositing, bloom (mip chain), chromatic aberration, colour grade,
// vignette and animated film grain. Grain is ALWAYS last (see atelier skill).
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSITIONS = {
  none: 0, crossfade: 1, dip: 2, wipe: 3, iris: 4, push: 5, zoom: 6, whip: 7, flash: 8,
  burn: 9, glitch: 10, ink: 11, mask: 12, blur: 13, blinds: 14, clock: 15, lumaWipe: 16,
};

export const DEFAULT_POST = {
  exposure: 0,          // stops
  contrast: 1.04,
  saturation: 1.0,
  lift: [0.0, 0.0, 0.0],
  gamma: [1, 1, 1],
  gain: [1, 1, 1],
  shadowTint: [0.04, 0.06, 0.10], // split-tone: shadows lean cool navy
  highTint: [0.06, 0.035, 0.0],   // highlights lean warm paper
  tintAmt: 0.35,
  fade: 0.015,          // filmic black lift
  bloom: 0.2,
  bloomThreshold: 0.86,
  ca: 0.0007,
  vignette: 0.32,
  grain: 0.055,
  grainSize: 1.35,
  sharpen: 0.0,
};

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

// Pass 1: transition + overlay composite → framebuffer (mipmapped)
const FS_COMP = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uA, uB, uMask, uOver;
uniform int uType; uniform float uP; uniform vec3 uColor; uniform vec2 uDir; uniform vec2 uCenter;
uniform float uFeather, uSeed; uniform int uHasB, uHasOver, uHasMask; uniform vec2 uRes;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
vec4 A(vec2 uv){ return texture(uA, uv); }
vec4 B(vec2 uv){ return uHasB==1 ? texture(uB, uv) : vec4(0.,0.,0.,1.); }
vec4 blurA(vec2 uv, float r){ vec4 s=vec4(0.); float n=0.;
  for(int i=-3;i<=3;i++) for(int j=-3;j<=3;j++){ vec2 o2=vec2(float(i),float(j))*r/uRes; float w=1.-length(vec2(i,j))/5.; if(w>0.){ s+=texture(uA,uv+o2)*w; n+=w; } } return s/n; }
vec4 blurB(vec2 uv, float r){ vec4 s=vec4(0.); float n=0.;
  for(int i=-3;i<=3;i++) for(int j=-3;j<=3;j++){ vec2 o2=vec2(float(i),float(j))*r/uRes; float w=1.-length(vec2(i,j))/5.; if(w>0.){ s+=B(uv+o2)*w; n+=w; } } return s/n; }
vec4 dirBlurA(vec2 uv, vec2 d){ vec4 s=vec4(0.); for(int i=0;i<16;i++){ float k=float(i)/15.-.5; s+=texture(uA, uv+d*k);} return s/16.; }
vec4 dirBlurB(vec2 uv, vec2 d){ vec4 s=vec4(0.); for(int i=0;i<16;i++){ float k=float(i)/15.-.5; s+=B(uv+d*k);} return s/16.; }
void main(){
  vec2 uv = vUv; float p = clamp(uP,0.,1.);
  float asp = uRes.x/uRes.y;
  vec4 c = A(uv);
  if (uType==1) { c = mix(A(uv), B(uv), smoothstep(0.,1.,p)); }
  else if (uType==2) { // dip to colour
    float a = smoothstep(0.,.5,p), b = smoothstep(.5,1.,p);
    c = p<.5 ? mix(A(uv), vec4(uColor,1.), a) : mix(vec4(uColor,1.), B(uv), b);
  }
  else if (uType==3) { // linear wipe along uDir with feather (+ soft light edge)
    vec2 d = normalize(uDir); float proj = dot(uv-.5, d)*1.0 + .5;
    float e = mix(-uFeather, 1.+uFeather, p);
    float m = smoothstep(e-uFeather, e+uFeather, proj);
    c = mix(B(uv), A(uv), m);
    float edge = 1.-abs(proj-e)/max(uFeather,1e-3); c.rgb += uColor*max(edge,0.)*.35*step(0.01,p)*step(p,.99);
  }
  else if (uType==4) { // iris open from uCenter
    vec2 q = (uv-uCenter)*vec2(asp,1.); float r = length(q);
    float R = mix(0., 1.35*asp, smoothstep(0.,1.,p));
    float m = smoothstep(R, R+uFeather, r);
    c = mix(B(uv), A(uv), m);
  }
  else if (uType==5) { // push
    vec2 d = normalize(uDir); float e = smoothstep(0.,1.,p);
    vec2 ua = uv - d*e, ub = uv - d*(e-1.);
    bool inA = all(greaterThanEqual(ua,vec2(0.))) && all(lessThanEqual(ua,vec2(1.)));
    c = inA ? A(ua) : B(ub);
  }
  else if (uType==6) { // zoom-through
    float e = smoothstep(0.,1.,p);
    vec2 ca = (uv-uCenter)/(1.+e*2.5)+uCenter; vec2 cb = (uv-uCenter)*(1.+(1.-e)*0.35)+uCenter;
    vec4 a = blurA(ca, e*10.); vec4 b = blurB(cb, (1.-e)*8.);
    c = mix(a, b, smoothstep(.35,.75,p));
  }
  else if (uType==7) { // whip pan with directional blur
    vec2 d = normalize(uDir); float e = smoothstep(0.,1.,p); float bl = sin(p*3.14159)*0.22;
    vec2 ua = uv - d*e*1.0, ub = uv - d*(e-1.)*1.0;
    vec4 a = dirBlurA(ua, d*bl), b = dirBlurB(ub, d*bl);
    float m = smoothstep(.45,.55,p);
    c = mix(a,b,m);
  }
  else if (uType==8) { // flash / overexposure
    float f = 1.-abs(p*2.-1.); f = pow(f,1.5);
    vec4 base = p<.5 ? A(uv) : B(uv);
    c = vec4(mix(base.rgb, uColor, f*.95) + uColor*f*.6, 1.);
  }
  else if (uType==9) { // burn-through (paper burning edge)
    float n = fbm(uv*vec2(asp,1.)*3.5 + uSeed);
    float rr = length((uv-uCenter)*vec2(asp,1.))*.55;
    float v = n*.55 + rr*.75;
    float th = mix(-.1, 1.25, p);
    float m = smoothstep(th-.015, th+.015, v);
    c = mix(B(uv), A(uv), m);
    float edge = smoothstep(.06,0.,abs(v-th)) * step(.01,p) * step(p,.99);
    c.rgb = mix(c.rgb, vec3(.08,.03,.01), smoothstep(.12,.0,v-th)*smoothstep(-.02,.0,v-th)*.8);
    c.rgb += uColor*edge*1.4;
  }
  else if (uType==10) { // glitch
    float blk = floor(uv.y*24.+uSeed);
    float j = (hash(vec2(blk, floor(p*18.)))-.5) * sin(p*3.14159) * .12;
    vec2 g = uv + vec2(j,0.);
    float sp = sin(p*3.14159)*.012;
    vec4 a = vec4(A(g+vec2(sp,0)).r, A(g).g, A(g-vec2(sp,0)).b, 1.);
    vec4 b = vec4(B(g+vec2(sp,0)).r, B(g).g, B(g-vec2(sp,0)).b, 1.);
    float m = step(hash(vec2(blk*1.7, floor(p*24.))), p);
    c = mix(a,b,m);
  }
  else if (uType==11) { // ink bleed from centre
    float n = fbm(uv*vec2(asp,1.)*5.+uSeed)*.35;
    float r = length((uv-uCenter)*vec2(asp,1.)) + n;
    float R = mix(-.1, 1.6, smoothstep(0.,1.,p));
    float m = smoothstep(R-.02, R+.02, r);
    c = mix(B(uv), A(uv), m);
  }
  else if (uType==12) { // custom mask from incoming scene (mask alpha = show B)
    float m = uHasMask==1 ? texture(uMask, uv).a : p;
    c = mix(A(uv), B(uv), m);
  }
  else if (uType==13) { // blur through (rack focus)
    float e = smoothstep(0.,1.,p);
    vec4 a = blurA(uv, e*14.); vec4 b = blurB(uv, (1.-e)*14.);
    c = mix(a,b, smoothstep(.3,.7,p));
  }
  else if (uType==14) { // blinds / slats
    float n = 14.; float f = fract(dot(uv, normalize(uDir))*n);
    float m = step(f, smoothstep(0.,1.,p)*1.02);
    c = mix(A(uv), B(uv), m);
  }
  else if (uType==15) { // clock wipe around uCenter
    vec2 q = (uv-uCenter)*vec2(asp,1.); float ang = atan(q.x, q.y); ang = (ang+3.14159)/6.28318;
    ang = fract(1.-ang+.5);
    float m = smoothstep(p-.004, p+.004, ang);
    c = mix(B(uv), A(uv), m);
  }
  else if (uType==16) { // luma wipe: brightest areas of B appear first
    vec4 b = B(uv); float l = dot(b.rgb, vec3(.3,.59,.11));
    float th = 1.-p*1.3;
    float m = smoothstep(th, th+.18, l + (fbm(uv*6.+uSeed)-.5)*.15);
    c = mix(A(uv), b, m);
  }
  if (uHasOver==1) { vec4 ov = texture(uOver, uv); c.rgb = mix(c.rgb, ov.rgb, ov.a); }
  o = vec4(c.rgb, 1.);
}`;

// Pass 2: bloom + CA + grade + vignette + grain
const FS_POST = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uRes; uniform float uFrame;
uniform float uExposure, uContrast, uSat, uFade, uBloom, uThresh, uCA, uVig, uGrain, uGrainSize, uTintAmt, uSharpen;
uniform vec3 uLift, uGamma, uGain, uShadowTint, uHighTint;
float hash(vec3 p){ p = fract(p*.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
vec3 srcCA(vec2 uv){
  vec2 d = uv-.5; float k = dot(d,d);
  vec2 off = d*k*uCA*4.;
  return vec3(texture(uSrc, uv+off).r, texture(uSrc, uv).g, texture(uSrc, uv-off).b);
}
void main(){
  vec2 uv = vUv;
  vec3 c = srcCA(uv);
  if (uSharpen > 0.) {
    vec2 px = 1./uRes;
    vec3 bl = (texture(uSrc,uv+vec2(px.x,0)).rgb+texture(uSrc,uv-vec2(px.x,0)).rgb+texture(uSrc,uv+vec2(0,px.y)).rgb+texture(uSrc,uv-vec2(0,px.y)).rgb)*.25;
    c += (c-bl)*uSharpen;
  }
  // bloom from mip chain (cheap wide glow)
  vec3 bl = vec3(0.);
  float ws = 0.;
  for (int i=2;i<=7;i++){
    float l = float(i);
    vec3 s = textureLod(uSrc, uv, l).rgb;
    float br = max(max(s.r,s.g),s.b);
    float k = smoothstep(uThresh, uThresh+.14, br);
    float w = 1./(1.+abs(l-4.5));
    bl += s*k*w; ws += w;
  }
  c += bl/ws*uBloom*1.6;
  // exposure + grade
  c *= exp2(uExposure);
  c = (c - .5)*uContrast + .5;
  c = max(c*uGain + uLift, 0.);
  c = pow(c, 1./max(uGamma, vec3(.01)));
  float L = dot(c, vec3(.2126,.7152,.0722));
  c = mix(vec3(L), c, uSat);
  // split tone
  c += uShadowTint*(1.-smoothstep(0.,.55,L))*uTintAmt;
  c += uHighTint*smoothstep(.45,1.,L)*uTintAmt;
  c = c*(1.-uFade) + uFade;
  // vignette (aspect-corrected)
  vec2 q = (uv-.5)*vec2(uRes.x/uRes.y, 1.);
  float v = smoothstep(1.15, .25, length(q));
  c *= mix(1., v, uVig);
  // grain — midtone weighted, animated, last
  vec2 gp = floor(gl_FragCoord.xy/uGrainSize);
  float n = hash(vec3(gp, mod(uFrame,997.)+1.)) - .5;
  float mid = 1. - abs(L*2.-1.);
  c += n*uGrain*(.35+.65*mid);
  o = vec4(clamp(c,0.,1.),1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class Post {
  constructor(canvas, w, h) {
    this.w = w; this.h = h;
    canvas.width = w; canvas.height = h;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;
    this.comp = program(gl, FS_COMP);
    this.post = program(gl, FS_POST);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const mk = (mip = false) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tA = mk(); this.tB = mk(); this.tMask = mk(); this.tOver = mk();
    // framebuffer target (mipmapped for bloom)
    this.tF = mk(true);
    gl.bindTexture(gl.TEXTURE_2D, this.tF);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tF, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  upload(tex, src) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }
  // a, b: canvases. tr: {type, p, color, dir, center, feather, seed}. over: canvas|null. mask: canvas|null
  render({ a, b = null, tr = null, over = null, mask = null, post = DEFAULT_POST, frame = 0 }) {
    const gl = this.gl;
    const P = { ...DEFAULT_POST, ...post };
    this.upload(this.tA, a);
    if (b) this.upload(this.tB, b);
    if (over) this.upload(this.tOver, over);
    if (mask) this.upload(this.tMask, mask);
    // pass 1
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, this.w, this.h);
    const { p, u } = this.comp;
    gl.useProgram(p);
    const bindT = (unit, t, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(u[name], unit); };
    bindT(0, this.tA, 'uA'); bindT(1, this.tB, 'uB'); bindT(2, this.tMask, 'uMask'); bindT(3, this.tOver, 'uOver');
    const T = tr || { type: 0, p: 0 };
    gl.uniform1i(u.uType, b ? (TRANSITIONS[T.type] ?? T.type ?? 0) : 0);
    gl.uniform1f(u.uP, T.p ?? 0);
    gl.uniform3fv(u.uColor, T.color || [1, 0.97, 0.92]);
    gl.uniform2fv(u.uDir, T.dir || [1, 0]);
    gl.uniform2fv(u.uCenter, T.center || [0.5, 0.5]);
    gl.uniform1f(u.uFeather, T.feather ?? 0.04);
    gl.uniform1f(u.uSeed, T.seed ?? 1.7);
    gl.uniform1i(u.uHasB, b ? 1 : 0);
    gl.uniform1i(u.uHasOver, over ? 1 : 0);
    gl.uniform1i(u.uHasMask, mask ? 1 : 0);
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, this.tF);
    gl.generateMipmap(gl.TEXTURE_2D);
    // pass 2
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    const q = this.post;
    gl.useProgram(q.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tF);
    gl.uniform1i(q.u.uSrc, 0);
    gl.uniform2f(q.u.uRes, this.w, this.h);
    gl.uniform1f(q.u.uFrame, frame);
    gl.uniform1f(q.u.uExposure, P.exposure);
    gl.uniform1f(q.u.uContrast, P.contrast);
    gl.uniform1f(q.u.uSat, P.saturation);
    gl.uniform1f(q.u.uFade, P.fade);
    gl.uniform1f(q.u.uBloom, P.bloom);
    gl.uniform1f(q.u.uThresh, P.bloomThreshold);
    gl.uniform1f(q.u.uCA, P.ca);
    gl.uniform1f(q.u.uVig, P.vignette);
    gl.uniform1f(q.u.uGrain, P.grain);
    gl.uniform1f(q.u.uGrainSize, P.grainSize);
    gl.uniform1f(q.u.uTintAmt, P.tintAmt);
    gl.uniform1f(q.u.uSharpen, P.sharpen);
    gl.uniform3fv(q.u.uLift, P.lift);
    gl.uniform3fv(q.u.uGamma, P.gamma);
    gl.uniform3fv(q.u.uGain, P.gain);
    gl.uniform3fv(q.u.uShadowTint, P.shadowTint);
    gl.uniform3fv(q.u.uHighTint, P.highTint);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
  }
}

// Linear interpolation between two post settings (for grade changes across cuts)
export function mixPost(a, b, t) {
  const A = { ...DEFAULT_POST, ...a }, B = { ...DEFAULT_POST, ...b };
  const out = {};
  for (const k of Object.keys(A)) {
    out[k] = Array.isArray(A[k]) ? A[k].map((v, i) => v + (B[k][i] - v) * t) : A[k] + (B[k] - A[k]) * t;
  }
  return out;
}
