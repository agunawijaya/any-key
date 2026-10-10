/* Colours as plain [r, g, b] triples (0–255), mixed in code and turned into CSS strings when painted. */

export type Rgb = readonly [number, number, number];

export const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Lighter (k > 1) or darker (k < 1), clamped. */
export const shade = (c: Rgb, k: number): Rgb => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];

export const css = (c: Rgb, alpha = 1) =>
  alpha >= 1 ? `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0})` : `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${Math.max(0, alpha).toFixed(3)})`;

/** A small random shift in brightness and warmth, for paint that isn't flat. */
export const jitter = (c: Rgb, amount: number, r: () => number): Rgb => {
  const k = 1 + (r() * 2 - 1) * amount;
  const warm = (r() * 2 - 1) * amount * 40;
  return [Math.min(255, c[0] * k + warm), Math.min(255, c[1] * k), Math.min(255, c[2] * k - warm)];
};
