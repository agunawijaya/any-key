import type { Crowd, Thrown } from "@/lib/sol-y-sombra/crowd";
import type { SunPatch } from "@/lib/sol-y-sombra/plaza";
import type { StyleId } from "@/lib/sol-y-sombra/progress";
import type { BullPose } from "@/lib/sol-y-sombra/rig/bull";
import type { Cloth } from "@/lib/sol-y-sombra/rig/cloth";
import type { Dust } from "@/lib/sol-y-sombra/rig/dust";
import type { Skeleton } from "@/lib/sol-y-sombra/rig/human";
import type { Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import type { Camera } from "../render/camera";
import type { Holds, MatadorColours } from "../render/matadorFigure";
import { PosterPainter } from "./poster/PosterPainter";

/*
 * The style layer. The stage composes a frame from the rig (who stands
 * where, the bull's pose, the capes' cloth, the dust, the crowd, the light,
 * the lettering) without knowing how it will look; a style draws it. The
 * Vintage Poster draws it as a lithograph on a 2D canvas; the Stylized 3D
 * style (11b) will draw the same frame with WebGL. Rules never depend on the
 * style, and neither does the rig.
 *
 * To add a style: make a folder beside `poster/`, implement `RingStyle`, add
 * its id to `StyleId` in lib/sol-y-sombra/progress.ts and a case below.
 */

/** Someone on the sand, as a style needs them: the bones, the tassels and fringes, how the hands hold the cape, the costume. */
export type Figure = { skeleton: Skeleton; strands: Vec3[][]; holds: Holds; dress?: Partial<MatadorColours>; hat?: boolean };

/** The poster's words: the title, the line under it, the ribbon naming the moment, and a name stamped across at the climax. */
export type Lettering = {
  title: string;
  subtitle: string;
  ribbon: string | null;
  /** A headline that stamps in, with how far into its stamping it is (seconds). */
  stamp: { text: string; t: number } | null;
};

export type RingFrame = {
  /** A sky other than the style's own, for a dusk. */
  sky?: { top: string; low: string };
  figures: Figure[];
  bull: BullPose | null;
  capes: Cloth[];
  dust: Dust | null;
  crowd: Crowd;
  thrown: Thrown[];
  /** The direction sunlight travels, and where it reaches the sand. */
  sun: Vec3;
  patch: SunPatch;
  text: Lettering;
  /** A big moment: the nearest figures may break out of the picture's frame. */
  breakout: boolean;
  /** 0–1: the great gate open onto bright evening light. */
  gateGlow: number;
  /** The bulls' door standing open. */
  torilOpen?: boolean;
  time: number;
};

export interface RingStyle {
  readonly id: StyleId;
  /** Sizes the drawing surface to the canvas's box, in CSS pixels, at the device's pixel ratio. */
  resize(width: number, height: number, dpr: number): void;
  /** Draws one frame. `camera` is aimed by the director; the style may fit it to the part of the canvas it draws the ring in. */
  paint(frame: RingFrame, camera: Camera, dark: boolean): void;
}

/** The style for an id, drawing on `canvas`; null where the browser cannot draw it. */
export function createStyle(id: StyleId, canvas: HTMLCanvasElement): RingStyle | null {
  switch (id) {
    case "poster":
    // The Stylized 3D style arrives in 11b; until then its id falls back to the poster.
    case "stylized-3d": {
      const ctx = canvas.getContext("2d");
      return ctx ? new PosterPainter(ctx) : null;
    }
  }
}
