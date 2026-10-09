import type { TrekState } from "@/lib/two-humps/engine";
import { HOURS_PER_TURN, MAX_FATIGUE } from "@/lib/two-humps/rules";
import type { DioramaFrame } from "./scene/Diorama";
import type { TrekView } from "./scene/trek";

/*
 * What the canvas shows, as opposed to what the engine knows. The engine
 * jumps from turn to turn; the playback eases the camel along the sand, lets
 * the clock roll forward, and remembers when the dunes started to sing so the
 * scene can draw the rings spreading out. The trek screen tells it what
 * happened; the canvas reads `frame` and `view` every animation frame.
 */

const viewOf = (s: TrekState): TrekView => ({
  pursuer: s.config.pursuer,
  miles: s.miles,
  pursuerAt: s.pursuer.at,
  goal: s.goal,
  oases: s.oases.map((o) => ({ at: o.at, dry: o.dry, used: o.used })),
  gait: "stand",
  phase: 0,
  fatigue: s.fatigue,
  camping: null,
  fed: s.pursuer.fed,
  plume: s.pursuer.plume,
  time: 0,
  singingSince: null,
  gustSince: null,
  fossilSince: null,
});

/** The trek's ground sits a little higher, so the camel's feet clear the command cards. */
const TREK_LIFT = 0.07;

export class TrekPlayback {
  readonly view: TrekView;
  private target: { miles: number; pursuerAt: number; hours: number; gait: "walk" | "gallop" };
  private hours: number;
  private lastTime = 0;
  /** Once the trek is over, the hour its ending scene is lit at. */
  private endingHour: number | null = null;

  constructor(state: TrekState) {
    this.view = viewOf(state);
    this.hours = state.config.startClock + state.turn * HOURS_PER_TURN;
    this.target = { miles: state.miles, pursuerAt: state.pursuer.at, hours: this.hours, gait: "walk" };
  }

  stride(gait: "walk" | "gallop", to: number) {
    this.view.camping = null;
    this.target.gait = gait;
    this.target.miles = to;
    this.view.fatigue = Math.min(MAX_FATIGUE, this.view.fatigue + (gait === "gallop" ? 3 : 1));
  }

  /** A gust shoves the camel along (or back) without a stride. */
  shove(miles: number) {
    this.view.gustSince = this.view.time;
    this.target.miles = Math.max(0, this.target.miles + miles);
  }

  pursuerMoved(to: number, stopped: boolean) {
    this.target.pursuerAt = to;
    this.view.fed = stopped;
    this.target.hours += HOURS_PER_TURN;
  }

  camp(kind: "night" | "day") {
    this.view.camping = kind;
  }

  feedGang() {
    this.view.fed = true;
  }

  singing() {
    this.view.singingSince = this.view.time;
  }

  fossil() {
    this.view.fossilSince = this.view.time;
  }

  /** Puts everything on the engine's own numbers once a turn has played out. */
  settle(s: TrekState) {
    this.view.fatigue = s.fatigue;
    this.view.oases = s.oases.map((o) => ({ at: o.at, dry: o.dry, used: o.used }));
    this.view.plume = s.pursuer.plume;
    this.target.miles = s.miles;
    this.target.pursuerAt = s.pursuer.at;
    this.target.hours = s.config.startClock + s.turn * HOURS_PER_TURN;
  }

  /** Holds the light at the hour the ending is shown at. */
  end(hour: number) {
    this.endingHour = hour;
  }

  /** The hour on the trek's clock, as shown. */
  get clock() {
    return this.hours % 24;
  }

  frame = (seconds: number, still: boolean): DioramaFrame => {
    const { view, target } = this;
    const dt = Math.min(0.05, Math.max(0, seconds - this.lastTime));
    this.lastTime = seconds;
    const ease = still ? 1 : 1 - Math.exp(-dt * 3.2);
    const before = view.miles;
    view.miles += (target.miles - view.miles) * ease;
    view.pursuerAt += (target.pursuerAt - view.pursuerAt) * ease;
    const hourGoal = this.endingHour ?? target.hours;
    // The ending's hour is reached the short way round the clock face.
    const hourGap = this.endingHour === null ? hourGoal - this.hours : ((((hourGoal - this.hours) % 24) + 36) % 24) - 12;
    this.hours += hourGap * (still ? 1 : 1 - Math.exp(-dt * 1.4));
    const moving = Math.abs(target.miles - view.miles) > 0.03;
    view.gait = moving ? target.gait : "stand";
    if (moving) view.phase = (view.phase + Math.abs(view.miles - before) * (target.gait === "gallop" ? 0.18 : 0.42) + dt * 0.4) % 1;
    view.time = still ? 0 : seconds;
    return { clock: ((this.hours % 24) + 24) % 24, time: view.time, travel: view.miles * 60, lift: TREK_LIFT };
  };
}
