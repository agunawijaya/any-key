import type { HairStyle, Look, Outfit } from "./figure";
import { seededRandom } from "./paint";

/*
 * Casting the faces: every player gets a look from a seeded draw, so the
 * same tune and style always seat the same people, and a section of three
 * doesn't look like triplets.
 */

export const SKINS = ["#f4d3bd", "#eabf9f", "#e0a97f", "#c98d63", "#a96e48", "#8a5638", "#6b402a", "#4e2e20"];
const HAIRS = ["#16110f", "#2b1a17", "#3d2a20", "#5a3a26", "#8a5a33", "#b07a3e", "#d9b26a", "#6a6670", "#c9c4c8"];

export type Wardrobe = {
  outfits: Outfit[];
  tops: string[];
  trims: string[];
  bottoms: string[];
  shoes: string[];
  hair?: HairStyle[];
  /** Skin tones to draw from, when a band comes from one place. */
  skins?: string[];
  /** Hair colours to draw from. */
  hairs?: string[];
  skirtChance?: number;
  shortSleeves?: number;
  glasses?: number;
  beard?: number;
};

/** Concert dress: black, white at the collar, a gown now and then. */
export const CONCERT: Wardrobe = {
  outfits: ["suit", "suit", "gown", "jacket"],
  tops: ["#1c1922", "#211d27", "#18161d"],
  trims: ["#f6f1e8", "#efe8dc"],
  bottoms: ["#1c1922", "#18161d"],
  shoes: ["#0f0d12"],
  hair: ["short", "crop", "bun", "bob", "ponytail", "waves", "curly", "bald"],
  skirtChance: 0.5,
  glasses: 0.2,
  beard: 0.15,
};

export function castLook(seed: number, wardrobe: Wardrobe, overrides: Partial<Look> = {}): Look {
  const r = seededRandom(seed);
  const pick = <T>(list: T[]) => list[Math.floor(r() * list.length) % list.length];
  const outfit = pick(wardrobe.outfits);
  const hairStyle = pick<HairStyle>(wardrobe.hair ?? ["short", "bob", "curly", "bun"]);
  const gown = outfit === "gown";
  const look: Look = {
    skin: pick(wardrobe.skins ?? SKINS),
    hair: hairStyle === "bald" ? "#000000" : pick(wardrobe.hairs ?? HAIRS.slice(0, r() < 0.15 ? HAIRS.length : 6)),
    hairStyle: gown && hairStyle === "bald" ? "bun" : hairStyle,
    outfit,
    top: pick(wardrobe.tops),
    trim: pick(wardrobe.trims),
    bottom: pick(wardrobe.bottoms),
    shoes: pick(wardrobe.shoes),
    skirt: gown || r() < (wardrobe.skirtChance ?? 0) * 0.3,
    shortSleeves: r() < (wardrobe.shortSleeves ?? 0),
    glasses: r() < (wardrobe.glasses ?? 0),
    beard: !gown && r() < (wardrobe.beard ?? 0),
    build: 0.92 + r() * 0.16,
    height: 0.96 + r() * 0.08,
  };
  if (look.hairStyle === "bald") look.hair = look.skin;
  if (gown) look.bottom = look.top;
  return { ...look, ...overrides };
}
