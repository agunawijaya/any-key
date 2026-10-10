/*
 * The pit playing itself: for the game menu and the Hall's card. A kid keeps
 * stepping away from a rabbit that pounces, chains and closes in; just before
 * anything could end, the pit starts over. Silent, seeded, and drawn with the
 * same choreography as a real game.
 */

import { createRng } from "@/lib/kit/rng";
import { type Cell, DIRECTIONS, kingDistance, step } from "@/lib/ten-turns/geometry";
import { act, canStepTo, drop, endTurn, intentOf, type PitPlan, rabbitsTurn, startPit, type TacticsState } from "@/lib/ten-turns/tactics";
import type { SceneFrame } from "../scene/view";
import { noMarks } from "../scene/view";
import { type Choreo, dropBeats, faceRabbits, freshScene, playerBeats, rabbitBeats, type Scene } from "./choreography";
import { Director } from "./director";

const DEMO_PIT: PitPlan = {
  id: "demo",
  chapter: 0,
  title: "Demo",
  note: "",
  radius: 10,
  turns: 10,
  rocks: [{ x: -4, y: 5 }, { x: -3, y: 5 }, { x: 5, y: -4 }],
  burrows: [],
  tunnels: [],
  patches: [],
  rabbits: [{ start: { x: -2, y: 2 }, temperament: "plain", rustle: { x: -2, y: 2 } }],
  tools: { carrot: 0, stone: 0, dig: 0 },
};

export function createDemo(seed: number | string, reduced = false) {
  const rng = createRng(`ten-turns/demo/${seed}`);
  const director = new Director();
  let state: TacticsState;
  let scene: Scene;
  let choreo: Choreo;
  let waiting = 0;

  const begin = () => {
    const kidAt: Cell = { x: 3 + rng.int(-1, 1), y: -2 + rng.int(-1, 1) };
    const rabbitAt: Cell = { x: -2 + rng.int(-1, 1), y: 2 + rng.int(-1, 1) };
    state = drop({ ...startPit(DEMO_PIT), rabbits: [{ at: rabbitAt, temperament: "plain", dazed: false }] }, kidAt);
    scene = freshScene(state);
    choreo = { scene, reduced, cue: () => {} };
    director.clear();
    director.add(...dropBeats(choreo, kidAt, [{ at: rabbitAt, temperament: "plain" }], true));
  };

  /** The kid steps to whichever free cell is furthest from the rabbit, preferring the middle of the pit. */
  const pickStep = (s: TacticsState): Cell | null => {
    const r = s.rabbits[0].at;
    let best: Cell | null = null;
    let score = -Infinity;
    for (const d of DIRECTIONS) {
      const c = step(s.player!, d);
      if (!canStepTo(s, c)) continue;
      const value = Math.hypot(c.x - r.x, c.y - r.y) - Math.hypot(c.x, c.y) * 0.35 + rng.float() * 0.6;
      if (value > score) {
        score = value;
        best = c;
      }
    }
    return best;
  };

  const nextTurn = () => {
    const to = pickStep(state);
    if (!to) return begin();
    const before = state;
    const acted = act(before, { kind: "move", to });
    const answer = rabbitsTurn(acted, (chance) => rng.float() < chance);
    const after = endTurn(answer.state);
    // Never show an ending in the demo: a catch or the last turn starts the pit over.
    if (after.outcome || answer.hops.some((h) => h.result === "hat") || after.turn > 8) {
      begin();
      return;
    }
    state = after;
    director.add(...playerBeats(choreo, before, { kind: "move", to }, acted), ...rabbitBeats(choreo, answer.hops, after), { duration: 0.6, end: () => faceRabbits(scene) });
  };

  begin();

  return (time: number, dt: number): SceneFrame => {
    director.advance(dt);
    if (!director.busy) {
      waiting += dt;
      if (waiting > 0.5) {
        waiting = 0;
        nextTurn();
      }
    }
    for (const d of scene.effects.dust) d.age += dt / 0.9;
    scene.effects.dust = scene.effects.dust.filter((d) => d.age < 1);
    const marks = noMarks();
    if (!director.busy && state.player) {
      marks.intents = [{ from: state.rabbits[0].at, to: intentOf(state, 0, true), first: true }];
      marks.reachable = DIRECTIONS.map((d) => step(state.player!, d)).filter((c) => canStepTo(state, c) && kingDistance(c, state.rabbits[0].at) > 0);
    }
    return { time, board: scene.board, kid: scene.kid, rabbits: scene.rabbits, marks, effects: scene.effects, zoom: scene.zoom };
  };
}
