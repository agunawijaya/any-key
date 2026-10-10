/*
 * A strong Tactics player: it looks one turn ahead, works out every way the
 * rabbits' turn could go with its exact chance, and judges where each one
 * leaves it by the solved values of the pit. It keeps tools in hand unless
 * using one is clearly worth it. The checks use it to show that every pit
 * and every Daily can be survived; the game uses it for nothing else.
 */

import { type Cell, keyOf } from "./geometry";
import { type Action, legalActions, type PitPlan, playTurn, rustleCells, type TacticsState, type Temperament } from "./tactics";
import { bestDrop, type PitSolution, pitTables, solvePit } from "./tacticsSolver";

export type Brain = { plan: PitPlan; solutions: PitSolution[] };

/** Solves a pit once per kind of rabbit in it. */
export function brainFor(plan: PitPlan): Brain {
  const byTemperament = new Map<Temperament, PitSolution>();
  const tables = pitTables(plan);
  const solutions = plan.rabbits.map((r) => {
    let solution = byTemperament.get(r.temperament);
    if (!solution) {
      solution = solvePit(plan, r.temperament, tables);
      byTemperament.set(r.temperament, solution);
    }
    return solution;
  });
  return { plan, solutions };
}

export function chooseDrop(brain: Brain): Cell {
  return bestDrop(brain.plan, brain.solutions, brain.plan.rabbits.map((_, i) => rustleCells(brain.plan, i))).cell;
}

/** How good a position is: the chance of lasting, each rabbit taken on its own. */
export function positionValue(brain: Brain, state: TacticsState): number {
  if (state.outcome === "crunch") return 0;
  if (state.outcome) return 1;
  let value = 1;
  state.rabbits.forEach((r, i) => {
    value *= brain.solutions[i].value(state.turn, state.player!, r.at, state.hat, r.dazed);
  });
  return value;
}

export type Branch = { state: TacticsState; chance: number };

/**
 * Every way a turn can go after `action`, with its chance: the engine is run
 * once per pattern of extra pounces, so nothing here re-implements the rules.
 */
export function branches(state: TacticsState, action: Action, smallest = 1e-5): Branch[] {
  const found: Branch[] = [];
  const explore = (prefix: boolean[], prefixChance: number) => {
    const asked: number[] = [];
    const roll = (chance: number) => {
      asked.push(chance);
      return prefix[asked.length - 1] ?? false;
    };
    const { state: after } = playTurn(state, action, roll);
    let chance = 1;
    asked.forEach((c, j) => {
      chance *= (prefix[j] ?? false) ? c : 1 - c;
    });
    found.push({ state: after, chance });
    let running = prefixChance;
    for (let j = prefix.length; j < asked.length; j++) {
      const c = asked[j];
      if (c > 0 && running * c > smallest) explore([...prefix, ...Array<boolean>(j - prefix.length).fill(false), true], running * c);
      running *= 1 - c;
    }
  };
  explore([], 1);
  return found;
}

/**
 * The expected value of an action, with a little credit for every tool still
 * in hand and for the hat still on: once survival is certain either way, the
 * player still prefers to keep them.
 */
export function actionValue(brain: Brain, state: TacticsState, action: Action, credit: Credit): number {
  let total = 0;
  for (const b of branches(state, action)) {
    if (b.state.outcome === "crunch") continue;
    const left = b.state.tools.carrot + b.state.tools.stone + b.state.tools.dig;
    total += b.chance * (positionValue(brain, b.state) + credit.tool * left + (b.state.hat ? credit.hat : 0));
  }
  return total;
}

export type Credit = { tool: number; hat: number };

export function chooseAction(brain: Brain, state: TacticsState, credit: Credit = { tool: 0.04, hat: 0.03 }): Action {
  let best: { action: Action; value: number } | null = null;
  for (const action of legalActions(state)) {
    const value = actionValue(brain, state, action, credit);
    if (!best || value > best.value) best = { action, value };
  }
  return best!.action;
}

export const describe = (a: Action) => (a.kind === "move" || a.kind === "carrot" || a.kind === "stone" ? `${a.kind} ${keyOf(a.to)}` : a.kind);
