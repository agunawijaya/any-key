/*
 * Tactics: the pit as a board game you can read. Before you act you see
 * where the rabbit's first pounce will land (it is locked on the cell you
 * stand on when your turn begins) and the odds of each pounce after it.
 * Extra pounces chase you wherever you went. Rocks and stones stop a
 * pounce dead (a dazed rabbit hops round them next turn), a burrow hides
 * you for one turn and caves in behind you, carrots buy you a turn, and
 * your bobble hat saves you once.
 */

import { rabbitStep } from "./classic";
import { cellsInCircle, type Cell, DIRECTIONS, type Direction, directionToward, inCircle, keyOf, kingDistance, same, step } from "./geometry";

export type Temperament = "plain" | "jumper" | "stalker" | "clever";

export type RabbitPlan = {
  start: Cell;
  temperament: Temperament;
  /** The middle of the patch of rustling grass it hides in before the drop. */
  rustle: Cell;
};

export type Tools = { carrot: number; stone: number; dig: number };

export type PitPlan = {
  /**
   * "classic" plays Classic through this engine: no locked first pounce (every
   * pounce goes for where you are now), no hat, and a rabbit that swings along
   * the pit wall instead of bonking into it, exactly as lib/ten-turns/classic.ts.
   */
  rules?: "classic" | "tactics";
  id: string;
  chapter: number;
  title: string;
  /** One line under the title: what is new in this pit. */
  note: string;
  radius: number;
  turns: number;
  rocks: Cell[];
  burrows: Cell[];
  /** Pairs of burrows joined underground: in at one, up at the other. */
  tunnels: [Cell, Cell][];
  /** Carrots growing in the ground, one each, to pull into the tray. */
  patches: Cell[];
  rabbits: RabbitPlan[];
  tools: Tools;
};

/** How far the rustling grass reaches from its middle, in steps: a five-by-five patch. */
export const RUSTLE_REACH = 2;

/** How far a carrot can be tossed, in steps. */
export const CARROT_REACH = 3;

/** `dazed`: it bonked into something last turn, and this turn it hops round obstacles instead. */
export type Rabbit = { at: Cell; temperament: Temperament; dazed: boolean };

export type TacticsOutcome = "squish" | "crunch" | "released";

export type TacticsState = {
  plan: PitPlan;
  /** The turn being played, 1-based. */
  turn: number;
  /** Null before the drop. */
  player: Cell | null;
  /** The burrow the rabbits saw the player go into, while hiding. */
  hiddenAt: Cell | null;
  hat: boolean;
  tools: Tools;
  stones: Cell[];
  carrots: Cell[];
  patches: Cell[];
  burrows: Cell[];
  rabbits: Rabbit[];
  /** Where each rabbit's first pounce is aimed this turn, fixed when the turn began. */
  locks: Cell[];
  outcome: TacticsOutcome | null;
  toolsUsed: number;
};

export type Action =
  | { kind: "move"; to: Cell }
  | { kind: "carrot"; to: Cell }
  | { kind: "stone"; to: Cell }
  | { kind: "dig" }
  | { kind: "pull"; patch: Cell }
  | { kind: "wait" };

/** One hop of one rabbit, for the animation and the log. */
export type Hop = {
  rabbit: number;
  from: Cell;
  to: Cell;
  /** What the hop ended in. */
  result: "landed" | "bonk" | "circle" | "hat" | "crunch" | "carrot";
  /** For a bonk: the rock, stone, rabbit or wall it hit. */
  hit?: Cell;
  /** Whether it pounces again after this one. */
  again: boolean;
  /** The chance it had of going again, shown as pips. */
  chance: number;
};

/* ---------- The board ---------- */

export function pitCells(plan: PitPlan): Cell[] {
  return cellsInCircle(plan.radius);
}

const has = (list: Cell[], c: Cell) => list.some((x) => same(x, c));

export function isBlocked(state: Pick<TacticsState, "plan" | "stones">, c: Cell) {
  return !inCircle(c, state.plan.radius) || has(state.plan.rocks, c) || has(state.stones, c);
}

