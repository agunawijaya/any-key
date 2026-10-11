/*
 * The 1970s mode: the two programs behind Over / Short, Gunner (1973) and
 * its IBM PC remake Cannoneer, played turn for turn on a terminal. Every
 * line they print here is written fresh; what they do is theirs, quirks
 * and all:
 *
 * - Microsoft BASIC's arithmetic, in single precision, and its random
 *   numbers: neither program calls RANDOMIZE, so every time one is loaded
 *   it fights the same war (the next war, after "again", is the next one in
 *   the sequence);
 * - the vacuum formula with 57.3 for 180/π, fractional elevations taken as
 *   typed, a hit within 100 either way after INT;
 * - a round exactly 100 short reported over;
 * - elevations outside 1 to 89 refused at no cost;
 * - the sixth elevation at one target never fired: the gun is found first;
 * - the 18-round verdict after the fifth target;
 * - Gunner plays again only on a capital Y; Cannoneer takes y as well;
 * - Cannoneer's PC-speaker sounds, cued for the screen to play.
 *
 * The engine is a pure state machine: `bootTerminal` loads a program,
 * `typeLine` gives it one line typed at its prompt. Each step returns the
 * lines printed, what happened as data (for the checks, which compare it
 * with the unmodified programs run in a GW-BASIC interpreter), and the
 * sounds to play.
 */

export type Program = "gunner" | "cannoneer";

export type TerminalEvent =
  | { kind: "gun"; range: number }
  | { kind: "target"; distance: number }
  | { kind: "refused"; too: "high" | "low" }
  | { kind: "not-a-number" }
  | { kind: "over" | "short"; distance: number }
  | { kind: "destroyed"; rounds: number }
  | { kind: "found" }
  | { kind: "total"; rounds: number }
  | { kind: "again"; yes: boolean };

/** Cannoneer's PC speaker: the round leaving, its whistle, the thud, a target's sweeps, the gun's own end. */
export type SpeakerCue = "fire" | "whistle" | "thud" | "sweeps" | "drone";

export type TerminalState = {
  program: Program;
  /** Microsoft BASIC's random number generator, as it stands. */
  seed: number;
  range: number;
  target: number;
  /** Rounds at this target, targets finished before this one, rounds in all. */
  rounds: number;
  finished: number;
  total: number;
  waiting: "elevation" | "again" | null;
};

export type TerminalStep = { state: TerminalState; lines: string[]; events: TerminalEvent[]; sounds: SpeakerCue[] };

/* ---------- Microsoft BASIC's numbers ---------- */

/** Every value in these programs is a single-precision number. */
const single = Math.fround;

/** The generator's state when a program is freshly loaded. */
export const FRESH_SEED = 5228370;

/** RND with a positive argument: the next number of the sequence, and the state after it. */
export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (seed * 214013 + 2531011) % 2 ** 24;
  return { value: single(next / 2 ** 24), seed: next };
}

/** How a program rolls its gun: 20,000–59,999 yards for Gunner, 10,000–13,999 metres for Cannoneer. */
function rollGun(program: Program, seed: number) {
  const r = nextRandom(seed);
  const [spread, least] = program === "gunner" ? [40000, 20000] : [4000, 10000];
  return { range: Math.floor(single(single(spread * r.value) + least)), seed: r.seed };
}

/** A target somewhere from a tenth to nine tenths of the gun's reach. */
function rollTarget(range: number, seed: number) {
  const r = nextRandom(seed);
  return { target: Math.floor(single(range * single(single(0.1) + single(single(0.8) * r.value)))), seed: r.seed };
}

/** The error of a round at `elevation`, as both programs work it out: E = INT(T − R·SIN(2B/57.3)). */
export function errorOf(range: number, target: number, elevation: number) {
  const b2 = single(single(2 * elevation) / single(57.3));
  const impact = single(range * single(Math.sin(b2)));
  return Math.floor(single(target - impact));
}

/**
 * A line typed at a numeric INPUT: blank counts as 0, anything that is not
 * a plain number is not accepted (the interpreter asks again).
 */
export function readNumber(typed: string): number | null {
  const text = typed.trim();
  if (text === "") return 0;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eEdD][+-]?\d+)?$/.test(text)) return null;
  return single(Number(text.replace(/[dD]/, "e")));
}

/** A number as Microsoft BASIC prints it: a space where the sign would go, and one after. */
const num = (n: number) => `${n < 0 ? "-" : " "}${Math.abs(n)} `;

