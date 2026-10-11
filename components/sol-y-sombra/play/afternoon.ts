import { afterCorrida } from "@/lib/sol-y-sombra/awards";
import { Corrida, type FinishResult, type PassResult, type Verdict } from "@/lib/sol-y-sombra/corrida";
import type { PlayStyleId } from "@/lib/sol-y-sombra/playStyles";
import { updateProgress } from "@/lib/sol-y-sombra/progress";
import type { BeatRequest } from "@/lib/sol-y-sombra/rig/ring";
import { FINISHES, MOVES, type FinishId, type MoveId } from "@/lib/sol-y-sombra/rules";
import { TIERS } from "@/lib/sol-y-sombra/verdict";
import type { StageHandle } from "../scene/useCorridaStage";
import { sound } from "../sound";
import type { Toast } from "./Hud";

/*
 * One afternoon in the ring, the Classic way, as a sequence. The corrida
 * (lib/sol-y-sombra/corrida.ts) decides every roll the moment the player
 * chooses; the afternoon asks the stage to act each result out, waits for
 * it, and says what the HUD should show next.
 *
 * The order: the paseo, the bull, the crews' work; passes until the player
 * goes to the moment of truth (or a goring forces a choice); the finish;
 * the crowd's one roll; what the crowd gives; the results.
 */

export type View =
  | { kind: "intro"; step: "paseo" | "bull" | "crew" }
  | { kind: "choose" }
  | { kind: "confirm" }
  | { kind: "passing" }
  | { kind: "down"; serious: boolean }
  | { kind: "truth" }
  | { kind: "finishing" }
  | { kind: "verdict"; verdict: Verdict }
  | { kind: "after"; verdict: Verdict }
  | { kind: "results"; verdict: Verdict };

/** The engine names the bull's side; the rig names the matador's: a bull going by on its right passes him on his right. */
const rigSide = (side: "left" | "right") => (side === "right" ? 1 : -1);

/** Passes before the moment of truth that need a second thought. */
export const EARLY = 3;

/** The name stamped across the poster when the crowd rises. */
const MATADOR = "EL NOVATO";

export type AfternoonOptions = { playStyle: PlayStyleId; reduced: boolean };

export class Afternoon {
  readonly corrida: Corrida;
  readonly bullNumber: number;
  view: View = { kind: "intro", step: "paseo" };
  toast: Toast | null = null;
  unlocked: string[] = [];
  /** Counts the times the afternoon has been started: a sequence from an earlier start stops at its next step. */
  private run = 0;
  private carriedOn = false;
  private options: AfternoonOptions;

  constructor(
    seed: string,
    private readonly handle: StageHandle,
    options: AfternoonOptions,
    private readonly changed: () => void,
  ) {
    this.corrida = new Corrida(seed);
    this.bullNumber = 10 + (Math.abs(hash(seed)) % 89);
    this.options = options;
  }

  configure(options: AfternoonOptions) {
    this.options = options;
  }

  private get stage() {
    return this.handle.stage;
  }

  private show(view: View, toast: Toast | null | undefined = undefined) {
    this.view = view;
    if (toast !== undefined) this.toast = toast;
    this.changed();
  }

  /**
   * Plays a beat and waits for it; with reduced motion the long walks are
   * cut short. True if the afternoon is still the one that asked.
   */
  private async play(beat: BeatRequest, cinematic = false) {
    const run = this.run;
    const s = this.stage;
    if (!s) return false;
    const done = s.play(beat);
    if (cinematic && this.options.reduced) s.cut();
    await done;
    return run === this.run;
  }

  private letter(ribbon: string | null) {
    this.stage?.letter(`The afternoon's bull · No. ${this.bullNumber}`, ribbon);
  }

  private cheer(level: number) {
    sound.cheer(level);
    sound.murmur(Math.min(1, 0.3 + level * 0.6));
  }

  /* ---------- The opening ---------- */