export function tunnelExit(plan: PitPlan, burrow: Cell): Cell | null {
  for (const [a, b] of plan.tunnels) {
    if (same(a, burrow)) return b;
    if (same(b, burrow)) return a;
  }
  return null;
}

/** The chance of another pounce after the `count`th one this turn. */
export function chainChance(temperament: Temperament, count: number) {
  switch (temperament) {
    case "stalker":
      return 0;
    // The clever one has the jumper's legs as well as its own head.
    case "jumper":
    case "clever":
      return 1 / (Math.ceil(count / 2) + 1);
    default:
      return 1 / (count + 1);
  }
}

/** Cells a stalker covers in one pounce. */
const reachOf = (t: Temperament) => (t === "stalker" ? 2 : 1);

/* ---------- Starting ---------- */

export function startPit(plan: PitPlan): TacticsState {
  return {
    plan,
    turn: 1,
    player: null,
    hiddenAt: null,
    hat: plan.rules !== "classic",
    tools: { ...plan.tools },
    stones: [],
    carrots: [],
    patches: [...plan.patches],
    burrows: [...plan.burrows],
    rabbits: plan.rabbits.map((r) => ({ at: r.start, temperament: r.temperament, dazed: false })),
    locks: [],
    outcome: null,
    toolsUsed: 0,
  };
}

/** The cells a rabbit's rustling grass covers: it is somewhere in here. */
export function rustleCells(plan: PitPlan, rabbit = 0): Cell[] {
  const middle = plan.rabbits[rabbit].rustle;
  const cells: Cell[] = [];
  for (let dy = -RUSTLE_REACH; dy <= RUSTLE_REACH; dy++) {
    for (let dx = -RUSTLE_REACH; dx <= RUSTLE_REACH; dx++) {
      const c = { x: middle.x + dx, y: middle.y + dy };
      if (inCircle(c, plan.radius) && !has(plan.rocks, c)) cells.push(c);
    }
  }
  return cells;
}

export function canDrop(state: TacticsState, c: Cell) {
  return !state.player && !isBlocked(state, c) && !has(state.burrows, c) && !has(state.patches, c);
}

export function drop(state: TacticsState, c: Cell): TacticsState {
  if (!canDrop(state, c)) return state;
  const squished = state.rabbits.some((r) => same(r.at, c));
  const next = { ...state, player: c, outcome: squished ? ("squish" as const) : null };
  return squished ? next : lockOn(next);
}

/* ---------- Where the rabbits aim ---------- */

/** What the rabbit goes for right now: a carrot on the ground, the burrow it saw you enter, or you. */
function aimOf(state: TacticsState, rabbit: Rabbit): Cell {
  if (state.carrots.length) return nearest(rabbit.at, state.carrots);
  return state.hiddenAt ?? state.player!;
}

function nearest(from: Cell, cells: Cell[]) {
  return cells.reduce((a, b) => (kingDistance(from, b) < kingDistance(from, a) ? b : a));
}

/**
 * The clever rabbit's guess: the free cell next to you that runs furthest
 * from it. It locks its first pounce on that cell instead of yours.
 */
export function predictedEscape(state: TacticsState, rabbit: Rabbit): Cell {
  const player = state.player!;
  let best = player;
  let bestDistance = -1;
  for (const d of DIRECTIONS) {
    const c = step(player, d);
    if (isBlocked(state, c) || has(state.burrows, c)) continue;
    const gap = Math.hypot(c.x - rabbit.at.x, c.y - rabbit.at.y);
    if (gap > bestDistance) {
      bestDistance = gap;
      best = c;
    }
  }
  return best;
}

/** Fixes each rabbit's first pounce of the coming turn. */
export function lockOn(state: TacticsState): TacticsState {
  if (state.plan.rules === "classic") return { ...state, locks: [] };
  const locks = state.rabbits.map((r) => (r.temperament === "clever" && !state.carrots.length ? predictedEscape(state, r) : aimOf(state, r)));
  return { ...state, locks };
}

