import type { FullSource, SectionSource } from "../score";

/*
 * The 1981 program ran one C major scale and a chromatic run. The full
 * version is the whole lesson: every major key once, walking round the
 * circle of fifths (each new key adds a sharp, then the flats take over),
 * up and down, then the broken chord. It ends with the chromatic run and
 * home on C.
 */

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

/** One octave of a major scale from a spelled tonic, e.g. ("Eb", 4) → Eb4 F4 G4 Ab4 Bb4 C5 D5 Eb5. */
function scale(tonic: string, octave: number) {
  const accidentals: Record<string, string> = {};
  for (const note of KEY_NOTES[tonic]) accidentals[note[0]] = note.slice(1);
  const start = LETTERS.indexOf(tonic[0]);
  const notes: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const letter = LETTERS[(start + i) % 7];
    const oct = octave + Math.floor((start + i) / 7);
    notes.push(`${letter}${accidentals[letter] ?? ""}${oct}`);
  }
  return notes;
}

/** The spelled notes of each major key. */
const KEY_NOTES: Record<string, string[]> = {
  C: ["C", "D", "E", "F", "G", "A", "B"],
  G: ["G", "A", "B", "C", "D", "E", "F#"],
  D: ["D", "E", "F#", "G", "A", "B", "C#"],
  A: ["A", "B", "C#", "D", "E", "F#", "G#"],
  E: ["E", "F#", "G#", "A", "B", "C#", "D#"],
  B: ["B", "C#", "D#", "E", "F#", "G#", "A#"],
  "F#": ["F#", "G#", "A#", "B", "C#", "D#", "E#"],
  Db: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"],
  Ab: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],
  Eb: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
  Bb: ["Bb", "C", "D", "Eb", "F", "G", "A"],
  F: ["F", "G", "A", "Bb", "C", "D", "E"],
};

/** Round the circle of fifths, each starting where it fits the 1981 program's little piano. */
const CIRCLE: [string, number][] = [
  ["C", 4], ["G", 4], ["D", 4], ["A", 4], ["E", 4], ["B", 3],
  ["F#", 4], ["Db", 4], ["Ab", 4], ["Eb", 4], ["Bb", 4], ["F", 4],
];

function keySection(tonic: string, octave: number): SectionSource {
  const n = scale(tonic, octave);
  const up = n.map((p) => `${p}e`).join(" ");
  const down = [...n].reverse().slice(1).map((p) => `${p}e`).join(" ");
  const [root, , third, , fifth] = n;
  return {
    name: `${tonic.replace("b", "♭").replace("#", "♯")} major`,
    key: tonic,
    melody: `${up} | ${down} re | ${root}e ${third}e ${fifth}e ${n[7]}e ${fifth}e ${third}e ${root}q`,
    chords: `${tonic} | ${KEY_NOTES[tonic][4]}7 ${tonic} | ${tonic}`,
  };
}

const sections: Record<string, SectionSource> = {};
for (const [tonic, octave] of CIRCLE) sections[tonic] = keySection(tonic, octave);
sections.chromatic = {
  name: "Chromatic, and home",
  key: "C",
  melody: `C4s C#4s D4s D#4s E4s F4s F#4s G4s G#4s A4s A#4s B4s C5q | C5s B4s A#4s A4s G#4s G4s F#4s F4s E4s D#4s D4s C#4s C4q |
    C4e E4e G4e C5e E5e G5e C6q | C6h rh`,
  chords: `C | G7 | C | C`,
};

export const scales: FullSource = {
  id: "scales",
  bpm: 112,
  meter: [4, 4],
  key: "C",
  about: "The whole lesson: all twelve major keys round the circle of fifths, up, down and the broken chord, then the chromatic run home.",
  source: "Written for Bop Box: the twelve major scales, spelled the way a piano method prints them.",
  excerpt: "C",
  sections,
  form: [...CIRCLE.map(([tonic]) => tonic), "chromatic"],
};
