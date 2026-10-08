import type { GameManifest } from "@/lib/kit/manifest";

/**
 * A placeholder until the game's own prompt builds it and gives it a real
 * title. The Hall shows a neutral "in design" card; nothing links to the route.
 */
export const desertManifest: GameManifest = {
  id: "desert",
  title: "Desert (in design)",
  status: "coming-soon",
  route: "/desert",
  kind: "In design",
  category: "adventure",
  players: "1",
  sessionMinutes: [5, 10],
  tagline: "Forty miles of sand, being drawn right now.",
  blurb: "A 1982 trek across the desert is on the drawing board. It joins the Hall when it is ready to play.",
  inspiredBy: { originalTitle: "Desert", file: "DESERT.BAS", publisher: "IPCO Personal Computer Owners Group", year: 1982 },
  palette: ["#c9b38a", "#8a7a63", "#efe5cf"],
  accent: "#b89a68",
  // A sun over two dunes.
  emblem: "M14.5 7a3 3 0 1 0 6 0 3 3 0 1 0-6 0zM2 18.2c2.6-3.4 5.6-4.4 8.6-2.6 2.2 1.3 4 1.2 6-.6 1.8-1.6 3.6-1.5 5.4 0V21H2z",
  stats: [],
  modes: [],
  moons: [],
  moonsName: "",
  trivia: [],
  achievements: [],
};
