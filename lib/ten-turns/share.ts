import { shareString } from "@/lib/kit/daily";
import { tenTurnsManifest } from "./manifest";

/*
 * The Daily Pit's share text. Emoji live only here, in a plain-text card
 * pasted into other apps; the page itself never shows them.
 *
 *   Ten Turns in the Pit · Daily #4
 *   survived 10/10 🐇💨 · 1 carrot · untouched
 *   🟩🟩🟨🟩🟩🟩🟨🟩🟩🟩
 */

/** How each turn went, for the row of squares. */
export type TurnMark = "clear" | "close" | "hat" | "crunch";

const SQUARE: Record<TurnMark, string> = { clear: "🟩", close: "🟨", hat: "🎩", crunch: "🟥" };

export function dailyShare(number: number, outcome: "squish" | "crunch" | "released", turns: number, of: number, carrots: number, untouched: boolean, marks: TurnMark[]): string {
  const parts =
    outcome === "squish"
      ? ["squished it at the drop 🐇🫓"]
      : outcome === "released"
        ? [`survived ${of}/${of} 🐇💨`]
        : [`crunched on turn ${turns} of ${of} 🐇`];
  if (outcome !== "squish") {
    if (carrots) parts.push(carrots === 1 ? "1 carrot" : `${carrots} carrots`);
    if (outcome === "released" && untouched) parts.push("untouched");
  }
  return shareString({ title: tenTurnsManifest.title, label: "Daily", number, score: parts.join(" · "), grid: marks.map((m) => SQUARE[m]).join("") || undefined });
}
