import type { Dir, GameEvent } from "@/lib/outta/engine";
import { sfx } from "@/lib/outta/sfx";

/** Keys for one player: arrows, WASD, or the 1980 program's comma and full stop. */
export const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  ",": "left",
  ".": "right",
};

export const CAUSES: Record<string, string> = {
  eraser: "The Eraser caught up with you.",
  bouncer: "A Bouncer walked into you.",
  glitch: "Glitch found you.",
  rain: "A block landed on you.",
  bomb: "Your own bomb got you.",
};

/** A key as one lower-case letter, or its name ("ArrowUp"). */
export const keyOf = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

export function playSound(e: GameEvent) {
  if (e.kind === "bomb") sfx.bomb();
  else if (e.kind === "boom") sfx.boom(e.broken, e.chain);
  else if (e.kind === "pickup") sfx.pickup(e.item !== "letter");
  else if (e.kind === "hit") sfx.hit();
  else if (e.kind === "bump") sfx.bump();
  else if (e.kind === "dive") sfx.dive();
  else if (e.kind === "rise") sfx.rise();
  else if (e.kind === "tunnel") sfx.tunnel();
  else if (e.kind === "win") sfx.win();
  else if (e.kind === "lose") sfx.lose();
}

export const fmt = (t: number) => t.toFixed(1);
