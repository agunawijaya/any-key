/*
 * The Tactics campaign: twenty pits in five chapters. Each chapter brings
 * one new idea; every pit is proved survivable by scripts/check-ten-turns.ts.
 */

import type { Cell } from "./geometry";
import type { PitPlan, RabbitPlan, Temperament, Tools } from "./tactics";

export type Chapter = { number: number; title: string; idea: string };

export const CHAPTERS: Chapter[] = [
  { number: 1, title: "The Pit", idea: "Read the arrow and the pips" },
  { number: 2, title: "Burrows", idea: "Hide, and come up somewhere else" },
  { number: 3, title: "Carrots", idea: "Buy a turn with a carrot" },
  { number: 4, title: "Two Rabbits", idea: "A jumper and a stalker at once" },
  { number: 5, title: "The Big One", idea: "A wider pit and a rabbit that thinks" },
];

const c = (x: number, y: number): Cell => ({ x, y });
const rabbit = (temperament: Temperament, start: Cell, rustle: Cell): RabbitPlan => ({ temperament, start, rustle });
const tools = (carrot: number, stone: number, dig: number): Tools => ({ carrot, stone, dig });

type Draft = Partial<PitPlan> & Pick<PitPlan, "id" | "chapter" | "title" | "note" | "rabbits" | "tools">;

const pit = (draft: Draft): PitPlan => ({ radius: 10, turns: 10, rocks: [], burrows: [], tunnels: [], patches: [], ...draft });

/** A small heap of rocks around a cell, in one of a few hand-picked shapes. */
function boulders(at: Cell, shape: "one" | "pair" | "heap" | "wall"): Cell[] {
  const offsets: Record<typeof shape, [number, number][]> = {
    one: [[0, 0]],
    pair: [[0, 0], [1, 0]],
    heap: [[0, 0], [1, 0], [0, 1]],
    wall: [[0, 0], [1, 0], [2, 0]],
  };
  return offsets[shape].map(([dx, dy]) => c(at.x + dx, at.y + dy));
}

