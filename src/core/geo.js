// ─────────────────────────────────────────────────────────────────────────────
// geo.js — real world geography (Natural Earth via world-atlas TopoJSON) for
// maps & globes. Load once in a scene's init():  const G = await loadGeo('50m');
//   G.countries  → [{ name, id, rings: [[ [lon,lat], ...], ...] }]
//   G.ussr       → rings of the 1961 USSR (union of the 15 republics)
//   G.draw(ctx, proj, { fill, stroke, filter, width })   draws countries with any projection
//   proj = equirect({cx, cy, scale, lon0, lat0}) | ortho({cx, cy, r, lon0, lat0, tilt})
//   PLACES.baikonur etc. → [lon, lat]
// ─────────────────────────────────────────────────────────────────────────────
import { feature, merge } from '../../node_modules/topojson-client/src/index.js';

export const PLACES = {
  baikonur: [63.342, 45.92], tyuratam: [63.342, 45.92], moscow: [37.62, 55.75], saratov: [46.03, 51.53],
  smelovka: [45.99, 51.27], engels: [46.12, 51.48], washington: [-77.04, 38.9], newYork: [-74.0, 40.71],
  london: [-0.13, 51.51], paris: [2.35, 48.86], havana: [-82.37, 23.13], kaliningrad: [20.5, 54.7],
  kamchatka: [158.65, 53.02], gzhatsk: [35.0, 55.55], starCity: [38.1, 55.88], africaCape: [18.42, -33.92],
  tokyo: [139.69, 35.69], delhi: [77.21, 28.61], cairo: [31.24, 30.04], rio: [-43.2, -22.9], berlin: [13.4, 52.52],
  helsinki: [24.94, 60.17], sofia: [23.32, 42.7], budapest: [19.04, 47.5], prague: [14.42, 50.08], warsaw: [21.01, 52.23],
  ottawa: [-75.7, 45.42], mexico: [-99.13, 19.43], buenosAires: [-58.38, -34.6], jakarta: [106.85, -6.21], kabul: [69.2, 34.55],
};
const USSR_NAMES = ['Russia', 'Ukraine', 'Belarus', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Georgia', 'Armenia', 'Azerbaijan', 'Moldova', 'Lithuania', 'Latvia', 'Estonia'];

const cache = {};
export async function loadGeo(res = '110m') {
  if (cache[res]) return cache[res];
  const topo = await (await fetch(`./node_modules/world-atlas/countries-${res}.json`)).json();
  const fc = feature(topo, topo.objects.countries);
  const ringsOf = (geom) => (geom.type === 'Polygon' ? geom.coordinates : geom.type === 'MultiPolygon' ? geom.coordinates.flat() : []);
  const countries = fc.features.map((f) => ({ name: f.properties.name, id: f.id, rings: ringsOf(f.geometry) }));
  const ussrGeo = merge(topo, topo.objects.countries.geometries.filter((g) => USSR_NAMES.includes(g.properties.name)));
  const usaGeo = merge(topo, topo.objects.countries.geometries.filter((g) => g.properties.name === 'United States of America'));
  const G = {
    countries,
    ussr: ringsOf(ussrGeo),
    usa: ringsOf(usaGeo),
    byName: (n) => countries.find((c) => c.name === n),
    draw(ctx, proj, { fill = null, stroke = null, width = 1, filter = null, rings = null, close = true } = {}) {
      const list = rings ? [{ rings }] : filter ? countries.filter(filter) : countries;
      ctx.beginPath();
      for (const c of list) for (const ring of c.rings) traceRing(ctx, ring, proj, close);
      if (fill) { ctx.fillStyle = fill; ctx.fill('evenodd'); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    },
  };
  cache[res] = G;
  return G;
}

// trace a lon/lat ring with a projection that returns {x,y,v} (v=false → hidden/back side)
function traceRing(ctx, ring, proj, close) {
  let pen = false, prev = null;
  for (let i = 0; i < ring.length; i++) {
    const p = proj(ring[i][0], ring[i][1]);
    if (!p || p.v === false) { pen = false; prev = null; continue; }
    if (prev && Math.abs(p.x - prev.x) > 600) pen = false; // dateline wrap
    if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
    prev = p;
  }
  if (close && pen) ctx.closePath();
}

const D = Math.PI / 180;
// Equirectangular (flat map). lon0/lat0 = centre, scale = px per degree.
export function equirect({ cx = 960, cy = 540, scale = 5, lon0 = 0, lat0 = 0 } = {}) {
  return (lon, lat) => {
    let dl = lon - lon0;
    if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
    return { x: cx + dl * scale * Math.cos(lat0 * D) ** 0, y: cy - (lat - lat0) * scale, v: true };
  };
}
// Orthographic globe. r = radius px; lon0/lat0 = point facing camera; tilt = roll
export function ortho({ cx = 960, cy = 540, r = 400, lon0 = 0, lat0 = 0, tilt = 0 } = {}) {
  const sl = Math.sin(lat0 * D), cl = Math.cos(lat0 * D), ct = Math.cos(tilt), st = Math.sin(tilt);
  return (lon, lat) => {
    const la = lat * D, lo = (lon - lon0) * D;
    const x = Math.cos(la) * Math.sin(lo);
    const y = cl * Math.sin(la) - sl * Math.cos(la) * Math.cos(lo);
    const z = sl * Math.sin(la) + cl * Math.cos(la) * Math.cos(lo);
    const X = x * ct - y * st, Y = x * st + y * ct;
    return { x: cx + X * r, y: cy - Y * r, v: z > -0.02, z };
  };
}
// great-circle interpolation between two [lon,lat] points (for flight/missile arcs)
export function greatCircle(a, b, n = 64) {
  const toV = ([lo, la]) => [Math.cos(la * D) * Math.cos(lo * D), Math.cos(la * D) * Math.sin(lo * D), Math.sin(la * D)];
  const A = toV(a), B = toV(b);
  const dot = Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
  const w = Math.acos(dot), out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s1 = Math.sin((1 - t) * w) / Math.sin(w || 1e-6), s2 = Math.sin(t * w) / Math.sin(w || 1e-6);
    const v = [A[0] * s1 + B[0] * s2, A[1] * s1 + B[1] * s2, A[2] * s1 + B[2] * s2];
    out.push([Math.atan2(v[1], v[0]) / D, Math.asin(Math.max(-1, Math.min(1, v[2]))) / D]);
  }
  return out;
}
