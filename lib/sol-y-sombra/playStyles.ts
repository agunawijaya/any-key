/*
 * Play styles decide how the player acts, not what the rules are:
 * Classic picks a card each pass and watches it play out; Arena (11b) is
 * real time, the pass's risk set by the player's timing and distance; Career
 * (11c) strings corridas into a season. Each keeps its own records.
 *
 * A style hands the engine a move and, for Arena, a timing quality; the
 * engine's odds take it as a multiplier (1 in Classic), so the same rules
 * serve all three.
 */

export type PlayStyleId = "classic" | "arena" | "career";

export type PlayStyle = {
  id: PlayStyleId;
  name: string;
  line: string;
  available: boolean;
  /** How a pass is chosen: a card, or the player's own timing in real time. */
  input: "cards" | "timing";
};

export const PLAY_STYLES: Record<PlayStyleId, PlayStyle> = {
  classic: { id: "classic", name: "Classic", line: "Choose each pass from the cards and watch it unfold.", available: true, input: "cards" },
  arena: { id: "arena", name: "Arena", line: "Hold the cape yourself: timing and nerve decide the pass.", available: false, input: "timing" },
  career: { id: "career", name: "Career", line: "A season of afternoons, from village rings to the great plaza.", available: false, input: "cards" },
};

export const PLAY_STYLE_LIST: PlayStyleId[] = ["classic", "arena", "career"];