/**
 * The direction a rabbit hops towards `aim`. The clever one steps round rocks
 * and stones; so does any rabbit still dazed from a bonk, so one rock can't
 * hold it off for ever.
 */
function hopDirection(state: TacticsState, rabbit: Rabbit, aim: Cell): Direction | null {
  const toward = directionToward(rabbit.at, aim);
  if (!toward) return null;
  if (rabbit.temperament !== "clever" && !rabbit.dazed) return toward;
  const index = DIRECTIONS.indexOf(toward);
  for (const turn of [0, 1, -1, 2, -2]) {
    const d = DIRECTIONS[(index + turn + 8) % 8];
    if (!isBlocked(state, step(rabbit.at, d))) return d;
  }
  return toward;
}

/**
 * Where one pounce at `aim` ends, before what it lands on is settled: a
 * stalker covers two cells, stopping short on whatever it meets first.
 */
export function pounceTarget(state: TacticsState, rabbit: Rabbit, aim: Cell): { to: Cell; blocked: boolean; hit?: Cell } {
  if (state.plan.rules === "classic") return { to: rabbitStep(rabbit.at, aim, state.plan.radius), blocked: false };
  const d = hopDirection(state, rabbit, aim);
  if (!d) return { to: rabbit.at, blocked: false };
  let at = rabbit.at;
  for (let i = 0; i < reachOf(rabbit.temperament); i++) {
    const next = step(at, d);
    // Two rabbits bump heads as hard as one rabbit meets a rock.
    if (isBlocked(state, next) || state.rabbits.some((r) => r !== rabbit && same(r.at, next))) return { to: at, blocked: true, hit: next };
    at = next;
    if (same(at, aim) || (state.player && same(at, state.player)) || has(state.carrots, at)) break;
  }
  return { to: at, blocked: false };
}

/** Where a rabbit's next pounce would land, for the intent arrow and its shadow. */
export function intentOf(state: TacticsState, index: number, first: boolean): Cell {
  const rabbit = state.rabbits[index];
  const aim = first ? state.locks[index] ?? aimOf(state, rabbit) : aimOf(state, rabbit);
  return pounceTarget(state, rabbit, aim).to;
}

/* ---------- The player's turn ---------- */

export function canStepTo(state: TacticsState, c: Cell) {
  const p = state.player!;
  if (kingDistance(p, c) !== 1 || isBlocked(state, c) || has(state.patches, c)) return false;
  if (state.rabbits.some((r) => same(r.at, c))) return false;
  // Out of a burrow you climb onto open ground; you can't burrow two turns running.
  if (state.hiddenAt && has(state.burrows, c)) return false;
  // A tunnel whose far end has a rabbit sitting on it is no way out.
  const exit = has(state.burrows, c) ? tunnelExit(state.plan, c) : null;
  if (exit && state.rabbits.some((r) => same(r.at, exit))) return false;
  return true;
}

export function legalActions(state: TacticsState): Action[] {
  if (state.outcome || !state.player) return [];
  const p = state.player;
  const actions: Action[] = [];
  for (const d of DIRECTIONS) {
    const c = step(p, d);
    if (canStepTo(state, c)) actions.push({ kind: "move", to: c });
  }
  if (!state.hiddenAt) {
    if (state.tools.carrot > 0) {
      for (const c of pitCells(state.plan)) {
        if (kingDistance(p, c) <= CARROT_REACH && !same(c, p) && freeForObject(state, c)) actions.push({ kind: "carrot", to: c });
      }
    }
    if (state.tools.stone > 0) {
      for (const d of DIRECTIONS) {
        const c = step(p, d);
        if (freeForObject(state, c)) actions.push({ kind: "stone", to: c });
      }
    }
    if (state.tools.dig > 0 && !has(state.burrows, p)) actions.push({ kind: "dig" });
    for (const patch of state.patches) if (kingDistance(p, patch) === 1) actions.push({ kind: "pull", patch });
  }
  if (!actions.some((a) => a.kind === "move")) actions.push({ kind: "wait" });
  return actions;
}

