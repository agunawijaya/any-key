/*
 * The Storybook's two pictures of the same meadow: a sunny afternoon and a
 * full-moon night. Every colour the style paints with comes from here, so a
 * change of appearance is a change of `Look`, never an inverted picture.
 */

import type { Pt } from "./paint";

export type Look = {
  night: boolean;
  /** Towards the light, on the ground (x east, y north), normalised. */
  lightGround: Pt;
  /** The light's height above the horizon, in radians. */
  lightElevation: number;
  /** Towards the light, on screen, for shading figures (up is negative y). */
  lightScreen: Pt;
  ink: string;
  inkSoft: string;
  paper: { tint: string; grain: number; vignette: string };
  meadow: { base: string; shade: string; lit: string; deep: string; blades: string[]; flowers: string[]; flowerHearts: string };
  earth: { topsoil: string; wall: string; clay: string; sand: string; pebble: string[]; root: string };
  floor: { base: string; light: string; dark: string; speck: string; spot: string };
  shadow: string;
  rabbit: { fur: string; shade: string; deep: string; innerEar: string; nose: string; eye: string; rage: string; glow: number; rim?: string };
  kid: { skin: string; skinShade: string; cheek: string; hat: string; hatShade: string; pompom: string; coat: string; coatShade: string; scarf: string; scarfStripe: string; trousers: string; boots: string; pack: string; rim?: string };
  dust: { fill: string; shade: string };
  star: string;
  sky: { top: string; middle: string; horizon: string; disc: string; glow: string; cloud: string; hills: string[] };
  /** Butterflies by day, fireflies by night. */
  critters: string[];
  lettering: { fill: string; shade: string; ink: string };
};

const norm = (x: number, y: number): Pt => {
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
};

export const SUNNY: Look = {
  night: false,
  lightGround: norm(-0.62, 0.78),
  lightElevation: (52 * Math.PI) / 180,
  lightScreen: norm(-0.6, -0.8),
  ink: "#3a271d",
  inkSoft: "#6b4c3a",
  paper: { tint: "#f7ecd6", grain: 0.36, vignette: "#6b4a2c" },
  meadow: {
    base: "#a3b56a",
    shade: "#7f9752",
    lit: "#c9d184",
    deep: "#5e7a3e",
    blades: ["#6c8a43", "#86a352", "#a6bb66", "#58743a", "#bfca7a", "#93ad5b"],
    flowers: ["#fbf6ea", "#f4cf4a", "#c98bd6", "#e2583e", "#7fa6e0"],
    flowerHearts: "#e8a22c",
  },
  earth: {
    topsoil: "#5e3f2c",
    wall: "#956645",
    clay: "#b47f55",
    sand: "#cc9d6c",
    pebble: ["#b8ab9a", "#a39586", "#cfc4b2", "#8f8478"],
    root: "#6e4a33",
  },
  floor: { base: "#cfa676", light: "#e2c08f", dark: "#b48858", speck: "#9c744d", spot: "#7d5b3e" },
  shadow: "#5b3f52",
  rabbit: { fur: "#fdf8f0", shade: "#d9d2e2", deep: "#b5abc6", innerEar: "#f1b1b6", nose: "#e8848f", eye: "#2b2130", rage: "#d8322a", glow: 0 },
  kid: {
    skin: "#f0c095",
    skinShade: "#d99a72",
    cheek: "#ec8b78",
    hat: "#2e8f88",
    hatShade: "#21706b",
    pompom: "#f7eedb",
    coat: "#e8a63a",
    coatShade: "#c27f25",
    scarf: "#d8432e",
    scarfStripe: "#f8e4c2",
    trousers: "#3f4d70",
    boots: "#5b3a28",
    pack: "#8a5a3b",
  },
  dust: { fill: "#efdcb8", shade: "#cdb08a" },
  star: "#ffd23f",
  sky: {
    top: "#7fb4dc",
    middle: "#bcd9e6",
    horizon: "#fbe0b0",
    disc: "#fff2c4",
    glow: "#ffd98a",
    cloud: "#fffaf0",
    hills: ["#9bb36c", "#7f9a58", "#647f45"],
  },
  critters: ["#f6d24a", "#8fb6ec", "#f29bb2"],
  lettering: { fill: "#ffd23f", shade: "#e2862b", ink: "#3a271d" },
};

export const MOONLIT: Look = {
  night: true,
  lightGround: norm(-0.72, 0.69),
  lightElevation: (30 * Math.PI) / 180,
  lightScreen: norm(-0.72, -0.69),
  ink: "#0d1324",
  inkSoft: "#26304a",
  paper: { tint: "#1b2440", grain: 0.38, vignette: "#03050d" },
  meadow: {
    base: "#2b4a51",
    shade: "#1f3940",
    lit: "#4c7472",
    deep: "#15282e",
    blades: ["#1d353b", "#284a4f", "#36605f", "#173036", "#4f7b77", "#2f5556"],
    flowers: ["#e9eefc", "#c8d39a", "#9a8fd0", "#c56a6a", "#86a8e6"],
    flowerHearts: "#d8c070",
  },
  earth: {
    topsoil: "#1b1a2c",
    wall: "#2f3150",
    clay: "#3b3d60",
    sand: "#4c4f74",
    pebble: ["#5d6886", "#4c5674", "#6f7a98", "#434c68"],
    root: "#24223a",
  },
  floor: { base: "#566384", light: "#8796bd", dark: "#424d6c", speck: "#323b58", spot: "#262d48" },
  shadow: "#060a20",
  rabbit: { fur: "#eaf0fb", shade: "#99a5c6", deep: "#6b7598", innerEar: "#c792a8", nose: "#c87a94", eye: "#141a2c", rage: "#ff3b2e", glow: 1, rim: "#f8f7e6" },
  kid: {
    skin: "#dcae8c",
    skinShade: "#a87a6a",
    cheek: "#c97a78",
    hat: "#2b7a7b",
    hatShade: "#1b5459",
    pompom: "#e6e6dc",
    coat: "#cf9a43",
    coatShade: "#8d6a3e",
    scarf: "#c23d33",
    scarfStripe: "#e7d8bc",
    trousers: "#2e3958",
    boots: "#3b2a26",
    pack: "#6d4c3e",
    rim: "#f8f4d8",
  },
  dust: { fill: "#8d8aa6", shade: "#5d5a78" },
  star: "#ffe27a",
  sky: {
    top: "#060a1f",
    middle: "#132050",
    horizon: "#3a4f86",
    disc: "#f6f3dc",
    glow: "#b9c6f0",
    cloud: "#3a4778",
    hills: ["#1c2f45", "#15253a", "#0f1b2c"],
  },
  critters: ["#e8ff8a", "#c8ff7a", "#fff2a0"],
  lettering: { fill: "#ffe27a", shade: "#e08a3a", ink: "#0d1324" },
};

export const lookFor = (night: boolean) => (night ? MOONLIT : SUNNY);
