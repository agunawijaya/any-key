/*
 * Your flag. The 1979 program hid a little flag-planting scene behind its
 * gentlest landings; here the flag is yours to design. One SVG builder feeds
 * both the page (inline SVG) and the canvas (drawn as an image and waved).
 */

import { readableOn } from "@/lib/kit/color";
import { EMBLEMS, emblemById, type EmblemId } from "./emblems";

export type FlagShape = "rect" | "swallow" | "pennant";
export type FlagPattern = "solid" | "stripes" | "bars" | "diagonal" | "cross" | "chevron" | "dots" | "canton";

export type FlagDesign = {
  shape: FlagShape;
  pattern: FlagPattern;
  colors: [string, string, string];
  /** An emblem id (see emblems.ts); "" for none. */
  emblem: EmblemId;
};

export const FLAG_SHAPES: { id: FlagShape; name: string }[] = [
  { id: "rect", name: "Classic" },
  { id: "swallow", name: "Swallowtail" },
  { id: "pennant", name: "Pennant" },
];

export const FLAG_PATTERNS: { id: FlagPattern; name: string }[] = [
  { id: "solid", name: "Solid" },
  { id: "stripes", name: "Stripes" },
  { id: "bars", name: "Bars" },
  { id: "diagonal", name: "Diagonal" },
  { id: "cross", name: "Cross" },
  { id: "chevron", name: "Chevron" },
  { id: "dots", name: "Dots" },
  { id: "canton", name: "Canton" },
];

export const FLAG_COLORS = ["#ff4f9a", "#ff6b1a", "#ffd23d", "#c9f73a", "#1fbf6f", "#13c2e3", "#3a5bff", "#6a48ff", "#16131f", "#ffffff", "#d7263d", "#8a5a3c"];

export const DEFAULT_FLAG: FlagDesign = { shape: "rect", pattern: "canton", colors: ["#6a48ff", "#ffffff", "#ffd23d"], emblem: "star" };

export function randomFlag(unlocked: string[], rng = Math.random): FlagDesign {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const colors = [...FLAG_COLORS].sort(() => rng() - 0.5).slice(0, 3) as [string, string, string];
  const emblems = EMBLEMS.filter((e) => !e.unlock || unlocked.includes(e.unlock));
  return { shape: pick(FLAG_SHAPES).id, pattern: pick(FLAG_PATTERNS).id, colors, emblem: pick(emblems).id };
}

const W = 90;
const H = 60;

function outline(shape: FlagShape) {
  if (shape === "swallow") return `M0 0H${W}L${W * 0.72} ${H / 2}L${W} ${H}H0Z`;
  if (shape === "pennant") return `M0 0L${W} ${H / 2}L0 ${H}Z`;
  return `M0 0H${W}V${H}H0Z`;
}

function pattern(p: FlagPattern, [a, b, c]: [string, string, string]) {
  switch (p) {
    case "stripes":
      return `<rect width="${W}" height="${H}" fill="${a}"/><rect y="${H / 3}" width="${W}" height="${H / 3}" fill="${b}"/><rect y="${(2 * H) / 3}" width="${W}" height="${H / 3}" fill="${c}"/>`;
    case "bars":
      return `<rect width="${W}" height="${H}" fill="${c}"/><rect width="${W / 3}" height="${H}" fill="${a}"/><rect x="${W / 3}" width="${W / 3}" height="${H}" fill="${b}"/>`;
    case "diagonal":
      return `<rect width="${W}" height="${H}" fill="${a}"/><path d="M0 ${H}L${W} 0V${H}Z" fill="${b}"/><path d="M0 ${H - 7}L${W - 11} 0H${W}L0 ${H}Z" fill="${c}"/>`;
    case "cross":
      return `<rect width="${W}" height="${H}" fill="${a}"/><rect x="${W * 0.3}" width="${H * 0.2}" height="${H}" fill="${b}"/><rect y="${H * 0.4}" width="${W}" height="${H * 0.2}" fill="${b}"/><rect x="${W * 0.3 + H * 0.05}" width="${H * 0.1}" height="${H}" fill="${c}"/><rect y="${H * 0.45}" width="${W}" height="${H * 0.1}" fill="${c}"/>`;
    case "chevron":
      return `<rect width="${W}" height="${H}" fill="${a}"/><path d="M0 0L${W * 0.45} ${H / 2}L0 ${H}Z" fill="${b}"/><path d="M0 ${H * 0.18}L${W * 0.3} ${H / 2}L0 ${H * 0.82}Z" fill="${c}"/>`;
    case "dots": {
      let dots = "";
      for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) dots += `<circle cx="${x * 16 + (y % 2 ? 13 : 5)}" cy="${y * 16 + 6}" r="3.4" fill="${(x + y) % 3 ? b : c}"/>`;
      return `<rect width="${W}" height="${H}" fill="${a}"/>${dots}`;
    }
    case "canton":
      return `<rect width="${W}" height="${H}" fill="${a}"/><rect x="${W * 0.45}" y="${H * 0.18}" width="${W * 0.55}" height="${H * 0.12}" fill="${b}"/><rect x="${W * 0.45}" y="${H * 0.44}" width="${W * 0.55}" height="${H * 0.12}" fill="${b}"/><rect x="${W * 0.45}" y="${H * 0.7}" width="${W * 0.55}" height="${H * 0.12}" fill="${b}"/><rect width="${W * 0.45}" height="${H}" fill="${c}"/>`;
    default:
      return `<rect width="${W}" height="${H}" fill="${a}"/>`;
  }
}

/** The flag as a standalone SVG document (90 × 60 units). */
export function flagSvg(design: FlagDesign, id = "f") {
  const clip = `clip-${id}`;
  const emblemX = design.shape === "pennant" ? W * 0.3 : design.pattern === "canton" ? W * 0.225 : W / 2;
  const size = design.shape === "pennant" ? 22 : 30;
  const glyph = emblemById(design.emblem);
  // The emblem sits on the canton when there is one, otherwise on the main colour: pick an ink that reads on it.
  const under = design.pattern === "canton" ? design.colors[2] : design.colors[0];
  const emblem = glyph.path
    ? `<path transform="translate(${emblemX - size / 2} ${H / 2 - size / 2}) scale(${size / 24})" d="${glyph.path}" fill="${readableOn(under, "#ffffff", "#16131f")}" fill-rule="evenodd" stroke="rgba(0,0,0,0.22)" stroke-width="0.6" stroke-linejoin="round"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}"><defs><clipPath id="${clip}"><path d="${outline(design.shape)}"/></clipPath></defs><g clip-path="url(#${clip})">${pattern(design.pattern, design.colors)}${emblem}</g><path d="${outline(design.shape)}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"/></svg>`;
}

export const FLAG_ASPECT = H / W;
