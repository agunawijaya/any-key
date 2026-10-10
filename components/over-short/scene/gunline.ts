import type { Era } from "../eras/types";
import type { SideView } from "./side";

/*
 * The gun in the side view is drawn far larger than life (its wheel is a
 * few per cent of the screen's height, where life size would be a pixel or
 * two), so its smoke and the start of every arc have to be placed from
 * where it is drawn, not from where it stands in metres.
 */

/** The gun's wheel as a share of the view's height: big enough to read the barrel's angle at a glance. */
export const GUN_SIZE = 0.04;

/** A metre of a burst, as a share of the view's height: bursts are drawn as much larger than life as the gun (see `Particles.magnify`). */
export const BURST_METRE = 0.0075;

/** Where the gun at world metre `gunX` is drawn, and how big. */
export function gunPlacement(view: SideView, gunX: number, wheelShare = GUN_SIZE) {
  const wheel = view.height * wheelShare;
  return { x: view.screenX(gunX) - wheel * 0.9, y: view.groundY(gunX) + wheel * 0.15, wheel };
}

/** The muzzle in world metres: across from the gun's spot, and up from the ground there. */
export function muzzleInWorld(view: SideView, era: Era, gunX: number, elevation: number, wheelShare = GUN_SIZE) {
  const at = gunPlacement(view, gunX, wheelShare);
  const offset = era.muzzle(at.wheel, elevation);
  return { x: gunX + (at.x + offset.x - view.screenX(gunX)) / view.scale, y: (view.groundY(gunX) - (at.y + offset.y)) / view.scale };
}
