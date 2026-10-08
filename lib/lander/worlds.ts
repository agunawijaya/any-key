/*
 * The four worlds. Gravity and radius drive everything else through the same
 * recipe the 1979 program used: the starting height grows with the square root
 * of gravity, the tank with the height, and the engine with the tank and the
 * log of gravity. The first three worlds use the 1979 figures; the fourth is
 * the real metal asteroid Psyche instead of the original's invented one.
 */

export type WorldId = "earth" | "moon" | "mars" | "psyche";
export type TimeOfDay = "day" | "night";

export type Palette = {
  /** Sky from the zenith down to the horizon, once you're inside the air (or always, on airless worlds). */
  sky: [string, string, string];
  /** Near ground, middle ground and far ridges. */
  ground: [string, string, string];
  /** Crater rims and rock highlights. */
  rim: string;
  /** Shadows inside craters and under rocks. */
  shade: string;
  /** The glow along the planet's edge seen from high up. */
  limb: string;
  stars: number;
  sun: string | null;
  /** Something hanging in the sky: Earth over the Moon, the Moon over Earth. */
  moon?: { color: string; glow: string; x: number; y: number; r: number };
  /** Mars at dusk: the famous blue glow around the setting sun. */
  sunset?: string;
  /** Earth at night: the lights of towns along the coast. */
  lights?: string;
  /** Psyche: sparkles on bare metal. */
  glint?: string;
  dust: string;
  /** The postcard's text and frame. */
  ink: string;
  paper: string;
};

export type World = {
  id: WorldId;
  name: string;
  /** For share texts only (pasted into chats); the page draws its own icon. */
  shareGlyph: string;
  /** Surface gravity in cm/s², as the 1979 program wrote it. */
  g1: number;
  /** Radius in km. */
  radius: number;
  /** Gravity in the game's own unit: km/h gained per second. */
  g2: number;
  /** Starting height (km), tank size (fuel units) and engine strength. */
  startAlt: number;
  fuel: number;
  thrust: number;
  /** Height of the visible air, in km (0 = no air). */
  air: number;
  realGravity: string;
  tagline: string;
  facts: string[];
  palette: Record<TimeOfDay, Palette>;
};

/** Mass of the lander without fuel, in the 1979 program's units. */
export const DRY_MASS = 15_000;
/** Everyone arrives at the same speed, straight down. */
export const ENTRY_SPEED = 5_000;

function derive(g1: number) {
  const g2 = g1 / 36;
  const startAlt = Math.max(175, Math.trunc(Math.sqrt(g2) * 100));
  const fuel = Math.max(10_000, Math.trunc(startAlt * 55));
  const thrust = fuel * (Math.log(g1) / 20) + 10_000;
  return { g1, g2, startAlt, fuel, thrust };
}

