/*
 * The emblems a flag can carry, drawn on a 24×24 grid as single-colour
 * silhouettes (holes cut with the even-odd rule), so they print cleanly on
 * any cloth colour and wave with the flag on the canvas.
 */

export type EmblemId =
  | ""
  | "star"
  | "rocket"
  | "planet"
  | "moon"
  | "comet"
  | "alien"
  | "cat"
  | "dino"
  | "pizza"
  | "bolt"
  | "rainbow"
  | "invader"
  | "gem"
  | "butter"
  | "barrel"
  | "crater"
  | "computer"
  | "black-cat"
  | "trophy";

export type Emblem = { id: EmblemId; label: string; path: string; /** Earned with this achievement. */ unlock?: string };

export const EMBLEMS: Emblem[] = [
  { id: "", label: "No emblem", path: "" },
  { id: "star", label: "Star", path: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" },
  {
    id: "rocket",
    label: "Rocket",
    path: "M12 2c3.2 2.4 4.6 6 4.4 10.4l2.6 3.2V20l-3.4-1.6H8.4L5 20v-4.4l2.6-3.2C7.4 8 8.8 4.4 12 2zm0 6a1.8 1.8 0 1 0 0 3.6A1.8 1.8 0 0 0 12 8zm-2 11.6h4L12 22.6z",
  },
  {
    id: "planet",
    label: "Ringed planet",
    path: "M12 6.5a5.5 5.5 0 0 1 5.4 4.4c2.5-.9 4.3-1 4.6-.3.5 1.1-3.1 3.6-8.4 5.6-5.3 2-9.6 2.6-10.1 1.5-.3-.7 1-2 3.2-3.3A5.5 5.5 0 0 1 12 6.5zm5.5 6.1c-.7 2.4-2.9 4.2-5.5 4.2-1.2 0-2.3-.4-3.2-1 2.9-.6 6-1.8 8.7-3.2z",
  },
  { id: "moon", label: "Crescent moon", path: "M15 2.5a9.5 9.5 0 1 0 6.5 16.4A8 8 0 0 1 15 2.5z" },
  { id: "comet", label: "Comet", path: "M15.5 4a5 5 0 1 1-4.6 7L3 20.5l2.2-6.9L2 12.1l8.7-1.7A5 5 0 0 1 15.5 4z" },
  {
    id: "alien",
    label: "Alien",
    path: "M12 2.5c4.7 0 7.5 3.3 7.5 7.3 0 4.6-4.2 10.7-7.5 11.7-3.3-1-7.5-7.1-7.5-11.7 0-4 2.8-7.3 7.5-7.3zm-4.5 8c.3 2 2 2.7 3.6 2.4-.4-1.7-2-2.6-3.6-2.4zm9 0c-1.6-.2-3.2.7-3.6 2.4 1.6.3 3.3-.4 3.6-2.4z",
  },
  {
    id: "cat",
    label: "Cat",
    path: "M4 3l4.5 4a9 9 0 0 1 7 0L20 3v8.5a8 8 0 0 1-16 0zm5.8 7.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm4.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM12 14.2l-1.2 1.2h2.4z",
  },
  {
    id: "dino",
    label: "Dinosaur",
    path: "M2 19.5c2.4-.3 3.6-1.8 4.6-3.6.9-2.6 3.1-4.4 6.4-4.4h1c.6-3 1.4-5.6 3.6-7 1.3-.8 3-.5 3.6.6.4.8-.2 1.5-1.3 1.4-1.2 1.9-1.6 4.5-1.9 7.9 1.3.8 2 2.2 2 4v2.1h-2.3v-2.3h-1.3v2.3h-2.6v-2.6H10v2.6H7.5v-2.4C6 19.3 4.2 20 2 19.5z",
  },
  {
    id: "pizza",
    label: "Pizza slice",
    path: "M2.5 4.2c6.3-2.3 12.7-2.3 19 0L12 22.5zm2.6 2c4.6-1.4 9.2-1.4 13.8 0l.3-.9C14.4 3.8 9.6 3.8 4.8 5.3zM10.4 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4.2 3.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm-2.8 3.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z",
  },
  { id: "bolt", label: "Lightning", path: "M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z" },
  { id: "rainbow", label: "Rainbow", path: "M2 18.5a10 10 0 0 1 20 0h-3a7 7 0 0 0-14 0zm5 0a5 5 0 0 1 10 0h-2.5a2.5 2.5 0 0 0-5 0z" },
  {
    id: "invader",
    label: "Space invader",
    path: "M6 4h2v2H6zm10 0h2v2h-2zM8 6h8v2H8zM6 8h12v2H6zm-2 2h4v2H4zm6 0h4v2h-4zm6 0h4v2h-4zM4 12h16v2H4zm0 2h2v4H4zm4 0h8v2H8zm10 0h2v4h-2zM8 16h2v2H8zm6 0h2v2h-2z",
  },
  { id: "gem", label: "Gem", path: "M7 4h10l4.5 5.2L12 21 2.5 9.2zm1.4 5.2L12 18l3.6-8.8z" },
  { id: "butter", label: "Butter", path: "M2.5 12.5l8.5-4.2 10.5 3.2v5.1l-8.5 4.2-10.5-3.2zm2.1.3l8.4 2.6 6.4-3.2-8.4-2.6z", unlock: "butter" },
  { id: "barrel", label: "Oil barrel", path: "M5 3.5h14v2.2l-1 1v10.6l1 1v2.2H5v-2.2l1-1V6.7l-1-1zm1.5 6v1.2h11V9.5zm0 4v1.2h11v-1.2z", unlock: "wildcatter" },
  {
    id: "crater",
    label: "Crater",
    path: "M12 7c5.5 0 10 2.7 10 6s-4.5 6-10 6S2 16.3 2 13s4.5-6 10-6zm0 3c-3.9 0-6.5 1.4-6.5 3s2.6 3 6.5 3 6.5-1.4 6.5-3-2.6-3-6.5-3z",
    unlock: "crater-maker",
  },
  { id: "computer", label: "1979 computer", path: "M3 3.5h18v12.5H3zm2 2v8.5h14V5.5zm2 5h3.2v1.6H7zm1 7.5h8l1.2 2.5H6.8z", unlock: "time-traveller" },
  {
    id: "black-cat",
    label: "Cat in a box",
    path: "M8 3l2 3.2a6 6 0 0 1 3.6 0L15.6 3l.7 5.3a5.3 5.3 0 0 1-.6 5.6l3.8 1.6V21H4.5v-5.5l3.9-1.6A5.3 5.3 0 0 1 7.3 8.3zm1.9 6.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z",
    unlock: "schrodinger",
  },
  {
    id: "trophy",
    label: "Trophy",
    path: "M7 3h10v2h3c0 3.5-1.8 5.6-4.5 6.2A5 5 0 0 1 13 14.5V17h3v3H8v-3h3v-2.5a5 5 0 0 1-2.5-3.3C5.8 10.6 4 8.5 4 5h3zm-.9 3.5c.3 1.6 1 2.6 2 3.1-.6-.9-1-1.9-1.1-3.1zm11.8 0c-.1 1.2-.5 2.2-1.1 3.1 1-.5 1.7-1.5 2-3.1z",
    unlock: "mission-control",
  },
];

export const emblemById = (id: string) => EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0];

/** The emoji emblems flags carried before October 2026, for the save migration. */
export const EMBLEM_FROM_EMOJI: Record<string, EmblemId> = {
  "": "",
  "⭐": "star",
  "🚀": "rocket",
  "🪐": "planet",
  "🌙": "moon",
  "☄️": "comet",
  "☄": "comet",
  "👽": "alien",
  "🐱": "cat",
  "🦖": "dino",
  "🍕": "pizza",
  "⚡": "bolt",
  "🌈": "rainbow",
  "👾": "invader",
  "💎": "gem",
  "🧈": "butter",
  "🛢️": "barrel",
  "🛢": "barrel",
  "🕳️": "crater",
  "🕳": "crater",
  "📟": "computer",
  "🐈‍⬛": "black-cat",
  "🏆": "trophy",
};
