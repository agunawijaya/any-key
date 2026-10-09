import { createRng } from "@/lib/kit/rng";
import { Trek, type TrekConfig } from "./engine";
import { STRIDES, THIRST_TURNS, type CommandId } from "./rules";

/*
 * Players made of rules, for balancing and for tests. They only see what the
 * screen shows: the previews, the gauges, the route.
 */

export type Policy = {
  name: string;
  choose(trek: Trek): CommandId | "seeds";
  /** On a run-on: let the camel keep going? */
  letRun(trek: Trek): boolean;
  caravan(trek: Trek): "chase" | "wait";
};

export type Result = { won: boolean; cause: string; turns: number; miles: number; trek: Trek };

/** Plays a crossing to its end. */
export function play(config: TrekConfig, policy: Policy): Result {
  const trek = new Trek(config);
  const s = trek.state;
  for (let guard = 0; guard < 400 && s.phase !== "over"; guard++) {
    if (s.phase === "choose") {
      const choice = policy.choose(trek);
      if (choice === "seeds") trek.tossSeeds();
      else trek.act(choice);
    } else if (s.phase === "run-on") {
      if (policy.letRun(trek)) trek.letRun();
      else trek.pullReins();
    } else if (s.phase === "caravan") {
      trek.chooseCaravan(policy.caravan(trek));
    }
  }
  return { won: s.ending === "arrived", cause: s.ending ?? "stalled", turns: s.turn, miles: s.miles, trek };
}

const strideCost = (trek: Trek) => STRIDES[trek.state.runOn?.command ?? "walk"].fatigue;

/** Picks any command the screen allows, and flips a coin on every run-on. */
export function randomPolicy(seed: number): Policy {
  const rng = createRng(`random-player/${seed}`);
  return {
    name: "random",
    choose(trek) {
      const s = trek.state;
      if (s.sips > 0 && s.thirst < THIRST_TURNS && rng.float() < 0.25) return "drink";
      const options = (["walk", "gallop", "camp", "signal"] as const).filter((c) => trek.preview(c).legal);
      return rng.pick(options);
    },
    letRun: () => rng.float() < 0.5,
    caravan: () => (rng.float() < 0.5 ? "chase" : "wait"),
  };
}

export type Plan = {
  /** Gallop only while fatigue is at or below this. */
  gallopUpTo: number;
  /** Make camp once fatigue reaches this. */
  campAt: number;
  /** On a run-on, keep going only while the next stride leaves fatigue at or below this. */
  runUpTo: number;
  /** Drink once this many turns of water are left. */
  drinkAt: number;
  /** Against the Haboob and the gang, avoid sleeping through the night: rest by day instead. */
  dayCamps: boolean;
  /** Toss seeds at night when the gang is this close. */
  seedsWithin: number;
};

/** The prompt's "sensible" player: drinks at the warning, camps at fatigue 5–6, pulls the reins at 6. */
export const SENSIBLE: Plan = { gallopUpTo: 1, campAt: 5, runUpTo: 5, drinkAt: 1, dayCamps: false, seedsWithin: 12 };

export function planPolicy(plan: Plan, name = "plan"): Policy {
  return {
    name,
    choose(trek) {
      const s = trek.state;
      if (s.sips > 0 && s.thirst <= plan.drinkAt) return "drink";
      if (s.config.pursuer === "gang" && s.seeds > 0 && !s.pursuer.fed && trek.night && s.miles - s.pursuer.at <= plan.seedsWithin) return "seeds";
      if (s.sips === 0 && s.thirst <= 1 && !trek.nextKnownOasis()) return "signal";
      const nightSleep = trek.night && s.config.pursuer !== "rival";
      const wantsCamp = s.fatigue >= plan.campAt || !trek.preview("walk").legal;
      if (wantsCamp && !(plan.dayCamps && nightSleep && trek.preview("walk").legal)) return "camp";
      if (s.fatigue <= plan.gallopUpTo && trek.preview("gallop").legal) return "gallop";
      if (trek.preview("walk").legal) return "walk";
      return "camp";
    },
    letRun(trek) {
      return trek.state.fatigue + strideCost(trek) <= plan.runUpTo;
    },
    caravan: () => "wait",
  };
}

export const sensiblePolicy = () => planPolicy(SENSIBLE, "sensible");

/**
 * A fixed order of moves, ignoring the state except to drink when told to
 * and to pull the reins at once. Used to check that no blind routine wins
 * too often.
 */
export function routinePolicy(order: ("walk" | "gallop" | "camp")[]): Policy {
  let i = 0;
  return {
    name: `routine ${order.join("-")}`,
    choose(trek) {
      const s = trek.state;
      if (s.sips > 0 && s.thirst <= 1) return "drink";
      for (let tries = 0; tries < order.length; tries++) {
        const next = order[i % order.length];
        i++;
        if (trek.preview(next).legal) return next;
      }
      return "camp";
    },
    letRun: () => false,
    caravan: () => "wait",
  };
}