export const PITS: PitPlan[] = [
  /* ---------- 1. The Pit ---------- */
  pit({
    id: "first-drop",
    chapter: 1,
    title: "First Drop",
    note: "The arrow shows where it will land. Don't be there.",
    rabbits: [rabbit("plain", c(6, 6), c(5, 5))],
    tools: tools(0, 2, 0),
  }),
  pit({
    id: "read-the-arrow",
    chapter: 1,
    title: "Read the Arrow",
    note: "Watch the pips too: each lit one is another chance it pounces again.",
    rabbits: [rabbit("plain", c(0, 10), c(0, 9))],
    tools: tools(0, 1, 0),
  }),
  pit({
    id: "hat-trick",
    chapter: 1,
    title: "Hat Trick",
    note: "Rocks stop a pounce dead. Your hat saves you once.",
    rocks: [...boulders(c(-4, 2), "heap"), ...boulders(c(4, -3), "pair"), ...boulders(c(0, -7), "heap"), ...boulders(c(6, 4), "one"), ...boulders(c(-7, -4), "pair")],
    rabbits: [rabbit("plain", c(-6, -1), c(-5, -1))],
    tools: tools(0, 1, 0),
  }),
  pit({
    id: "ring-of-stones",
    chapter: 1,
    title: "Ring of Stones",
    note: "A ring of rocks with gaps in it, and two stones of your own.",
    rocks: [c(4, 3), c(3, 4), c(-3, 4), c(-4, 3), c(-4, -3), c(-3, -4), c(3, -4), c(4, -3), c(5, 1), c(-5, -1), c(1, -5), c(-1, 5)],
    rabbits: [rabbit("plain", c(5, 8), c(4, 7))],
    tools: tools(0, 2, 0),
  }),

  /* ---------- 2. Burrows ---------- */
  pit({
    id: "rabbit-holes",
    chapter: 2,
    title: "Rabbit Holes",
    note: "Step into a burrow to hide for a turn. It caves in behind you.",
    burrows: [c(-6, 3), c(5, 5), c(2, -6)],
    rabbits: [rabbit("plain", c(7, -2), c(6, -2))],
    tools: tools(0, 0, 1),
  }),
  pit({
    id: "down-and-across",
    chapter: 2,
    title: "Down and Across",
    note: "In at one end of the tunnel, up at the other, while it sniffs at the wrong hole.",
    burrows: [c(-7, -1), c(7, 1), c(0, 7)],
    tunnels: [[c(-7, -1), c(7, 1)]],
    rabbits: [rabbit("plain", c(-5, 7), c(-4, 6))],
    tools: tools(0, 1, 0),
  }),
  pit({
    id: "warren",
    chapter: 2,
    title: "Warren",
    note: "Two tunnels and a spade. Dig in when there is nowhere left to run.",
    burrows: [c(-6, -5), c(6, 5), c(-6, 5), c(6, -5)],
    tunnels: [
      [c(-6, -5), c(6, 5)],
      [c(-6, 5), c(6, -5)],
    ],
    rocks: [...boulders(c(-1, 0), "wall")],
    rabbits: [rabbit("plain", c(3, 1), c(2, 1))],
    tools: tools(0, 0, 1),
  }),
  pit({
    id: "last-hole",
    chapter: 2,
    title: "Last Hole",
    note: "Six burrows, two of them joined underground. Make every one count.",
    burrows: [c(-4, -4), c(4, 4), c(-4, 4), c(4, -4), c(0, -8), c(0, 8)],
    tunnels: [[c(0, -8), c(0, 8)]],
    rabbits: [rabbit("plain", c(5, -5), c(4, -4))],
    tools: tools(0, 1, 1),
  }),

  /* ---------- 3. Carrots ---------- */
  pit({
    id: "carrot-toss",
    chapter: 3,
    title: "Carrot Toss",
    note: "Toss a carrot: every pounce goes for it, and eating it ends the rabbit's turn.",
    rabbits: [rabbit("plain", c(6, -3), c(5, -2))],
    tools: tools(1, 0, 0),
  }),
  pit({
    id: "kitchen-garden",
    chapter: 3,
    title: "Kitchen Garden",
    note: "Nothing in your pockets: pull carrots from the patches as you pass.",
    patches: [c(-6, -6), c(6, -6), c(0, 7)],
    rabbits: [rabbit("plain", c(0, 6), c(0, 5))],
    tools: tools(0, 1, 0),
  }),
  pit({
    id: "two-for-one",
    chapter: 3,
    title: "Two for One",
    note: "A jumper keeps its odds of another pounce for longer. Two carrots.",
    rocks: [...boulders(c(-5, -5), "heap"), ...boulders(c(3, 6), "pair")],
    rabbits: [rabbit("jumper", c(-3, -1), c(-2, -1))],
    tools: tools(2, 0, 0),
  }),
  pit({
    id: "snack-run",
    chapter: 3,
    title: "Snack Run",
    note: "Carrots at both ends, rocks in the middle, a jumper in between.",
    patches: [c(-8, 0), c(8, 0)],
    rocks: [c(0, 0), c(1, 0), c(0, 1), c(-1, 0), c(0, -1)],
    rabbits: [rabbit("jumper", c(1, 4), c(1, 3))],
    tools: tools(1, 0, 0),
  }),

  /* ---------- 4. Two Rabbits ---------- */
  pit({
    id: "double-trouble",
    chapter: 4,
    title: "Double Trouble",
    note: "Two rabbits: the jumper pounces again and again, the stalker leaps two cells but never twice.",
    rabbits: [rabbit("jumper", c(6, 5), c(5, 5)), rabbit("stalker", c(-6, -5), c(-5, -5))],
    tools: tools(1, 1, 0),
  }),
  pit({
    id: "pincer",
    chapter: 4,
    title: "Pincer",
    note: "They come at you from both sides.",
    rabbits: [rabbit("jumper", c(3, -1), c(2, -1)), rabbit("stalker", c(7, -2), c(6, -2))],
    tools: tools(1, 1, 1),
  }),
  pit({
    id: "hide-and-seek",
    chapter: 4,
    title: "Hide and Seek",
    note: "Burrows, a tunnel and two noses.",
    burrows: [c(-5, 5), c(5, -5), c(-6, -3), c(6, 3)],
    tunnels: [[c(-6, -3), c(6, 3)]],
    rabbits: [rabbit("jumper", c(6, -1), c(5, -1)), rabbit("stalker", c(-5, -1), c(-4, -1))],
    tools: tools(1, 0, 1),
  }),
  pit({
    id: "stampede",
    chapter: 4,
    title: "Stampede",
    note: "Rocks, carrots and two rabbits in a hurry.",
    rocks: [...boulders(c(-3, 3), "heap"), ...boulders(c(3, -4), "heap"), ...boulders(c(-6, -4), "pair"), ...boulders(c(5, 4), "pair")],
    patches: [c(-7, 3), c(7, -2)],
    rabbits: [rabbit("jumper", c(0, -6), c(0, -5)), rabbit("stalker", c(0, 6), c(0, 5))],
    tools: tools(0, 2, 0),
  }),

  /* ---------- 5. The Big One ---------- */
  pit({
    id: "the-big-pit",
    chapter: 5,
    title: "The Big Pit",
    note: "A wider pit and twelve turns.",
    radius: 12,
    turns: 12,
    rocks: [...boulders(c(-6, 6), "heap"), ...boulders(c(6, -6), "heap")],
    rabbits: [rabbit("jumper", c(3, 1), c(2, 1))],
    tools: tools(1, 1, 0),
  }),
  pit({
    id: "clever-clogs",
    chapter: 5,
    title: "Clever Clogs",
    note: "This one waits in the middle, guesses where you'll run, and pounces there first.",
    radius: 12,
    rabbits: [rabbit("clever", c(0, 0), c(0, 0))],
    tools: tools(1, 1, 0),
  }),
  pit({
    id: "outfoxed",
    chapter: 5,
    title: "Outfoxed",
    note: "Rocks don't stop a clever rabbit: it steps round them.",
    radius: 12,
    turns: 12,
    rocks: [...boulders(c(-2, 2), "wall"), ...boulders(c(2, -3), "wall"), ...boulders(c(-8, -3), "heap"), ...boulders(c(7, 5), "heap")],
    burrows: [c(-9, 4), c(9, -4)],
    tunnels: [[c(-9, 4), c(9, -4)]],
    rabbits: [rabbit("clever", c(7, -1), c(6, -1))],
    tools: tools(0, 1, 0),
  }),
  pit({
    id: "the-big-one",
    chapter: 5,
    title: "The Big One",
    note: "Fifteen turns, a clever rabbit, and everything you have learned.",
    radius: 12,
    turns: 15,
    rocks: [...boulders(c(-5, 5), "heap"), ...boulders(c(5, -6), "heap"), ...boulders(c(-9, -2), "pair"), ...boulders(c(8, 3), "pair")],
    burrows: [c(-7, -7), c(7, 7), c(0, -10)],
    tunnels: [[c(-7, -7), c(7, 7)]],
    patches: [c(-10, 3), c(10, -2)],
    rabbits: [rabbit("clever", c(8, 4), c(7, 3))],
    tools: tools(1, 2, 1),
  }),
];

export const pitById = (id: string) => PITS.find((p) => p.id === id);
