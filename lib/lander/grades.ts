/*
 * How a flight ends. The speed bands follow the 1979 program's ladder
 * (under 2, under 5, under 20 km/h to survive, then ever bigger holes, and a
 * joke at 5000 and above); the words are ours, and nobody gets hurt.
 */

export type GradeId = "butter" | "smooth" | "bumpy" | "tipped" | "splash" | "dented" | "scrap" | "confetti" | "crater" | "oil" | "lost";

export type Grade = {
  id: GradeId;
  title: string;
  line: (world: string) => string;
  landed: boolean;
  stars: 0 | 1 | 2 | 3;
  /** A landing gentle enough to climb out and plant your flag. */
  flag: boolean;
  /** For share texts only (pasted into chats); the page draws its own icon. */
  shareGlyph: string;
};

export const GRADES: Record<GradeId, Grade> = {
  butter: { id: "butter", title: "Butter.", line: () => "So soft the dust barely noticed.", landed: true, stars: 3, flag: true, shareGlyph: "🧈" },
  smooth: { id: "smooth", title: "Smooth.", line: () => "Textbook touchdown. Out you get: plant that flag.", landed: true, stars: 2, flag: true, shareGlyph: "🟩" },
  bumpy: { id: "bumpy", title: "Bumpy.", line: () => "Down in one piece. Mostly.", landed: true, stars: 1, flag: false, shareGlyph: "🟨" },
  // Free Flight only: down gently, but on a slope, leaning, sliding, or in the sea.
  tipped: { id: "tipped", title: "Tipped.", line: () => "Down gently, then over it went. The astronaut climbs out and shrugs.", landed: false, stars: 0, flag: false, shareGlyph: "🙃" },
  splash: { id: "splash", title: "Splash.", line: () => "It floats! Mostly. Someone is sending a boat.", landed: false, stars: 0, flag: false, shareGlyph: "💦" },
  dented: { id: "dented", title: "Dented.", line: () => "You walked away. The lander won't be flying again.", landed: false, stars: 0, flag: false, shareGlyph: "🟧" },
  scrap: { id: "scrap", title: "Scrap.", line: () => "The pilot ejected just in time. The lander is modern art now.", landed: false, stars: 0, flag: false, shareGlyph: "💥" },
  confetti: { id: "confetti", title: "Confetti.", line: () => "The lander is now spread evenly across the landscape.", landed: false, stars: 0, flag: false, shareGlyph: "🎊" },
  crater: { id: "crater", title: "New crater.", line: () => "Relax, the pilot bailed out long ago. The hole will be named after you.", landed: false, stars: 0, flag: false, shareGlyph: "🕳️" },
  oil: { id: "oil", title: "You struck oil.", line: (world) => `…on ${world === "Earth" ? "the sea floor" : world === "Moon" ? "the Moon" : world}. Geologists have questions.`, landed: false, stars: 0, flag: false, shareGlyph: "🛢️" },
  lost: { id: "lost", title: "Lost in space.", line: () => "Up is also a direction. Just not the useful one.", landed: false, stars: 0, flag: false, shareGlyph: "🛸" },
};

export function gradeFor(speed: number): GradeId {
  const v = Math.abs(speed);
  if (v < 2) return "butter";
  if (v < 5) return "smooth";
  if (v < 20) return "bumpy";
  if (v < 45) return "dented";
  if (v < 100) return "scrap";
  if (v < 250) return "confetti";
  if (v < 5000) return "crater";
  return "oil";
}
