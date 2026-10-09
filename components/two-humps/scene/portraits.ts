import type { PursuerKind } from "@/lib/two-humps/rules";
import { camelPaint, drawCamel } from "./camel";
import { drawCaravan } from "./caravan";
import type { DioramaFrame, SceneHooks, SceneInfo } from "./Diorama";
import { drawBlowingSand, drawHaboob } from "./haboob";
import { drawJerboa, type JerboaPaint } from "./jerboa";
import { css, litColour, type Light, type RGB } from "./light";

/*
 * Close-ups for the pursuer cards: each pursuer big enough to have a
 * character, at the hour it is most itself. The storm towers over a camel at
 * dusk, the rival's caravan struts through the morning, the gang hops across
 * the sand at night.
 */

/** The hour each portrait is lit at. */
const HOURS: Record<PursuerKind, number> = { haboob: 17.6, rival: 8.2, gang: 22.2 };

export function portraitScene(kind: PursuerKind) {
  const hooks: SceneHooks = kind === "haboob" ? storm() : kind === "rival" ? rival() : gang();
  const frame = (seconds: number, still: boolean): DioramaFrame => {
    const time = still ? 0 : seconds;
    // The rival's caravan walks on, so its ground slides; the others hold still.
    return { clock: HOURS[kind], time, travel: kind === "rival" ? time * 40 : time * 4 };
  };
  return { hooks, frame };
}

function storm(): SceneHooks {
  return {
    beforeLayer(index, info) {
      if (index !== 3) return;
      drawHaboob(info.ctx, { width: info.width, height: info.height, horizon: info.horizon }, info.light, { front: 0.5, time: info.time, fury: 0.8 });
    },
    overlay(info) {
      const { ctx, width, height, light, time, groundAt } = info;
      const x = width * 0.8;
      const size = height * 0.26;
      drawCamel(ctx, x, groundAt(x), size, { gait: "walk", phase: (time * 0.5) % 1, headLow: 0.6, hump: 0.9, wind: 0.9, time, rider: true }, camelPaint(light, light.sunX >= 0.5 ? 1 : -1));
      drawBlowingSand(ctx, { width, height, horizon: info.horizon }, light, 0.7, time);
    },
  };
}

function rival(): SceneHooks {
  return {
    overlay(info) {
      const { ctx, width, height, light, time, groundAt } = info;
      const x = width * 0.62;
      drawCaravan(ctx, light, { x, groundY: groundAt(x), size: height * 0.24, moving: true, plume: true, camped: false, facing: 1, time });
    },
  };
}

function gang(): SceneHooks {
  return {
    overlay(info) {
      const { ctx, width, height, light, time, groundAt } = info;
      const paint = gangPaint(light);
      const size = height * 0.2;
      for (let i = 0; i < 5; i++) {
        // An uneven line: each one hops to its own beat.
        const x = width * (0.74 - i * 0.13) + Math.sin(time * 0.7 + i * 1.7) * width * 0.012;
        drawJerboa(ctx, x, groundAt(x), size * (i === 0 ? 1.08 : 0.92 + 0.08 * ((i * 37) % 3)), { hop: (time * 1.3 + i * 0.31) % 1, facing: 1, time, ladle: i === 0, seed: i * 5 + 1 }, paint);
      }
      moonlitSand(info);
    },
  };
}

/** A faint cool sheen on the sand so the gang reads against the night. */
function moonlitSand({ ctx, width, height, horizon }: SceneInfo) {
  const g = ctx.createLinearGradient(0, horizon, 0, height);
  g.addColorStop(0, "rgb(120 150 220 / 0)");
  g.addColorStop(1, "rgb(120 150 220 / 0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, width, height - horizon);
}

function gangPaint(light: Light): JerboaPaint {
  // Lit a little warmer than the night would, as if by a lantern off to the side.
  const lit = (albedo: RGB) => css(litColour(light, albedo, 0.3, [0.18, 0.12, 0.06]));
  return { fur: lit([214, 170, 118]), belly: lit([246, 230, 206]), ear: lit([232, 160, 150]), dark: "rgb(30 22 20)", eyeShine: "rgb(255 236 200)", ladle: lit([190, 196, 206]), bib: lit([250, 250, 246]), bibTrim: lit([230, 70, 80]) };
}
