/*
 * The game contract. Every game exports one `GameManifest` from
 * `lib/<folder>/manifest.ts`; `lib/catalog.ts` lists them, and the Hall,
 * the shell and the Keyring read nothing else about a game.
 */

export type GameStatus = "playable" | "coming-soon";

export type AchievementTier = "common" | "rare" | "legendary";

export type AchievementSpec = {
  id: string;
  title: string;
  /** How to earn it, in a few words. Shown on unearned keycaps unless the badge is secret. */
  hint: string;
  tier: AchievementTier;
  /** Shown as a blank cap with "?" until earned. */
  secret?: boolean;
};

export type InspiredBy = {
  originalTitle: string;
  file: string;
  author?: string;
  publisher: string;
  year: number;
  /** The year is a best guess, shown as "c. 1980". */
  circa?: boolean;
};

export type GameManifest = {
  /** One id everywhere: storage, achievements, docs folder. */
  id: string;
  title: string;
  status: GameStatus;
  route: string;
  /** Short label for cards: "Music studio", "Mind game". */
  kind: string;
  category: "music" | "puzzle" | "action" | "simulation" | "strategy" | "adventure";
  players: "1" | "1–2";
  /** A typical session, in minutes: [shortest, longest]. */
  sessionMinutes: [number, number];
  tagline: string;
  blurb: string;
  inspiredBy: InspiredBy;
  /** Three colours that drive the card gradient, the planet and the cartridge. The first is the game's own UI accent. */
  palette: [string, string, string];
  /**
   * The game's colour in the collection: its keycaps, its emblem badge, its chip in the Today strip.
   * Chosen so the games stay apart from each other on one ring.
   */
  accent: string;
  /** SVG path data on a 24×24 grid, filled: the legend on keycaps, cards and share cards. */
  emblem: string;
  stats: { value: string; label: string }[];
  /** Short chips shown on cards: the ways you can play it. */
  modes: string[];
  /** What orbits the planet in the Orbit hall: tracks, levels, rooms... */
  moons: string[];
  /** What to call them: "tunes", "ladder tables"... */
  moonsName: string;
  trivia: string[];
  /** Games with a daily challenge: the day numbered #1. */
  daily?: { epoch: string };
  achievements: AchievementSpec[];
};

/** The original's year as the Hall shows it: "1973", or "c. 1980" when it is a best guess. */
export const yearLabel = (game: Pick<GameManifest, "inspiredBy">) => `${game.inspiredBy.circa ? "c. " : ""}${game.inspiredBy.year}`;

/** "Inspired by 23 Matches (23MTCH.BAS), People's Computer Company, 1973". */
export const inspiredByLine = ({ inspiredBy: o }: Pick<GameManifest, "inspiredBy">) =>
  `Inspired by ${o.originalTitle} (${o.file}), ${o.author ? `${o.author}, ` : ""}${o.publisher}, ${o.circa ? "c. " : ""}${o.year}`;

export const isPlayable = (game: Pick<GameManifest, "status">) => game.status === "playable";
