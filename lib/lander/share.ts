import { difficultyTag, type Difficulty } from "./difficulty";
import { fmtKm, fmtSpeed } from "./format";
import { GRADES, type GradeId } from "./grades";
import type { World } from "./worlds";

/*
 * The texts players paste into chats after a flight. Coloured squares and
 * emoji are text for other apps here, not art on the page: the throttle line
 * is eight squares, dark for coasting, orange for a partial burn, a flame for
 * full power.
 */

type ThrottleSample = { t: number; throttle: number };

function throttleLine(samples: ThrottleSample[]) {
  const end = samples[samples.length - 1]?.t ?? 1;
  let line = "";
  for (let i = 0; i < 8; i++) {
    const from = (end * i) / 8;
    const to = (end * (i + 1)) / 8;
    const part = samples.filter((s) => s.t >= from && s.t < to);
    const avg = part.length ? part.reduce((a, s) => a + s.throttle, 0) / part.length : 0;
    line += avg < 8 ? "⬛" : avg < 65 ? "🟧" : "🔥";
  }
  return line;
}

const fuelTag = (difficulty?: Difficulty) => (difficulty && difficulty !== "standard" ? ` · ${difficultyTag(difficulty)}` : "");

/** A descent (Live, Ten-Second, missions and the Daily Drop). */
export function descentShare(f: { title: string; dailyNumber?: number; world: World; grade: GradeId; speed: number; fuelPct: number; samples: ThrottleSample[]; assisted: boolean; difficulty?: Difficulty }) {
  const g = GRADES[f.grade];
  const head = f.dailyNumber !== undefined ? `Don't Crater · Daily Drop #${f.dailyNumber}` : `Don't Crater · ${f.title}`;
  return `${head}\n${f.world.shareGlyph} ${f.world.name} · ${g.shareGlyph} ${fmtSpeed(f.speed)} · ⛽ ${Math.round(f.fuelPct * 100)}%${fuelTag(f.difficulty)}${f.assisted ? " · 🛟" : ""}\n${throttleLine(f.samples)}${g.shareGlyph}`;
}

/** A Free Flight landing, with where it came down and how far from the target. */
export function freeFlightShare(f: {
  site: string;
  world: World;
  grade: GradeId;
  speed: number | null;
  stands: boolean;
  detail: string;
  onTarget: boolean;
  missBy: number;
  fuelPct: number;
  samples: ThrottleSample[];
  scanned: boolean;
  assisted: boolean;
  difficulty: Difficulty;
}) {
  const g = GRADES[f.grade];
  const where = f.detail ? ` · ${f.detail.split(" · ").slice(1).join(" · ")}` : "";
  const speed = f.speed === null ? "" : fmtSpeed(f.speed);
  const aim = f.stands ? (f.onTarget ? " · 🎯" : ` · ↪️ ${fmtKm(f.missBy)} off`) : "";
  return `Don't Crater · Free Flight · ${f.site}\n${f.world.shareGlyph} ${f.world.name} · ${g.shareGlyph} ${speed}${where}${aim} · ⛽ ${Math.round(f.fuelPct * 100)}%${fuelTag(f.difficulty)}${f.scanned ? " · 🛰️" : ""}${f.assisted ? " · 🛟" : ""}\n${throttleLine(f.samples)}${g.shareGlyph}`;
}