/* ---------- The words, written fresh for each terminal ---------- */

type Words = {
  intro: string[];
  gun: (range: number) => string;
  target: (distance: number) => string[];
  prompt: string;
  tooHigh: string;
  tooLow: string;
  notANumber: string;
  over: (distance: number) => string;
  short: (distance: number) => string;
  destroyed: (rounds: number) => string;
  nextTarget: string;
  found: string[];
  total: (rounds: number) => string;
  fine: string[];
  schooling: string[];
  again: string;
  goodbye: string;
};

const WORDS: Record<Program, Words> = {
  gunner: {
    intro: [
      "GUNNER  -  1973 RULES",
      "",
      "YOU COMMAND ONE FIELD GUN. CALL ITS ELEVATION IN DEGREES",
      "AND YOUR OBSERVER WILL SAY HOW FAR THE ROUND MISSED.",
      "A ROUND WITHIN 100 YARDS TAKES THE TARGET OUT.",
      "FIVE TARGETS. FIVE ROUNDS AT EACH, THEN THEY FIND YOU.",
      "",
    ],
    gun: (range) => `THIS GUN THROWS A SHELL${num(range)}YARDS AT MOST.`,
    target: (distance) => [`OBSERVER: TARGET SIGHTED AT${num(distance)}YARDS.`],
    prompt: "DEGREES? ",
    tooHigh: "THE BARREL WILL NOT GO PAST 89 DEGREES.",
    tooLow: "THE BARREL WILL NOT GO BELOW 1 DEGREE.",
    notANumber: "? A NUMBER OF DEGREES, PLEASE",
    over: (d) => `LONG. IT CAME DOWN${num(d)}YARDS BEYOND.`,
    short: (d) => `SHORT. IT CAME DOWN${num(d)}YARDS SHORT.`,
    destroyed: (rounds) => `ON TARGET. DOWN WITH${num(rounds)}ROUNDS.`,
    nextTarget: "OBSERVER: ANOTHER TARGET...",
    found: ["THEIR GUNS FOUND YOURS FIRST.", "YOUR GUN IS GONE."],
    total: (rounds) => `ROUNDS FIRED IN ALL:${num(rounds)}`,
    fine: ["FINE SHOOTING, OFFICER."],
    schooling: ["REPORT TO FORT SILL FOR A REFRESHER."],
    again: "ANOTHER WAR (Y OR N)? ",
    goodbye: "STAND DOWN.",
  },
  cannoneer: {
    intro: [
      "Cannoneer  -  an IBM PC terminal",
      "",
      "Your gun, your crew, your call: give the elevation in degrees",
      "and the observer will tell you where each round fell.",
      "Within 100 metres the target goes up.",
      "Five targets, and no more than five rounds at any one of them.",
      "",
    ],
    gun: (range) => `Today's gun reaches${num(range)}metres at the most.`,
    target: (distance) => [`Target at${num(distance)}metres.`, "Ready the crew."],
    prompt: "Degrees: ",
    tooHigh: "No higher than 89 degrees on this carriage.",
    tooLow: "No lower than 1 degree, or the round hits the parapet.",
    notANumber: "? A number, please",
    over: (d) => `Over by${num(d)}metres.`,
    short: (d) => `Short by${num(d)}metres.`,
    destroyed: (rounds) => `Direct hit! Down in${num(rounds)}rounds.`,
    nextTarget: "Next target coming up.",
    found: ["The enemy has your range. The gun is lost."],
    total: (rounds) => `Rounds fired:${num(rounds)}`,
    fine: ["Good shooting."],
    schooling: ["Back to Fort Sill with you,", "for more practice at the guns."],
    again: "Again (Y or N)? ",
    goodbye: "Gun stood down.",
  },
};

/* ---------- The programs ---------- */

/** A new gun and its first target, as the program does at its start and after "again". */
function newWar(state: TerminalState, step: TerminalStep): TerminalStep {
  const words = WORDS[state.program];
  const gun = rollGun(state.program, state.seed);
  const s: TerminalState = { ...state, seed: gun.seed, range: gun.range, finished: 0, total: 0 };
  return newTarget(s, { ...step, lines: [...step.lines, words.gun(gun.range), ""], events: [...step.events, { kind: "gun", range: gun.range }] });
}

