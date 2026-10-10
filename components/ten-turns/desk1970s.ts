/*
 * The 1970s terminal's conversation: the original program's rules, turn for
 * turn and quirk for quirk (lib/ten-turns/original.ts), told in our own words.
 * It keeps the lines on the screen, knows what it is waiting for, and notes
 * what the secret keycaps need.
 */

import { createRng } from "@/lib/kit/rng";
import { AS_WRITTEN, drop, newGame, type OriginalEvent, type OriginalGame, rabbitStart, run } from "@/lib/ten-turns/original";

export type DeskMode = "drop" | "angle" | "ended";

export const PROMPTS: Record<DeskMode, string> = {
  drop: "WHERE SHALL WE DROP YOU (X,Y)? ",
  angle: "RUN WHICH WAY (DEGREES)? ",
  ended: "TYPE RUN TO GO AGAIN. ",
};

const BANNER = ["TEN TURNS IN THE PIT", "AFTER A PROGRAM IN CREATIVE COMPUTING", ""];

const INTRO = [
  "THEY HAVE LOWERED YOU INTO A ROUND PIT.",
  "A RABBIT LIVES DOWN HERE. IT IS HUNGRY.",
  "THE PIT IS CENTRED ON (0,0), RADIUS 10.",
  "LAST 10 TURNS AND THEY WILL PULL YOU OUT.",
  "YOU MOVE ONE SPACE A TURN. SO DOES THE",
  "RABBIT - BUT IT MAY POUNCE AGAIN, AND AGAIN.",
  "RUN AT ANY MULTIPLE OF 45 DEGREES:",
  "0 IS EAST, 90 NORTH, 180 WEST, 270 SOUTH.",
  "",
];

/** Big letters for the two ways out, drawn with #. */
export const SQUISH_ART = [
  " ####   ###   #   #  #####   ####  #   #  #",
  "#      #   #  #   #    #    #      #   #  #",
  " ###   # # #  #   #    #     ###   #####  #",
  "    #  #  ##  #   #    #        #  #   #   ",
  "####    ## #   ###   #####  ####   #   #  #",
];

export const CRUNCH_ART = [
  " ####  ####   #   #  #   #   ####  #   #  #",
  "#      #   #  #   #  ##  #  #      #   #  #",
  "#      ####   #   #  # # #  #      #####  #",
  "#      #  #   #   #  #  ##  #      #   #   ",
  " ####  #   #   ###   #   #   ####  #   #  #",
];

/** Numbers the way the old BASIC printed them: a space before positives, no trailing zeros. */
export function basicNumber(n: number): string {
  const text = Number(n.toPrecision(6)).toString().replace(/^(-?)0\./, "$1.");
  return n < 0 ? text : ` ${text}`;
}

const at = (p: { x: number; y: number }) => `(${basicNumber(p.x)} ,${basicNumber(p.y)} )`;

export type DeskOutcome = { finished?: { outcome: NonNullable<OriginalGame["outcome"]>; frozenTurns: number; releasedUnderRabbit: boolean } };

export class Desk1970s {
  lines: string[] = [];
  mode: DeskMode = "drop";
  game: OriginalGame;
  /** Turns in which the rabbit stayed frozen (you were due north of it). */
  private frozenTurns = 0;
  private random = createRng(`ten-turns/terminal/${Date.now()}/${Math.random()}`);

  constructor() {
    this.game = newGame(rabbitStart(this.random.float), AS_WRITTEN);
    this.lines = [...BANNER, ...INTRO];
  }

  get started() {
    return this.game.dropped && !this.game.outcome;
  }

  restart() {
    this.random = createRng(`ten-turns/terminal/${Date.now()}/${Math.random()}`);
    this.game = newGame(rabbitStart(this.random.float), AS_WRITTEN);
    this.frozenTurns = 0;
    this.mode = "drop";
    this.lines = [...this.lines, "", ...INTRO];
  }

  submit(raw: string): DeskOutcome {
    const text = raw.trim();
    this.lines.push(`${PROMPTS[this.mode]}${text}`);
    if (this.mode === "ended") {
      if (/^run$/i.test(text)) this.restart();
      else this.lines.push("?SYNTAX ERROR", "");
      return {};
    }
    if (this.mode === "drop") {
      const parts = text.split(",").map((s) => Number(s.trim()));
      if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
        this.lines.push("?REDO FROM START");
        return {};
      }
      return this.tell(drop(this.game, parts[0], parts[1]));
    }
    const angle = Number(text);
    if (!text || !Number.isFinite(angle)) {
      this.lines.push("?REDO FROM START");
      return {};
    }
    return this.tell(run(this.game, angle, this.random.float));
  }

  /** Turns the rules' events into lines on the screen. */
  private tell(events: OriginalEvent[]): DeskOutcome {
    const g = this.game;
    let pounceLine: string | null = null;
    let frozenThisTurn = false;
    const flushPounces = () => {
      if (pounceLine !== null) this.lines.push(pounceLine);
      pounceLine = null;
    };
    for (const e of events) {
      switch (e.kind) {
        case "drop-outside":
          this.lines.push("THAT IS OUTSIDE THE PIT. AGAIN.");
          break;
        case "squish":
          this.lines.push("", ...SQUISH_ART, "", "YOU LANDED RIGHT ON THE RABBIT.", "IT WILL NOT BE BOTHERING ANYONE. YOU ARE FREE.", "");
          break;
        case "turn":
          flushPounces();
          this.lines.push("", `RABBIT AT ${at(e.rabbit)}  DISTANCE${basicNumber(e.distance)}`, `TURN ${e.turn}   YOU ARE AT ${at(e.player)}`);
          this.mode = "angle";
          break;
        case "bad-angle":
          this.lines.push("MULTIPLES OF 45 ONLY.");
          break;
        case "wall":
          this.lines.push("THE WALL STOPS YOU. ANOTHER WAY.");
          break;
        case "ran":
          this.lines.push(`RUNNING... YOU ARE NOW AT ${at(e.player)}`);
          break;
        case "ran-into":
          this.lines.push("YOU RAN STRAIGHT INTO THE RABBIT!", "", ...CRUNCH_ART, "");
          break;
        case "pounce":
          // Chained pounces run on along one line, the way the original kept printing.
          if (e.angle === null) frozenThisTurn = true;
          pounceLine = `${pounceLine ?? "THE RABBIT POUNCES AT"}${e.angle === null ? " ..." : basicNumber(e.angle)}`;
          break;
        case "crunch":
          flushPounces();
          this.lines.push("", ...CRUNCH_ART, "", "THE RABBIT GOT YOU. IT LOOKS PLEASED.", "");
          break;
        case "released":
          flushPounces();
          this.lines.push("", "TEN TURNS! A ROPE COMES DOWN.", "YOU CLIMB OUT. THE RABBIT WATCHES YOU GO.", "");
          break;
      }
    }
    flushPounces();
    if (frozenThisTurn) this.frozenTurns++;
    if (!g.outcome) return {};
    this.mode = "ended";
    this.lines.push("READY.");
    const underRabbit = g.outcome === "released" && g.rabbit.x === g.player.x && g.rabbit.y === g.player.y;
    return { finished: { outcome: g.outcome, frozenTurns: this.frozenTurns, releasedUnderRabbit: underRabbit } };
  }
}
