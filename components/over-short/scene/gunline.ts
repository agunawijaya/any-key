import type { Era, GunPose } from "../eras/types";
import { css, type Rgb } from "./color";
import { context, makeCanvas, type Ctx } from "./paint";
import type { SideView } from "./side";

/*
 * The gun in the side view is drawn far larger than life (its wheel is a
 * few per cent of the screen's height, where life size would be a pixel or
 * two), so its smoke and the start of every arc have to be placed from
 * where it is drawn, not from where it stands in metres.
 *
 * Eras draw their gun facing right; a gun across the line (the duel's other
 * battery) is the same drawing mirrored, `facing` -1.
 */

/** 1 for a gun firing towards larger x, -1 for one firing back. */
export type Facing = 1 | -1;

/** The gun's wheel as a share of the view's height: big enough to read the barrel's angle at a glance. */
export const GUN_SIZE = 0.04;

/** A metre of a burst, as a share of the view's height: bursts are drawn as much larger than life as the gun (see `Particles.magnify`). */
export const BURST_METRE = 0.0075;

/** Where the gun at world metre `gunX` is drawn, and how big. */
export function gunPlacement(view: SideView, gunX: number, wheelShare = GUN_SIZE, facing: Facing = 1) {
  const wheel = view.height * wheelShare;
  return { x: view.screenX(gunX) - wheel * 0.9 * facing, y: view.groundY(gunX) + wheel * 0.15, wheel };
}

/**
 * Where to start the muzzle's smoke: x in world metres across from the gun's
 * spot, y in the metres of a magnified effect (see `BURST_METRE`), so the
 * smoke, drawn larger than life around its own x, comes out of the muzzle
 * as drawn rather than far above it.
 */
export function muzzleInWorld(view: SideView, era: Era, gunX: number, elevation: number, wheelShare = GUN_SIZE, facing: Facing = 1) {
  const at = gunPlacement(view, gunX, wheelShare, facing);
  const offset = era.muzzle(at.wheel, elevation);
  return { x: gunX + (at.x + offset.x * facing - view.screenX(gunX)) / view.scale, y: (view.groundY(gunX) - (at.y + offset.y)) / (view.height * BURST_METRE) };
}

/** The era's gun at world metre `gunX`, turned to face the way it fires. */
export function drawGunAt(ctx: Ctx, view: SideView, era: Era, gunX: number, pose: GunPose, wheelShare = GUN_SIZE, facing: Facing = 1) {
  const at = gunPlacement(view, gunX, wheelShare, facing);
  if (facing === 1) {
    era.drawGun(ctx, at.x, at.y, at.wheel, pose, view.appearance);
    return;
  }
  ctx.save();
  ctx.translate(at.x, 0);
  ctx.scale(-1, 1);
  era.drawGun(ctx, 0, at.y, at.wheel, pose, view.appearance);
  ctx.restore();
}

let scratch: HTMLCanvasElement | null = null;

/**
 * The gun with a light close by thrown across it, a burst's fire or a star
 * shell's white: drawn on a scratch canvas first, so the light falls on the
 * gun and its crew and nothing else. At night it turns them from shadows
 * into figures lit from one side. `glare` is the light on screen, its
 * colour, and how strong it is (0–1).
 */
export function drawGunInGlare(ctx: Ctx, view: SideView, era: Era, gunX: number, pose: GunPose, glare: { x: number; y: number; strength: number; color: Rgb }, wheelShare = GUN_SIZE, facing: Facing = 1) {
  if (glare.strength <= 0.01) {
    drawGunAt(ctx, view, era, gunX, pose, wheelShare, facing);
    return;
  }
  const at = gunPlacement(view, gunX, wheelShare, facing);
  const box = { x: at.x - at.wheel * 3.4, y: at.y - at.wheel * 2.4, w: at.wheel * 6.8, h: at.wheel * 2.8 };
  const dpr = ctx.getTransform().a;
  const width = Math.ceil(box.w * dpr);
  const height = Math.ceil(box.h * dpr);
  if (!scratch || scratch.width < width || scratch.height < height) scratch = makeCanvas(Math.max(width, scratch?.width ?? 0), Math.max(height, scratch?.height ?? 0));
  const s = context(scratch);
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = "source-over";
  s.clearRect(0, 0, scratch.width, scratch.height);
  s.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
  drawGunAt(s, view, era, gunX, pose, wheelShare, facing);
  s.globalCompositeOperation = "source-atop";
  const reach = at.wheel * 6;
  const g = s.createRadialGradient(glare.x, glare.y, 0, glare.x, glare.y, reach);
  g.addColorStop(0, css(glare.color, 0.85 * glare.strength));
  g.addColorStop(0.45, css(glare.color, 0.45 * glare.strength));
  g.addColorStop(1, css(glare.color, 0));
  s.fillStyle = g;
  s.fillRect(box.x, box.y, box.w, box.h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scratch, 0, 0, width, height, Math.round(box.x * dpr), Math.round(box.y * dpr), width, height);
  ctx.restore();
}