function freeForObject(state: TacticsState, c: Cell) {
  return (
    !isBlocked(state, c) &&
    !has(state.burrows, c) &&
    !has(state.patches, c) &&
    !has(state.carrots, c) &&
    !same(c, state.player!) &&
    !state.rabbits.some((r) => same(r.at, c))
  );
}

/** The player acts; the rabbits have not moved yet. */
export function act(state: TacticsState, action: Action): TacticsState {
  let next: TacticsState = { ...state, hiddenAt: null };
  // Climbing out, the burrow caves in behind you, and a tunnel's other end with it.
  if (state.hiddenAt) next = { ...next, burrows: state.burrows.filter((b) => !same(b, state.hiddenAt!) && !same(b, state.player!)) };
  switch (action.kind) {
    case "move": {
      const exit = has(state.burrows, action.to) ? tunnelExit(state.plan, action.to) : null;
      next = { ...next, player: exit ?? action.to, hiddenAt: has(state.burrows, action.to) ? action.to : null };
      break;
    }
    case "carrot":
      next = { ...next, carrots: [...state.carrots, action.to], tools: { ...state.tools, carrot: state.tools.carrot - 1 }, toolsUsed: state.toolsUsed + 1 };
      break;
    case "stone":
      next = { ...next, stones: [...state.stones, action.to], tools: { ...state.tools, stone: state.tools.stone - 1 }, toolsUsed: state.toolsUsed + 1 };
      break;
    case "dig":
      next = { ...next, burrows: [...state.burrows, state.player!], hiddenAt: state.player, tools: { ...state.tools, dig: state.tools.dig - 1 }, toolsUsed: state.toolsUsed + 1 };
      break;
    case "pull":
      next = { ...next, patches: state.patches.filter((c) => !same(c, action.patch)), tools: { ...state.tools, carrot: state.tools.carrot + 1 } };
      break;
    case "wait":
      break;
  }
  // A carrot on the ground catches every rabbit's eye at once, even its first pounce.
  if (action.kind === "carrot") next = { ...next, locks: next.rabbits.map((r) => nearest(r.at, next.carrots)) };
  return next;
}

/* ---------- The rabbits' turn ---------- */

export type RabbitRoll = (chance: number) => boolean;

/**
 * Every rabbit takes its turn in order. `roll` decides each extra pounce;
 * the engine asks with the chance, so a simulation, a replay or the solver
 * can answer.
 */
export function rabbitsTurn(state: TacticsState, roll: RabbitRoll): { state: TacticsState; hops: Hop[] } {
  let s = state;
  const hops: Hop[] = [];
  for (let i = 0; i < s.rabbits.length && !s.outcome; i++) {
    let bonked = false;
    for (let count = 1; ; count++) {
      const rabbit = s.rabbits[i];
      const aim = count === 1 ? s.locks[i] ?? aimOf(s, rabbit) : aimOf(s, rabbit);
      const { to, blocked, hit } = pounceTarget(s, rabbit, aim);
      const from = rabbit.at;
      const chance = chainChance(rabbit.temperament, count);
      if (blocked && same(to, from)) {
        hops.push({ rabbit: i, from, to, result: "bonk", again: false, chance, hit });
        bonked = true;
        break;
      }
      // The burrow you are hiding in is out of reach: the rabbit circles it instead.
      if (s.hiddenAt && (same(to, s.hiddenAt) || same(to, s.player!))) {
        const around = circleAround(s, i, s.hiddenAt);
        s = moveRabbit(s, i, around);
        const again = roll(chance);
        hops.push({ rabbit: i, from, to: around, result: "circle", again, chance });
        if (!again) break;
        continue;
      }
      if (!s.hiddenAt && same(to, s.player!)) {
        if (s.hat) {
          // It snatches the hat and springs back to where it came from.
          s = { ...s, hat: false };
          hops.push({ rabbit: i, from, to, result: "hat", again: false, chance });
        } else {
          s = { ...moveRabbit(s, i, to), outcome: "crunch" };
          hops.push({ rabbit: i, from, to, result: "crunch", again: false, chance });
        }
        break;
      }
      s = moveRabbit(s, i, to);
      if (has(s.carrots, to)) {
        s = { ...s, carrots: s.carrots.filter((c) => !same(c, to)) };
        hops.push({ rabbit: i, from, to, result: "carrot", again: false, chance });
        break;
      }
      if (blocked) {
        hops.push({ rabbit: i, from, to, result: "bonk", again: false, chance, hit });
        bonked = true;
        break;
      }
      const again = roll(chance);
      hops.push({ rabbit: i, from, to, result: "landed", again, chance });
      if (!again) break;
    }
    s = { ...s, rabbits: s.rabbits.map((r, j) => (j === i ? { ...r, dazed: bonked } : r)) };
  }
  return { state: s, hops };
}

