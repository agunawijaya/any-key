import type { FullSource } from "../score";

/*
 * Humoresque No. 7 as Dvořák published it (8 Humoresques, Op. 101, Berlin:
 * N. Simrock, 1894), in its own key of G-flat and at his marking,
 * Poco lento e grazioso, crotchet = 72. The skipping tune is written the
 * way he wrote it: a sixteenth, a thirty-second rest, a thirty-second.
 *
 * The form: the tune (repeated), its answer in thirds, the tune again,
 * the stormy F-sharp minor middle, the tune, and the answer once more
 * with a quiet ending. Transcribed from a public-domain scan of the
 * Simrock print, taking the top line of the right hand; the chords are
 * our reading of his left hand.
 */

const THEME_1 = "Gb4s rt Ab4t Gb4s rt Ab4t Bb4s rt Db5t Eb5s rt Db5t";
const THEME_2 = "Gb5s rt F5t Ab5s rt Gb5t F5s rt Ab5t Gb5s rt Eb5t";
const THEME_3 = "Db5s rt Db5t Eb5s rt Db5t Gb5s rt Eb5t Db5s rt Bb4t";
const MINOR = "F#4s G#4s A4s G#4s A4e G#4s F#4s";

export const humor: FullSource = {
  id: "humor",
  bpm: 72,
  meter: [2, 4],
  key: "Gb",
  about: "The whole piece as Dvořák published it in 1894: the skipping tune, its gentle answer in thirds, the stormy F-sharp minor middle, and home again.",
  source: "Dvořák, 8 Humoresques Op. 101 (Berlin: N. Simrock, 1894), No. 7; public-domain scan via IMSLP, transcribed for Bop Box.",
  excerpt: "theme",
  sections: {
    theme: {
      name: "Theme",
      melody: `${THEME_1} | ${THEME_2} | ${THEME_3} | Ab4h |
        ${THEME_1} | Eb5s rt F5t Ab5s rt Gb5t F5s rt Ab5t Gb5s rt Eb5t | Db5s rt Db5t Gb5s rt Gb4t Ab4e Db5e | Gb4q. re`,
      chords: `Gb | Ebm | Gb | Db7 | Gb | Abm | Gb Db7 | Gb`,
    },
    answer: {
      name: "Answer in thirds",
      bpm: 72,
      melody: `Bb4e Bb5s rt Ab5t Ab5e Gb5e | Gb5e F5s rt Eb5t Eb5e Db5e | Db5e Cb5s Eb5s Db5e Cb5e | Bb4s Ab4s Gb4q Gb4s Ab4s |
        Bb4e Bb5s rt Ab5t Ab5e Gb5e | Gb5e F5s rt Eb5t Eb5e Db5e | Db5s Cb5s Db5s Eb5s Bb4s Ab4s Bb4s Cb5s`,
      chords: `Abm7 Gb | Cb Db7 | Abm Db7 | Gb Db7 Gb:2 | Abm7 Gb | Cb Db7 | Abm Db7`,
      endings: [
        { melody: `@60 Bb4e Bbb4q Ab4e`, chords: `Ebm Ddim:2 Db7` },
        { melody: `@60 Bb4e Db5e @44 Gb5q`, chords: `Gb Db7 Gb:2` },
      ],
    },
    tune: {
      name: "The tune again",
      key: "Gb",
      bpm: 72,
      melody: `${THEME_1} | ${THEME_2} | ${THEME_3} | Ab4h | ${THEME_1} | ${THEME_2} |
        @60 Db5s rt Db5t Bbb5s rt Db5t C5s rt Bb5t Ab5s rt Eb5t | Gb5h`,
      chords: `Gb | Ebm | Gb | Db7 | Gb | Ebm | Gb Gbm Adim Db7 | Gb`,
    },
    minor: {
      name: "F-sharp minor",
      key: "F#m",
      bpm: 72,
      melody: `${MINOR} | E4e B3e C#4s E4e. | ${MINOR} | E4e C#5e A4q |
        ${MINOR} | E4s F#4s D4s B3s C#4s E4e. | ${MINOR} | F#4e D5e C#5q |
        ${MINOR} | E4s G#4t F#4t E4s B3s C#4t F#4t E4e. | F#4s G#4s A4s G#4s B4s A4s G#4s F#4s | E4e B4e C#5t B4t A4e. |
        F#5s G#5s A5s G#5s B5s A5s G#5s F#5s | E5s F#5s E5s B4s C#5s E5e. | F#5s G#5s A5s G#5s A5e G#5s F#5s | F#5e E6s D6s @48 C#6q`,
      chords: `F#m A | E A | F#m A | E A | F#m A | Bm A | F#m A | D C#7 |
        F#m A | E A | F#m E | E7 A | F#m E | E A | F#m A | D C#7`,
    },
  },
  form: ["theme", "theme", "answer:1", "tune", "minor", "tune", "answer:2"],
};
