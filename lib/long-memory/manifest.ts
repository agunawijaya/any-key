import type { GameManifest } from "@/lib/kit/manifest";

export const longMemoryManifest: GameManifest = {
  id: "long-memory",
  title: "Same Trick Twice",
  status: "playable",
  route: "/long-memory",
  kind: "Strategy board game",
  category: "strategy",
  players: "1–2",
  sessionMinutes: [5, 10],
  tagline: "Beat it once. It remembers.",
  blurb:
    "A seed-sowing game as old as history, against an opponent that studies every loss. Win with a clever line and watch it learn; then play traditional Oware and Kalah, or crack today's endgame puzzle.",
  inspiredBy: { originalTitle: "Awari", file: "AWARI.BAS", author: "Geoff Wyvill", publisher: "Creative Computing", year: 1978 },
  palette: ["#b5652d", "#2c2a4a", "#e9c98f"],
  accent: "#b5652d",
  // Two rows of pits with a seed arcing from one to the next.
  emblem:
    "M4 15.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5.3 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5.4 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5.3 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM4 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm16 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM5.2 7.6C7.6 4.4 10 3.2 12.4 3.6c2 .3 3.6 1.6 4.8 3.4l.9-.6-.2 2.6-2.4-1 .8-.5c-1-1.4-2.3-2.4-4-2.6-2-.3-4 .7-6.1 3.4z",
  stats: [
    { value: "36", label: "seeds" },
    { value: "3", label: "rule sets" },
    { value: "1", label: "long memory" },
  ],
  modes: ["Play", "Daily Endgame", "1970s mode"],
  moonsName: "rule sets",
  moons: ["1978 Awari", "Oware", "Kalah"],
  trivia: [
    "The 1978 computer remembered each game it failed to win as one number: the first eight moves, written in base 6.",
    "Its table had room for 51 lessons. After the 51st game it failed to win, the next game never started: the program stopped with an error.",
    "Before weighing each move it meant to clear a running score, but cleared a different variable. Its judgement drifts with whatever it last thought.",
    "The program is older than the 1978 book: Geoff Wyvill of Bradford University wrote it, and it was already in Digital Equipment's 101 BASIC Computer Games.",
    "Oware was worked out completely by computer in 2002: with perfect play on both sides, it is a draw.",
  ],
  // Daily Endgame #1 is the day the game was built.
  daily: { epoch: "2026-10-09" },
  achievements: [
    { id: "first-harvest", title: "First Harvest", hint: "Win a game against the Learner or the Scholar, any rules", tier: "common" },
    { id: "taught-it", title: "Taught It Something", hint: "Beat the Learner", tier: "common" },
    { id: "it-remembers", title: "It Remembers", hint: "Watch the Learner turn away from a move it once lost with", tier: "common" },
    { id: "encore", title: "Encore", hint: "Beat the Learner twice with the very same opening", tier: "legendary" },
    { id: "fifty-lessons", title: "Fifty Lessons", hint: "Fill the Learner's book with fifty lessons", tier: "rare" },
    { id: "grand-haul", title: "Grand Haul", hint: "In Oware, capture from three or more pits in one move", tier: "rare" },
    { id: "chain-reaction", title: "Chain Reaction", hint: "In Kalah, earn three extra turns in a row", tier: "rare" },
    { id: "scholars-bane", title: "Scholar's Bane", hint: "Beat the Scholar on Hard", tier: "legendary" },
    { id: "daily-sower", title: "Daily Sower", hint: "Solve seven Daily Endgames", tier: "rare" },
    { id: "clean-slate", title: "Clean Slate", hint: "Wipe the Learner's book", tier: "common" },
    { id: "subscript", title: "Subscript", hint: "Something about running out of pages, the 1978 way", tier: "common", secret: true },
  ],
};
