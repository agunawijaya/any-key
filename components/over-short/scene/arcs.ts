import { fieldPositionAt, type FieldFlight, type FieldSample } from "@/lib/over-short/fieldModel";
import { positionAt, type Flight } from "@/lib/over-short/models";
import type { Era } from "../eras/types";
import { GUN_SIZE, gunPlacement, type Facing } from "./gunline";
import type { Ctx } from "./paint";
import type { SideView } from "./side";

/*
 * A shell's arc drawn over real hills. The flight is worked out in metres
 * from the gun (along its line of fire, and up from its muzzle); the view
 * places it with the same squeezed heights as the land, so the arc and the
 * crests it clears agree. Near the gun the trail starts at the muzzle as
 * drawn (the gun is drawn far larger than life) and settles onto the true
 * path as the shell climbs away.
 */

export type ArcOnRelief = {
  flight: Flight;
  /** World metre the gun stands at, which way it fires, and its height above the lowest ground. */
  gunX: number;
  facing: Facing;
  gunHeight: number;
  /** Pixels from the gun's spot on the ground to its muzzle as drawn (x the way it fires, y up); none for a gun off the screen. */
  muzzle?: { x: number; y: number };
};

/** Pixels from the gun's spot on the ground to the era's muzzle at this elevation: x the way it fires, y up. */
export function drawnMuzzle(view: SideView, era: Era, gunX: number, elevation: number, wheelShare = GUN_SIZE) {
  const at = gunPlacement(view, gunX, wheelShare);
  const offset = era.muzzle(at.wheel, elevation);
  return { x: at.x + offset.x - view.screenX(gunX), y: view.groundY(gunX) - (at.y + offset.y) };
}

/** Screen position of a point `x` metres along the flight and `y` metres above the muzzle. */
export function arcPoint(view: SideView, arc: ArcOnRelief, x: number, y: number) {
  const away = 1 - Math.min(1, Math.abs(x) / Math.max(1, arc.flight.landed * 0.35));
  const m = arc.muzzle ?? { x: 0, y: 0 };
  return { x: view.screenX(arc.gunX + arc.facing * x) + arc.facing * m.x * away, y: view.heightY(arc.gunHeight + y) - m.y * away };
}

/**
 * A Field Artillery round's trail and shell: its path is already in world
 * metres (x along the line of fire, y above the lowest ground), turned into
 * the view's by `toWorld` for a gun firing the other way. Near the gun the
 * trail starts at the drawn muzzle, `muzzle` pixels from the gun's spot.
 */
export function drawFieldArc(
  ctx: Ctx,
  view: SideView,
  era: Era,
  flight: FieldFlight,
  clock: number,
  gun: { x: number; facing: Facing; muzzle: { x: number; y: number } },
  toWorld: (p: FieldSample) => { x: number; y: number } = (p) => p,
  from = 0,
) {
  const range = Math.max(1, Math.abs(toWorld(flight.path[flight.path.length - 1]).x - gun.x));
  const place = (p: FieldSample) => {
    const w = toWorld(p);
    const away = 1 - Math.min(1, Math.abs(w.x - gun.x) / (range * 0.35));
    return { x: view.screenX(w.x) + gun.facing * gun.muzzle.x * away, y: view.heightY(w.y) - gun.muzzle.y * away };
  };
  const points = flight.path.filter((p) => p.t <= clock && p.t >= from).map(place);
  const head = place(fieldPositionAt(flight, clock));
  points.push(head);
  era.drawTrail(ctx, points, view.appearance, view.height * 0.0032);
  if (clock >= flight.time) return;
  const next = place(fieldPositionAt(flight, clock + 0.3));
  era.drawShell(ctx, head.x, head.y, Math.atan2(next.y - head.y, next.x - head.x), view.height * 0.022, view.appearance);
}

/** The trail since `from` seconds and the shell at its head, `clock` seconds into the flight. */
export function drawArc(ctx: Ctx, view: SideView, era: Era, arc: ArcOnRelief, clock: number, from = 0) {
  const flight = arc.flight;
  const points = flight.path.filter((p) => p.t <= clock && p.t >= from).map((p) => arcPoint(view, arc, p.x, p.y));
  const here = positionAt(flight, clock);
  const head = arcPoint(view, arc, here.x, here.y);
  points.push(head);
  era.drawTrail(ctx, points, view.appearance, view.height * 0.0032);
  if (clock >= flight.time) return;
  const ahead = positionAt(flight, clock + 0.3);
  const next = arcPoint(view, arc, ahead.x, ahead.y);
  era.drawShell(ctx, head.x, head.y, Math.atan2(next.y - head.y, next.x - head.x), view.height * 0.022, view.appearance);
}
