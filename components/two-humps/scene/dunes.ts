import { fbm1, hash1, noise1 } from "@/lib/two-humps/noise";
import { clamp01, css, lerp3, litColour, type Light, type RGB } from "./light";

/*
 * The ground, in parallax layers from the far ranges to the sand under the
 * camel's feet.
 *
 * Gobi dunes are barchans and transverse ridges shaped by a steady wind: a
 * long, gentle windward slope up to a sharp brink, then a short slip face at
 * the angle of repose. Our wind blows left to right, so slip faces face right.
 * Each layer is a height profile along the world; the screen samples it in
 * narrow columns and shades every column by how squarely it faces the sun,
 * which gives the long golden-hour shadows on the slip faces for free.
 */

export type LayerKind = "range" | "dunes" | "ground";

export type DuneLayer = {
  kind: LayerKind;
  /** How fast the layer slides past as the camel moves: 0 never, 1 with the ground. */
  parallax: number;
  /** The layer's baseline, as a share of the screen height from the top. */
  base: number;
  /** Crest height, as a share of the screen height. */
  amp: number;
  /** Distance between crests, as a share of the screen height. */
  wavelength: number;
  albedo: RGB;
  /** How much distance haze covers it, 0–1. */
  haze: number;
  /** Lines of wind ripples drawn into its faces. */
  ripples: number;
  seed: number;
  /** How much of a scene's lift the layer takes: the near ground all of it, the far ranges none. */
  lifts: number;
};

export const GOBI_LAYERS: DuneLayer[] = [
  { kind: "range", parallax: 0.02, base: 0.6, amp: 0.12, wavelength: 0.9, albedo: [178, 140, 128], haze: 0.6, ripples: 0, seed: 11, lifts: 0 },
  { kind: "range", parallax: 0.05, base: 0.625, amp: 0.06, wavelength: 0.45, albedo: [190, 146, 120], haze: 0.46, ripples: 0, seed: 23, lifts: 0 },
  { kind: "dunes", parallax: 0.12, base: 0.665, amp: 0.075, wavelength: 0.55, albedo: [246, 194, 132], haze: 0.34, ripples: 0, seed: 37, lifts: 0.1 },
  { kind: "dunes", parallax: 0.3, base: 0.73, amp: 0.13, wavelength: 0.8, albedo: [250, 196, 128], haze: 0.16, ripples: 3, seed: 41, lifts: 0.4 },
  { kind: "dunes", parallax: 0.6, base: 0.8, amp: 0.14, wavelength: 1.0, albedo: [252, 198, 126], haze: 0.05, ripples: 5, seed: 53, lifts: 0.75 },
  { kind: "ground", parallax: 1, base: 0.87, amp: 0.035, wavelength: 1.3, albedo: [250, 194, 122], haze: 0, ripples: 8, seed: 67, lifts: 1 },
];

/** `lift` raises the near ground (as a share of the height) for screens with controls along the bottom. */
export type GroundView = { width: number; height: number; travel: number; lift?: number };

/** A layer's baseline on this screen, after any lift. */
const baseOf = (layer: DuneLayer, view: GroundView) => layer.base - (view.lift ?? 0) * layer.lifts;

/** Height of a layer above its baseline at world position `u` (in wavelengths), 0–1 or so. */
function profile(layer: DuneLayer, u: number): number {
  if (layer.kind === "range") {
    // Weathered ranges: broad masses with sharper ridges on top.
    const broad = fbm1(u * 0.6, layer.seed, 3);
    const ridge = 1 - Math.abs(2 * noise1(u * 2.3, layer.seed + 5) - 1);
    return 0.55 * broad + 0.45 * ridge * broad * 1.3;
  }
  // Dunes: warp the spacing so no two are alike, then one asymmetric dune per wavelength.
  const w = u + 0.7 * (fbm1(u * 0.31, layer.seed + 9, 2) - 0.5);
  const i = Math.floor(w);
  const f = w - i;
  const size = 0.45 + 0.55 * hash1(i, layer.seed);
  const crest = 0.66 + 0.14 * hash1(i, layer.seed + 3);
  let shape: number;
  if (f < crest) {
    const s = f / crest;
    shape = s ** 1.35;
  } else {
    const s = (f - crest) / (1 - crest);
    shape = (1 - s) ** 1.5;
  }
  const swell = layer.kind === "ground" ? 0.6 : 0.18;
  return size * shape * (1 - swell) + swell * fbm1(u * 0.23, layer.seed + 17, 2) + 0.03 * noise1(u * 9, layer.seed + 21);
}

