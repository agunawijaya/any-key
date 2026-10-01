export type ProgramStatus = "playable" | "in-studio";

export type Program = {
  id: string;
  title: string;
  kind: string;
  tagline: string;
  blurb: string;
  status: ProgramStatus;
  href?: string;
  original: { title: string; file: string; publisher: string; year: number; /** The year is a best guess, shown as "c. 1980". */ yearCirca?: boolean };
  /** Three colours that drive the card gradient, the planet and the cartridge. */
  palette: [string, string, string];
  stats: { value: string; label: string }[];
  /** Short chips shown on cards: the ways you can play it. */
  modes: string[];
  /** What orbits the planet in the Orbit hall: tracks, levels, rooms... */
  moons: string[];
  trivia: string[];
};

export const programs: Program[] = [
  {
    id: "music",
    title: "Bop Box",
    kind: "Music studio",
    tagline: "Eleven tunes from 1981. Twelve ways to make them bop.",
    blurb:
      "A tiny jukebox from the first days of the PC, rebuilt with live sheet music, a glowing keyboard and a whole band behind every note.",
    status: "playable",
    href: "/music",
    original: { title: "Music", file: "MUSIC.BAS", publisher: "IBM", year: 1981 },
    palette: ["#ff4f9a", "#6a48ff", "#13c2e3"],
    stats: [
      { value: "11", label: "tunes" },
      { value: "12", label: "styles" },
      { value: "1981", label: "first played" },
    ],
    modes: [
      "Orchestra",
      "Pop",
      "Jazz",
      "House",
      "Dangdut",
      "Koplo",
      "Lo-fi",
      "Hip-hop",
      "Solo",
      "PC Speaker ’81",
      "AI Remix",
      "Original Score",
    ],
    moons: [
      "La Cucaracha",
      "Blue Danube",
      "Humoresque",
      "Pop! Goes the Weasel",
      "Symphony No. 40",
      "Yankee Doodle",
      "Funeral March of a Marionette",
      "Stars and Stripes Forever",
      "Mexican Hat Dance",
      "Sakura",
      "Scales",
    ],
    trivia: [
      "Its pitch math started from a rounded-off number, so the note A came out at 441 Hz instead of 440.",
      "To play silence, the program played a note at 32,767 Hz: far too high for anyone to hear.",
      "La Cucaracha means “the cockroach”, so the song menu filed it under BUG.",
      "The on-screen piano had only 26 keys. Some notes played right off the edge of it.",
    ],
  },
  {
    id: "23mtch",
    title: "Stickler",
    kind: "Mind game",
    tagline: "Take 1, 2 or 3. Never the last one.",
    blurb:
      "A 1970s mind game with a secret number, rebuilt with a sore-loser opponent called Sparky, a ten-table ladder, a daily puzzle and three stick styles.",
    status: "playable",
    href: "/stickler",
    original: { title: "23 Matches", file: "23MTCH.BAS", publisher: "People's Computer Company", year: 1973 },
    palette: ["#ff8a1f", "#d7263d", "#ffd23d"],
    stats: [
      { value: "23", label: "sticks" },
      { value: "6", label: "modes" },
      { value: "14", label: "badges" },
    ],
    modes: ["Classic 23", "Handfuls", "Ladder", "Daily", "Versus", "1981 mode", "Matches", "Glow sticks", "Candy sticks"],
    moons: ["Warm-up", "Getting warmer", "The Classic", "Sparky starts", "Take up to four", "Take up to five", "Bonfire", "Two rows", "Three rows", "Marienbad"],
    trivia: [
      "Whoever moves first from 23 can always win. The 1973 program let you go first anyway.",
      "The original's “random” move used RND(0), which on a PC never changes. When losing, the computer always took exactly 1.",
      "Type 4 into the original and it called you a cheater. Sparky is just as strict.",
      "The credits in the original file misspell the author's name as ALBRECHR.",
    ],
  },
  {
    id: "escape",
    title: "Outta Here",
    kind: "Escape game",
    tagline: "The walls grow while you hesitate.",
    blurb:
      "A tiny 1980 TRS-80 game about an asterisk trying to reach the exit, rebuilt with wood to push, glass to bomb, three chasers, thirty screens on five old computers and a daily escape.",
    status: "playable",
    href: "/outta-here",
    original: { title: "Escape", file: "ESCAPE.BAS", publisher: "Unknown author", year: 1980, yearCirca: true },
    palette: ["#ff6b4a", "#2ef2a0", "#151b3d"],
    stats: [
      { value: "30", label: "screens" },
      { value: "3", label: "chasers" },
      { value: "12", label: "badges" },
    ],
    modes: ["Run", "Screens", "Daily Escape", "Versus", "1980 mode", "Chill", "Normal", "Hard"],
    moons: ["Green Screen", "Amber Terminal", "Home Micro", "Pocket LCD", "The Last Machine"],
    trivia: [
      "The 1980 program never says you won. Reach the exit and it simply stops at BASIC's READY prompt.",
      "Its check for the top of the screen can never be true, so you can walk up into the keyboard's memory and vanish.",
      "Step down from the bottom-left corner and the star is written over the computer's own memory. It almost certainly crashed.",
      "Blocks only fall while no key is down, so the faster you press keys, the fewer blocks fall.",
    ],
  },
];

export const oldestYear = Math.min(...programs.map((p) => p.original.year));

/** The original's year as the Hall shows it: "1973", or "c. 1980" when it is a best guess. */
export const yearLabel = (p: Program) => `${p.original.yearCirca ? "c. " : ""}${p.original.year}`;
