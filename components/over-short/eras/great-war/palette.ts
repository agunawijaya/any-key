import { rgb, type Rgb } from "../../scene/color";
import type { Appearance, Lighting } from "../../scene/side";

/*
 * The Great War's colours: the muted earths, olive greys and slate skies of
 * the war artists, under a pale overcast day; by night a blue-black dark,
 * and the hard silver-white of the land under a star shell.
 */

export type Palette = {
  skyTop: Rgb;
  skyMid: Rgb;
  skyLow: Rgb;
  cloudLight: Rgb;
  cloudMid: Rgb;
  cloudShadow: Rgb;
  /** The far ridge and the village on it. */
  far: Rgb;
  farDetail: Rgb;
  /** The country behind the line: rolling ground, woods, farms. */
  country: Rgb;
  countryDark: Rgb;
  woods: Rgb;
  plaster: Rgb;
  roof: Rgb;
  /** The ground the shells land on. */
  mud: Rgb;
  mudDark: Rgb;
  mudLight: Rgb;
  grass: Rgb;
  water: Rgb;
  /** The ground just in front, and the very nearest silhouettes. */
  near: Rgb;
  nearDark: Rgb;
  wire: Rgb;
  sandbag: Rgb;
  foreground: Rgb;
  /** Light on the top edges of things. */
  rim: Rgb;
  haze: Rgb;
};

const DAY: Palette = {
  skyTop: rgb("#69737d"),
  skyMid: rgb("#a3a399"),
  skyLow: rgb("#ebe2cb"),
  cloudLight: rgb("#f7f0e0"),
  cloudMid: rgb("#b3b0a4"),
  cloudShadow: rgb("#5f676d"),
  far: rgb("#a6a99f"),
  farDetail: rgb("#8b8f88"),
  country: rgb("#6c6954"),
  countryDark: rgb("#4c4a3d"),
  woods: rgb("#3b392f"),
  plaster: rgb("#bcae94"),
  roof: rgb("#6c5241"),
  mud: rgb("#5a4936"),
  mudDark: rgb("#332920"),
  mudLight: rgb("#8d7862"),
  grass: rgb("#5f5e43"),
  water: rgb("#ece5d2"),
  near: rgb("#3e3329"),
  nearDark: rgb("#271f19"),
  wire: rgb("#1f1b17"),
  sandbag: rgb("#8a7b62"),
  foreground: rgb("#17130f"),
  rim: rgb("#f6ecd6"),
  haze: rgb("#dfd6c0"),
};

const NIGHT: Palette = {
  skyTop: rgb("#060a12"),
  skyMid: rgb("#0d131e"),
  skyLow: rgb("#1b2130"),
  cloudLight: rgb("#2f3646"),
  cloudMid: rgb("#1a2030"),
  cloudShadow: rgb("#0b0f18"),
  far: rgb("#1c2330"),
  farDetail: rgb("#161c27"),
  country: rgb("#171c25"),
  countryDark: rgb("#11151d"),
  woods: rgb("#0d1017"),
  plaster: rgb("#262b33"),
  roof: rgb("#1b1d23"),
  mud: rgb("#17171b"),
  mudDark: rgb("#0e0e12"),
  mudLight: rgb("#22232a"),
  grass: rgb("#15181c"),
  water: rgb("#2b3342"),
  near: rgb("#111115"),
  nearDark: rgb("#0b0b0e"),
  wire: rgb("#07070a"),
  sandbag: rgb("#22232a"),
  foreground: rgb("#050507"),
  rim: rgb("#3a4254"),
  haze: rgb("#1d2433"),
};

/** The land as a star shell shows it: drained of colour, silver on top, black in the hollows. */
const FLARE: Palette = {
  ...NIGHT,
  far: rgb("#6c7380"),
  farDetail: rgb("#545b68"),
  country: rgb("#7c8088"),
  countryDark: rgb("#4c5059"),
  woods: rgb("#2a2d33"),
  plaster: rgb("#c4c6c8"),
  roof: rgb("#55575c"),
  mud: rgb("#8a8784"),
  mudDark: rgb("#3c3a3a"),
  mudLight: rgb("#c9c7c2"),
  grass: rgb("#77786f"),
  water: rgb("#eef0f2"),
  near: rgb("#5d5b59"),
  nearDark: rgb("#2c2b2b"),
  wire: rgb("#101012"),
  sandbag: rgb("#a7a49c"),
  foreground: rgb("#0b0b0d"),
  rim: rgb("#ffffff"),
  haze: rgb("#59606e"),
};

export const paletteFor = (appearance: Appearance, lighting: Lighting = "ambient"): Palette =>
  appearance === "day" ? DAY : lighting === "flare" ? FLARE : NIGHT;