/** The y of a layer's surface at screen x. */
export function surfaceY(layer: DuneLayer, view: GroundView, x: number): number {
  const h = view.height;
  const u = (x + view.travel * layer.parallax) / (layer.wavelength * h);
  return h * (baseOf(layer, view) - layer.amp * profile(layer, u));
}

/** The sun's direction across the screen: +1 shining from the right, −1 from the left. */
const sunSide = (light: Light) => (light.sunX >= 0.5 ? 1 : -1);

export type DuneExtras = {
  /** Extra light added to the sand (firelight, lanterns), per column. */
  glowAt?: (x: number, y: number) => RGB;
};

export function drawLayer(ctx: CanvasRenderingContext2D, layer: DuneLayer, view: GroundView, light: Light, extras: DuneExtras = {}) {
  const { width, height } = view;
  const step = layer.kind === "range" ? 4 : 2;
  const columns = Math.ceil(width / step) + 2;
  const ys = new Float32Array(columns + 1);
  for (let c = 0; c <= columns; c++) ys[c] = surfaceY(layer, view, c * step);

  const side = sunSide(light);
  const elevation = (Math.max(1, light.sunElevation) * Math.PI) / 180;
  const sun = { x: side * Math.cos(elevation), y: Math.sin(elevation) };
  // Windward faces lean left, slip faces lean right and much steeper.
  // Seen from a little above, windward faces still catch some of a low sun.
  const windwardFacing = sun.y * 0.96 - sun.x * 0.12 + 0.22;
  const leeFacing = sun.y * 0.55 + sun.x * 0.84;
  const tone = (facing: number, y: number) => lerp3(litColour(light, layer.albedo, facing, extras.glowAt?.(width / 2, y)), light.haze, layer.haze);

  const top = height * (baseOf(layer, view) - layer.amp);
  const silhouette = new Path2D();
  silhouette.moveTo(0, height);
  for (let c = 0; c <= columns; c++) silhouette.lineTo(c * step, ys[c]);
  silhouette.lineTo(columns * step, height);
  silhouette.closePath();

  // The body of the layer: lit on top, sinking into shade and haze towards its foot.
  const body = ctx.createLinearGradient(0, top, 0, height * (baseOf(layer, view) + 0.1));
  body.addColorStop(0, css(tone(windwardFacing + 0.08, top)));
  body.addColorStop(0.55, css(tone(windwardFacing - 0.12, top)));
  body.addColorStop(1, css(lerp3(tone(windwardFacing - 0.4, top), light.haze, 0.25)));
  ctx.fillStyle = body;
  ctx.fill(silhouette);

  ctx.save();
  ctx.clip(silhouette);
  const faces = slipFaces(ys, step, layer.kind === "range" ? 1.2 : 0.55);
  for (const face of faces) drawSlipFace(ctx, face, ys, step, tone(leeFacing, face.crestY), tone(windwardFacing, face.crestY), layer.kind === "range" ? 0.55 : 0.9);
  ctx.restore();

  if (layer.kind !== "range") drawBrinks(ctx, layer, faces, ys, step, light);
  if (layer.ripples > 0) drawRipples(ctx, layer, view, ys, step, light, side);
}

type SlipFace = { crest: number; foot: number; crestY: number; footY: number };

/** Each crest with a steep drop after it, and where that drop bottoms out. */
function slipFaces(ys: Float32Array, step: number, minSlope: number): SlipFace[] {
  const faces: SlipFace[] = [];
  let c = 1;
  while (c < ys.length - 1) {
    const isCrest = ys[c] <= ys[c - 1] && ys[c] < ys[c + 1];
    if (!isCrest) {
      c++;
      continue;
    }
    let foot = c + 1;
    while (foot < ys.length - 1 && ys[foot + 1] > ys[foot]) foot++;
    const drop = ys[foot] - ys[c];
    const run = (foot - c) * step;
    if (drop > 0 && drop / run > minSlope * 0.35) faces.push({ crest: c, foot, crestY: ys[c], footY: ys[foot] });
    c = foot + 1;
  }
  return faces;
}

/**
 * A slip face seen from a little above: a wedge that runs from the brink down
 * the profile to the foot, and back under the brink towards the viewer.
 */
