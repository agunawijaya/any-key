import { hash1 } from "@/lib/two-humps/noise";
import type { PursuerKind } from "@/lib/two-humps/rules";
import type { DioramaFrame, SceneHooks } from "./Diorama";
import { trekScene, type TrekView } from "./trek";

/*
 * The trek with nobody playing: the camel walks on for ever, the pursuer
 * keeps its distance, and oases drift past. The game menu's panorama and the
 * Hall's preview both use it.
 */

const PACE = 0.32; // miles per second of animation
const OASIS_EVERY = 14;

/** How far the pursuer hangs back (or, for the rival, ahead). */
const GAP: Record<PursuerKind, number> = { haboob: 12, rival: -6, gang: 6 };

export function demoScene(pursuer: PursuerKind, clock: number, { seed = 1, anchor = 0.56 } = {}) {
  const view: TrekView = {
    pursuer,
    miles: 20,
    pursuerAt: 20 - GAP[pursuer],
    // Far enough that the finish never comes into view.
    goal: 1e6,
    oases: [],
    gait: "walk",
    phase: 0,
    fatigue: 1,
    camping: null,
    fed: false,
    plume: pursuer === "rival",
    time: 0,
    singingSince: null,
    gustSince: null,
    fossilSince: null,
    anchor,
  };

  const hooks: SceneHooks = trekScene(() => view);

  const frame = (seconds: number, still: boolean): DioramaFrame => {
    const t = still ? 0 : seconds;
    view.miles = 20 + t * PACE;
    view.pursuerAt = view.miles - GAP[pursuer] + Math.sin(t * 0.21) * 0.8;
    view.phase = (t * PACE * 0.42 + t * 0.4) % 1;
    view.gait = still ? "stand" : "walk";
    view.time = t;
    const first = Math.floor(view.miles / OASIS_EVERY) - 2;
    view.oases = [0, 1, 2, 3, 4].map((i) => {
      const n = first + i;
      return { at: n * OASIS_EVERY + Math.floor(hash1(n, seed) * 6), dry: false, used: false };
    });
    return { clock, time: t, travel: view.miles * 60 };
  };

  return { hooks, frame };
}