function newTarget(state: TerminalState, step: TerminalStep): TerminalStep {
  const words = WORDS[state.program];
  const t = rollTarget(state.range, state.seed);
  const s: TerminalState = { ...state, seed: t.seed, target: t.target, rounds: 0, waiting: "elevation" };
  return { state: s, lines: [...step.lines, ...words.target(t.target), "", ""], events: [...step.events, { kind: "target", distance: t.target }], sounds: step.sounds };
}

/** Loads a program: its introduction, its first gun and its first target, and the prompt for an elevation. */
export function bootTerminal(program: Program, seed = FRESH_SEED): TerminalStep {
  const state: TerminalState = { program, seed, range: 0, target: 0, rounds: 0, finished: 0, total: 0, waiting: null };
  return newWar(state, { state, lines: [...WORDS[program].intro], events: [], sounds: [] });
}

/** The prompt the program is waiting at. */
export const promptOf = (state: TerminalState) => (state.waiting === "again" ? WORDS[state.program].again : state.waiting === "elevation" ? WORDS[state.program].prompt : "");

/** One line typed at the prompt. */
export function typeLine(state: TerminalState, typed: string): TerminalStep {
  const step: TerminalStep = { state, lines: [], events: [], sounds: [] };
  if (state.waiting === "elevation") return elevation(state, typed, step);
  if (state.waiting === "again") return again(state, typed, step);
  return step;
}

function elevation(state: TerminalState, typed: string, step: TerminalStep): TerminalStep {
  const words = WORDS[state.program];
  const gunner = state.program === "gunner";
  const b = readNumber(typed);
  if (b === null) return { ...step, lines: [words.notANumber], events: [{ kind: "not-a-number" }] };
  // Refused elevations cost nothing: the round counter only moves after these tests.
  if (b > 89 || b < 1) {
    const too = b > 89 ? "high" : "low";
    return { ...step, lines: [too === "high" ? words.tooHigh : words.tooLow, ...(gunner ? [""] : [])], events: [{ kind: "refused", too }] };
  }
  // Cannoneer plays the whole firing before it counts the round, so even the fatal sixth is heard leaving.
  const sounds: SpeakerCue[] = gunner ? [] : ["fire", "whistle", "thud"];
  const rounds = state.rounds + 1;
  if (rounds >= 6) {
    const lines = ["", ...words.found, "", "", "", ...words.schooling, ""];
    return { state: { ...state, rounds, waiting: "again" }, lines, events: [{ kind: "found" }], sounds: gunner ? [] : [...sounds, "drone"] };
  }
  const e = errorOf(state.range, state.target, b);
  const s: TerminalState = { ...state, rounds };
  if (Math.abs(e) < 100) {
    const total = state.total + rounds;
    const done: TerminalStep = { state: { ...s, total }, lines: [words.destroyed(rounds)], events: [{ kind: "destroyed", rounds }], sounds };
    if (state.finished === 4) return verdict({ ...s, total }, done);
    const next = { ...s, total, finished: state.finished + 1 };
    return newTarget(next, { ...done, lines: [...done.lines, "", words.nextTarget], sounds: [...sounds, "sweeps"] });
  }
  // The famous slip: short only when the error is MORE than 100, so a round exactly 100 short is called over.
  const short = e > 100;
  const line = short ? words.short(Math.abs(e)) : words.over(Math.abs(e));
  return { state: s, lines: [line, ...(gunner ? [""] : [])], events: [{ kind: short ? "short" : "over", distance: Math.abs(e) }], sounds };
}

function verdict(state: TerminalState, step: TerminalStep): TerminalStep {
  const words = WORDS[state.program];
  const lines = [...step.lines, "", "", words.total(state.total), ...(state.total > 18 ? words.schooling : words.fine), ""];
  return { state: { ...state, waiting: "again" }, lines, events: [...step.events, { kind: "total", rounds: state.total }], sounds: step.sounds };
}

function again(state: TerminalState, typed: string, step: TerminalStep): TerminalStep {
  const words = WORDS[state.program];
  // An unquoted answer loses its outer spaces; Gunner then wants a capital Y and nothing else.
  const answer = typed.trim();
  const yes = state.program === "gunner" ? answer === "Y" : answer === "Y" || answer === "y";
  if (!yes) return { state: { ...state, waiting: null }, lines: ["", words.goodbye], events: [{ kind: "again", yes }], sounds: [] };
  return newWar(state, { ...step, events: [{ kind: "again", yes }] });
}
