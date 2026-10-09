/*
 * The 1982 program, step for step.
 *
 * This is the BASIC listing's logic as a state machine, so 1982 mode can play
 * it with every number and every bug intact. It produces happenings, not
 * text: the terminal writes its own lines for them. Line numbers in the
 * comments are the listing's.
 *
 * The bugs it keeps on purpose:
 * - A move calls the event routine as a subroutine (GOSUB) before it adds the
 *   miles. When no event fires, the routine jumps straight back to the
 *   command dispatcher without returning, so the same command starts again:
 *   more fatigue, another roll for events, and no miles for the stride that
 *   never finished. Only the last stride's miles count. The abandoned return
 *   addresses stay on BASIC's stack for the rest of the game.
 * - The status report runs on into the drink routine, so it costs a sip.
 * - Any number other than 1–6 falls through to "hope for help".
 * - The captive flag is never set, so after a capture waiting is always safe.
 * - The "hurt hump" event moves the pursuers a mile closer.
 */

export type Happening =
  | { kind: "start" }
  | { kind: "warning" }
  | { kind: "behind"; miles: number }
  | { kind: "travelled"; miles: number }
  | { kind: "prompt" }
  | { kind: "drink"; sips: number }
  | { kind: "status"; goodDays: number; sips: number; turnsDry: number }
  | { kind: "walked"; miles: number }
  | { kind: "galloped"; miles: number }
  | { kind: "rested" }
  | { kind: "oasis" }
  | { kind: "sandstorm"; shift: number; miles: number }
  | { kind: "hump" }
  | { kind: "ambush" }
  | { kind: "subPrompt" }
  | { kind: "escaped" }
  | { kind: "paid" }
  | { kind: "stillWaiting" }
  | { kind: "rescued" }
  | { kind: "caught" }
  | { kind: "won" }
  | { kind: "died"; cause: DeathCause; epitaph: number }
  | { kind: "illegal" };

export type DeathCause = "thirst" | "empty-canteen" | "camel" | "no-help" | "escape";

export type Ending = "won" | "died" | "caught" | "crashed";

export type OriginalState = {
  /** C: miles travelled. Can go below zero after a sandstorm. */
  miles: number;
  /** C1: how far the pursuers have come. Moves in steps ending in .5. */
  pursuers: number;
  /** S: drinks left in the canteen. */
  sips: number;
  /** Z: commands left before you must drink. */
  thirst: number;
  /** F: the camel's fatigue; 7 − F is its "good days left". */
  fatigue: number;
  /** P: turns taken; the pursuers set off after the third. */
  turn: number;
  /** Y: the last command, which a repeat runs again. */
  command: number;
  /** GOSUB return addresses left on BASIC's stack and never popped. */
  staleReturns: number;
  /** Strides this turn that ran again unseen (the repeat bug). */
  repeatsThisTurn: number;
  repeatsTotal: number;
  phase: "command" | "subcommand" | "over";
  ending: Ending | null;
};

export type Original = {
  state: OriginalState;
  /** Everything the program has "printed" since the last call, oldest first. */
  take(): Happening[];
  /** Type a number at WHAT IS YOUR COMMAND. */
  command(value: number): void;
  /** Type a number at YOUR SUB-COMMAND (7 escape, 8 wait; anything else counts as escape). */
  subcommand(value: number): void;
};

/** A die roll the way the listing writes it: INT(n * RND). */
const roll = (random: () => number, n: number) => Math.floor(n * random());

