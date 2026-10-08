import { mulberry32 } from "@/lib/kit/rng";

/*
 * 1980 mode: the original program's behaviour, step for step.
 *
 * The 1980 listing doesn't keep a board of its own. It writes characters
 * straight into the TRS-80's video memory (64 × 16 cells from address 15360)
 * and reads them back to see what's there. Your star is an address, P, and a
 * move is P ± 1 or P ± 64. That is where all of its quirks come from, so this
 * simulation keeps an address too:
 *
 * - Off the right end of a row is the next row's left end (and back): memory
 *   is one long line.
 * - The up check can never stop you, so the first step up from the top row
 *   lands in the keyboard's memory just below the screen's. Writing there
 *   does nothing: the star is invisible until you come back down.
 * - The right-hand check was copied from the left-hand one, so you can't step
 *   right from the very first cell.
 * - Down from the bottom-left corner, or right from the bottom-right one, P
 *   walks off the screen into the computer's working memory, and the star is
 *   written over the start of it. The computer almost certainly crashed.
 * - A block is dropped every time round the main loop that no key is down,
 *   anywhere except the bottom row (bar its first cell) and the exit, even on
 *   top of you. Any key at all clears a block you are under.
 * - Reaching the exit simply ends the program: no message, just BASIC's
 *   READY prompt.
 *
 * How fast the loop ran is our estimate: interpreted BASIC on a 1.77 MHz
 * machine, about sixty times a second.
 */

export const VIDEO = 15360;
export const VIDEO_END = VIDEO + 1024;
/** The keyboard's memory sits just below the screen's; writing to it does nothing. */
export const KEYBOARD = 14336;
export const EXIT = VIDEO + 15 * 64 + 30;
export const BLOCK = 191;
const STAR = 42;
const PLUS = 43;
const SPACE = 32;
export const LOOPS_PER_SECOND = 60;

/** The keys the listing reads: comma and full stop, the up arrow (which BASIC reads as "[") and the down arrow (a line feed). */
export type Key = "," | "." | "[" | "\n" | "other";

export class Escape1980 {
  readonly screen = new Uint8Array(1024).fill(SPACE);
  p = VIDEO;
  /** The previous position, which BASIC starts at 0 (so the first "erase" writes into ROM and does nothing). */
  pp = 0;
  state: "running" | "ended" | "crashed" = "running";
  t = 0;
  keys = 0;
  blocks = 0;
  private queue: Key[] = [];
  private clock = 0;
  private rng: () => number;

  constructor(
    seed: number,
    readonly speed = LOOPS_PER_SECOND,
  ) {
    this.rng = mulberry32(seed);
    // Clear the screen and print the title, then put the exit on the bottom row.
    "ESCAPE".split("").forEach((c, i) => (this.screen[i] = c.charCodeAt(0)));
    this.poke(EXIT, PLUS);
    this.draw();
  }

  /** Where the star is: on the screen, in the keyboard's memory, or somewhere else in memory. */
  where(): "screen" | "keyboard" | "memory" {
    if (this.p >= VIDEO && this.p < VIDEO_END) return "screen";
    if (this.p >= KEYBOARD && this.p < VIDEO) return "keyboard";
    return "memory";
  }

  press(key: Key) {
    if (this.state === "running") this.queue.push(key);
  }

  update(dt: number) {
    if (this.state !== "running") return;
    this.t += dt;
    this.clock += dt * this.speed;
    while (this.clock >= 1 && this.state === "running") {
      this.clock -= 1;
      this.loop();
    }
  }

  /** Once round the main loop: take a key if one is waiting, otherwise drop a block. */
  private loop() {
    this.pp = this.p;
    const key = this.queue.shift();
    if (key === undefined) {
      this.poke(VIDEO + 1 + Math.floor(this.rng() * 960), BLOCK);
      this.blocks++;
      return;
    }
    this.keys++;
    let p = this.p;
    if (key === ",") {
      if (p === VIDEO) return;
      p -= 1;
    } else if (key === ".") {
      // The check that should stop you at the right edge tests the left edge instead.
      if (p === VIDEO) return;
      p += 1;
    } else if (key === "[") {
      // Meant to stop you at the top row, but it tests a row above the screen.
      if (p < VIDEO - 64) return;
      p -= 64;
    } else if (key === "\n") {
      if (p > VIDEO_END - 64) return;
      p += 64;
    }
    this.p = p;
    if (p === EXIT) {
      this.state = "ended";
      this.print(1, "READY");
      this.print(2, ">");
      return;
    }
    // Walking into a block puts you back; then the old cell is cleared and the star drawn.
    if (this.peek(p) === BLOCK) this.p = this.pp;
    this.draw();
  }

  private draw() {
    this.poke(this.pp, SPACE);
    this.poke(this.p, STAR);
  }

  private peek(a: number) {
    return a >= VIDEO && a < VIDEO_END ? this.screen[a - VIDEO] : 0;
  }

  private poke(a: number, v: number) {
    if (a >= VIDEO && a < VIDEO_END) this.screen[a - VIDEO] = v;
    // Past the screen is the computer's working memory, starting with the jumps BASIC itself uses.
    else if (a >= VIDEO_END) this.state = "crashed";
    // Below the screen: the keyboard's memory and the ROM, which can't be written.
  }

  private print(row: number, text: string) {
    text.split("").forEach((c, i) => (this.screen[row * 64 + i] = c.charCodeAt(0)));
  }
}
