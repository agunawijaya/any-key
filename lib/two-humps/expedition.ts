import type { Twist } from "./engine";
import type { PursuerKind } from "./rules";

/*
 * The Expedition: five legs across real places in the Gobi, each with its own
 * pursuer and its own twist, and a page of the field journal at the end.
 * The journal's facts are ours, checked against the sources in
 * docs/two-humps/ABOUT.md.
 */

export type Leg = {
  id: string;
  place: string;
  /** One line on the leg card. */
  twistLine: string;
  pursuer: PursuerKind;
  startClock: number;
  twist: Twist;
  /** The field-journal page, in our own words. */
  journal: string[];
  /** Where the place sits on the expedition map, as shares of its width and height: west to east, roughly where it really is. */
  map: { x: number; y: number };
};

export const LEG_MILES = 30;

export const LEGS: Leg[] = [
  {
    id: "khermen-tsav",
    place: "Khermen Tsav",
    twistLine: "Red canyons: no room to gallop between the walls.",
    pursuer: "haboob",
    startClock: 6,
    twist: { goal: LEG_MILES, noGallop: true },
    journal: [
      "Khermen Tsav is a maze of red and orange canyons far out in the southern Gobi, a long way from any road.",
      "Wind and rare floods carved it from soft sediment laid down tens of millions of years ago, and fossil hunters still search its walls.",
    ],
    map: { x: 0.14, y: 0.7 },
  },
  {
    id: "khongoryn-els",
    place: "Khongoryn Els",
    twistLine: "The singing dunes: they hum often here, and every song is a free two miles.",
    pursuer: "haboob",
    startClock: 6,
    twist: { goal: LEG_MILES, events: { singing: 0.2, gust: 0.06 } },
    journal: [
      "Khongoryn Els is one of Mongolia's great fields of sand dunes: a band of sand about a hundred kilometres long at the foot of the Gobi Altai mountains.",
      "Some of its dunes stand well over a hundred metres high. When dry sand avalanches down a steep face, the whole slope can boom with a low hum, which is why people call them the singing sands.",
    ],
    map: { x: 0.5, y: 0.54 },
  },
  {
    id: "bayanzag",
    place: "Bayanzag",
    twistLine: "The Flaming Cliffs: keep an eye on the ground, there are fossils in this sandstone.",
    pursuer: "rival",
    startClock: 6,
    twist: { goal: LEG_MILES, events: { fossil: 0.1 } },
    journal: [
      "Bayanzag's red sandstone cliffs glow orange in the evening sun. An American expedition in the 1920s named them the Flaming Cliffs.",
      "In 1923 that expedition found the first dinosaur eggs known to science here, along with skeletons of Protoceratops and the first Velociraptor.",
    ],
    map: { x: 0.74, y: 0.3 },
  },
  {
    id: "yolyn-am",
    place: "Yolyn Am",
    twistLine: "An ice gorge: no thirst in the cold, but the going is slow on the ice.",
    pursuer: "gang",
    startClock: 18,
    twist: { goal: LEG_MILES, noThirst: true, pace: 0.85 },
    journal: [
      "Yolyn Am is a deep, narrow gorge in the Gurvan Saikhan mountains. Its walls keep the sun off the floor, and a thick sheet of ice lasts there well into summer.",
      "The name is usually translated as Valley of the Lammergeier, after the great bearded vulture that nests on its cliffs.",
    ],
    map: { x: 0.8, y: 0.7 },
  },
  {
    id: "ger-camp",
    place: "The ger camp",
    twistLine: "Herders nearby: a signal is answered four times in ten.",
    pursuer: "gang",
    startClock: 18,
    twist: { goal: LEG_MILES, helpNearby: 0.4 },
    journal: [
      "A ger is the round felt home of Mongolia's herders. It goes up in a few hours and packs onto a camel or two when the family moves on.",
      "Its door traditionally faces south, and a guest is offered tea before anything else.",
    ],
    map: { x: 0.92, y: 0.46 },
  },
];

export const legById = (id: string) => LEGS.find((leg) => leg.id === id);
