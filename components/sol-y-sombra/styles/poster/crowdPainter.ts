import { Crowd } from "@/lib/sol-y-sombra/crowd";
import { PLAZA, standsLit } from "@/lib/sol-y-sombra/plaza";
import { type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import { mix as mixHex } from "@/lib/kit/color";
import { NEAR, type Camera } from "../../render/camera";
import type { PosterPalette } from "./palette";
import { SEGMENTS } from "./plazaPainter";

/*
 * The crowd in poster inks. Each person is a little printed figure (a shirt,
 * a head, sometimes a hat or a white handkerchief) in one of a dozen looks,
 * sitting or standing, arms down, up, or waving to one side. The figures are
 * drawn once into small offscreen canvases, in sun and in shade, and stamped
 * into the stands row by row, so thousands cost no more than a few hundred
 * shapes.
 */

/** Pixels per metre in the stamps; drawn smaller or larger as the camera needs. */
const STAMP_SCALE = 70;
const STAMP_W = 80;
const STAMP_H = 140;
/** Where the seat is in a stamp: bottom middle. */
const ANCHOR_X = STAMP_W / 2;
const ANCHOR_Y = STAMP_H - 6;

type Arms = 0 | 1 | 2 | 3; // down, up, waving left, waving right

export class CrowdPainter {
  private readonly ctx: CanvasRenderingContext2D;
  private stamps = new Map<string, HTMLCanvasElement>();
  private stampPalette: PosterPalette | null = null;
  private buckets: number[][] | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** People grouped by the stand segment and row they sit in, so the plaza can call for one bucket at a time. */
  private bucketsFor(crowd: Crowd) {
    if (this.buckets) return this.buckets;
    const buckets: number[][] = Array.from({ length: SEGMENTS * PLAZA.rows }, () => []);
    for (let i = 0; i < crowd.count; i++) {
      const a = ((crowd.azimuth[i] % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const k = Math.min(SEGMENTS - 1, Math.floor((a / (Math.PI * 2)) * SEGMENTS));
      buckets[k * PLAZA.rows + crowd.rowOf[i]].push(i);
    }
    this.buckets = buckets;
    return buckets;
  }

  /** Draws the people of one segment's row. */
  paintRow(crowd: Crowd, camera: Camera, p: PosterPalette, sun: Vec3, segment: number, rowIndex: number) {
    if (this.stampPalette !== p) {
      this.stamps.clear();
      this.stampPalette = p;
    }
    const bucket = this.bucketsFor(crowd)[segment * PLAZA.rows + rowIndex];
    if (!bucket.length) return;
    const ctx = this.ctx;
    for (const i of bucket) {
      const seat = crowd.seatOf(i);
      const q = camera.project(seat);
      if (q.depth < NEAR) continue;
      const size = q.scale / STAMP_SCALE;
      if (size * STAMP_H < 2) continue;
      // Off the picture: skip, allowing for the figure standing up above its seat.
      if (q.x < -STAMP_W * size || q.x > camera.width + STAMP_W * size || q.y < -10 || q.y > camera.height + STAMP_H * size) continue;
      const lit = standsLit(crowd.azimuth[i], sun);
      const standing = crowd.rise[i] > 0.5;
      const sway = crowd.sway(i);
      const arms: Arms = crowd.arms[i] < 0.4 ? 0 : Math.abs(sway) < 0.35 ? 1 : sway > 0 ? 2 : 3;
      // Rows further up fade into the stands, as distance does on a print.
      const haze = Math.min(3, Math.floor(crowd.rowOf[i] / 5));
      const stamp = this.stamp(p, crowd.look[i], standing, arms, lit, haze);
      // A half-risen person is drawn as standing, sunk into the row in front a little.
      const sink = standing ? (1 - crowd.rise[i]) * 0.45 * q.scale : 0;
      ctx.drawImage(stamp, q.x - ANCHOR_X * size, q.y - ANCHOR_Y * size + sink, STAMP_W * size, STAMP_H * size);
    }
  }

  private stamp(p: PosterPalette, look: number, standing: boolean, arms: Arms, lit: boolean, haze: number) {
    const key = `${look}/${standing ? 1 : 0}/${arms}/${lit ? 1 : 0}/${haze}`;
    let canvas = this.stamps.get(key);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = STAMP_W;
      canvas.height = STAMP_H;
      drawPerson(canvas.getContext("2d")!, p, look, standing, arms, lit, haze);
      this.stamps.set(key, canvas);
    }
    return canvas;
  }
}

/** One printed spectator, in stamp pixels, seat at the bottom middle. */
function drawPerson(ctx: CanvasRenderingContext2D, p: PosterPalette, look: number, standing: boolean, arms: Arms, lit: boolean, haze: number) {
  const m = STAMP_SCALE;
  const fade = 0.12 + haze * 0.1;
  const shade = (c: string) => mixHex(lit ? c : mixHex(c, p.shadeTint, 0.45), lit ? p.haze : p.riser.shade, fade);
  const shirt = shade(p.crowd[look % p.crowd.length]);
  const skin = shade(p.skin[look % p.skin.length]);
  const ink = p.ink;
  const ox = ANCHOR_X;
  const oy = ANCHOR_Y;
  const Y = (metres: number) => oy - metres * m;
  // Seated, the hips are at the seat; standing, they rise.
  const hips = standing ? 0.42 : 0.05;
  const shoulders = hips + 0.55;
  const head = shoulders + 0.17;
  const halfWidth = 0.19 * m;

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = ink;

  // Arms behind the body first when they are down; raised arms go in front.
  const shoulderL = { x: ox - halfWidth * 0.82, y: Y(shoulders - 0.04) };
  const shoulderR = { x: ox + halfWidth * 0.82, y: Y(shoulders - 0.04) };
  const hand = (side: number, up: boolean, lean: number) =>
    up ? { x: ox + side * (halfWidth * 1.1) + lean * m * 0.14, y: Y(shoulders + 0.5) } : { x: ox + side * halfWidth * 1.05, y: Y(hips + 0.12) };
  const leftUp = arms === 1 || arms === 2;
  const rightUp = arms === 1 || arms === 3;
  const lean = arms === 2 ? -1 : arms === 3 ? 1 : 0;
  const armPath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineWidth = 0.13 * m + 2.4;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.lineWidth = 0.13 * m - 1;
    ctx.strokeStyle = shirt;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(to.x, to.y, 0.055 * m, 0, Math.PI * 2);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    ctx.stroke();
  };

  // The body: a rounded block of shirt, broad at the shoulders.
  ctx.beginPath();
  ctx.moveTo(ox - halfWidth * 0.85, Y(hips - 0.1));
  ctx.lineTo(ox - halfWidth, Y(shoulders - 0.08));
  ctx.quadraticCurveTo(ox - halfWidth, Y(shoulders + 0.02), ox - halfWidth * 0.55, Y(shoulders + 0.03));
  ctx.lineTo(ox + halfWidth * 0.55, Y(shoulders + 0.03));
  ctx.quadraticCurveTo(ox + halfWidth, Y(shoulders + 0.02), ox + halfWidth, Y(shoulders - 0.08));
  ctx.lineTo(ox + halfWidth * 0.85, Y(hips - 0.1));
  ctx.closePath();
  ctx.fillStyle = shirt;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = ink;
  ctx.stroke();
  // A collar of contrasting colour on some looks.
  if (look % 3 === 0) {
    ctx.beginPath();
    ctx.moveTo(ox - 0.06 * m, Y(shoulders + 0.03));
    ctx.lineTo(ox, Y(shoulders - 0.1));
    ctx.lineTo(ox + 0.06 * m, Y(shoulders + 0.03));
    ctx.fillStyle = shade(p.crowd[(look + 5) % p.crowd.length]);
    ctx.fill();
  }

  // Head.
  ctx.beginPath();
  ctx.arc(ox, Y(head + 0.08), 0.11 * m, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = ink;
  ctx.stroke();
  // Hair, or a hat: a wide flat-brimmed black one, a straw boater, or a scarf.
  const hatKind = look % 4;
  if (hatKind === 0) {
    ctx.beginPath();
    ctx.ellipse(ox, Y(head + 0.14), 0.2 * m, 0.035 * m, 0, 0, Math.PI * 2);
    ctx.rect(ox - 0.1 * m, Y(head + 0.3), 0.2 * m, 0.15 * m);
    ctx.fillStyle = shade(p.hatDark);
    ctx.fill();
  } else if (hatKind === 1) {
    ctx.beginPath();
    ctx.ellipse(ox, Y(head + 0.14), 0.17 * m, 0.03 * m, 0, 0, Math.PI * 2);
    ctx.rect(ox - 0.095 * m, Y(head + 0.25), 0.19 * m, 0.11 * m);
    ctx.fillStyle = shade(p.hatStraw);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = shade(p.crowd[1]);
    ctx.fillRect(ox - 0.095 * m, Y(head + 0.19), 0.19 * m, 0.035 * m);
  } else {
    ctx.beginPath();
    ctx.arc(ox, Y(head + 0.1), 0.115 * m, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineTo(ox + 0.1 * m, Y(head + 0.12));
    ctx.fillStyle = shade(look % 2 ? p.hatDark : mixHex(p.hatDark, "#8a5a32", 0.6));
    ctx.fill();
  }

  if (leftUp || rightUp || arms !== 0) {
    armPath(shoulderL, hand(-1, leftUp, lean));
    armPath(shoulderR, hand(1, rightUp, lean));
  } else {
    // Hands in the lap.
    ctx.beginPath();
    ctx.arc(ox - 0.06 * m, Y(hips + 0.05), 0.05 * m, 0, Math.PI * 2);
    ctx.arc(ox + 0.06 * m, Y(hips + 0.05), 0.05 * m, 0, Math.PI * 2);
    ctx.fillStyle = skin;
    ctx.fill();
  }
  // Some wave a white handkerchief: the ring's old way of asking for a reward.
  if ((leftUp || rightUp) && look % 5 === 0) {
    const h = hand(1, rightUp, lean);
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + 0.16 * m, h.y - 0.08 * m);
    ctx.lineTo(h.x + 0.1 * m, h.y + 0.12 * m);
    ctx.closePath();
    ctx.fillStyle = shade("#fbf7ee");
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}
