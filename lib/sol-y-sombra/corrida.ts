import { createRng, type Rng } from "@/lib/kit/rng";
import {
  CLOSE_CALL,
  closeCallOdds,
  FINISHES,
  finishOdds,
  goringOdds,
  MAX_ATTEMPTS,
  missGoringOdds,
  MOVES,
  QUALITIES,
  seriousOdds,
  TELL_LIST,
  type FinishId,
  type MoveId,
  type Quality,
  type Tell,
  type Work,
} from "./rules";
import { award, awardOdds, emptyMeter, meterTotal, type Cap, type Meter, type Tier } from "./verdict";

/*
 * One corrida in the Classic play style: draw a bull, see the crews' work,
 * make passes until you choose the moment of truth, then the crowd decides.
 * Pure and seeded: the same seed and the same choices give the same corrida.
 *
 * Every roll is against the odds the cards show (`moveOdds`, `finishChance`,
 * `verdictOdds`), so what the player reads is what happens.
 */

export type Phase = "pass" | "down" | "truth" | "verdict";

export type Ending = "rested" | "retired" | "infirmary" | "returned";

export type PassResult = {
  kind: "pass";
  move: MoveId;
  side: "left" | "right";
  pass: number;
  odds: { goring: number; close: number };
  outcome: "clean" | "close" | "gored";
  serious: boolean;
};

export type FinishResult = {
  kind: "finish";
  finish: FinishId;
  attempt: number;
  odds: { success: number; goringOnMiss: number };
  outcome: "rests" | "miss" | "gored";
  serious: boolean;
};

export type Verdict = { total: number; cap: Cap; odds: [number, number, number, number]; needle: number; tier: Tier };

export type CorridaSetup = { quality?: Quality; tells?: [Tell, Tell]; picadores?: Work; banderilleros?: Work };

/** How often each kind of work comes out of the crews: mostly middling, sometimes masterly or poor. */
const WORK_WEIGHTS: [Work, number][] = [
  [1, 0.14],
  [2, 0.24],
  [3, 0.3],
  [4, 0.2],
  [5, 0.12],
];

function drawWork(rng: Rng): Work {
  let r = rng.float();
  for (const [work, weight] of WORK_WEIGHTS) {
    if (r < weight) return work;
    r -= weight;
  }
  return 3;
}

/** Two different tells; a bull doesn't hook both ways. */
function drawTells(rng: Rng): [Tell, Tell] {
  const first = rng.pick(TELL_LIST);
  const rest = TELL_LIST.filter((t) => t !== first && !(first.startsWith("hooks") && t.startsWith("hooks")));
  return [first, rng.pick(rest)];
}

export class Corrida {
  readonly quality: Quality;
  readonly tells: [Tell, Tell];
  readonly picadores: Work;
  readonly banderilleros: Work;
  phase: Phase = "pass";
  /** Passes made so far. */
  passes = 0;
  gorings = 0;
  hurt = false;
  attempts = 0;
  ending: Ending | null = null;
  verdict: Verdict | null = null;
  readonly meter: Meter = emptyMeter();
  readonly history: (PassResult | FinishResult)[] = [];
  private readonly rng: Rng;
  private readonly recentMoves: MoveId[] = [];

  constructor(seed: string | number, setup: CorridaSetup = {}) {
    this.rng = createRng(seed);
    this.quality = setup.quality ?? (this.rng.int(1, 5) as Quality);
    this.tells = setup.tells ?? drawTells(this.rng);
    this.picadores = setup.picadores ?? drawWork(this.rng);
    this.banderilleros = setup.banderilleros ?? drawWork(this.rng);
    this.meter.bull = QUALITIES[this.quality].credit;
  }

  /** Which of the bull's sides the next pass goes by: series alternate, starting on his right. */
  get nextSide(): "left" | "right" {
    return this.passes % 2 === 0 ? "right" : "left";
  }

  private context(pass: number) {
    return {
      quality: this.quality,
      tells: this.tells,
      picadores: this.picadores,
      banderilleros: this.banderilleros,
      pass,
      side: this.nextSide,
      hurt: this.hurt,
    };
  }

  /**
   * The odds a move carries on the next pass, exactly as rolled. `timing` is
   * the Arena play style's measure of how well the player held the cape (1 in
   * Classic, where the card is the whole decision).
   */
  moveOdds(move: MoveId, timing = 1) {
    return { goring: Math.min(0.9, goringOdds(move, this.context(this.passes + 1)) * timing), close: closeCallOdds(move) };
  }

