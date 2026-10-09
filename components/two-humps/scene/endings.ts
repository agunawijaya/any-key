import type { EndCause } from "@/lib/two-humps/engine";
import type { PursuerKind } from "@/lib/two-humps/rules";
import { camelPaint, drawCamel } from "./camel";
import { drawCampfire, drawFirelight, drawTraveller, flickerAt } from "./camp";
import { drawCaravan } from "./caravan";
import type { SceneHooks, SceneInfo } from "./Diorama";
import { drawSaxaul, drawTuft, floraPaint } from "./flora";
import { drawCakeTable, drawGer, drawLanternString, gerPaint, LANTERN } from "./ger";
import { drawBlowingSand, drawHaboob, drawStormShade } from "./haboob";
import { drawJerboa, type JerboaPaint } from "./jerboa";
import { css, litColour, type Light, type RGB } from "./light";

/*
 * How a trek ends, as a scene. Arriving is always a party at the ger camp,
 * with the pursuer as a guest: the storm as a breeze that blows the candles
 * out, the rival with a present, the gang in party bibs. Losing is never
 * grim: you shelter from the storm, the rival throws the party for himself,
 * the gang cooks porridge because a camel is far too heavy to lift, the
 * thirsty traveller rests in the shade, the worn-out camel lies down.
 */

/** The hour each ending is shown at. */
export function endingClock(ending: EndCause, pursuer: PursuerKind, current: number) {
  if (ending === "arrived" || ending === "beaten") return 22.4;
  if (ending === "caught" && pursuer === "gang") return 23;
  if (ending === "thirst") return 14;
  return current;
}

export function endingScene(ending: EndCause, pursuer: PursuerKind): SceneHooks {
  if (ending === "arrived") return party(pursuer);
  if (ending === "beaten") return party("rival", true);
  if (ending === "caught" && pursuer === "haboob") return storm();
  if (ending === "caught") return porridge();
  if (ending === "thirst") return shade();
  return lieDown();
}

function party(guest: PursuerKind, rivalWon = false): SceneHooks {
  return {
    beforeLayer(index, { ctx, width, height, time }) {
      if (index === 4) drawGer(ctx, width * 0.86, height * 0.765, height * 0.075, gerPaint(1, 0.5), 0.6, time);
    },
    overlay(info) {
      const { ctx, width, height, light, time, groundAt } = info;
      const gx = width * 0.24;
      const gy = groundAt(gx);
      const gerSize = height * 0.2;
      drawGer(ctx, gx, gy, gerSize, gerPaint(1, 1), 1, time);
      const poleX = width * 0.645;
      const poleTop = groundAt(poleX) - height * 0.3;
      ctx.strokeStyle = "rgb(60 40 40)";
      ctx.lineWidth = height * 0.006;
      ctx.beginPath();
      ctx.moveTo(poleX, groundAt(poleX));
      ctx.lineTo(poleX, poleTop);
      ctx.stroke();
      drawLanternString(ctx, [gx + gerSize * 0.2, gy - gerSize * 1.08], [poleX, poleTop], height * 0.08, 9, height * 0.012, time, 3);
      drawLanternString(ctx, [poleX, poleTop], [width * 1.02, poleTop - height * 0.06], height * 0.06, 6, height * 0.012, time, 9);
      glowOn(info, width * 0.48, 0.22);

      const flora = floraPaint(light, [0.3, 0.2, 0.1]);
      drawSaxaul(ctx, width * 0.03, groundAt(width * 0.03), height * 0.09, 4, flora, 0.1, time);
      for (const [share, seed] of [
        [0.12, 1],
        [0.95, 5],
      ] as const)
        drawTuft(ctx, width * share, groundAt(width * share) + height * 0.004, height * 0.03, seed, flora, 0.1, time);

      const warm: RGB = [0.5, 0.32, 0.16];
      const camelSize = height * 0.15;
      const tableX = width * 0.48;
      drawCakeTable(ctx, tableX, groundAt(tableX), height * 0.07, time, light.starlight, guest === "haboob" && !rivalWon);

      if (rivalWon) {
        // The Captain's party: his caravan at the camp, and you, just arriving.
        drawCaravan(ctx, light, { x: width * 0.6, groundY: groundAt(width * 0.6), size: height * 0.1, moving: false, plume: false, camped: false, facing: -1, time });
        drawCamel(ctx, width * 0.86, groundAt(width * 0.86), camelSize, { gait: "walk", phase: (time * 0.5) % 1, headLow: 0.4, hump: 0.6, wind: 0.1, time, rider: true }, camelPaint(light, -1, warm, -1), -1);
        return;
      }

      drawCamel(ctx, width * 0.81, groundAt(width * 0.81), camelSize, { gait: "walk", phase: 0.12, headLow: 0, hump: 1, wind: 0.1, time, rider: false }, camelPaint(light, -1, warm, -1), -1);
      drawTraveller(ctx, width * 0.395, groundAt(width * 0.395), camelSize * 0.9, "cheer", camelPaint(light, 1, warm, 1), 1, time);

      if (guest === "gang") {
        const guests: [number, number, boolean, number | null][] = [
          [0.54, -1, true, null],
          [0.565, -1, false, (time * 1.6) % 1],
          [0.59, -1, false, null],
          [0.44, 1, false, (time * 1.6 + 0.5) % 1],
        ];
        guests.forEach(([share, facing, ladle, hop], i) => {
          const x = width * share;
          drawJerboa(ctx, x, groundAt(x), height * 0.045, { hop, facing, time, ladle, bib: true, joy: 1, seed: i * 7 + 1 }, jerboaPaint(light, 0.6));
        });
      } else if (guest === "rival") {
        // Captain Bluster, late, with a present.
        drawCaravan(ctx, light, { x: width * 0.6, groundY: groundAt(width * 0.6), size: height * 0.08, moving: false, plume: false, camped: false, facing: -1, time });
        drawGift(ctx, width * 0.555, groundAt(width * 0.555), height * 0.035);
      } else {
        // The Haboob comes as a breeze: a swirl of fine sand, and the candles are out.
        drawBlowingSand(ctx, { width, height, horizon: info.horizon }, light, 0.35, time);
      }
    },
  };
}

