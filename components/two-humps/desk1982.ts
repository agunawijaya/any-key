import { createRng, type Rng } from "@/lib/kit/rng";
import { createOriginal, type DeathCause, type Happening, type Original } from "@/lib/two-humps/original";

/*
 * The 1982 terminal's desk: the program running (lib/two-humps/original.ts),
 * what is on the screen, and what BASIC keeps quiet about. The terminal
 * component draws it and passes the player's typing in. Every line on the
 * screen is ours; the pursuers are the Ladle Gang.
 */

export type Mode = "command" | "subcommand" | "again" | "ended";

export const KEYS = [
  { n: 1, label: "DRINK" },
  { n: 2, label: "WALK" },
  { n: 3, label: "GALLOP" },
  { n: 4, label: "REST" },
  { n: 5, label: "STATUS" },
  { n: 6, label: "HELP!" },
];

export const PROMPTS: Record<Mode, string> = {
  command: "WHAT NEXT? ",
  subcommand: "YOUR CHOICE? ",
  again: "ANOTHER TREK (Y/N)? ",
  ended: "",
};

const CAUSES: Record<DeathCause, string> = {
  thirst: "YOUR WATER RAN OUT, AND SO DID YOUR LUCK.",
  "empty-canteen": "YOU TIPPED UP AN EMPTY CANTEEN. NOT ONE DROP.",
  camel: "YOUR CAMEL LIES DOWN AND REFUSES TO GET UP AGAIN.",
  "no-help": "YOU WAVED AND WAVED. NOBODY CAME.",
  escape: "THE GERBILS CAUGHT YOU BY THE BOOTLACES.",
};

const CLOSERS = [
  "THE CAMEL SAYS IT TOLD YOU SO.",
  "A HERDER GIVES YOU A LIFT HOME. NOBODY MENTIONS IT AGAIN.",
  "THE SAND WILL REMEMBER YOUR FOOTPRINTS FOR ABOUT A MINUTE.",
  "NEXT TIME, PACK MORE WATER AND FEWER JOKES.",
  "THE DESERT WINS THIS ROUND.",
];

const half = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The screen's lines for one happening, in our own words. */
function linesFor(h: Happening): string[] {
  switch (h.kind) {
    case "start":
      return [
        "TWO HUMPS  ·  THE 1982 RULES",
        "",
        "CROSS 40 MILES OF GOBI ON A CAMEL THAT HAS IDEAS OF ITS OWN.",
        "THE LADLE GANG IS ON YOUR TRAIL. THEY HAVE HEARD ABOUT CAMEL SOUP.",
        "YOU CARRY 6 DRINKS. GO 4 TURNS WITHOUT ONE AND THE TREK IS OVER.",
        "TYPE A NUMBER AND PRESS ENTER, OR USE THE KEYS ON THE BOTTOM LINE.",
        "",
      ];
    case "warning":
      return ["YOUR MOUTH IS AS DRY AS THE SAND. DRINK SOON!"];
    case "behind":
      return [`THE LADLE GANG IS HOPPING ALONG ${half(h.miles)} MILES BACK.`];
    case "travelled":
      return [`DISTANCE COVERED: ${half(h.miles)} MILES`, ""];
    case "drink":
      return [`GLUG. ${h.sips} DRINKS LEFT.`, ""];
    case "status":
      return [`CAMEL: STRONG FOR ${h.goodDays} MORE DAYS.`, `CANTEEN: ${h.sips} DRINKS.  NEXT DRINK DUE IN ${h.turnsDry} TURNS.`];
    case "walked":
      return [`YOUR CAMEL AMBLES ON ${h.miles} MILES.`];
    case "galloped":
      return [`YOUR CAMEL THUNDERS ${h.miles} MILES ACROSS THE SAND.`];
    case "rested":
      return ["YOU STOP FOR THE NIGHT. THE CAMEL SNORES LIKE A TRUMPET."];
    case "oasis":
      return ["AN OASIS! YOU FILL THE CANTEEN AND THE CAMEL DRINKS FOR TEN MINUTES."];
    case "sandstorm":
      if (h.shift === 0) return ["A SANDSTORM HOWLS ALL AROUND, BUT YOU HOLD YOUR GROUND."];
      return [h.shift > 0 ? `A SANDSTORM SWEEPS YOU ${h.shift} MILES FORWARD.` : `A SANDSTORM SHOVES YOU ${-h.shift} MILES BACK.`, `YOU ARE AT MILE ${half(h.miles)}.`];
    case "hump":
      return ["YOUR CAMEL BUMPED A HUMP. GOOD THING IT HAS A SPARE."];
    case "ambush":
      return ["", "GERBIL BANDITS! THEY GRAB YOUR CAMEL'S REINS", "AND DEMAND A TOLL OF BISCUITS."];
    case "subPrompt":
      return ["7 = MAKE A RUN FOR IT     8 = WAIT AND HAGGLE"];
    case "escaped":
      return ["YOU GOT AWAY! THE GERBILS SHAKE THEIR TINY FISTS.", ""];
    case "paid":
      return ["THE GERBILS SETTLE FOR TWO BISCUITS. OFF YOU GO.", ""];
    case "stillWaiting":
      return ["THE GERBILS ARE STILL ARGUING ABOUT THE PRICE. YOU WAIT.", ""];
    case "rescued":
      return ["A HERDER SAW YOU WAVING! THREE DRINKS FOR YOUR CANTEEN.", ""];
    case "caught":
      return ["", "THE LADLE GANG HAS CAUGHT UP WITH YOU!", "THEY CAN'T LIFT A CAMEL, SO THEY ASK YOU BOTH TO STAY FOR PORRIDGE.", "THE TREK IS OVER.", ""];
    case "won":
      return [
        "",
        "*********************************************",
        "*        YOU MADE IT ACROSS THE GOBI!       *",
        "*********************************************",
        "THE GER CAMP IS THROWING YOU A PARTY TONIGHT.",
        "THE LADLE GANG SAYS IT'S COMING TOO. HIDE THE SOUP.",
        "",
      ];
    case "died":
      return ["", CAUSES[h.cause], "THE TREK IS OVER.", CLOSERS[h.epitaph], ""];
    case "illegal":
      return ["Illegal function call in 1250", "Ok"];
    case "prompt":
      return [];
  }
}