  /** What a move would add to the meter if the pass is clean. */
  moveGain(move: MoveId) {
    const spec = MOVES[move];
    return { bravery: spec.bravery, artistry: spec.artistry * this.variety(move) };
  }

  /** The crowd tires of the same move three times running. */
  private variety(move: MoveId) {
    const [a, b] = this.recentMoves.slice(-2);
    return a === move && b === move ? 0.4 : 1;
  }

  makePass(move: MoveId, timing = 1): PassResult {
    if (this.phase !== "pass") throw new Error(`no pass while ${this.phase}`);
    const odds = this.moveOdds(move, timing);
    const side = this.nextSide;
    const gain = this.moveGain(move);
    this.passes += 1;
    this.recentMoves.push(move);
    this.meter.bravery += gain.bravery;
    this.meter.risk += odds.goring * 6;
    let outcome: PassResult["outcome"];
    let serious = false;
    if (this.rng.float() < odds.goring) {
      outcome = "gored";
      serious = this.gore();
    } else {
      this.meter.artistry += gain.artistry;
      outcome = this.rng.float() < odds.close ? "close" : "clean";
      if (outcome === "close") {
        this.meter.bravery += CLOSE_CALL.bravery;
        this.meter.artistry += CLOSE_CALL.artistry;
      }
    }
    // A fight dragged out loses the crowd.
    if (this.passes > 10) this.meter.courage -= 0.5;
    const result: PassResult = { kind: "pass", move, side, pass: this.passes, odds, outcome, serious };
    this.history.push(result);
    return result;
  }

  /** A goring: serious ends the corrida; otherwise the matador is down and must choose. */
  private gore() {
    this.gorings += 1;
    const serious = this.rng.float() < seriousOdds(this.gorings);
    if (serious) this.end("infirmary");
    else this.phase = "down";
    return serious;
  }

  /** Back on his feet and back to the bull: braver in the crowd's eyes, riskier from now on. */
  carryOn() {
    if (this.phase !== "down") throw new Error("not down");
    this.hurt = true;
    this.meter.courage += 2.5;
    this.phase = this.attempts > 0 ? "truth" : "pass";
  }

  retire() {
    if (this.phase !== "down") throw new Error("not down");
    this.meter.courage -= 3;
    this.end("retired");
  }

  /** The chance a finish succeeds on the next attempt. */
  finishChance(finish: FinishId) {
    const context = {
      quality: this.quality,
      tells: this.tells,
      picadores: this.picadores,
      banderilleros: this.banderilleros,
      pass: Math.max(1, this.passes),
      attempt: this.attempts + 1,
    };
    return { success: finishOdds(finish, context), goringOnMiss: missGoringOdds(finish) };
  }

  /** Goes to the moment of truth: from now on only the finish remains. */
  beginTruth() {
    if (this.phase !== "pass") throw new Error(`no moment of truth while ${this.phase}`);
    this.phase = "truth";
  }

  tryFinish(finish: FinishId): FinishResult {
    if (this.phase !== "truth") throw new Error(`no finish while ${this.phase}`);
    const odds = this.finishChance(finish);
    this.attempts += 1;
    let outcome: FinishResult["outcome"];
    let serious = false;
    if (this.rng.float() < odds.success) {
      outcome = "rests";
      this.meter.finish += FINISHES[finish].bonus;
      this.end("rested");
    } else {
      this.meter.finish -= 1.5;
      if (this.rng.float() < odds.goringOnMiss) {
        outcome = "gored";
        serious = this.gore();
      } else {
        outcome = "miss";
        if (this.attempts >= MAX_ATTEMPTS) this.end("returned");
      }
    }
    const result: FinishResult = { kind: "finish", finish, attempt: this.attempts, odds, outcome, serious };
    this.history.push(result);
    return result;
  }

  /** The most the crowd will give for how the corrida ended. */
  get cap(): Cap {
    return this.ending === "rested" ? 3 : 1;
  }

  /** The crowd's mood: the meter's total, with sympathy for a matador carried to the infirmary. */
  get total() {
    return meterTotal(this.meter) + (this.ending === "infirmary" ? 2 : 0);
  }

  verdictOdds() {
    return awardOdds(this.total, this.cap);
  }

  private end(ending: Ending) {
    this.ending = ending;
    this.phase = "verdict";
  }

  /** The crowd's one roll. */
  decide(): Verdict {
    if (this.phase !== "verdict") throw new Error("the corrida isn't over");
    if (this.verdict) return this.verdict;
    const odds = this.verdictOdds();
    const { needle, tier } = award(this.total, this.rng.float(), this.cap);
    this.verdict = { total: this.total, cap: this.cap, odds, needle, tier };
    return this.verdict;
  }
}
