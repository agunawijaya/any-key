import type { GameManifest } from "@/lib/kit/manifest";

export const solYSombraManifest: GameManifest = {
  id: "sol-y-sombra",
  title: "Sol y Sombra",
  status: "playable",
  route: "/sol-y-sombra",
  kind: "Cape and courage",
  category: "action",
  players: "1",
  sessionMinutes: [3, 10],
  tagline: "One cape. One charge. Hold still.",
  blurb:
    "Stand in the ring with a red cape and half a tonne of bull coming at you. Choose how close to let it pass, read the crowd, and earn your place on the poster.",
  inspiredBy: {
    originalTitle: "Bull",
    file: "BULLFGHT.BAS",
    publisher: "Creative Computing",
    year: 1978,
  },
  palette: ["#c8202e", "#2e4a7d", "#e8a93a"],
  accent: "#c8202e",
  // Two horns over the sweep of a cape.
  emblem:
    "M2.5 6.5c1.4 2.6 3.9 4 6.6 3.9L12 12.2l2.9-1.8c2.7.1 5.2-1.3 6.6-3.9-.3 3.6-2.9 6-6.3 6.5L12 15.3 8.8 13C5.4 12.5 2.8 10.1 2.5 6.5zM3.5 19.6c3.3-.3 6.2-1.8 8.5-4.2 2.3 2.4 5.2 3.9 8.5 4.2-2.6 1.3-5.5 1.9-8.5 1.9s-5.9-.6-8.5-1.9z",
  stats: [
    { value: "3", label: "cape moves" },
    { value: "3", label: "traditions" },
    { value: "1", label: "moment of truth" },
  ],
  modes: ["Classic", "1970s mode"],
  moonsName: "traditions",
  moons: ["Corrida", "Course Camarguaise (coming)", "Recortes (coming)"],
  trivia: [
    "The 1978 program promised that good assistants improve your chances. Its arithmetic did the opposite: a superb crew made a fair bull's first veronica five times more likely to gore you than an awful one.",
    "It asked whether you'd kill over the horns or in the chest, then treated both answers exactly alike: the test that would have told them apart reads a variable nothing ever sets.",
    "Its crowd rolled the dice three times, once for each step of the award, which pulled every afternoon towards the middle.",
    "A matador who didn't survive the goring still received the crowd's award: in 1,863 simulated fatal gorings, every one.",
    "Your helpers' ratings were drawn from the bull's: the most dangerous bulls usually came with the best crews.",
    "With no random seed, every run on a freshly loaded computer dealt exactly the same afternoon.",
  ],
  achievements: [
    { id: "first-paseo", title: "First Paseo", hint: "See an afternoon through to the crowd's verdict", tier: "common" },
    { id: "seven-passes", title: "Seven Passes", hint: "Make seven passes before the moment of truth", tier: "common" },
    { id: "close-call", title: "Close Call", hint: "Let the horns brush the suit and come through it", tier: "common" },
    { id: "back-on-your-feet", title: "Back on Your Feet", hint: "Get up after a goring and carry on", tier: "rare" },
    { id: "all-veronicas", title: "All Veronicas", hint: "Five passes or more, every one a veronica, and a finish", tier: "rare" },
    { id: "lap-of-honour", title: "Lap of Honour", hint: "Have the crowd call you round the ring", tier: "rare" },
    { id: "on-their-shoulders", title: "On Their Shoulders", hint: "Leave through the great gate, carried", tier: "legendary" },
    { id: "the-inversion", title: "The Inversion", hint: "Something the 1978 instructions got backwards", tier: "rare", secret: true },
  ],
};
