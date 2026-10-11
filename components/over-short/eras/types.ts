import type { TargetKind } from "@/lib/over-short/engagement";
import type { FrontProp, FrontScenery } from "../scene/front";
import type { Ctx } from "../scene/paint";
import type { Particles } from "../scene/particles";
import type { Appearance, Lighting, SideScenery } from "../scene/side";

/*
 * An era: everything about Over / Short that is look and sound and words,
 * and nothing that is rules. The engine, the physics, the missions and the
 * records never see an era, so changing it mid-game changes no shot.
 * docs/over-short/ARCHITECTURE.md explains how to add one.
 */

export type TargetState = "intact" | "damaged" | "destroyed";

/** How a target looks at a moment; `since` is seconds since its state last changed. */
export type TargetLook = { kind: TargetKind; state: TargetState; since: number };

/** What the crew are doing: serving the gun, or down behind its shield with rounds landing close. */
export type CrewAction = "serving" | "ducking";

export type GunPose = {
  elevation: number;
  /** 0 at rest, 1 at the instant of firing, easing back. */
  recoil: number;
  /** Serving when left out. */
  crew?: CrewAction;
};

/** Metres in an effect's scene: x along the view, z into it. */
export type At = { x: number; z: number };

/** A river in its valley, in screen pixels: the water between the banks, and the lights shining on it. */
export type RiverGeometry = {
  left: number;
  right: number;
  /** The water's surface, the bottom of the band drawn for it, and the bank's line at any x. */
  surface: number;
  bed: number;
  bankY: (x: number) => number;
  lights: { x: number; intensity: number }[];
  time: number;
  moonlit: boolean;
};

/** A bridge across the river valley, in screen pixels, with how lit it is (0–1) and what state it is in. */
export type BridgeGeometry = {
  x0: number;
  x1: number;
  deckY: number;
  /** Where a pier at screen x stands: on the slope, or on the river bed. */
  footY: (x: number) => number;
  /** The view's height, for sizes that follow the screen. */
  scale: number;
  light: number;
  state: TargetState;
};

/** The team moving the gun: where the horses are in their stride (0–1) and how far the limber's wheels have turned (radians). */
export type TeamPose = { step: number; wheelTurn: number };

export type Era = {
  id: string;
  name: string;
  /** One line for the settings. */
  blurb: string;

  words: {
    /** What the target is called in briefings and on the slips: "supply dump". */
    target: (kind: TargetKind) => string;
    /** Who reports the fall of shot, and over what: "Forward observer", "telephone". */
    observer: string;
    line: string;
  };

  /** The side view: sky and land in parallax layers. */
  side: SideScenery;
  /** The observer's view: ground, sky and props, and what the observer looks through. */
  front: FrontScenery;
  optic: (ctx: Ctx, width: number, height: number, appearance: Appearance) => void;

  /** The gun and its crew on the ground at (x, y); `size` is the gun's wheel in pixels. */
  drawGun: (ctx: Ctx, x: number, y: number, size: number, pose: GunPose, appearance: Appearance) => void;
  /** Where the muzzle is, in pixels from the (x, y) given to `drawGun`, at rest and at this elevation. */
  muzzle: (size: number, elevation: number) => { x: number; y: number };
  drawShell: (ctx: Ctx, x: number, y: number, angle: number, length: number, appearance: Appearance) => void;
  drawTrail: (ctx: Ctx, points: { x: number; y: number }[], appearance: Appearance, width: number) => void;
  /** A star shell or other light in the sky at night. */
  drawFlare: (ctx: Ctx, x: number, y: number, size: number, intensity: number, smokeRise: number) => void;

  /** A target as a small symbol in the side view, standing on the ground at (x, y), `size` pixels tall. */
  drawTargetSide: (ctx: Ctx, look: TargetLook, x: number, y: number, size: number, appearance: Appearance, time: number) => void;
  /** A standing target as a prop in the observer's view (convoys move, and use `drawMover`). */
  targetProp: (look: () => TargetLook, across: number, away: number) => FrontProp;
  /** One vehicle of a moving target at (x, y) in the observer's view, `scale` pixels per metre. */
  drawMover: (ctx: Ctx, x: number, y: number, scale: number, appearance: Appearance, lighting: Lighting, wrecked: boolean) => void;
  /** Metres between the vehicles of a moving target. */
  moverSpacing: number;

  effects: {
    /** A round landing in the open, as the observer sees it close up. */
    fallOfShot: (fx: Particles, at: At, power: number) => void;
    /** A round bursting as the side view sees it from far off: bigger, brighter, a ball of fire. */
    explosion: (fx: Particles, at: At, power: number) => void;
    /** A round on the target: `destroyed` when it is the last hit it takes. */
    hit: (fx: Particles, kind: TargetKind, at: At, destroyed: boolean, power: number) => void;
    /** Smoke and flash at the muzzle; `direction` is the barrel's angle in radians from the ground. */
    muzzle: (fx: Particles, at: At & { y?: number }, direction: number, power: number) => void;
  };

  /** What Field Artillery adds to the side view: rivers and their bridges, lorries side-on, the team that moves the gun. */
  field: {
    drawRiver: (ctx: Ctx, river: RiverGeometry, appearance: Appearance) => void;
    drawBridge: (ctx: Ctx, bridge: BridgeGeometry, appearance: Appearance) => void;
    /** A lorry at (x, road), facing left (−1) or right, `scale` pixels a metre, lit 0–1 at night. */
    drawLorry: (ctx: Ctx, x: number, roadY: number, scale: number, facing: 1 | -1, appearance: Appearance, light: number, wrecked: boolean) => void;
    /** The horses and limber, the limber's hook at (x, y), at the scale of a gun whose wheel is `wheel` pixels. */
    drawTeam: (ctx: Ctx, x: number, y: number, wheel: number, pose: TeamPose, appearance: Appearance) => void;
  };
};
