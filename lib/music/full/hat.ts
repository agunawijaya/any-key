import type { FullSource } from "../score";

/*
 * The Mexican Hat Dance the way bands play it: the hat theme (twice), the
 * chromatic strain (twice), the trio in C, the strain again and the theme
 * to finish. The theme and the strain are the 1981 program's own; the trio
 * is our transcription of the traditional tune (the jarabe tapatío is a
 * nineteenth-century medley, public domain), checked against published
 * folk-tune transcriptions.
 */
export const hat: FullSource = {
  id: "hat",
  bpm: 176,
  meter: [6, 8],
  key: "F",
  about: "The dance as bands play it: the hat theme, the chromatic strain, a trio in C, and back to the theme.",
  source: "Traditional jarabe tapatío (public domain), transcribed for Bop Box.",
  excerpt: ["theme", "strain"],
  sections: {
    theme: {
      name: "The hat theme",
      melody: `C5e F5e re C5e F5e re | C5e F5q rq. | C5e F5e G5e F5e E5q | F5e G5e rh |
        C5e E5e re C5e E5e re | C5e E5q rq. | C5e E5e F5e E5e D5q | E5e F5e rh`,
      chords: `F | F | C7 | C7 | C7 | C7 | C7 | F`,
    },
    strain: {
      name: "The chromatic strain",
      melody: `C6e B5e C6e A5e G#5e A5e | F5e E5e F5e C5e rq | A4e Bb4e C5e D5e E5e F5e | G5e A5e Bb5e G5e rq |
        Bb5e A5e Bb5e G5e F#5e G5e | E5e D#5e E5e C5e rq | C6e B5e C6e D6e C6e Bb5e`,
      chords: `F | F | F | C7 | C7 | C7 | F`,
      endings: [
        { melody: `A5e G5e F5q rq`, chords: `C7 F` },
        { melody: `A5e G5e F5q`, chords: `C7 F` },
      ],
    },
    trio: {
      name: "Trio in C",
      key: "C",
      pickup: 1,
      melody: `G5e G5e | G5e D5e D5e D5e E5e F5e | F5e E5q re G5e G5e | G5e D5e D5e D5e E5e F5e | F5e E5q re G5e G5e |
        G5e D5e D5e D5e E5e F5e | F5e E5q re G5e G5e | G5e A5e G5e F5e E5e D5e | C5q rq rq`,
      chords: `G7 | G7 | C | G7 | C | G7 | C | G7 | C7`,
    },
    end: {
      name: "Last chord",
      key: "F",
      melody: `@150 F5q. rq.`,
      chords: `F`,
    },
  },
  form: ["theme", "theme", "strain:1", "strain:2", "trio", "strain:1", "theme", "end"],
};