/** What BASIC keeps quiet about, after a command. */
function whatBasicHides(game: Original, before: { repeats: number; command: number; value: number }, happened: Happening[]) {
  const s = game.state;
  const notes: string[] = [];
  const repeats = s.repeatsTotal - before.repeats;
  if (repeats > 0) {
    const each = Math.round(before.value) === 3 ? 3 : 1;
    notes.push(`The camel ran on ${repeats} more time${repeats === 1 ? "" : "s"} without a word: +${repeats * each} fatigue, and only the last stride's miles counted.`);
  }
  if (happened.some((h) => h.kind === "status")) notes.push("Asking for your status cost a drink: the status lines run straight on into the drinking code.");
  if (happened.some((h) => h.kind === "hump")) notes.push("That bump moved the gang a mile closer.");
  if (happened.some((h) => h.kind === "paid" || h.kind === "stillWaiting")) notes.push("Waiting is always safe: the flag that should hold you prisoner is never set.");
  const typed = Math.round(before.value);
  if (typed === 0 || (typed > 6 && typed <= 255)) notes.push(`The program has no command ${typed}: anything but 1 to 6 counts as hoping for help.`);
  if (happened.some((h) => h.kind === "illegal")) notes.push("A negative number stops BASIC itself: its ON … GOTO can't jump to line minus anything.");
  const gang = s.turn >= 4 ? `The gang is at mile ${half(s.pursuers)}.` : `The gang sets off after turn 3 (this is turn ${s.turn}).`;
  return { notes, facts: `Fatigue F = ${s.fatigue} · ${gang} · return addresses left on BASIC's stack: ${s.staleReturns}` };
}

const LIMIT = 400;
const FRESH_FACTS = "Fatigue F = 0 · The gang sets off after turn 3. · return addresses left on BASIC's stack: 0";

/** What a submitted line led to, for the keycaps and records. */
export type Outcome = { typo: boolean; finished: { won: boolean } | null };

export class Desk1982 {
  lines: string[] = [];
  mode: Mode = "command";
  /** Has the player answered anything in this game yet? */
  started = false;
  notes: string[] = [];
  facts = FRESH_FACTS;
  private rng: Rng;
  private game: Original;

  constructor() {
    // No RANDOMIZE in 1982: every time the desk is set up, the dice fall the same way.
    this.rng = createRng("two-humps/1982");
    this.game = this.deal([]);
  }

  /** A new game, keeping what is already on the screen above it. */
  private deal(keep: string[]) {
    const game = createOriginal(() => this.rng.float());
    this.game = game;
    this.show([...keep, ...game.take().flatMap(linesFor)]);
    this.mode = "command";
    this.started = false;
    this.notes = [];
    this.facts = FRESH_FACTS;
    return game;
  }

  restart() {
    this.deal(this.lines);
  }

  private show(lines: string[]) {
    this.lines = lines.slice(-LIMIT);
  }

  submit(raw: string): Outcome {
    const none: Outcome = { typo: false, finished: null };
    const echo = `${PROMPTS[this.mode]}${raw}`;
    const text = raw.trim();

    if (this.mode === "again") {
      // Only a capital Y means yes to this program.
      if (text === "Y") this.deal([...this.lines, echo, ""]);
      else {
        this.mode = "ended";
        this.show([...this.lines, echo, "", "SCAREDY-CAMEL.", "Ok"]);
      }
      return none;
    }
    if (this.mode === "ended") {
      if (text.toUpperCase() === "RUN") this.deal([...this.lines, raw]);
      else this.show([...this.lines, raw, ...(text ? ["Syntax error", "Ok"] : [])]);
      return none;
    }

    // BASIC's INPUT wants a number: anything else is sent back, and an empty answer is 0.
    if (text && !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(text)) {
      this.show([...this.lines, echo, "?Redo from start"]);
      return none;
    }
    const value = Number(text || "0");
    const game = this.game;
    const before = { repeats: game.state.repeatsTotal, command: game.state.command, value };
    const typed = Math.round(value);
    const typo = this.mode === "command" && (typed === 0 || (typed > 6 && typed <= 255));
    if (this.mode === "command") game.command(value);
    else game.subcommand(value);
    this.started = true;
    const happened = game.take();
    const hidden = whatBasicHides(game, before, happened);
    this.notes = hidden.notes;
    this.facts = hidden.facts;
    this.show([...this.lines, echo, ...happened.flatMap(linesFor)]);
    if (game.state.phase !== "over") {
      this.mode = game.state.phase === "subcommand" ? "subcommand" : "command";
      return { typo, finished: null };
    }
    this.mode = game.state.ending === "crashed" ? "ended" : "again";
    return { typo, finished: { won: game.state.ending === "won" } };
  }
}
