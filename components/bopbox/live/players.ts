import type { Painter } from "./paint";
import type { FrameInfo } from "./stage";

/*
 * One performer on a stage: a figure with an instrument, placed on a seat.
 * Players draw themselves in their own model space (pelvis at the origin,
 * a standing adult 113 units tall); the show moves and scales them into
 * place, back rows first.
 */

export type Seat = {
  x: number;
  /** Where the floor is under this player. */
  y: number;
  scale: number;
  /** -1..1: which way the player turns, towards the conductor or the audience. */
  face: number;
  /** Shifts sways and blinks so a section doesn't move like one puppet. */
  phase: number;
  /** Drawn mirror-image: a grand piano on the left of the stage, its player facing the middle. */
  mirror?: boolean;
};

export type Box = { x0: number; y0: number; x1: number; y1: number };

export interface Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  /** Model-space box around the player and instrument, for clicks. */
  readonly box: Box;
  /** Where the floor is in the player's model space: lower for a standing player than a seated one. */
  readonly floor: number;
  draw(p: Painter, frame: FrameInfo, muted: boolean): void;
}

/** Draws a player at its seat: translate to the floor point, scale, draw in model space. */
export function drawSeated(p: Painter, player: Player, frame: FrameInfo, muted: boolean, floorOffset: number) {
  const { ctx } = p;
  const { seat } = player;
  ctx.save();
  ctx.translate(seat.x, seat.y);
  ctx.scale(seat.mirror ? -seat.scale : seat.scale, seat.scale);
  ctx.translate(0, -floorOffset);
  player.draw(p, frame, muted);
  ctx.restore();
}

/** A blink every few seconds, different for every player. */
export function blinking(wall: number, phase: number) {
  const period = 3.1 + (phase % 1) * 2.3;
  const at = (wall + phase * 7.3) % period;
  return at < 0.12;
}
