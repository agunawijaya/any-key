import type { GameManifest } from "@/lib/kit/manifest";

export const tenTurnsManifest: GameManifest = {
  id: "ten-turns",
  title: "Ten Turns in the Pit",
  status: "playable",
  route: "/ten-turns",
  kind: "Tactics chase",
  category: "strategy",
  players: "1",
  sessionMinutes: [2, 8],
  tagline: "It's fluffy. It's hungry. It's faster than you.",
  blurb:
    "You, a round pit and one very hungry rabbit. Read its pounces, use burrows, carrots and stones, and last ten turns: as the 1970s game put right, or a campaign of twenty pits.",
  inspiredBy: { originalTitle: "Man-Eating Rabbit", file: "RABBIT.BAS", author: "Philip Stanway", publisher: "Creative Computing", year: 1979 },
  palette: ["#c4572e", "#23324a", "#f1d9a6"],
  accent: "#c4572e",
  // Two rabbit ears over a round pit.
  emblem:
    "M8.6 2.2c1.3-.3 2.2 1.6 2.4 4.6.1 1.2.1 2.3 0 3.2h-2C8.4 8.7 7.9 7.2 7.6 5.7c-.4-1.9-.1-3.3 1-3.5zm6.8 0c1.1.2 1.4 1.6 1 3.5-.3 1.5-.8 3-1.4 4.3h-2c-.1-.9-.1-2 0-3.2.2-3 1.1-4.9 2.4-4.6zM12 11c5 0 9 2.2 9 5s-4 5-9 5-9-2.2-9-5 4-5 9-5zm0 2.2c-3.6 0-6.5 1.3-6.5 2.8s2.9 2.8 6.5 2.8 6.5-1.3 6.5-2.8-2.9-2.8-6.5-2.8z",
  stats: [
    { value: "10", label: "turns" },
    { value: "8", label: "directions" },
    { value: "10", label: "pit radius" },
  ],
  modes: ["Classic", "Tactics", "Daily Pit", "1970s mode"],
  moonsName: "styles",
  moons: ["Spooky Storybook", "Gladiator Arena (coming)", "1970s Graph Paper (coming)", "Sci-Fi Lab (coming)"],
  trivia: [
    "A slip on one line of the 1970s program drags you towards the middle every time you run: afterwards your north-south position is always 0, 1 or 2.",
    "Stand straight north of the 1970s rabbit and it skips its move. Using that, perfect play survives the original 87% of the time.",
    "The original never checked for a landing in its last turn: the rabbit could be sitting on you and you were still released.",
    "Each extra pounce comes with a chance of 1 in 2, then 1 in 3, then 1 in 4, so the rabbit pounces e minus 1, about 1.72 times, a turn.",
    "Fix every bug in the 1970s game and even perfect play survives a blind drop only a third of the time.",
  ],
  // Daily Pit #1 is the day the game was built.
  daily: { epoch: "2026-10-10" },
  achievements: [
    { id: "ten-turns", title: "Ten Turns", hint: "Survive ten turns and climb out", tier: "common" },
    { id: "squish", title: "Squish", hint: "Land right on the rabbit when you're dropped in", tier: "rare" },
    { id: "untouched", title: "Not a Hair Out of Place", hint: "Survive a Tactics pit with your hat still on", tier: "common" },
    { id: "bonk", title: "Bonk!", hint: "Make a rabbit bonk into a stone you set down", tier: "common" },
    { id: "burrow-hopper", title: "Burrow Hopper", hint: "Go down one end of a tunnel and come up the other", tier: "common" },
    { id: "carrot-diplomat", title: "Carrot Diplomat", hint: "Have rabbits eat three of your carrots", tier: "rare" },
    { id: "pounce-counter", title: "Pounce Counter", hint: "See a rabbit pounce four times in one turn", tier: "rare" },
    { id: "double-trouble", title: "Double Trouble", hint: "Survive a pit with two rabbits in it", tier: "rare" },
    { id: "daily-survivor", title: "Daily Survivor", hint: "Survive seven Daily Pits", tier: "rare" },
    { id: "full-marks", title: "Full Marks", hint: "Earn all three medals in every pit of a chapter", tier: "legendary" },
    { id: "the-big-one", title: "The Big One", hint: "Survive the campaign's last pit", tier: "legendary" },
    { id: "middle-row", title: "Middle Row", hint: "The 1970s way out runs along the middle", tier: "rare", secret: true },
    { id: "turn-ten-miracle", title: "Turn Ten Miracle", hint: "Something the 1970s forgot to check", tier: "rare", secret: true },
  ],
};
