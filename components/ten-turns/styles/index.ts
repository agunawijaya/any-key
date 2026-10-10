import type { StyleFactory, StyleId } from "./style";
import { StorybookStyle } from "./storybook/StorybookStyle";

/*
 * Every style the player can choose in Settings. The three marked coming
 * arrive with prompt 10c; until then they show in the list, greyed out.
 */

export type StyleEntry = { id: StyleId; name: string; blurb: string; create: StyleFactory | null };

export const STYLES: StyleEntry[] = [
  { id: "storybook", name: "Spooky Storybook", blurb: "A picture book come alive: a meadow, a moonlit pit, a very fluffy menace.", create: (ctx, fonts) => new StorybookStyle(ctx, fonts) },
  { id: "arena", name: "Gladiator Arena", blurb: "Coming soon.", create: null },
  { id: "graph-paper", name: "1970s Graph Paper", blurb: "Coming soon.", create: null },
  { id: "lab", name: "Sci-Fi Lab", blurb: "Coming soon.", create: null },
];

/** The chosen style if it is ready, otherwise the Storybook. */
export function styleEntry(id: StyleId): StyleEntry & { create: StyleFactory } {
  const entry = STYLES.find((s) => s.id === id && s.create) ?? STYLES[0];
  return entry as StyleEntry & { create: StyleFactory };
}
