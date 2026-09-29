export type ProgramStatus = "playable" | "in-studio";

export type Program = {
  id: string;
  title: string;
  kind: string;
  tagline: string;
  blurb: string;
  status: ProgramStatus;
  href?: string;
  original: { title: string; file: string; publisher: string; year: number };
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
    tagline: "Eleven tunes from 1981. Ten ways to make them bop.",
    blurb:
      "A tiny jukebox from the first days of the PC, rebuilt with live sheet music, a glowing keyboard and a whole band behind every note.",
    status: "in-studio",
    original: { title: "Music", file: "MUSIC.BAS", publisher: "IBM", year: 1981 },
    palette: ["#ff4f9a", "#6a48ff", "#13c2e3"],
    stats: [
      { value: "11", label: "tunes" },
      { value: "10", label: "styles" },
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
      "Solo",
      "PC Speaker ’81",
      "AI Remix",
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
];

export const oldestYear = Math.min(...programs.map((p) => p.original.year));