function storm(): SceneHooks {
  return {
    beforeLayer(index, { ctx, width, height, horizon, light, time }) {
      if (index === 3) drawHaboob(ctx, { width, height, horizon }, light, { front: 0.78, time, fury: 1 });
    },
    overlay(info) {
      const { ctx, width, height, horizon, light, time, groundAt } = info;
      drawStormShade(ctx, { width, height, horizon }, light, 1.2, 1);
      const size = height * 0.15;
      const x = width * 0.56;
      drawCamel(ctx, x, groundAt(x), size, { gait: "rest", phase: 0, headLow: 0, hump: 0.7, wind: 1, time, rider: false }, camelPaint(light, 1));
      drawTraveller(ctx, x + size * 1.15, groundAt(x), size * 0.85, "warm-hands", camelPaint(light, -1), -1, time);
      drawBlowingSand(ctx, { width, height, horizon }, light, 1, time);
    },
  };
}

function porridge(): SceneHooks {
  return {
    overlay(info) {
      const { ctx, width, height, light, time, groundAt } = info;
      const fx = width * 0.5;
      const flicker = flickerAt(time);
      drawFirelight(ctx, fx, groundAt(fx), height * 0.5, flicker);
      const warm: RGB = [0.46 * flicker, 0.26 * flicker, 0.11 * flicker];
      const size = height * 0.15;
      drawCamel(ctx, width * 0.3, groundAt(width * 0.3), size, { gait: "rest", phase: 0, headLow: 0, hump: 0.7, wind: 0.1, time, rider: false }, camelPaint(light, 1, warm, 1));
      drawTraveller(ctx, width * 0.38, groundAt(width * 0.38), size * 0.85, "warm-hands", camelPaint(light, 1, warm, 1), 1, time);
      drawCampfire(ctx, fx, groundAt(fx), height * 0.035, time);
      drawPot(ctx, fx, groundAt(fx) - height * 0.035, height * 0.06, light, time);
      const paint = jerboaPaint(light, 0.7);
      [0.56, 0.6, 0.64, 0.68, 0.45].forEach((share, i) => {
        const x = width * share;
        drawJerboa(ctx, x, groundAt(x), height * 0.045, { hop: i === 2 ? (time * 1.5) % 1 : null, facing: -1, time, ladle: i === 0, bib: true, joy: i % 2, seed: i * 3 + 2 }, paint);
      });
    },
  };
}

