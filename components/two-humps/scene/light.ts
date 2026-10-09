/*
 * The light over the Gobi at any hour of the trek.
 *
 * Everything in the diorama is lit from here: the sky's gradient, the colour
 * of direct sun and of skylight, how far the haze reaches and how many stars
 * show. Colours are keyed to the sun's height above the horizon, the way real
 * twilight is (blue hour and golden hour are bands of sun elevation, not
 * clock times), and interpolated between keys.
 */

export type RGB = [number, number, number];

export type Light = {
  /** Hours since midnight, 0–24. */
  clock: number;
  /** Degrees above the horizon; negative at night. */
  sunElevation: number;
  /** Where the sun is across the screen, 0 (left) to 1 (right): it rises on the right and sets on the left. */
  sunX: number;
  zenith: RGB;
  midSky: RGB;
  horizon: RGB;
  /** The bright halo round the sun, strongest at golden hour. */
  glow: RGB;
  /** Direct sunlight, already scaled by its strength. */
  sun: RGB;
  /** Skylight that reaches every surface. */
  ambient: RGB;
  /** Moonlight, at night. */
  moon: RGB;
  /** Distance haze that far layers fade into. */
  haze: RGB;
  /** 0 by day, 1 in full darkness. */
  starlight: number;
};

type Key = { at: number; zenith: RGB; midSky: RGB; horizon: RGB; glow: RGB; sun: RGB; ambient: RGB; haze: RGB };

/* Keys by sun elevation in degrees, lowest first. */
const KEYS: Key[] = [
  { at: -18, zenith: [6, 8, 24], midSky: [11, 15, 40], horizon: [22, 28, 62], glow: [0, 0, 0], sun: [0, 0, 0], ambient: [0.12, 0.14, 0.26], haze: [26, 31, 64] },
  { at: -9, zenith: [14, 20, 58], midSky: [34, 42, 98], horizon: [92, 84, 136], glow: [60, 40, 70], sun: [0, 0, 0], ambient: [0.2, 0.22, 0.38], haze: [70, 70, 118] },
  { at: -3, zenith: [34, 50, 110], midSky: [104, 106, 162], horizon: [238, 142, 110], glow: [255, 120, 80], sun: [0.18, 0.08, 0.06], ambient: [0.36, 0.34, 0.48], haze: [190, 140, 150] },
  { at: 3, zenith: [58, 92, 160], midSky: [204, 160, 160], horizon: [255, 178, 104], glow: [255, 150, 60], sun: [1.25, 0.72, 0.38], ambient: [0.62, 0.5, 0.5], haze: [244, 182, 136] },
  { at: 10, zenith: [70, 122, 190], midSky: [176, 190, 210], horizon: [250, 206, 150], glow: [255, 200, 120], sun: [1.2, 0.95, 0.68], ambient: [0.62, 0.6, 0.62], haze: [236, 206, 166] },
  { at: 30, zenith: [62, 128, 210], midSky: [150, 192, 230], horizon: [236, 222, 196], glow: [255, 240, 210], sun: [1.2, 1.12, 0.98], ambient: [0.55, 0.57, 0.64], haze: [232, 220, 198] },
  { at: 90, zenith: [52, 118, 206], midSky: [140, 186, 230], horizon: [230, 224, 206], glow: [255, 250, 235], sun: [1.25, 1.2, 1.1], ambient: [0.6, 0.62, 0.68], haze: [230, 224, 206] },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The light for an hour of the day: the sun is up from six to six, highest at noon. */
export function lightAt(clock: number): Light {
  const c = ((clock % 24) + 24) % 24;
  const day = c >= 6 && c <= 18;
  const angle = ((c - 6) / 12) * Math.PI;
  // Below the horizon the sun sinks fast at first, then slowly; deep night bottoms out at −30°.
  const nightAngle = (((c - 18 + 24) % 24) / 12) * Math.PI;
  const sunElevation = day ? 64 * Math.sin(angle) : -30 * Math.sin(nightAngle) ** 0.6;
  const sunX = day ? 0.5 + 0.47 * Math.cos(angle) : c > 18 || c < 0 ? 0.03 : 0.97;

  let i = 0;
  while (i < KEYS.length - 2 && sunElevation > KEYS[i + 1].at) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = clamp01((sunElevation - a.at) / (b.at - a.at));
  const pick = (k: keyof Omit<Key, "at">) => lerp3(a[k], b[k], t);

  const starlight = smoothstep(-4, -14, sunElevation);
  return {
    clock: c,
    sunElevation,
    sunX,
    zenith: pick("zenith"),
    midSky: pick("midSky"),
    horizon: pick("horizon"),
    glow: pick("glow"),
    sun: pick("sun"),
    ambient: pick("ambient"),
    moon: [0.32 * starlight, 0.38 * starlight, 0.6 * starlight],
    haze: pick("haze"),
    starlight,
  };
}

/** A surface of colour `albedo` (0–255) facing the sun by `facing` (−1 away, 1 square on). */
export function litColour(light: Light, albedo: RGB, facing: number, extra: RGB = [0, 0, 0]): RGB {
  const sunTerm = Math.max(0, facing);
  const moonTerm = 0.55 + 0.45 * Math.max(0, facing);
  return [
    Math.min(255, albedo[0] * (light.ambient[0] + light.sun[0] * sunTerm + light.moon[0] * moonTerm + extra[0])),
    Math.min(255, albedo[1] * (light.ambient[1] + light.sun[1] * sunTerm + light.moon[1] * moonTerm + extra[1])),
    Math.min(255, albedo[2] * (light.ambient[2] + light.sun[2] * sunTerm + light.moon[2] * moonTerm + extra[2])),
  ];
}

export const css = (c: RGB, alpha = 1) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${alpha})`;
