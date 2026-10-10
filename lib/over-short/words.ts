import type { Report } from "./engagement";

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
