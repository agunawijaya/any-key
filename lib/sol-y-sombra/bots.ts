import { Corrida, type CorridaSetup, type Ending } from "./corrida";
import { type FinishId, type MoveId } from "./rules";
import { type Tier } from "./verdict";

/*
 * Players made of rules, for balancing the Classic corrida: each decides
 * every pass, what to do when gored, when to go for the finish and how.
 * They see only what the cards show a person.
 */

export type Bot = {
  name: string;
  move(c: Corrida): MoveId;
  /** Go to the moment of truth before this pass? */
  finishNow(c: Corrida): boolean;
  finish(c: Corrida): FinishId;
  carryOn(c: Corrida): boolean;
};

/** The safest move by the odds on the cards. */
const safest = (c: Corrida): MoveId => (["swirl", "outside", "veronica"] as MoveId[]).reduce((a, b) => (c.moveOdds(b).goring < c.moveOdds(a).goring ? b : a));

export const BOTS: Bot[] = [
  {
    name: "careful",
    move: (c) => (c.passes % 3 === 2 ? "outside" : "swirl"),
    finishNow: (c) => c.passes >= 6,
    finish: () => "over-the-horns",
    carryOn: () => false,
  },
  {
    name: "balanced",
    // Veronicas, with a swirl to break a series so the crowd doesn't tire.
    move: (c) => (c.passes % 3 === 2 ? "swirl" : "veronica"),
    finishNow: (c) => c.passes >= 6,
    finish: () => "over-the-horns",
    carryOn: (c) => c.gorings < 2,
  },
  {
    name: "brave",
    move: (c) => (c.passes % 3 === 2 ? "outside" : "veronica"),
    finishNow: (c) => c.passes >= 7,
    finish: () => "waiting",
    carryOn: () => true,
  },
  {
    name: "reckless",
    move: () => "veronica",
    finishNow: (c) => c.passes >= 9,
    finish: () => "waiting",
    carryOn: () => true,
  },
  {
    name: "reader",
    // Reads the odds: a veronica while it's cheap, the safest move when it isn't, the bold finish when the odds allow.
    move: (c) => (c.moveOdds("veronica").goring < 0.12 ? (c.passes % 3 === 2 ? "swirl" : "veronica") : safest(c)),
    finishNow: (c) => c.passes >= 6 && c.finishChance("over-the-horns").success > 0.6,
    finish: (c) => (c.finishChance("waiting").success > 0.5 ? "waiting" : "over-the-horns"),
    carryOn: (c) => c.gorings < 2,
  },
];

export type CorridaOutcome = { ending: Ending; tier: Tier; total: number; passes: number; gorings: number; serious: boolean };

export function playCorrida(bot: Bot, seed: string, setup: CorridaSetup = {}): CorridaOutcome {
  const c = new Corrida(seed, setup);
  let guard = 0;
  while (c.phase !== "verdict" && guard++ < 200) {
    if (c.phase === "down") {
      if (bot.carryOn(c)) c.carryOn();
      else c.retire();
    } else if (c.phase === "pass") {
      if (bot.finishNow(c) || c.passes >= 14) c.beginTruth();
      else c.makePass(bot.move(c));
    } else c.tryFinish(bot.finish(c));
  }
  const v = c.decide();
  return { ending: c.ending!, tier: v.tier, total: v.total, passes: c.passes, gorings: c.gorings, serious: c.ending === "infirmary" };
}

export type CorridaTally = {
  games: number;
  endings: Record<Ending, number>;
  tiers: [number, number, number, number];
  gored: number;
  serious: number;
  meanTotal: number;
};

export function tallyCorridas(bot: Bot, games: number, seed: string, setup: CorridaSetup = {}): CorridaTally {
  const endings: Record<Ending, number> = { rested: 0, retired: 0, infirmary: 0, returned: 0 };
  const tiers: [number, number, number, number] = [0, 0, 0, 0];
  let gored = 0;
  let serious = 0;
  let total = 0;
  for (let i = 0; i < games; i++) {
    const o = playCorrida(bot, `${seed}/${i}`, setup);
    endings[o.ending]++;
    tiers[o.tier]++;
    if (o.gorings > 0) gored++;
    if (o.serious) serious++;
    total += o.total;
  }
  const share = (n: number) => n / games;
  return {
    games,
    endings: { rested: share(endings.rested), retired: share(endings.retired), infirmary: share(endings.infirmary), returned: share(endings.returned) },
    tiers: tiers.map(share) as CorridaTally["tiers"],
    gored: share(gored),
    serious: share(serious),
    meanTotal: total / games,
  };
}
