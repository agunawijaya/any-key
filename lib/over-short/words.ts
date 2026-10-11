import type { Report } from "./engagement";
import type { FieldReport } from "./field";
import type { Wind } from "./fieldModel";

/*
 * Numbers as the game shows and says them. The engine thinks in metres;
 * the player may read yards. The observer speaks in words, the way a
 * report comes down a telephone line, and the slip shows the figure too.
 */

export type Units = "m" | "yd";

const METRES_PER_YARD = 0.9144;

/** A distance in the player's units, rounded to whole units. */
export const inUnits = (metres: number, units: Units) => Math.round(units === "yd" ? metres / METRES_PER_YARD : metres);

const grouped = (n: number) => Math.round(n).toLocaleString("en-GB");

/** "8,450 m" or "9,241 yd". */
export const distanceLabel = (metres: number, units: Units) => `${grouped(inUnits(metres, units))} ${units === "yd" ? "yd" : "m"}`;

export const unitWord = (units: Units, plural = true) => (units === "yd" ? (plural ? "yards" : "yard") : plural ? "metres" : "metre");

/** An elevation as the dial shows it: "27.5°" or "27.50°". */
export const elevationLabel = (degrees: number, precision: number) => `${degrees.toFixed(precision < 0.1 ? 2 : 1)}°`;

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const tail = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ""}`;
  if (!hundreds) return tail;
  return rest ? `${ONES[hundreds]} hundred and ${tail}` : `${ONES[hundreds]} hundred`;
}

/** A whole number in words, British style: "one thousand two hundred and forty". */
export function inWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n < 1000) return belowThousand(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = `${belowThousand(thousands)} thousand`;
  if (!rest) return head;
  return rest < 100 ? `${head} and ${belowThousand(rest)}` : `${head} ${belowThousand(rest)}`;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What the observer says down the line: "Short. One hundred and ten metres." */
export function spokenReport(report: Report, units: Units, destroyed: boolean): string {
  if (report.call === "hit") return destroyed ? "Direct hit. Target destroyed." : "Direct hit. It is still standing.";
  const call = report.call === "over" ? "Over." : "Short.";
  if (report.distance === null) return call;
  const amount = inUnits(report.distance, units);
  return `${call} ${capital(inWords(amount))} ${unitWord(units, amount !== 1)}.`;
}

/* ---------- Field Artillery ---------- */

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

/**
 * The wind as a forecast gives it: "12 km/h from the west". The line of
 * fire runs east, so a wind behind the gun comes from the west and one
 * blowing to the gunners' right (south) comes from the north.
 */
export function windWords(wind: Wind): string {
  const speed = Math.hypot(wind.along, wind.across);
  const kmh = Math.round(speed * 3.6);
  if (kmh < 2) return "calm";
  const towards = (Math.atan2(wind.along, -wind.across) * 180) / Math.PI;
  const from = (towards + 180 + 360) % 360;
  return `${kmh} km/h from the ${COMPASS[Math.round(from / 45) % 8]}`;
}

/** A correction's distance in the player's units, to the nearest 5. */
const shortDistance = (metres: number, units: Units) => Math.max(5, Math.round(inUnits(metres, units) / 5) * 5);

/** What the observer says down the line about one round: "Add 150. Right 40." */
export function correctionWords(report: FieldReport, units: Units, milsHint = false): string {
  if (report.kind === "target") return report.destroyed ? "Target! It's gone up." : "Target! Hit, but still standing.";
  if (report.kind === "lost") return report.destroyed ? "Lost it in the smoke, but we heard it go up." : "Lost in the smoke. Nothing seen.";
  if (report.kind === "flash") {
    if (!report.range && !report.line) return "Flash right on it, but too dark to tell.";
    const where = [report.range === "over" ? "beyond the target" : report.range === "short" ? "short of the target" : null, report.line ? `to the ${report.line}` : null].filter(Boolean).join(", ");
    return `Only the flash: ${where}.`;
  }
  const parts: string[] = [];
  if (report.range) parts.push(`${capital(report.range.word)} ${shortDistance(report.range.metres, units)}.`);
  if (report.line) parts.push(`${capital(report.line.word)} ${shortDistance(report.line.metres, units)}${milsHint ? ` (${report.line.mils} mils)` : ""}.`);
  return parts.length ? parts.join(" ") : "On for line and range, just missed.";
}
