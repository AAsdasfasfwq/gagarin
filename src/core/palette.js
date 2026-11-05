// ─────────────────────────────────────────────────────────────────────────────
// palette.js — the film's colour system. Related palettes, one per chapter
// "state". Use these tokens; do not invent random hex values in scenes unless a
// specific material needs it (and then derive it from a token with shade()).
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // Base inks — dark grounds are always TINTED, never #000
  ink: '#0E1726',        // night navy — default dark ground
  inkDeep: '#081019',    // deepest shadow / space vignette (still tinted)
  inkSoft: '#1B2638',
  graphite: '#2A2F36',

  // Paper — archive / editorial grounds
  paper: '#EDE4CF',
  paperLight: '#F6F0E2',
  paperDark: '#D6C8A8',
  paperShadow: '#B9A882',
  newsprint: '#E4DDCB',

  // Cold War steel
  steel: '#8DA2AE',
  steelLight: '#C3D0D6',
  steelDark: '#3B5161',
  concrete: '#9A968C',
  concreteDark: '#5F5C55',

  // Signal colours
  red: '#D33A2C',        // Soviet vermilion — state, alarm, propaganda
  redDeep: '#8E1E16',
  orange: '#F26B1D',     // THE ORANGE — reserved for Gagarin / human courage
  orangeLight: '#FF9A4D',
  gold: '#D9A93E',       // stars, medals, sunrise
  goldLight: '#F3D27A',
  cream: '#F4EBD6',      // light ink on dark grounds (instead of pure white)
  white: '#FBF8F1',

  // Danger chemistry
  toxic: '#B6BE45',      // propellant / hydrazine
  toxicDark: '#5D6420',
  acid: '#D9E06A',

  // Fire ramp (cool → hot)
  fire0: '#4A0E08',
  fire1: '#8E2210',
  fire2: '#E0521C',
  fire3: '#FFA53A',
  fire4: '#FFE3A1',
  fire5: '#FFF8E6',
  soot: '#2B2724',
  ash: '#77726A',

  // Blueprint / technical
  blueprint: '#123A5C',
  blueprintDeep: '#0B2740',
  blueprintLine: '#9CC7E6',
  cyan: '#6FC3E3',

  // Sky & space
  sky0: '#F7C9A3',       // dawn horizon
  sky1: '#E58B6A',       // dawn mid
  sky2: '#7FA9CF',       // day
  sky3: '#2E5F9A',       // high altitude
  space: '#0C1430',      // deep space (indigo, not black)
  spaceDeep: '#060A1C',
  halo: '#7CC8EE',       // Earth atmosphere limb
  earthOcean: '#1F4E79',
  earthLand: '#5E7A4A',
  cloud: '#EEF3F6',

  // Re-entry plasma
  plasma0: '#FF6A2B',
  plasma1: '#FF3E5E',
  plasma2: '#FFD2A0',

  // Landing / spring field
  field: '#6E7B3A',
  fieldLight: '#9AA65A',
  soil: '#6A4A30',
  soilDark: '#3F2B1C',
  springSky: '#BFD9E8',

  // Celebration
  confettiRed: '#D33A2C',
  confettiGold: '#E6B84C',
  confettiCream: '#F4EBD6',
};

// Chapter colour states (used for grades and as guidance). Each part may use
// several. Keys are referenced in docs/DIRECTION.md.
export const STATES = {
  coldwar:   { ground: C.ink,        ink: C.steelLight, accent: C.red,    temp: 'cold' },
  archive:   { ground: C.paper,      ink: C.ink,        accent: C.red,    temp: 'neutral-warm' },
  toxic:     { ground: '#1C1F14',    ink: C.acid,       accent: C.toxic,  temp: 'sick' },
  disaster:  { ground: C.fire0,      ink: C.fire4,      accent: C.fire3,  temp: 'hot' },
  ash:       { ground: '#3A3733',    ink: C.paper,      accent: C.red,    temp: 'dead' },
  blueprint: { ground: C.blueprint,  ink: C.blueprintLine, accent: C.orange, temp: 'cool-tech' },
  editorial: { ground: C.paperLight, ink: C.ink,        accent: C.red,    temp: 'warm' },
  night:     { ground: '#101A2E',    ink: C.cream,      accent: C.gold,   temp: 'tungsten-night' },
  dawn:      { ground: C.sky1,       ink: C.ink,        accent: C.orange, temp: 'dawn' },
  ascent:    { ground: C.sky3,       ink: C.cream,      accent: C.fire3,  temp: 'bright' },
  orbit:     { ground: C.space,      ink: C.cream,      accent: C.halo,   temp: 'silent' },
  warning:   { ground: '#151C26',    ink: C.cream,      accent: '#F2A33A', temp: 'alarm' },
  reentry:   { ground: '#2A0E10',    ink: C.plasma2,    accent: C.plasma0, temp: 'inferno' },
  spring:    { ground: C.springSky,  ink: C.soilDark,   accent: C.orange, temp: 'fresh' },
  triumph:   { ground: C.red,        ink: C.cream,      accent: C.gold,   temp: 'festive' },
  coda:      { ground: '#2B2440',    ink: C.cream,      accent: C.gold,   temp: 'dusk' },
};

// ── colour utilities ────────────────────────────────────────────────────────
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function rgba(hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
// mix two hex colours, t in 0..1
export function mixColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
// shade: amt <0 darker (towards ink-tinted shadow), >0 lighter (towards warm white)
export function shade(hex, amt) {
  return amt < 0 ? mixColor(hex, '#0A0F1A', -amt) : mixColor(hex, '#FFF9EE', amt);
}
// sample a multi-stop ramp [[pos, hex], ...] at t
export function ramp(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mixColor(stops[i - 1][1], stops[i][1], k);
    }
  }
  return stops[stops.length - 1][1];
}
export const FIRE_RAMP = [
  [0, C.fire0], [0.25, C.fire1], [0.5, C.fire2], [0.72, C.fire3], [0.9, C.fire4], [1, C.fire5],
];
export const PLASMA_RAMP = [
  [0, '#3A0A12'], [0.35, C.plasma1], [0.65, C.plasma0], [0.88, C.plasma2], [1, '#FFF6EA'],
];
