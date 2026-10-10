/*
 * The style layer. A style draws the pit and everyone in it from a
 * SceneFrame; it owns its own paint, light and dark looks, and decides how
 * the world sits on screen. Everything else (rules, pits, records, dailies)
 * is the same in every style, and the player picks one in Settings.
 *
 * Adding a style: make a folder under components/ten-turns/styles/, export a
 * factory with this interface, and list it in STYLES (styles/index.ts).
 */

import type { Cell } from "@/lib/ten-turns/geometry";
import type { BoardView, SceneFrame, Spot } from "../scene/view";

export type StyleId = "storybook" | "arena" | "graph-paper" | "lab";

/** The last page of a survived pit, as the style tells it. */
export type ReleaseMoment = {
  time: number;
  /** 0 rolled up at the rim, 1 hanging to the floor. */
  ladder: number;
  /** 0 at the foot of the ladder, 1 on the rim. */
  climb: number;
  /** 0 still climbing, 1 stood on the rim and cheering. */
  cheer: number;
  /** 0 the sun or moon on the rim, 1 risen. */
  rise: number;
  hat: boolean;
};

export type ScreenSpot = { x: number; y: number; scale: number };

export interface PitStyle {
  readonly id: StyleId;
  /** Sizes the drawing to the canvas, in CSS pixels. */
  resize(width: number, height: number, dpr: number): void;
  /** Light and dark: the style's day and night. */
  setNight(night: boolean): void;
  /** The pit's lasting features (its size and rocks); repaints what the style keeps painted. */
  setBoard(board: BoardView): void;
  /** Draws one moment of play. */
  render(frame: SceneFrame): void;
  /** Draws one moment of the release, the page after a survived pit. */
  renderRelease(moment: ReleaseMoment): void;
  /** Where a floor spot (or one `lift` above it) appears on screen, for buttons laid over the canvas. */
  project(spot: Spot, lift?: number): ScreenSpot;
  /** The whole-number cell under a screen point, or null outside the pit. */
  cellAt(x: number, y: number): Cell | null;
  /** Lets go of what it holds. */
  dispose(): void;
}

export type StyleFactory = (ctx: CanvasRenderingContext2D, fonts: { shout: string; book: string }) => PitStyle;
