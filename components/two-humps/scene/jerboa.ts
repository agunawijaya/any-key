import { css, type RGB } from "./light";
import { bandPath, smoothPath } from "./shapes";

/*
 * The Ladle Gang: pygmy jerboas, about the size of a thumb, who hop on long
 * back legs with a tufted tail for balance. Ours are drawn big-eared and
 * round, in their own units (one unit to the top of the head, y up, facing
 * right). Pose and props are parameters: hopping, standing up to look,
 * carrying the gang's soup ladle, wearing a bib to a party.
 */

export type JerboaPose = {
  /** 0–1 through a hop; null stands still. */
  hop: number | null;
  /** −1 faces left, 1 faces right. */
  facing: number;
  /** Ear twitch and blink time. */
  time: number;
  /** A long-handled ladle held up in the forepaws. */
  ladle?: boolean;
  /** A party bib with a dotted trim. */
  bib?: boolean;
  /** 0–1: eyes squeezed happy, for the party. */
  joy?: number;
  /** Raise the paws (cheering, or reaching for seeds). */
  reach?: number;
  seed: number;
};

export type JerboaPaint = { fur: string; belly: string; ear: string; dark: string; eyeShine: string; ladle: string; bib: string; bibTrim: string };

export function drawJerboa(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, pose: JerboaPose, paint: JerboaPaint) {
  const hop = pose.hop;
  // A hop: crouch, spring up in an arc, land.
  const air = hop === null ? 0 : Math.max(0, Math.sin(hop * Math.PI)) * 0.55;
  const crouch = hop === null ? 0 : Math.max(0, Math.cos(hop * Math.PI * 2)) * 0.06;
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(size * pose.facing, -size);
  ctx.translate(0, air - crouch);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const stretch = hop === null ? 0 : Math.sin(hop * Math.PI * 2) * 0.2;

  // The tail: long and thin, curving out behind, ending in a black-and-white tuft for balance.
  const sway = Math.sin(pose.time * 3 + pose.seed) * 0.05;
  const tip: [number, number] = [-1.02, 0.5 + sway];
  ctx.strokeStyle = paint.fur;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(-0.18, 0.3);
  ctx.bezierCurveTo(-0.5, 0.24 + stretch * 0.3, -0.75, 0.34 + sway, tip[0], tip[1]);
  ctx.stroke();
  ctx.save();
  ctx.translate(tip[0], tip[1]);
  ctx.rotate(Math.atan2(tip[1] - (0.34 + sway), tip[0] + 0.75) + Math.PI);
  ctx.fillStyle = paint.dark;
  ctx.beginPath();
  ctx.moveTo(0, 0.025);
  ctx.quadraticCurveTo(0.12, 0.07, 0.24, 0.0);
  ctx.quadraticCurveTo(0.12, -0.07, 0, -0.025);
  ctx.fill();
  ctx.fillStyle = paint.belly;
  ctx.beginPath();
  ctx.moveTo(0.14, 0.04);
  ctx.quadraticCurveTo(0.24, 0.05, 0.3, 0.0);
  ctx.quadraticCurveTo(0.24, -0.05, 0.14, -0.04);
  ctx.fill();
  ctx.restore();

  // Long, springy hind legs and big feet.
  const kick = hop === null ? 0 : stretch;
  ctx.fillStyle = paint.fur;
  ctx.fill(bandPath([[-0.1, 0.3], [-0.02, 0.14 - kick * 0.2], [-0.16 - kick * 0.5, 0.04 - kick * 0.1]], [0.26, 0.1, 0.05]));
  ctx.fillStyle = paint.dark;
  ctx.beginPath();
  ctx.ellipse(-0.1 - kick * 0.5, 0.02 - kick * 0.1, 0.13, 0.03, -kick * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Body: a round little bean, pale underneath.
  const body = new Path2D();
  smoothPath(
    body,
    [
      [-0.22, 0.3],
      [-0.16, 0.48],
      [0.02, 0.56],
      [0.16, 0.5],
      [0.18, 0.34],
      [0.06, 0.2],
      [-0.12, 0.2],
    ],
    true,
    0.5,
  );
  ctx.fillStyle = paint.fur;
  ctx.fill(body);
  ctx.fillStyle = paint.belly;
  ctx.beginPath();
  ctx.ellipse(0.09, 0.33, 0.1, 0.13, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Bib for the party.
  if (pose.bib) {
    ctx.fillStyle = paint.bib;
    ctx.beginPath();
    ctx.moveTo(0.02, 0.56);
    ctx.quadraticCurveTo(0.26, 0.5, 0.2, 0.28);
    ctx.quadraticCurveTo(0.08, 0.3, 0.02, 0.56);
    ctx.fill();
    ctx.fillStyle = paint.bibTrim;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0.1 + i * 0.03, 0.47 - i * 0.055, 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Head: big for the body, with a blunt nose and whiskers.
  const head = new Path2D();
  smoothPath(
    head,
    [
      [0.0, 0.62],
      [0.08, 0.84],
      [0.28, 0.88],
      [0.45, 0.74],
      [0.48, 0.63],
      [0.32, 0.52],
      [0.1, 0.51],
    ],
    true,
    0.5,
  );
  ctx.fillStyle = paint.fur;
  ctx.fill(head);

  // Ears: huge, round-tipped, and always moving.
  const twitch = Math.sin(pose.time * 5 + pose.seed * 3) > 0.92 ? 0.12 : 0;
  for (const [ox, oy, lean] of [
    [0.1, 0.8, 0.5 + twitch],
    [0.22, 0.84, 0.18 - twitch * 0.5],
  ] as const) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(lean);
    ctx.fillStyle = paint.fur;
    ctx.beginPath();
    ctx.ellipse(0, 0.26, 0.1, 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = paint.ear;
    ctx.beginPath();
    ctx.ellipse(0.008, 0.27, 0.06, 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Eye: huge and dark, with a shine; a happy squint at parties; blinks now and then.
  const blink = (pose.time * 0.6 + pose.seed * 0.37) % 1 > 0.96;
  if (pose.joy || blink) {
    ctx.strokeStyle = paint.dark;
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.arc(0.29, 0.68, 0.06, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else {
    ctx.fillStyle = paint.dark;
    ctx.beginPath();
    ctx.ellipse(0.29, 0.69, 0.075, 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = paint.eyeShine;
    ctx.beginPath();
    ctx.arc(0.315, 0.72, 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = paint.dark;
  ctx.beginPath();
  ctx.arc(0.48, 0.64, 0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = paint.belly;
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  for (const dy of [-0.02, 0.01, 0.04]) {
    ctx.moveTo(0.46, 0.62);
    ctx.lineTo(0.66, 0.62 + dy * 2);
  }
  ctx.stroke();

  // Little forepaws, holding the ladle if there is one.
  const reach = pose.reach ?? (pose.ladle ? 0.5 : 0);
  const paw: [number, number] = [0.3, 0.42 + reach * 0.12];
  if (pose.ladle) {
    // A soup ladle far taller than its owner, held proudly out in front.
    ctx.strokeStyle = paint.ladle;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(paw[0] - 0.08, 0.12);
    ctx.lineTo(paw[0] + 0.32, 1.62);
    ctx.stroke();
    ctx.save();
    ctx.translate(paw[0] + 0.36, 1.7);
    ctx.rotate(-0.3);
    ctx.fillStyle = paint.ladle;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.17, 0.11, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = paint.fur;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(0.12, 0.44);
  ctx.lineTo(paw[0], paw[1]);
  ctx.stroke();

  ctx.restore();
}

/**
 * Just the eyes: a pair of small lights where a jerboa watches from the dark,
 * catching the firelight, and blinking now and then.
 */
export function drawEyes(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, seed: number, colour: RGB) {
  const phase = (time * (0.3 + (seed % 7) * 0.05) + seed * 0.61) % 1;
  const lid = phase > 0.93 ? Math.abs(Math.cos(((phase - 0.93) / 0.07) * Math.PI)) : 1;
  const glance = Math.sin(time * 0.4 + seed) * size * 0.4;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3.5);
  glow.addColorStop(0, css(colour, 0.25));
  glow.addColorStop(1, "rgb(0 0 0 / 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - size * 4, y - size * 4, size * 8, size * 8);
  ctx.restore();
  ctx.fillStyle = css(colour);
  for (const dx of [-size * 1.1, size * 1.1]) {
    ctx.beginPath();
    ctx.ellipse(x + dx + glance, y, size * 0.75, size * 0.9 * lid, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
