import { COLLECTION_EPOCH } from "@/lib/kit/daily";
import type { GameManifest } from "@/lib/kit/manifest";

export const landerManifest: GameManifest = {
  id: "lander",
  title: "Don't Crater",
  status: "playable",
  route: "/dont-crater",
  kind: "Descent sim",
  category: "simulation",
  players: "1",
  sessionMinutes: [2, 20],
  tagline: "5,000 km/h down. Land like a feather.",
  blurb:
    "A 1979 descent simulator, rebuilt with four worlds drawn like travel posters, a throttle lever, ten missions, a daily drop, free flight over real terrain and a flag you design yourself.",
  inspiredBy: { originalTitle: "Lander", file: "LANDER.BAS", publisher: "Simutek", year: 1979 },
  palette: ["#ff6b1a", "#1b2a6b", "#ffd23d"],
  accent: "#2c43a8",
  // The lander on its legs, engine lit.
  emblem:
    "M7.5 9.4a4.5 4.5 0 0 1 9 0v2.3h-9zM5.4 12.4h13.2v2.5H5.4zM7.3 14.9h2l-3.3 5.2H4zM14.7 14.9h2l3.3 5.2h-2zM2.6 20.1h4.8v1.6H2.6zM16.6 20.1h4.8v1.6h-4.8zM12 15.6l1.7 3.1L12 22.6l-1.7-3.9z",
  stats: [
    { value: "4", label: "worlds" },
    { value: "10", label: "missions" },
    { value: "5,000", label: "km/h" },
  ],
  modes: ["Live", "Ten-Second", "Free Flight", "Missions", "Daily Drop", "1979 mode", "Day side", "Night side", "Flag designer"],
  moonsName: "worlds and missions",
  moons: ["Moon", "Mars", "Psyche", "Earth", "First Contact", "Cargo Run", "Hot Entry", "Instruments Out", "Needle", "Express Delivery"],
  trivia: [
    "Burn nothing at all and the 1979 game said you had struck oil. On the Moon, too.",
    "At exactly 19 to 20 km/h the original showed a wrecked lander while its text said you had landed.",
    "The 1979 game never reset its clock: your second landing's time included the first one.",
    "Only landings at 5 km/h or less showed a tiny astronaut planting a flag. Most players never saw it.",
  ],
  daily: { epoch: COLLECTION_EPOCH },
  achievements: [
    { id: "first-touch", title: "First Touch", hint: "Land anywhere without breaking anything", tier: "common" },
    { id: "butter", title: "Butter", hint: "Touch down under 2 km/h", tier: "rare" },
    { id: "postcards", title: "Postcard Set", hint: "Land on all four worlds", tier: "rare" },
    { id: "flag-planter", title: "Flag Planter", hint: "Plant your flag on all four worlds", tier: "rare" },
    { id: "hoverslam", title: "Hoverslam", hint: "Land with 90% of a perfect hoverslam's fuel left", tier: "legendary" },
    { id: "wildcatter", title: "Wildcatter", hint: "Hit the ground so hard you strike oil", tier: "common", secret: true },
    { id: "crater-maker", title: "Crater Maker", hint: "Leave a brand new crater", tier: "common" },
    { id: "ten-seconds", title: "Ten Seconds Flat", hint: "Land in Ten-Second mode", tier: "common" },
    { id: "time-traveller", title: "Time Traveller", hint: "Land in 1979 mode", tier: "common" },
    { id: "schrodinger", title: "Schrödinger's Lander", hint: "In 1979 mode, land between 19 and 20 km/h", tier: "legendary", secret: true },
    { id: "mission-control", title: "Mission Control", hint: "Clear all ten missions", tier: "legendary" },
    { id: "daily-3", title: "Daily Driver", hint: "Land three Daily Drops", tier: "common" },
    { id: "pinpoint", title: "Pinpoint", hint: "In Free Flight, stand on a flat narrower than 15 m", tier: "rare" },
    { id: "sidewinder", title: "Sidewinder", hint: "Kill more than 500 km/h of drift and land standing", tier: "rare" },
    { id: "oops", title: "Oops", hint: "Tip over for the first time", tier: "common", secret: true },
  ],
};
