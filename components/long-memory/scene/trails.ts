/*
 * The light a move leaves behind: each sown seed draws its arc as a trail of
 * motes that fades a moment after it lands, and a soft ring spreads from the
 * hole it drops into. Captures draw theirs brighter, from the pit they empty.
 * By day the trail is ink-dark dots (light added to sunlit wood washes out);
 * by night it glows.
 */

import type { FlightRecord } from "./choreography";
import { BOARD, HOLLOWS, hollowAt } from "./layout";
import { clamp, lerp3, smoothstep, type Vec3 } from "./math";
import type { Sprite } from "./Renderer";

const TRAIL_STEPS = 22;
export const FADE_AFTER_LANDING = 0.7;
const RIPPLE = 0.55;

function arcPoint(f: FlightRecord, t: number): Vec3 {
  const p = lerp3(f.from, f.to, t);
  return [p[0], p[1] + 4 * f.apex * t * (1 - t), p[2]];
}

export function flightSprites(flights: FlightRecord[], time: number, night: boolean): Sprite[] {
  const sprites: Sprite[] = [];
  const sow: Vec3 = night ? [1, 0.68, 0.32] : [0.6, 0.28, 0.07];
  const capture: Vec3 = night ? [1, 0.82, 0.45] : [0.72, 0.36, 0.06];
  const capturedFrom = new Set<number>();
  for (const f of flights) {
    const t = (time - f.start) / f.duration;
    if (t < 0) continue;
    const age = time - (f.start + f.duration);
    const fade = age > 0 ? 1 - smoothstep(0, FADE_AFTER_LANDING, age) : 1;
    if (fade <= 0) continue;
    const shown = clamp(t);
    const color = f.capture ? capture : sow;
    for (let k = 1; k <= TRAIL_STEPS; k++) {
      const u = k / TRAIL_STEPS;
      if (u > shown) break;
      const recent = 1 - (shown - u) / Math.max(shown, 0.01);
      const pos = arcPoint(f, u);
      if (night) sprites.push({ kind: "glow", pos, size: 0.2 + 0.14 * recent, color, alpha: (0.18 + 0.62 * recent) * fade });
      else sprites.push({ kind: "dot", pos, size: 0.13 + 0.08 * recent, color, alpha: (0.2 + 0.65 * recent) * fade });
    }
    if (age > 0 && age < RIPPLE) {
      const h = HOLLOWS[f.hole];
      const k = age / RIPPLE;
      sprites.push({ kind: "ring", pos: [h.cx, BOARD.top + 0.06, h.cz], size: h.ax * (0.85 + k * 0.55), color, alpha: (1 - k) * 0.55, ring: 0.82, stretch: h.az / h.ax });
    }
    if (f.capture && age < 0.4) {
      const origin = hollowAt(f.from[0], f.from[2]);
      if (origin && !capturedFrom.has(origin.hole)) {
        capturedFrom.add(origin.hole);
        sprites.push({ kind: "ring", pos: [origin.cx, BOARD.top + 0.06, origin.cz], size: origin.ax * 1.3, color, alpha: 0.8 * (1 - clamp(age / 0.4)), ring: 0.8 });
      }
    }
  }
  return sprites;
}