export const WORLDS: World[] = [
  {
    id: "moon",
    name: "Moon",
    shareGlyph: "🌕",
    ...derive(162),
    radius: 1738,
    air: 0,
    realGravity: "1.62 m/s²",
    tagline: "The classic. No air, no wind, no excuses.",
    facts: ["Six crews landed here between 1969 and 1972.", "The sky is black even at noon: there's no air to scatter the light."],
    palette: {
      day: {
        sky: ["#020308", "#05060d", "#0b0d18"],
        ground: ["#e9e6df", "#b9b8bd", "#8e8f99"],
        rim: "#fbfaf6",
        shade: "#5b5c68",
        limb: "rgba(255,255,255,0.10)",
        stars: 0.25,
        sun: "#fffdf2",
        moon: { color: "#4f8fe8", glow: "rgba(90,150,255,0.3)", x: 0.3, y: 0.34, r: 0.045 },
        dust: "#d8d5ce",
        ink: "#1c1d26",
        paper: "#f1efe9",
      },
      night: {
        sky: ["#01020a", "#040716", "#0a1030"],
        ground: ["#4a5578", "#353e5c", "#262c44"],
        rim: "#7c8ab8",
        shade: "#161a2c",
        limb: "rgba(120,150,255,0.14)",
        stars: 1,
        sun: null,
        moon: { color: "#7fb3ff", glow: "rgba(110,170,255,0.45)", x: 0.3, y: 0.32, r: 0.06 },
        dust: "#6d7aa3",
        ink: "#e8ecff",
        paper: "#141a33",
      },
    },
  },
  {
    id: "mars",
    name: "Mars",
    shareGlyph: "🔴",
    ...derive(374),
    radius: 3380,
    air: 60,
    realGravity: "3.71 m/s²",
    tagline: "Rust, dust and a butterscotch sky.",
    facts: ["Sunsets on Mars are blue: fine dust scatters blue light forward, around the Sun.", "Olympus Mons is nearly three times the height of Everest."],
    palette: {
      day: {
        sky: ["#b9875c", "#dcae7e", "#f3d2a4"],
        ground: ["#c8693a", "#a44f2b", "#80402c"],
        rim: "#e48a55",
        shade: "#6b2f1c",
        limb: "rgba(240,170,110,0.55)",
        stars: 0,
        sun: "#fff4dc",
        dust: "#d98a57",
        ink: "#3a1a10",
        paper: "#f6dfc2",
      },
      night: {
        sky: ["#060914", "#101b3d", "#3f6fb8"],
        ground: ["#5a2e2a", "#3f1f22", "#2a1520"],
        rim: "#8a4a3c",
        shade: "#1a0c12",
        limb: "rgba(90,140,230,0.5)",
        stars: 0.8,
        sun: "#dff0ff",
        sunset: "rgba(120,180,255,0.75)",
        dust: "#8a5244",
        ink: "#e6eeff",
        paper: "#101a38",
      },
    },
  },
  {
    id: "psyche",
    name: "Psyche",
    shareGlyph: "🪨",
    ...derive(14.4),
    radius: 111,
    air: 0,
    realGravity: "0.14 m/s²",
    tagline: "A metal asteroid. Gravity so weak you can hear yourself think.",
    facts: ["Psyche may be the exposed metal core of a baby planet.", "A NASA spacecraft of the same name is due to arrive in 2029."],
    palette: {
      day: {
        sky: ["#030306", "#06060c", "#0d0c14"],
        ground: ["#d7c9ad", "#a89a82", "#7a7064"],
        rim: "#fff3d6",
        shade: "#4a443c",
        limb: "rgba(255,230,190,0.08)",
        stars: 0.35,
        sun: "#fffbe8",
        glint: "#ffffff",
        dust: "#c9bba0",
        ink: "#221e19",
        paper: "#efe8da",
      },
      night: {
        sky: ["#020208", "#070617", "#140f2e"],
        ground: ["#5b566a", "#423e50", "#2d2a3a"],
        rim: "#9a93b8",
        shade: "#16141f",
        limb: "rgba(180,160,255,0.12)",
        stars: 1,
        sun: null,
        glint: "#d9d2ff",
        dust: "#7c7695",
        ink: "#ece8ff",
        paper: "#16132b",
      },
    },
  },
  {
    id: "earth",
    name: "Earth",
    shareGlyph: "🌍",
    ...derive(980.7),
    radius: 6371,
    air: 100,
    realGravity: "9.81 m/s²",
    tagline: "Home. The heaviest gravity and the longest way down.",
    facts: ["Rocket boosters now land upright on floating platforms at sea.", "From 500 km up you can see the curve of the planet."],
    palette: {
      day: {
        sky: ["#1f63d6", "#56a3f0", "#c9ecff"],
        ground: ["#1f6fa8", "#2b87bf", "#6aa7a0"],
        rim: "#e8f6ff",
        shade: "#0f4470",
        limb: "rgba(120,190,255,0.8)",
        stars: 0,
        sun: "#fffbe6",
        dust: "#e9f7ff",
        ink: "#0d2340",
        paper: "#e7f3fb",
      },
      night: {
        sky: ["#03061a", "#0b1640", "#1e3470"],
        ground: ["#0b2344", "#0a1a36", "#101c30"],
        rim: "#5f86c9",
        shade: "#040a18",
        limb: "rgba(80,140,255,0.55)",
        stars: 0.9,
        sun: null,
        moon: { color: "#f1efe6", glow: "rgba(255,255,240,0.35)", x: 0.3, y: 0.26, r: 0.03 },
        lights: "#ffc766",
        dust: "#9fc2e8",
        ink: "#e3ecff",
        paper: "#0b1533",
      },
    },
  },
];

export const worldById = (id: WorldId) => WORLDS.find((w) => w.id === id)!;
