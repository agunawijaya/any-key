import type { BullColours } from "../../render/bullFigure";
import type { MatadorColours } from "../../render/matadorFigure";

/*
 * The Vintage Poster's inks. A lithograph is printed in a handful of flat
 * colours, so every surface gets one colour for sun and one for shade, and
 * gradients are kept for the sky and the glow of lamps.
 *
 * Light is the afternoon corrida: a pale turquoise sky, the sand gold in the
 * sun and lavender-blue across the shadow line. Dark is the evening
 * festival: a deep blue night, lamps round the ring, the shade side deep
 * blue and the lit side warm under the lamps.
 */

export type Pair = { sun: string; shade: string };

export type PosterPalette = {
  paper: string;
  paperEdge: string;
  ink: string;
  frameGold: string;
  frameRed: string;
  title: string;
  titleShadow: string;
  subtitle: string;
  skyTop: string;
  skyLow: string;
  sunDisc: string;
  stars: string | null;
  lamp: string | null;
  lampGlow: string;
  sand: Pair;
  sandMark: Pair;
  painted: Pair;
  barrier: Pair;
  barrierTop: Pair;
  passage: Pair;
  wall: Pair;
  riser: Pair;
  step: Pair;
  arch: Pair;
  column: Pair;
  roof: Pair;
  gateDark: string;
  gateGlow: string;
  shadow: string;
  /** What figures, the cape and the crowd are mixed towards across the shadow line. */
  shadeTint: string;
  /** What distant rows of the crowd fade towards. */
  haze: string;
  dust: string;
  cape: { front: string; frontShade: string; back: string; backShade: string; braid: string };
  /** Shirt, jacket and hat colours for the crowd, in the order of their looks. */
  crowd: string[];
  skin: string[];
  hatDark: string;
  hatStraw: string;
  flowers: string[];
  matador: MatadorColours;
  bull: BullColours;
};

export const POSTER_LIGHT: PosterPalette = {
  paper: "#efe0bd",
  paperEdge: "#e2cc9c",
  ink: "#21160f",
  frameGold: "#c98f2a",
  frameRed: "#b3241f",
  title: "#b3241f",
  titleShadow: "#21160f",
  subtitle: "#3a2a1c",
  skyTop: "#86b5ae",
  skyLow: "#efdfb6",
  sunDisc: "#f8e9b8",
  stars: null,
  lamp: null,
  lampGlow: "rgb(255 214 140 / 0)",
  sand: { sun: "#e8b247", shade: "#8f8fb2" },
  sandMark: { sun: "#d49a35", shade: "#7c7ca4" },
  painted: { sun: "#f6ecd6", shade: "#b8b8d4" },
  barrier: { sun: "#ad2a1f", shade: "#5f2534" },
  barrierTop: { sun: "#f1e2c0", shade: "#a7a3bf" },
  passage: { sun: "#c99a52", shade: "#6c6c91" },
  wall: { sun: "#ead2a0", shade: "#7a7fa3" },
  riser: { sun: "#e4c48c", shade: "#6e7599" },
  step: { sun: "#cfa96b", shade: "#5b6188" },
  arch: { sun: "#f3e6c8", shade: "#8e93b4" },
  column: { sun: "#d79a45", shade: "#5c6087" },
  roof: { sun: "#b4502c", shade: "#5a3a4c" },
  gateDark: "#2a1d1a",
  gateGlow: "#f6c770",
  shadow: "rgb(110 60 30 / 0.24)",
  shadeTint: "#3a3d78",
  haze: "#e9d7ad",
  dust: "#f3dca6",
  cape: { front: "#d21d2c", frontShade: "#a41425", back: "#b8182b", backShade: "#86102a", braid: "#e2a83a" },
  crowd: ["#efe2c4", "#b8432f", "#2c2724", "#3d5a8a", "#d4a24a", "#f6efdf", "#5d7a58", "#9a6236", "#7a4552", "#e2cfa0", "#45465c", "#c97a3e"],
  skin: ["#e3b08a", "#c98f68", "#a8714f", "#f0c8a2", "#8c5a3c"],
  hatDark: "#1d1714",
  hatStraw: "#ecd28c",
  flowers: ["#d8202f", "#f6efe0", "#f2b73c", "#e2577a", "#d8202f", "#f6efe0"],
  matador: {
    ink: "#21160f",
    suit: "#223a6e",
    gold: "#e2a93a",
    skin: "#d9a07a",
    skinShade: "#a86e4c",
    hair: "#3a2418",
    stocking: "#f0b3c0",
    slipper: "#1a1514",
    hat: "#14100f",
    shirt: "#fbf4e6",
    tie: "#a8182a",
  },
  bull: {
    light: "#4d3d34",
    body: "#231b17",
    shade: "#100c0b",
    far: "#140f0d",
    ink: "#0f0a08",
    sheen: "#806452",
    horn: "#f3e5c6",
    hornTip: "#2e2219",
    hoof: "#0c0908",
    muzzle: "#5e4b40",
    eyeWhite: "#f6e9d0",
    pupil: "#100a08",
  },
};

