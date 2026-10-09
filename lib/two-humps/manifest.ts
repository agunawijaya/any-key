import type { GameManifest } from "@/lib/kit/manifest";

export const twoHumpsManifest: GameManifest = {
  id: "two-humps",
  title: "Two Humps",
  status: "playable",
  route: "/two-humps",
  kind: "Survival trek",
  category: "adventure",
  players: "1",
  sessionMinutes: [5, 30],
  tagline: "Forty miles. Two humps. Don't stop now.",
  blurb:
    "Cross the real Gobi on a camel with a mind of its own. Outrun a wall of sand, race a rival caravan, or slip past a gang of jerboas who have heard that camel soup is delicious.",
  inspiredBy: { originalTitle: "Desert", file: "DESERT.BAS", publisher: "IPCO", year: 1982 },
  palette: ["#d9822b", "#272a63", "#f3d28c"],
  accent: "#d08a2c",
  // A Bactrian camel side on: two humps, a long neck, four legs.
  emblem:
    "M2.6 13.6c.2-2.3 1.6-3.8 3.4-3.8 1.4 0 1.9-2.6 3.5-2.6 1.5 0 1.8 2.5 2.8 2.5s1.4-2.5 3-2.5c1.7 0 2.1 2.6 2.7 3.8l1.6-3.2c.4-.8 1.3-1.1 2-.6l.9.6c.5.3.3 1.1-.3 1.1h-.8l-1.7 4.6c-.4 1-1.1 1.6-1.9 1.8V21h-1.5l-.4-5h-7l-.4 5H7.1v-5.2c-.8-.3-1.4-.9-1.7-1.6l-.8 1.9-.9-.4z",
  stats: [
    { value: "40", label: "miles" },
    { value: "3", label: "pursuers" },
    { value: "5", label: "Gobi places" },
  ],
  modes: ["Crossing", "Expedition", "Daily Crossing", "1982 mode"],
  moonsName: "Gobi places",
  moons: ["Khermen Tsav", "Khongoryn Els", "Bayanzag", "Yolyn Am", "Ger camp"],
  trivia: [
    "In the 1982 program the camel sometimes kept going by itself: a jump back to the last command, made from inside a subroutine. It cost the camel strength and never added a mile.",
    "Asking for your status in 1982 quietly cost you a drink: the status lines ran straight on into the drinking code.",
    "A Bactrian camel's humps hold fat, not water. They flop over when the camel has used its reserves.",
    "Five-toed pygmy jerboas really live in the Gobi, hop on their hind legs and eat seeds. The real ones have small ears; ours borrowed theirs from a neighbour.",
  ],
  // Daily Crossing #1 is the day the game was built.
  daily: { epoch: "2026-10-09" },
  achievements: [
    { id: "first-forty", title: "First Forty", hint: "Cross the forty miles for the first time", tier: "common" },
    { id: "no-gallop", title: "Forty Without a Gallop", hint: "Win a crossing without galloping once", tier: "rare" },
    { id: "let-it-run", title: "Let It Run", hint: "Let the camel run on for five strides in one go", tier: "rare" },
    { id: "one-to-spare", title: "One to Spare", hint: "Pull the reins with a single hump of strength left", tier: "common" },
    { id: "last-sip", title: "Last Sip", hint: "Arrive with an empty canteen", tier: "rare" },
    { id: "under-their-noses", title: "Under Their Noses", hint: "Sleep through a night with the Ladle Gang about, and wake up free", tier: "rare" },
    { id: "oasis-thief", title: "Oasis Thief", hint: "Reach three oases before the rival does, in one crossing", tier: "rare" },
    { id: "storm-runner", title: "Storm Runner", hint: "Outrun the Haboob on Hard", tier: "legendary" },
    { id: "seedless", title: "Seedless", hint: "Beat the Ladle Gang without tossing a single seed", tier: "rare" },
    { id: "fossil-hunter", title: "Fossil Hunter", hint: "Find all three fossils at Bayanzag", tier: "legendary" },
    { id: "singing-sands", title: "Singing Sands", hint: "Hear the dunes sing three times", tier: "common" },
    { id: "expedition", title: "Across the Gobi", hint: "Finish all five legs of the Expedition", tier: "legendary" },
    { id: "daily-three", title: "Daily Caravan", hint: "Win three Daily Crossings", tier: "common" },
    { id: "survivor-1982", title: "1982 Survivor", hint: "Make it across in 1982 mode", tier: "rare" },
    { id: "typo", title: "Typo", hint: "Something about a slip of the finger in 1982 mode", tier: "common", secret: true },
  ],
};
