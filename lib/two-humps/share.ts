import { shareString } from "@/lib/kit/daily";
import type { Trek } from "./engine";
import type { PursuerKind } from "./rules";

/*
 * The Daily Crossing's share text. Emoji live only here, in the text that
 * gets pasted into other apps; the page itself draws its own pictures.
 */

export const PURSUER_NAMES: Record<PursuerKind, string> = {
  haboob: "The Haboob",
  rival: "The rival caravan",
  gang: "The Ladle Gang",
};

const SHORT_NAMES: Record<PursuerKind, string> = { haboob: "Storm", rival: "Rival", gang: "Gang" };

const LOSSES: Record<string, string> = {
  caught: "\u{1F32A}",
  beaten: "\u{1F3C6}",
  thirst: "\u{1F3DC}",
  collapse: "\u{1F4A4}",
};

/** One glyph per turn: the trek in a line. */
export function trekGlyphs(trek: Trek): string {
  const s = trek.state;
  const glyphs: string[] = [];
  for (const entry of s.log) {
    const had = (kind: string) => entry.happened.includes(kind as never);
    if (had("oasis")) glyphs.push("\u{1F333}");
    else if (entry.action === "drink") glyphs.push("\u{1F4A7}");
    else if (entry.action === "camp") glyphs.push(had("dawn") ? "\u{1F319}" : "\u{26FA}");
    else if (entry.action === "walk" || entry.action === "gallop") glyphs.push(had("singing") ? "\u{1F3B5}" : "\u{1F42B}");
    else if (entry.action === "signal") glyphs.push("\u{2728}");
  }
  const end = s.ending === "arrived" ? "\u{1F3C1}" : (LOSSES[s.ending ?? ""] ?? "");
  const line = glyphs.length > 14 ? [...glyphs.slice(0, 6), "\u{2026}", ...glyphs.slice(-7)] : glyphs;
  return line.join("") + end;
}

export function dailyShare(trek: Trek, number: number): string {
  const s = trek.state;
  const pursuer = s.config.pursuer;
  const gap = pursuer === "rival" ? `${SHORT_NAMES.rival} at ${Math.round(Math.min(s.goal, s.pursuer.at))} mi` : `${SHORT_NAMES[pursuer]} ${Math.max(0, s.miles - s.pursuer.at).toFixed(0)} mi behind`;
  const score = s.ending === "arrived" ? `${s.goal} mi in ${s.turn} turns` : `${Math.round(s.miles)} of ${s.goal} mi`;
  const sips = `${s.sips} ${s.sips === 1 ? "sip" : "sips"} left`;
  return [`${shareString({ title: "Two Humps", number })} · ${PURSUER_NAMES[pursuer]}`, `${trekGlyphs(trek)}  ${score}`, `${gap} · ${sips}`].join("\n");
}