  async start(seed: string, density: number) {
    this.run++;
    this.stage?.toAfternoon(seed, density);
    this.letter("THE PASEO");
    sound.fanfare("paseo");
    if (!(await this.play({ kind: "paseo" }, true))) return;
    this.show({ kind: "intro", step: "bull" });
    this.letter("THE BULL");
    if (!(await this.play({ kind: "bull-enters" }, true))) return;
    this.show({ kind: "intro", step: "crew" });
    this.letter("THE CREWS AT WORK");
    if (!(await this.play({ kind: "crew-work" }, true))) return;
    this.letter(null);
    this.show({ kind: "choose" });
  }

  stop() {
    this.run++;
    this.stage?.release();
  }

  /** Space: on to the end of whatever is playing. */
  skip() {
    const k = this.view.kind;
    if (k === "intro" || k === "passing" || k === "finishing" || k === "after") this.stage?.cut();
  }

  /* ---------- Passes ---------- */

  async pass(move: MoveId) {
    if (this.view.kind !== "choose" || this.corrida.phase !== "pass") return;
    const result = this.corrida.makePass(move);
    this.show({ kind: "passing" }, null);
    this.letter(MOVES[move].name.toUpperCase());
    await this.play({ kind: "site" });
    if (!(await this.play({ kind: "pass", pass: move, side: rigSide(result.side), paw: this.corrida.passes === 1, outcome: result.outcome }))) return;
    this.stage?.warm(this.corrida.total / 22);
    if (result.outcome === "gored") return this.gored(result);
    if (result.outcome === "close") this.cheer(0.8);
    this.letter(null);
    this.show({ kind: "choose" }, toastFor(result));
  }

  private async gored(result: PassResult | FinishResult) {
    this.letter(result.serious ? "THE INFIRMARY" : "DOWN");
    if (!result.serious) {
      // Held until the player decides; the crew keep the bull busy meanwhile.
      void this.stage?.play({ kind: "down" });
      this.show({ kind: "down", serious: false }, toastFor(result));
      return;
    }
    this.show({ kind: "down", serious: true }, toastFor(result));
    if (!(await this.play({ kind: "down", seconds: 2.5 }))) return;
    if (!(await this.play({ kind: "helped-off", serious: true }, true))) return;
    this.decide();
  }

  async carryOn() {
    if (this.view.kind !== "down" || this.view.serious) return;
    this.corrida.carryOn();
    this.carriedOn = true;
    this.cheer(0.6);
    this.show({ kind: "passing" }, { title: "Back on your feet", detail: "The crowd is with you. Every pass is riskier now.", tone: "brave" });
    this.letter("BACK ON HIS FEET");
    if (!(await this.play({ kind: "rise" }))) return;
    this.letter(this.corrida.phase === "truth" ? "THE MOMENT OF TRUTH" : null);
    this.show(this.corrida.phase === "truth" ? { kind: "truth" } : { kind: "choose" });
  }

  async retire() {
    if (this.view.kind !== "down" || this.view.serious) return;
    this.corrida.retire();
    this.show({ kind: "passing" }, null);
    this.letter("RETIRED");
    if (!(await this.play({ kind: "helped-off", serious: false }, true))) return;
    this.decide();
  }

  /* ---------- The moment of truth ---------- */

  askTruth() {
    if (this.view.kind !== "choose" || this.corrida.phase !== "pass") return;
    if (this.corrida.passes < EARLY) this.show({ kind: "confirm" });
    else this.goToTruth();
  }

  goToTruth() {
    if (this.view.kind !== "choose" && this.view.kind !== "confirm") return;
    this.corrida.beginTruth();
    this.letter("THE MOMENT OF TRUTH");
    this.show({ kind: "truth" }, null);
  }

  keepWorking() {
    if (this.view.kind === "confirm") this.show({ kind: "choose" });
  }

