"use client";

import { useEffect } from "react";
import { createRng } from "@/lib/kit/rng";
import { RULES } from "@/lib/long-memory/rules";
import { scholarMove } from "@/lib/long-memory/scholar";
import type { BoardHandle } from "./useBoardScene";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * The board plays itself behind the game menu: two easy Scholars sowing at
 * a relaxed pace, a fresh 1978 game after each one ends. Silent.
 */
export function useAttract(handle: BoardHandle, active: boolean, reduced: boolean, seed?: number) {
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const rules = RULES.awari1978;
    const rng = createRng(`same-trick-twice/attract/${seed ?? Date.now()}`);
    (async () => {
      let p = rules.start();
      handle.scene?.setBoard(p.board, "attract");
      await wait(1400);
      while (!stopped) {
        const scene = handle.scene;
        if (!scene) return;
        if (p.over) {
          await wait(2600);
          if (stopped) return;
          p = rules.start();
          scene.setBoard(p.board, `attract/${rng.int(0, 1e6)}`);
          await wait(1200);
          continue;
        }
        const outcome = rules.play(p, scholarMove(rules, p, "easy", rng));
        // On the light board the moves land at once, as with reduced motion: drawing every sowing would keep the processor busy behind the menu.
        const instant = reduced || scene.light;
        await scene.animate(outcome, "relaxed", instant);
        if (stopped) return;
        p = outcome.next;
        await wait(instant ? 1800 : 1100);
      }
    })();
    return () => {
      stopped = true;
    };
  }, [handle, active, reduced, seed]);
}
