import type { GameManifest } from "@/lib/kit/manifest";

/* Over / Short's contract with the Hall. */
export const overShortManifest: GameManifest = {
  id: "over-short",
  title: "Over / Short",
  status: "playable",
  route: "/over-short",
  kind: "Artillery game",
  category: "strategy",
  players: "1–2",
  sessionMinutes: [3, 15],
  tagline: "Call the angle. Trust the observer.",
  blurb:
    "One of the first artillery games ever written, reborn: bracket the target, read the observer's reports, and outthink wind, hills, moving convoys and an enemy battery hunting you back.",
  inspiredBy: { originalTitle: "Gunner", file: "GUNNER.BAS", author: "Tom Kloos", publisher: "Creative Computing", year: 1973 },
  palette: ["#8a6a3c", "#2f3a3f", "#d9cdb4"],
  daily: { epoch: "2026-10-10" },
  accent: "#9b7440",
  // A shell's arc over a field gun's barrel and wheel.
  emblem:
    "M3.2 13.6C5.4 6.9 9.2 3.6 13 3.6s7.6 3.3 9.8 10l-1.5.5C19.3 8.2 16.2 5.2 13 5.2S6.7 8.2 4.7 14.1zM20.6 12.4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM2.4 18.6l7.3-3.4.6 1.3-7.3 3.4zM9.6 15.4a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zm0 1.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z",
  stats: [
    { value: "1973", label: "first fired" },
    { value: "30", label: "missions" },
    { value: "4", label: "charges" },
  ],
  modes: ["Classic", "Campaign", "Field Artillery", "Counter-Battery Duel", "Daily Barrage", "1970s mode"],
  moonsName: "eras",
  // The eras: the Great War now, three more to come.
  moons: ["The Great War", "Age of Sail (coming)", "The 1970s (coming)", "Toy Tabletop (coming)"],
  trivia: [
    "Gunner (1973) is one of the very first artillery games, the family that grew into Artillery, Scorched Earth and Worms.",
    "The 1973 program reported a round that fell exactly 100 short as over: it only called a round short when it was more than 100 short.",
    "Gunner turned degrees into radians by dividing by 57.3. On its longest gun that moved a round by up to 13.7 yards.",
    "In the original, the sixth elevation you typed at one target was never fired: the enemy found your gun first.",
    "The IBM PC remake whistled each shell in with the PC speaker, sweeping from 3,000 to 4,000 Hz in about two seconds.",
  ],
  achievements: [
    { id: "first-bracket", title: "First Bracket", hint: "Put one round over and one short, then hit the target", tier: "common" },
    { id: "one-round", title: "One Round", hint: "Destroy a Classic target with your first round", tier: "rare" },
    { id: "under-eighteen", title: "Under Eighteen", hint: "Finish a Classic game in 18 rounds or fewer", tier: "common" },
    { id: "five-for-five", title: "Five for Five", hint: "Five Classic targets with five rounds", tier: "legendary" },
    { id: "two-roads", title: "Two Roads", hint: "Hit the same target from both sides of 45°", tier: "rare" },
    { id: "range-finder", title: "Range Finder", hint: "Win with an unknown gun in three rounds or fewer", tier: "rare" },
    { id: "into-the-wind", title: "Into the Wind", hint: "Win a mission against a headwind of 10 m/s or more", tier: "common" },
    { id: "table-maker", title: "Table Maker", hint: "Fill every row of your battery's range table", tier: "rare" },
    { id: "moving-target", title: "Moving Target", hint: "Hit a convoy with one of your first two rounds", tier: "rare" },
    { id: "counter-battery", title: "Counter-Battery", hint: "Silence the battery that is hunting your gun", tier: "rare" },
    { id: "campaign-done", title: "The Whole Campaign", hint: "Win all twenty Campaign missions", tier: "rare" },
    { id: "fort-sill", title: "Fort Sill Graduate", hint: "Gold on every Campaign mission, without the textbook hint", tier: "legendary" },
    { id: "charge-two", title: "Charge Two", hint: "Drop a round over a crest with one of the two smallest charges, onto the target behind it", tier: "common" },
    { id: "left-fifty", title: "Left Fifty", hint: "Hit with the round after the observer called the line fifty or more off", tier: "common" },
    { id: "bridge-down", title: "Bridge Down", hint: "Drop a bridge before the column reaches it", tier: "rare" },
    { id: "smoke-and-mirrors", title: "Smoke and Mirrors", hint: "Win a shoot through the enemy's smoke", tier: "rare" },
    { id: "moving-day", title: "Moving Day", hint: "Move the gun, let their next round fall on the empty pit, and win", tier: "rare" },
    { id: "duelist", title: "Duelist", hint: "Win a Counter-Battery Duel against a computer commander", tier: "rare" },
    { id: "daily-gunner", title: "Daily Gunner", hint: "Win seven Daily Barrages", tier: "rare" },
    { id: "old-terminals", title: "1973 Gunner and Cannoneer", hint: "Finish a war on both 1970s terminals", tier: "legendary" },
  ],
};
