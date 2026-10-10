/*
 * What is on screen at one moment, in world terms and nothing else: where
 * the kid and the rabbits are, how they hold themselves, what lies on the
 * pit floor, which marks and effects are showing. Play screens build a
 * SceneFrame every animation frame; a Style (styles/style.ts) turns it into
 * a picture. Rules never depend on a style, and a style never decides rules.
 */

import type { Cell } from "@/lib/ten-turns/geometry";
import type { Temperament } from "@/lib/ten-turns/tactics";

/** A point on the pit floor; actors move smoothly between cells, so it need not be whole. */
export type Spot = { x: number; y: number };

export type Mood = "brave" | "scared" | "shock" | "joy" | "sheepish";

export type KidView = {
  at: Spot;
  /** Height above the floor, in pit units: falling at the drop, hopping between cells. */
  lift: number;
  mood: Mood;
  /** stand, a step in progress, cowering, falling at the drop, sitting (on a squashed rabbit), cheering, hidden in a burrow. */
  pose: "stand" | "step" | "cower" | "fall" | "sit" | "cheer" | "hidden";
  facing: 1 | -1;
  hat: boolean;
  /** Where the eyes look, -1 to 1 each way. */
  look: Spot;
  /** Squash and stretch: 1 at rest, below on landing, above in the air. */
  squash: number;
};

export type RabbitView = {
  at: Spot;
  lift: number;
  temperament: Temperament;
  /** sitting, crouched to pounce, in mid-leap, flattened, eating a carrot, stunned after a bonk. */
  pose: "sit" | "crouch" | "leap" | "flat" | "eat" | "stunned";
  facing: 1 | -1;
  /** 0 a sweet bunny, 1 a predator. */
  menace: number;
  squash: number;
  mouth: number;
  earsBack: number;
  /** In a leap: how far through it (0 to 1), for the stretch and the pitch. */
  flight: number;
  /** How flat it is when squashed, 0 to 1. */
  flat: number;
  look: Spot;
  /** Wearing the kid's bobble hat, snatched earlier in the pit. */
  hat: boolean;
};

export type BoardView = {
  radius: number;
  rocks: Cell[];
  burrows: Cell[];
  /** Burrows that have caved in. */
  caved: Cell[];
  tunnels: [Cell, Cell][];
  /** Carrot patches with a carrot still in them. */
  patches: Cell[];
  stones: Cell[];
  carrots: Cell[];
};

export type IntentMark = {
  from: Spot;
  to: Cell;
  /** The locked first pounce of the turn (drawn bolder) or a possible extra one. */
  first: boolean;
};

export type MarksView = {
  intents: IntentMark[];
  /** Cells you could step to, faintly ringed. */
  reachable: Cell[];
  /** The cell under the pointer or the keyboard cursor. */
  hover: Cell | null;
  /** Cells a tool can be used on, while choosing. */
  targets: Cell[];
  /** The rustling grass before the drop: the cells the rabbit may be hiding in. */
  rustle: Cell[] | null;
  /** A cell that just refused a move: it shakes, unless motion is reduced. */
  refused: { cell: Cell; age: number; shake: boolean } | null;
};

export type EffectsView = {
  dust: { at: Spot; age: number; size: number }[];
  /** A falling thing's shadow growing where it will land. */
  landing: { at: Spot; closeness: number; size: number }[];
  /** Stars round a dizzy head (a squashed or stunned rabbit). */
  stars: { at: Spot; lift: number; size: number }[];
  shout: { text: string; at: Spot; lift: number; age: number } | null;
  /** 0 to 1: the page turning to the next one, which has a little picture of what just happened. */
  pageTurn: { amount: number; title: string; line: string; picture: "squish" } | null;
  /** 0 to 1: darkness closing in for a crunch. */
  blackout: number;
  /** A small word from the rabbit after a crunch. */
  burp: { at: Spot; age: number } | null;
  /** Things in the air: a tossed carrot, one pulled from its patch. */
  flying: { at: Spot; lift: number; spin: number }[];
};

export type SceneFrame = {
  time: number;
  board: BoardView;
  kid: KidView | null;
  rabbits: RabbitView[];
  marks: MarksView;
  effects: EffectsView;
  /** Pushes the camera in on a spot for a big moment: 1 shows the whole pit. */
  zoom: { factor: number; focus: Spot };
};

export const noMarks = (): MarksView => ({ intents: [], reachable: [], hover: null, targets: [], rustle: null, refused: null });

export const noEffects = (): EffectsView => ({ dust: [], landing: [], stars: [], shout: null, pageTurn: null, blackout: 0, burp: null, flying: [] });

export const restingRabbit = (at: Spot, temperament: Temperament): RabbitView => ({
  at,
  lift: 0,
  temperament,
  pose: "sit",
  facing: 1,
  menace: 0,
  squash: 1,
  mouth: 0,
  earsBack: 0,
  flight: 0,
  flat: 0,
  look: { x: 0.2, y: 0 },
  hat: false,
});

export const standingKid = (at: Spot): KidView => ({ at, lift: 0, mood: "brave", pose: "stand", facing: 1, hat: true, look: { x: 0, y: 0 }, squash: 1 });
