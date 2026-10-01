import type { Game } from "./engine";
import { LEVELS, type Settings } from "./levels";

/*
 * The Daily Escape: one screen a day, the same for everyone (Normal rules,
 * a seed from the date). The share text is a short timeline of the run in
 * coloured squares, like the word games people post.
 */

export type Daily = { number: number; key: string; seed: number; settings: Settings };

export function dailyFor(date = new Date()): Daily {
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 0, 1)) / 86_400_000);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { number: day + 1, key, seed: 70_000 + ((day * 7919) % 99_991), settings: { ...LEVELS.normal, id: "daily", name: "Daily Escape" } };
}

const SQUARE: Record<string, string> = { m: "🟩", h: "🟨", k: "🟦", b: "🟧", x: "🟥" };
const RANK = "mhkbx";

/** Ten squares for the run: each tenth of it shows the most eventful second in it. */
export function timelineSquares(timeline: string[]) {
  if (!timeline.length) return "";
  const out: string[] = [];
  for (let k = 0; k < 10; k++) {
    const from = Math.floor((k * timeline.length) / 10);
    const to = Math.max(from + 1, Math.floor(((k + 1) * timeline.length) / 10));
    const slice = timeline.slice(from, to);
    const top = slice.reduce((a, b) => (RANK.indexOf(b) > RANK.indexOf(a) ? b : a), "m");
    out.push(SQUARE[top]);
  }
  return out.join("");
}

export function shareText(daily: Daily, g: Game) {
  const stars = g.stars().map((s) => (s ? "★" : "☆")).join("");
  const end = g.state === "won" ? "➕" : "✖️";
  return [
    `Outta Here · Daily #${daily.number}`,
    `${g.state === "won" ? `${g.t.toFixed(1)} s` : "caught"} · ${stars} · ${g.hits} ${g.hits === 1 ? "hit" : "hits"}`,
    `${timelineSquares(g.timeline)} ${end}`,
  ].join("\n");
}
