import { COLLECTION_EPOCH } from "@/lib/kit/daily";
import type { GameManifest } from "@/lib/kit/manifest";

export const sticklerManifest: GameManifest = {
  id: "23mtch",
  title: "Stickler",
  status: "playable",
  route: "/stickler",
  kind: "Mind game",
  category: "strategy",
  players: "1–2",
  sessionMinutes: [2, 15],
  tagline: "Take 1, 2 or 3. Never the last one.",
  blurb:
    "A 1970s mind game with a secret number, rebuilt with a sore-loser opponent called Sparky, a ten-table ladder, a daily puzzle and three stick styles.",
  inspiredBy: { originalTitle: "23 Matches", file: "23MTCH.BAS", author: "Bob Albrecht", publisher: "People's Computer Company", year: 1973 },
  palette: ["#ff8a1f", "#d7263d", "#ffd23d"],
  accent: "#e5383b",
  // Two matches standing, the third one lit.
  emblem:
    "M4.6 9.6h2.2V21H4.6zM3.3 7.4a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0zM10.9 9.6h2.2V21h-2.2zM9.6 7.4a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0zM17.2 10.4h2.2V21h-2.2zM18.3 1.2c2.1 2.3 3.1 4.2 3.1 5.9a3.1 3.1 0 0 1-6.2 0c0-1.7 1-3.6 3.1-5.9z",
  stats: [
    { value: "23", label: "sticks" },
    { value: "6", label: "modes" },
    { value: "14", label: "badges" },
  ],
  modes: ["Classic 23", "Handfuls", "Ladder", "Daily", "Versus", "1981 mode", "Matches", "Glow sticks", "Candy sticks"],
  moonsName: "ladder tables",
  moons: ["Warm-up", "Getting warmer", "The Classic", "Sparky starts", "Take up to four", "Take up to five", "Bonfire", "Two rows", "Three rows", "Marienbad"],
  trivia: [
    "Whoever moves first from 23 can always win. The 1973 program let you go first anyway.",
    "The original's “random” move used RND(0), which on a PC never changes. When losing, the computer always took exactly 1.",
    "Type 4 into the original and it called you a cheater. Sparky is just as strict.",
    "The credits in the original file misspell the author's name as ALBRECHR.",
  ],
  daily: { epoch: COLLECTION_EPOCH },
  achievements: [
    { id: "first-light", title: "First Light", hint: "Win your first game", tier: "common" },
    { id: "stickler", title: "Rule Bender", hint: "Try to take more (or fewer) than the rules allow", tier: "common", secret: true },
    { id: "secret-four", title: "The Secret Four", hint: "Beat Master Sparky in Classic without a hint", tier: "legendary" },
    { id: "flawless", title: "Flawless", hint: "Win a game where every move was perfect", tier: "rare" },
    { id: "hot-streak", title: "Hot Streak", hint: "Win three games in a row", tier: "rare" },
    { id: "climber", title: "Climber", hint: "Clear five Ladder tables", tier: "common" },
    { id: "summit", title: "Summit", hint: "Clear all ten Ladder tables", tier: "legendary" },
    { id: "marienbad", title: "Last Year at Marienbad", hint: "Beat the 1-3-5-7 table", tier: "rare" },
    { id: "daily-3", title: "Daily Habit", hint: "Win three Daily puzzles", tier: "common" },
    { id: "time-traveller", title: "Time Traveller", hint: "Win in 1981 mode", tier: "common" },
    { id: "rivals", title: "Rivals", hint: "Finish a Versus game", tier: "common" },
    { id: "collector", title: "Collector", hint: "Play with all three stick styles", tier: "common" },
    { id: "clean-sweep", title: "Clean Sweep", hint: "Make Sparky sweep 3 or more sticks in Handfuls", tier: "rare" },
    { id: "handful-master", title: "Handful Master", hint: "Beat Master Sparky on every Handfuls preset", tier: "legendary" },
  ],
};