function shade(): SceneHooks {
  return {
    overlay({ ctx, width, height, light, time, groundAt }) {
      const size = height * 0.15;
      const x = width * 0.5;
      drawCamel(ctx, x, groundAt(x), size, { gait: "rest", phase: 0, headLow: 0, hump: 0.4, wind: 0.1, time, rider: false }, camelPaint(light, 1));
      drawTraveller(ctx, x - size * 1.2, groundAt(x), size * 0.85, "warm-hands", camelPaint(light, 1), 1, time);
      drawGer(ctx, width * 0.85, groundAt(width * 0.85), height * 0.07, gerPaint(0, 0), 0, time);
    },
  };
}

function lieDown(): SceneHooks {
  return {
    overlay({ ctx, width, height, light, time, groundAt }) {
      const size = height * 0.15;
      const x = width * 0.5;
      drawCamel(ctx, x, groundAt(x), size, { gait: "rest", phase: 0, headLow: 0, hump: 0.3, wind: 0.1, time, rider: false }, camelPaint(light, 1));
      drawTraveller(ctx, x + size * 1.3, groundAt(x), size * 0.85, "cheer", camelPaint(light, -1), -1, time * 0.2);
    },
  };
}

function glowOn(info: SceneInfo, x: number, strength: number) {
  const { ctx, width, height, groundAt } = info;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pool = ctx.createRadialGradient(x, groundAt(x), 0, x, groundAt(x), width * 0.4);
  pool.addColorStop(0, css(LANTERN, strength));
  pool.addColorStop(1, css(LANTERN, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, height * 0.6, width, height * 0.4);
  ctx.restore();
}

/** A big pot of porridge on the fire, steaming, with the gang's ladle in it. */
function drawPot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, light: Light, time: number) {
  const iron = css(litColour(light, [70, 66, 72], 0.3, [0.4, 0.22, 0.1]));
  ctx.fillStyle = iron;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.9, size * 0.7, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "rgb(236 220 180)";
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.9, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgb(240 240 240 / 0.3)";
  ctx.lineWidth = size * 0.08;
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.4 + i / 3) % 1;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.3 + i * size * 0.3, y - size * 0.1);
    ctx.quadraticCurveTo(x - size * 0.5 + i * size * 0.3, y - size * (0.5 + t), x - size * 0.3 + i * size * 0.3, y - size * (0.9 + t * 1.2));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawGift(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number) {
  ctx.fillStyle = "rgb(60 130 200)";
  ctx.fillRect(x - size * 0.6, groundY - size, size * 1.2, size);
  ctx.fillStyle = "rgb(250 204 80)";
  ctx.fillRect(x - size * 0.1, groundY - size, size * 0.2, size);
  ctx.fillRect(x - size * 0.6, groundY - size * 0.6, size * 1.2, size * 0.18);
  ctx.beginPath();
  ctx.ellipse(x - size * 0.2, groundY - size * 1.1, size * 0.22, size * 0.12, -0.4, 0, Math.PI * 2);
  ctx.ellipse(x + size * 0.2, groundY - size * 1.1, size * 0.22, size * 0.12, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function jerboaPaint(light: Light, firelight: number): JerboaPaint {
  const warm: RGB = [0.9 * firelight, 0.55 * firelight, 0.25 * firelight];
  const lit = (albedo: RGB) => css(litColour(light, albedo, 0.3, warm));
  return {
    fur: lit([214, 170, 118]),
    belly: lit([246, 230, 206]),
    ear: lit([232, 160, 150]),
    dark: "rgb(30 22 20)",
    eyeShine: "rgb(255 236 200)",
    ladle: lit([190, 196, 206]),
    bib: lit([250, 250, 246]),
    bibTrim: lit([230, 70, 80]),
  };
}
