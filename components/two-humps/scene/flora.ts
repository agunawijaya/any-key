import { hash1 } from "@/lib/two-humps/noise";
import { css, lerp3, litColour, type Light, type RGB } from "./light";

/*
 * What grows in the Gobi: saxaul, a gnarled shrub with grey bark and green,
 * leafless, jointed twigs that droop in tassels, and tufts of feather grass.
 * Both are drawn from a seed so each plant is its own shape.
 */

export type FloraPaint = { bark: string; twig: string; twigLight: string; grass: string; grassLight: string; shadow: string };

export function floraPaint(light: Light, extra: RGB = [0, 0, 0]): FloraPaint {
  const lit = (albedo: RGB, facing: number) => css(litColour(light, albedo, facing, extra));
  return {
    bark: lit([118, 100, 88], 0.1),
    twig: lit([120, 140, 92], 0.25),
    twigLight: lit(lerp3([150, 168, 110], [230, 210, 150], 0.3), 0.9),
    grass: lit([196, 170, 110], 0.3),
    grassLight: lit([240, 214, 150], 0.9),
    shadow: "rgb(40 20 10 / 0.16)",
  };
}

/** A saxaul shrub: a twisted trunk that forks and ends in drooping tassels of twigs. */
export function drawSaxaul(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, seed: number, paint: FloraPaint, wind: number, time: number) {
  const rand = (k: number) => hash1(seed * 13 + k, 991);
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(size, -size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = paint.shadow;
  ctx.beginPath();
  ctx.ellipse(0.1, 0, 0.7, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  type Branch = { x: number; y: number; angle: number; length: number; width: number; depth: number };
  const tips: { x: number; y: number }[] = [];
  const grow = (b: Branch, k: number) => {
    const bend = (rand(k) - 0.5) * 0.7;
    const ex = b.x + Math.cos(b.angle) * b.length;
    const ey = b.y + Math.sin(b.angle) * b.length;
    ctx.strokeStyle = paint.bark;
    ctx.lineWidth = b.width;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + Math.cos(b.angle + bend) * b.length * 0.6, b.y + Math.sin(b.angle + bend) * b.length * 0.6, ex, ey);
    ctx.stroke();
    if (b.depth >= 3) {
      tips.push({ x: ex, y: ey });
      return;
    }
    const forks = 2 + (rand(k + 1) > 0.6 ? 1 : 0);
    for (let i = 0; i < forks; i++) {
      grow(
        {
          x: ex,
          y: ey,
          angle: b.angle + (i - (forks - 1) / 2) * 0.7 + (rand(k + 2 + i) - 0.5) * 0.5,
          length: b.length * (0.62 + 0.2 * rand(k + 5 + i)),
          width: b.width * 0.62,
          depth: b.depth + 1,
        },
        k * 3 + i + 7,
      );
    }
  };
  // Several stems from the root, low and spreading: a shrub, not a tree.
  for (let stem = 0; stem < 3; stem++) {
    grow({ x: (stem - 1) * 0.06, y: 0, angle: Math.PI / 2 + (stem - 1) * 0.55 + (rand(1 + stem) - 0.5) * 0.3, length: 0.22, width: 0.06, depth: 1 }, 11 + stem * 17);
  }

  // Tassels of thin green twigs hanging from every tip, swaying in the wind.
  const sway = wind * 0.12 + Math.sin(time * 1.7 + seed) * 0.03;
  for (const [i, tip] of tips.entries()) {
    for (let j = 0; j < 9; j++) {
      const spread = (j - 4) * 0.03;
      const len = 0.22 + 0.16 * rand(100 + i * 7 + j);
      ctx.strokeStyle = j % 3 === 0 ? paint.twigLight : paint.twig;
      ctx.lineWidth = 0.018;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.quadraticCurveTo(tip.x + spread + sway * 0.5, tip.y + len * 0.3, tip.x + spread * 2 + sway, tip.y - len * 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A tuft of feather grass: fine blades fanning out, bent over by the wind. */
export function drawTuft(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, seed: number, paint: FloraPaint, wind: number, time: number) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(size, -size);
  ctx.lineCap = "round";
  const blades = 14;
  for (let i = 0; i < blades; i++) {
    const r = hash1(seed * 31 + i, 993);
    const spread = (i / (blades - 1) - 0.5) * 1.3;
    const len = 0.55 + 0.6 * r;
    const bend = wind * 0.5 + Math.sin(time * 2.3 + i + seed) * 0.06;
    ctx.strokeStyle = r > 0.6 ? paint.grassLight : paint.grass;
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(spread * 0.15, 0);
    ctx.quadraticCurveTo(spread * 0.4, len * 0.6, spread * 0.7 + bend * len, len * (1 - Math.abs(bend) * 0.3));
    ctx.stroke();
  }
  ctx.restore();
}