function moveRabbit(state: TacticsState, index: number, to: Cell): TacticsState {
  return { ...state, rabbits: state.rabbits.map((r, i) => (i === index ? { ...r, at: to } : r)) };
}

/** The next free cell round a burrow, going clockwise from where the rabbit is. */
export function circleAround(state: TacticsState, index: number, burrow: Cell): Cell {
  const rabbit = state.rabbits[index].at;
  const ring = [...DIRECTIONS].reverse().map((d) => step(burrow, d));
  const here = ring.findIndex((c) => same(c, rabbit));
  const startAt = here >= 0 ? here + 1 : 0;
  for (let k = 0; k < 8; k++) {
    const c = ring[(startAt + k) % 8];
    if (!isBlocked(state, c) && !state.rabbits.some((r, j) => j !== index && same(r.at, c)) && !same(c, state.player!)) {
      if (here < 0 && kingDistance(rabbit, c) > 1) continue;
      return c;
    }
  }
  return rabbit;
}

/** The end of the rabbits' turn: the next turn begins, or the ladder comes down. */
export function endTurn(state: TacticsState): TacticsState {
  if (state.outcome) return state;
  if (state.turn >= state.plan.turns) return { ...state, outcome: "released" };
  return lockOn({ ...state, turn: state.turn + 1 });
}

/** A whole turn: the action, the rabbits' answer, and the start of the next turn. */
export function playTurn(state: TacticsState, action: Action, roll: RabbitRoll): { state: TacticsState; hops: Hop[] } {
  const acted = act(state, action);
  const answer = rabbitsTurn(acted, roll);
  return { state: endTurn(answer.state), hops: answer.hops };
}

/* ---------- Medals ---------- */

export type Medals = { survived: boolean; toolsToSpare: boolean; untouched: boolean };

export function medalsOf(state: TacticsState): Medals {
  const survived = state.outcome === "released" || state.outcome === "squish";
  const left = state.tools.carrot + state.tools.stone + state.tools.dig;
  return {
    survived,
    toolsToSpare: survived && (state.outcome === "squish" || left > 0 || totalTools(state.plan) === 0),
    untouched: survived && state.hat,
  };
}

export const totalTools = (plan: PitPlan) => plan.tools.carrot + plan.tools.stone + plan.tools.dig + plan.patches.length;

export const cellKey = keyOf;

/* ---------- Classic through this engine ---------- */

/** Classic's pit: the original's radius and ten turns, bare earth, empty pockets. The rabbit's start comes after the drop. */
export function classicPlan(): PitPlan {
  return {
    rules: "classic",
    id: "classic",
    chapter: 0,
    title: "Classic",
    note: "Drop in blind, then last ten turns.",
    radius: 10,
    turns: 10,
    rocks: [],
    burrows: [],
    tunnels: [],
    patches: [],
    rabbits: [{ start: { x: 0, y: 0 }, temperament: "plain", rustle: { x: 0, y: 0 } }],
    tools: { carrot: 0, stone: 0, dig: 0 },
  };
}

/** Classic's drop: the rabbit is placed only now (see classic.rabbitAfterDrop), then the usual drop. */
export function dropClassic(state: TacticsState, at: Cell, rabbitAt: Cell): TacticsState {
  return drop({ ...state, rabbits: [{ at: rabbitAt, temperament: "plain", dazed: false }] }, at);
}
