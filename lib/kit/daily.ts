/*
 * Daily challenges run on the player's own calendar: a new puzzle at their
 * midnight, not at UTC midnight. The local date is turned into a UTC day so
 * daylight-saving changes never make two days share a number.
 *
 * Every game picks its own epoch (the day numbered #1). The first three dailies
 * all started on 2026-01-01, so that is the collection's default.
 */

export const COLLECTION_EPOCH = "2026-01-01";

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-07" for the player's local calendar date. */
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcDayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Whole days from the epoch to the local date: 0 on the epoch itself. */
export function dayIndex(date = new Date(), epoch = COLLECTION_EPOCH): number {
  return Math.round(utcDayOf(localDateKey(date)) - utcDayOf(epoch));
}

export type DailyDate = {
  /** Local date, "YYYY-MM-DD": the key progress is stored under. */
  key: string;
  /** Days since the epoch (0 on the epoch). Games derive their seed from it. */
  day: number;
  /** What players see: "#1" on the epoch. */
  number: number;
};

export function dailyDate(date = new Date(), epoch = COLLECTION_EPOCH): DailyDate {
  const day = dayIndex(date, epoch);
  return { key: localDateKey(date), day, number: day + 1 };
}

/** The key of the day `offset` days from `key` (negative goes back). */
export function shiftDateKey(key: string, offset: number): string {
  const ms = (utcDayOf(key) + offset) * DAY_MS;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export type ShareCard = {
  /** The game's title as players know it. */
  title: string;
  /** What the challenge is called, "Daily" unless the game names it ("Daily Drop"). */
  label?: string;
  number: number;
  /** One line with the result: "12.3 s · 1 hit". */
  score?: string;
  /** The coloured-square picture of the run, one or more lines. */
  grid?: string;
  url?: string;
};

/**
 * The text players paste into chats:
 *
 *   Outta Here · Daily #280
 *   12.3 s · 1 hit
 *   (squares)
 *   https://…
 */
export function shareString({ title, label = "Daily", number, score, grid, url }: ShareCard): string {
  return [`${title} · ${label} #${number}`, score, grid, url].filter((line): line is string => !!line).join("\n");
}