export function createOriginal(random: () => number): Original {
  const state: OriginalState = {
    miles: 0,
    pursuers: 0,
    sips: 6,
    thirst: 4,
    fatigue: 0,
    turn: 0,
    command: 0,
    staleReturns: 0,
    repeatsThisTurn: 0,
    repeatsTotal: 0,
    phase: "command",
    ending: null,
  };
  let out: Happening[] = [];
  const say = (h: Happening) => out.push(h);

  const finish = (ending: Ending) => {
    state.ending = ending;
    state.phase = "over";
  };

  /** 2260: a death, with one of five epitaphs picked by U = INT(10 * RND). */
  const die = (cause: DeathCause) => {
    const u = roll(random, 10);
    const epitaph = u <= 1 ? 0 : u <= 3 ? 1 : u <= 5 ? 2 : u <= 7 ? 3 : 4;
    say({ kind: "died", cause, epitaph });
    finish("died");
  };

  /** 940: the top of a turn. Resting jumps in at 950 and skips the win check. */
  const top = (fromRest = false) => {
    if (!fromRest && state.miles > 39) {
      say({ kind: "won" });
      return finish("won");
    }
    state.thirst -= 1;
    if (state.thirst === 1) say({ kind: "warning" });
    if (state.thirst < 0) return die("thirst");
    state.turn += 1;
    // 1060: the pursuers' step is drawn every turn, even before they set off.
    const step = roll(random, 10) + 2.5;
    if (state.turn >= 4) {
      state.pursuers += step;
      if (state.pursuers >= state.miles) {
        say({ kind: "caught" });
        return finish("caught");
      }
      say({ kind: "behind", miles: state.miles - state.pursuers });
    }
    say({ kind: "travelled", miles: state.miles });
    prompt();
  };

  const prompt = () => {
    state.repeatsThisTurn = 0;
    state.phase = "command";
    say({ kind: "prompt" });
  };

  /** 1540: one drink. With the canteen empty it is fatal, not a warning. */
  const drink = () => {
    state.sips -= 1;
    if (state.sips < 0) return die("empty-canteen");
    say({ kind: "drink", sips: state.sips });
    state.thirst = 4;
    prompt();
  };

  /**
   * 1590: the event subroutine. Returns "return" when it ends with RETURN
   * (the caller then adds its miles), "repeat" when it jumps back to the
   * dispatcher instead, or "held" when the camel's been ambushed.
   */
  const events = (): "return" | "repeat" | "held" => {
    state.staleReturns += 1;
    if (roll(random, 100) <= 5) {
      say({ kind: "ambush" });
      state.phase = "subcommand";
      say({ kind: "subPrompt" });
      return "held";
    }
    if (roll(random, 10) <= 2) {
      state.thirst = 4;
      state.sips = 6;
      say({ kind: "oasis" });
      state.staleReturns -= 1;
      return "return";
    }
    if (roll(random, 100) <= 5) {
      const shift = roll(random, 10);
      const backwards = roll(random, 10) < 5;
      state.miles += backwards ? -shift : shift;
      say({ kind: "sandstorm", shift: backwards ? -shift : shift, miles: state.miles });
      state.staleReturns -= 1;
      return "return";
    }
    if (roll(random, 100) <= 5) {
      state.pursuers += 1;
      say({ kind: "hump" });
      state.staleReturns -= 1;
      return "return";
    }
    // 2220: no event, and no RETURN either. The return address stays put.
    return "repeat";
  };

  /** 1320 and 1390: a move. Each pass adds fatigue and rolls for events before any miles. */
  const move = (fast: boolean) => {
    for (;;) {
      state.fatigue += fast ? 3 : 1;
      const deadly = fast ? state.fatigue > 7 : state.fatigue === 8;
      if (deadly) return die("camel");
      const outcome = events();
      if (outcome === "held" || state.phase === "over") return;
      if (outcome === "return") break;
      state.repeatsThisTurn += 1;
      state.repeatsTotal += 1;
    }
    const miles = fast ? 2 * roll(random, 10) : roll(random, 10);
    state.miles += miles;
    say(fast ? { kind: "galloped", miles } : { kind: "walked", miles });
    top();
  };

  /** 1250: ON Y GOTO. Zero and anything past 6 fall through to "hope for help". */
  const dispatch = (value: number) => {
    const y = Math.round(value);
    if (y < 0 || y > 255) {
      // BASICA stops with an "Illegal function call" error.
      say({ kind: "illegal" });
      return finish("crashed");
    }
    state.command = y;
    switch (y) {
      case 1:
        return drink();
      case 2:
        return move(false);
      case 3:
        return move(true);
      case 4:
        say({ kind: "rested" });
        state.fatigue = 0;
        return top(true);
      case 5:
        say({ kind: "status", goodDays: 7 - state.fatigue, sips: state.sips, turnsDry: state.thirst });
        return drink();
      default: {
        // 1260: hope for help. One chance in ten.
        if (roll(random, 10) !== 1) return die("no-help");
        say({ kind: "rescued" });
        state.sips = 3;
        state.thirst = 4;
        return top();
      }
    }
  };

  say({ kind: "start" });
  top();

  return {
    state,
    take() {
      const taken = out;
      out = [];
      return taken;
    },
    command(value: number) {
      if (state.phase !== "command") return;
      dispatch(value);
    },
    subcommand(value: number) {
      if (state.phase !== "subcommand") return;
      // 1740 compares the number exactly: 8 waits, everything else (7.9 included) runs.
      if (value === 8) {
        // 1820: wait for the ransom. Nothing is ever lost by waiting.
        say(roll(random, 100) <= 24 ? { kind: "paid" } : { kind: "stillWaiting" });
        return top();
      }
      // 1750: anything else is an escape attempt, and half of them end badly.
      if (roll(random, 10) < 5) return die("escape");
      say({ kind: "escaped" });
      top();
    },
  };
}
