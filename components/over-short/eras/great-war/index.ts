import type { TargetKind } from "@/lib/over-short/engagement";
import { blast, burning, dumpGoesUp, earthFountain, explosion, masonryBurst, muzzleSmoke } from "../../scene/effects";
import type { Era } from "../types";
import { drawFlare, drawShell, drawTrail } from "./flight";
import { frontGround, frontProps, frontSky } from "./front";
import { drawBridge, drawLorrySide, drawRiver, drawTeam } from "./fieldPieces";
import { drawFieldGun, fieldGunMuzzle } from "./gun";
import { greatWarLayers } from "./land";
import { fieldGlasses } from "./optics";
import { paletteFor } from "./palette";
import { paintSky, skyOverlay } from "./sky";
import { CONVOY_SPACING, drawLorry, drawTargetSide, targetProp } from "./targets";

/*
 * The Great War, the default era: a Western Front field gun and its crew,
 * a long side-on landscape of shell-scarred fields, woods, a ruined farm and
 * a church spire, an observer with field glasses in a forward trench and a
 * field telephone. Painterly and muted under a pale overcast by day; a night
 * barrage under star shells in the dark.
 */

const NAMES: Record<TargetKind, string> = {
  battery: "enemy battery",
  dump: "supply dump",
  bridge: "stone bridge",
  railyard: "rail yard",
  mast: "wireless mast",
  convoy: "lorry convoy",
};

export const greatWar: Era = {
  id: "great-war",
  name: "The Great War",
  blurb: "A Western Front field gun, shell-scarred fields, star shells at night",
  words: { target: (kind) => NAMES[kind], observer: "Forward observer", line: "field telephone" },
  side: { sky: { paint: paintSky, overlay: skyOverlay }, layers: greatWarLayers, nightAmbient: paletteFor("night").skyLow },
  front: { ground: frontGround, sky: frontSky, props: frontProps },
  optic: fieldGlasses,
  drawGun: drawFieldGun,
  muzzle: fieldGunMuzzle,
  drawShell,
  drawTrail,
  drawFlare,
  drawTargetSide,
  targetProp,
  drawMover: drawLorry,
  moverSpacing: CONVOY_SPACING,
  effects: {
    fallOfShot: earthFountain,
    explosion,
    muzzle: muzzleSmoke,
    hit: (fx, kind, at, destroyed, power) => {
      earthFountain(fx, at, power * 0.7);
      if (!destroyed) {
        if (kind === "bridge") masonryBurst(fx, { ...at, y: 4 }, power);
        return;
      }
      if (kind === "dump") return dumpGoesUp(fx, at);
      if (kind === "bridge") return masonryBurst(fx, { ...at, y: 4 }, power * 1.6);
      blast(fx, { ...at, y: 2 }, kind === "battery" ? 0.6 : 0.45);
      if (kind === "battery") fx.after(0.5, () => blast(fx, { x: at.x + 6, z: at.z, y: 1 }, 0.35));
      burning(fx, at, 18, kind === "railyard" ? 0.7 : 0.4);
    },
  },
  field: { drawRiver, drawBridge, drawLorry: drawLorrySide, drawTeam },
};
