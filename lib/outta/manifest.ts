import { COLLECTION_EPOCH } from "@/lib/kit/daily";
import type { GameManifest } from "@/lib/kit/manifest";

export const outtaManifest: GameManifest = {
  id: "escape",
  title: "Outta Here",
  status: "playable",
  route: "/outta-here",
  kind: "Escape game",
  category: "action",
  players: "1–2",
  sessionMinutes: [1, 20],
  tagline: "The walls grow while you hesitate.",
  blurb:
    "A tiny 1980 TRS-80 game about an asterisk trying to reach the exit, rebuilt with wood to push, glass to bomb, three chasers, thirty screens on five old computers and a daily escape.",
  inspiredBy: { originalTitle: "Escape", file: "ESCAPE.BAS", publisher: "Unknown author", year: 1980, circa: true },
  palette: ["#ff6b4a", "#2ef2a0", "#151b3d"],
  accent: "#25d98f",
  // The asterisk, heading for the way out.
  emblem:
    "M7.8 6h2.4v12H7.8zM13.6 7.96l1.2 2.08-10.4 6-1.2-2.08zM14.8 13.96l-1.2 2.08-10.4-6 1.2-2.08zM16.6 6.4 22 12l-5.4 5.6-1.7-1.6 3.8-4-3.8-4z",
  stats: [
    { value: "30", label: "screens" },
    { value: "3", label: "chasers" },
    { value: "12", label: "badges" },
  ],
  modes: ["Run", "Screens", "Daily Escape", "Versus", "1980 mode", "Chill", "Normal", "Hard"],
  moonsName: "computers",
  moons: ["Green Screen", "Amber Terminal", "Home Micro", "Pocket LCD", "The Last Machine"],
  trivia: [
    "The 1980 program never says you won. Reach the exit and it simply stops at BASIC's READY prompt.",
    "Its check for the top of the screen can never be true, so you can walk up into the keyboard's memory and vanish.",
    "Step down from the bottom-left corner and the star is written over the computer's own memory. It almost certainly crashed.",
    "Blocks only fall while no key is down, so the faster you press keys, the fewer blocks fall.",
  ],
  daily: { epoch: COLLECTION_EPOCH },
  achievements: [
    { id: "scape", title: "*SCAPE", hint: "Get out in 1980 mode", tier: "common" },
    { id: "under-keys", title: "Under the Keys", hint: "Hide under the keyboard", tier: "common" },
    { id: "wraparound", title: "Wraparound", hint: "Take an edge tunnel", tier: "common" },
    { id: "chain-reaction", title: "Chain Reaction", hint: "Break 15 glass blocks with one chain bomb", tier: "rare" },
    { id: "rush-hour", title: "Rush Hour", hint: "Pick up a Chain Rush", tier: "common" },
    { id: "spelled-it", title: "Spelled It", hint: "Collect E-S-C-A-P-E in one run", tier: "rare" },
    { id: "no-hesitation", title: "No Hesitation", hint: "Get out on Normal or Hard with the meter never past half", tier: "rare" },
    { id: "untouched", title: "Untouched", hint: "Get out on Hard without a single hit", tier: "legendary" },
    { id: "pop", title: "Pop!", hint: "Pop a chaser with a bomb", tier: "common" },
    { id: "crash-test", title: "Crash Test", hint: "Crash the computer in 1980 mode", tier: "common", secret: true },
    { id: "daily-driver", title: "Daily Driver", hint: "Get out of five Daily Escapes", tier: "rare" },
    { id: "out-of-the-machine", title: "Out of the Machine", hint: "Clear all thirty Screens", tier: "legendary" },
  ],
};