  async finish(id: FinishId) {
    if (this.view.kind !== "truth" || this.corrida.phase !== "truth") return;
    const result = this.corrida.tryFinish(id);
    this.show({ kind: "finishing" }, null);
    this.letter(FINISHES[id].name.toUpperCase());
    await this.play({ kind: "site", distance: 7.5 });
    if (
      !(await this.play({ kind: "pass", pass: id, side: -1, outcome: result.outcome === "rests" ? "rests" : result.outcome === "gored" ? "gored" : "clean" }))
    )
      return;
    const s = this.stage;
    if (result.outcome === "rests") {
      // The bull rests on the sand; the stands come to their feet.
      if (s) {
        s.warm(1);
        s.rise(s.ring.matador.feet.centre(), 70);
        s.stampName(MATADOR);
      }
      this.cheer(1);
      this.letter("THE CROWD RISES");
      this.show({ kind: "finishing" }, { title: "The bull rests", detail: "He goes down onto the sand, calm and still.", tone: "good" });
      if (!(await this.play({ kind: "salute", seconds: 3.6, facing: s?.saluteFacing() ?? 0 }))) return;
      return this.decide();
    }
    if (result.outcome === "gored") return this.gored(result);
    // Out of tries: the bull is led back to the pens.
    const last = this.corrida.ending !== null;
    this.show(
      { kind: "finishing" },
      { title: "A miss", detail: last ? "Three tries, and the bull is still strong." : "He goes by untouched. Try again.", tone: "plain" },
    );
    if (last) {
      this.letter("BACK TO THE PENS");
      if (!(await this.play({ kind: "bull-leaves" }, true))) return;
      return this.decide();
    }
    this.letter("THE MOMENT OF TRUTH");
    this.show({ kind: "truth" });
  }

  /* ---------- The crowd decides ---------- */

  private decide() {
    const verdict = this.corrida.decide();
    this.stage?.stampName(null);
    this.stage?.frame("crowd");
    this.letter("THE CROWD DECIDES");
    this.show({ kind: "verdict", verdict });
  }

  /** Once the needle has landed: the records, then what the crowd gives, played out. */
  async crowdHasSpoken() {
    if (this.view.kind !== "verdict") return;
    const verdict = this.view.verdict;
    const c = this.corrida;
    this.unlocked = updateProgress((p) => afterCorrida(p, c, this.options.playStyle, this.carriedOn));
    this.show({ kind: "after", verdict }, null);
    const s = this.stage;
    this.letter(TIERS[verdict.tier].name.toUpperCase());
    s?.frame("ring");
    if (verdict.tier >= 2) {
      this.cheer(1);
      sound.fanfare("honour");
    } else if (verdict.tier === 1) this.cheer(0.5);
    const run = this.run;
    // A bull that rested gets up and walks back to the pens: alive, and applauded out.
    if (c.ending === "rested" && !(await this.play({ kind: "bull-leaves" }, true))) return;
    if (c.ending === "rested" || c.ending === "returned") {
      const done = verdict.tier === 0 ? await this.play({ kind: "leave" }, true) : await this.play({ kind: "bow", facing: s?.saluteFacing() ?? 0 });
      if (!done) return;
      if (verdict.tier === 2) {
        s?.shower(true);
        const lapped = await this.play({ kind: "lap" }, true);
        s?.shower(false);
        if (!lapped) return;
      }
      if (verdict.tier === 3) {
        s?.carryOut();
        await wait(this.options.reduced ? 1500 : 8500);
      }
    }
    if (run !== this.run) return;
    this.show({ kind: "results", verdict });
  }
}

function toastFor(result: PassResult | FinishResult): Toast {
  if (result.outcome === "gored") {
    return result.serious
      ? { title: "Seriously hurt", detail: "The crew help him to the infirmary. He will be fine; the afternoon is over.", tone: "hurt" }
      : { title: "Gored", detail: "Thrown onto the sand, shaken, not badly hurt.", tone: "hurt" };
  }
  if (result.kind === "pass" && result.outcome === "close")
    return { title: "Close call!", detail: "The horns brushed the suit. The crowd gasps, then roars.", tone: "brave" };
  return { title: "A clean pass", detail: "The bull follows the cape and goes by.", tone: "good" };
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** A small stable number from the seed, for the bull's number on the poster. */
function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return h;
}