function drawSlipFace(ctx: CanvasRenderingContext2D, face: SlipFace, ys: Float32Array, step: number, lee: RGB, windward: RGB, strength: number) {
  const xc = face.crest * step;
  const xf = face.foot * step;
  const drop = face.footY - face.crestY;
  const toe = { x: xf - (xf - xc) * 0.62 - drop * 0.35, y: face.footY + drop * 0.9 };
  const path = new Path2D();
  path.moveTo(xc, face.crestY);
  for (let c = face.crest + 1; c <= face.foot; c++) path.lineTo(c * step, ys[c]);
  path.quadraticCurveTo(xf - (xf - xc) * 0.2, face.footY + drop * 0.55, toe.x, toe.y);
  path.quadraticCurveTo(xc - drop * 0.05, face.crestY + drop * 0.5, xc, face.crestY);
  const g = ctx.createLinearGradient(xc, face.crestY, toe.x, toe.y);
  g.addColorStop(0, css(lee, strength));
  g.addColorStop(0.7, css(lerp3(lee, windward, 0.35), strength * 0.85));
  g.addColorStop(1, css(windward, 0));
  ctx.fillStyle = g;
  ctx.fill(path);
}

/** A thin line of light along each brink, brightest where the sun grazes it. */
function drawBrinks(ctx: CanvasRenderingContext2D, layer: DuneLayer, faces: SlipFace[], ys: Float32Array, step: number, light: Light) {
  const strength = clamp01(Math.max(light.sun[0] * 0.9, light.moon[0] * 1.8));
  if (strength < 0.05) return;
  const highlight = lerp3(litColour(light, layer.albedo, 1.3), [255, 246, 226], 0.3);
  ctx.strokeStyle = css(lerp3(highlight, light.haze, layer.haze), 0.7 * strength);
  ctx.lineWidth = Math.max(1, layer.parallax * 2.4);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const face of faces) {
    // Back down the windward side a little way from each brink.
    const from = Math.max(0, face.crest - Math.round((face.foot - face.crest) * 1.4));
    ctx.moveTo(from * step, ys[from] + 0.6);
    for (let c = from + 1; c <= face.crest; c++) ctx.lineTo(c * step, ys[c] + 0.6);
  }
  ctx.stroke();
}

/**
 * Wind ripples: fine lines a little below the surface that follow its
 * contour, drawn darker on lit faces and lighter on shaded ones, and fading
 * the deeper they lie.
 */
function drawRipples(ctx: CanvasRenderingContext2D, layer: DuneLayer, view: GroundView, ys: Float32Array, step: number, light: Light, side: number) {
  const h = view.height;
  const spacing = h * 0.0085 * (layer.parallax + 0.4);
  const dark = lerp3(litColour(light, layer.albedo, -0.4), light.haze, layer.haze);
  const bright = lerp3(litColour(light, layer.albedo, 1.3), light.haze, layer.haze);
  const offset = view.travel * layer.parallax;
  for (let k = 1; k <= layer.ripples; k++) {
    const depth = k * spacing * (1 + k * 0.12);
    const alpha = 0.22 * (1 - k / (layer.ripples + 1.5));
    for (const [colour, shift] of [
      [dark, 0],
      [bright, 1.2],
    ] as const) {
      ctx.strokeStyle = css(colour, alpha * (shift ? 0.7 : 1));
      ctx.lineWidth = Math.max(0.8, h / 1100);
      ctx.beginPath();
      let drawing = false;
      for (let c = 0; c < ys.length; c++) {
        const x = c * step;
        const wx = (x + offset) / h;
        const wiggle = Math.sin(wx * 46 + k * 1.7 + noise1(wx * 3, layer.seed + k) * 6) * spacing * 0.35;
        // Ripples sit on the windward faces; a gap in them shows a slip face.
        const slope = ys[Math.min(ys.length - 1, c + 1)] - ys[Math.max(0, c - 1)];
        const onWindward = side > 0 ? slope < step * 0.9 : slope > -step * 0.9;
        const show = onWindward && noise1(wx * 5 + k * 3.1, layer.seed + 40) > 0.32;
        const y = ys[c] + depth + wiggle + shift;
        if (show) {
          if (!drawing) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          drawing = true;
        } else drawing = false;
      }
      ctx.stroke();
    }
  }
}