export const POSTER_DARK: PosterPalette = {
  paper: "#1b1a2a",
  paperEdge: "#12111d",
  ink: "#0b0a10",
  frameGold: "#d9a646",
  frameRed: "#c4322b",
  title: "#f0c25a",
  titleShadow: "#0b0a10",
  subtitle: "#e6d3a8",
  skyTop: "#0c1130",
  skyLow: "#3d2c58",
  sunDisc: "#f1e4c4",
  stars: "#f3e9cf",
  lamp: "#ffe2a0",
  lampGlow: "rgb(255 196 110 / 0.55)",
  sand: { sun: "#c1873f", shade: "#2f3a68" },
  sandMark: { sun: "#a87235", shade: "#28325c" },
  painted: { sun: "#f2dfb6", shade: "#6a76a6" },
  barrier: { sun: "#8f2620", shade: "#3d1a2c" },
  barrierTop: { sun: "#e6cf9c", shade: "#5d6290" },
  passage: { sun: "#8b5f34", shade: "#262d55" },
  wall: { sun: "#b88d58", shade: "#2a3159" },
  riser: { sun: "#a87d4c", shade: "#252c52" },
  step: { sun: "#8c6640", shade: "#1e2447" },
  arch: { sun: "#d9bd8c", shade: "#343d6b" },
  column: { sun: "#b07a3c", shade: "#262c52" },
  roof: { sun: "#7d3a2a", shade: "#2a2040" },
  gateDark: "#120d14",
  gateGlow: "#ffbf62",
  shadow: "rgb(40 20 10 / 0.3)",
  shadeTint: "#151a3d",
  haze: "#2b2a4a",
  dust: "#d8b98a",
  cape: { front: "#d82434", frontShade: "#a8182b", back: "#b81c30", backShade: "#7e1028", braid: "#e8b44a" },
  crowd: ["#e6d7b8", "#b8302a", "#1a1820", "#2e4a8c", "#d09a3a", "#efe6d6", "#4b7350", "#9a5a30", "#7a2f55", "#d6c08e", "#363756", "#cc6630"],
  skin: ["#c99470", "#b07a58", "#8f5f42", "#d7ad88", "#7a4c32"],
  hatDark: "#0f0d10",
  hatStraw: "#d8ba78",
  flowers: ["#e02a38", "#f6efe0", "#f2b73c", "#e2577a", "#e02a38", "#f6efe0"],
  matador: {
    ink: "#0b0a10",
    suit: "#2c4785",
    gold: "#ecb648",
    skin: "#c99272",
    skinShade: "#93603f",
    hair: "#2f1d16",
    stocking: "#e2a6b4",
    slipper: "#0f0d0e",
    hat: "#0a0809",
    shirt: "#efe7d8",
    tie: "#b81c30",
  },
  bull: {
    light: "#3e3340",
    body: "#1c1619",
    shade: "#0b090d",
    far: "#100c10",
    ink: "#060508",
    sheen: "#6a5a66",
    horn: "#ead9b8",
    hornTip: "#2a1f1a",
    hoof: "#09080a",
    muzzle: "#4e4048",
    eyeWhite: "#f0e2c8",
    pupil: "#0b080a",
  },
};
