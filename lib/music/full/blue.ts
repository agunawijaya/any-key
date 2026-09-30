import type { FullSource } from "../score";

/*
 * The Blue Danube, Op. 314, as Johann Strauss II scored it for orchestra:
 * the Andantino introduction (the horn's rising A major call, answered a
 * third higher each time, then the cellos), the Tempo di valse that creeps
 * up chromatically to the first waltz, five waltzes (each with its own
 * second strain and its da-segno return), and the long coda: a new theme,
 * waltzes 2, 4 and 1 again, a general pause, a quiet farewell in the cellos
 * and flute, and the final rush.
 *
 * Read from Breitkopf & Härtel's full score (Leipzig, about 1920), a
 * public-domain scan on IMSLP. The tune follows whichever instrument carries
 * it: the horn and then the cellos in the introduction (an octave up), the
 * first violins in most of the waltzes, the flute and cellos where Strauss
 * gives them the melody. The chords are our reading of the whole orchestra, a
 * bar at a time. A few transitional bars of the coda are hard to read in the
 * scan and follow our best reading. The repeats and da-segno returns are
 * played as printed for orchestra (without repeats after a return); the
 * short "Coda I" meant for choir is left out, as the score directs.
 */
export const blue: FullSource = {
  id: "blue",
  bpm: 160,
  meter: [3, 4],
  key: "D",
  about: "The whole concert waltz: the misty introduction, all five waltzes with their second strains, and the coda that sweeps them together.",
  source: "Johann Strauss II, An der schönen blauen Donau, Op. 314; notes from Breitkopf & Härtel’s full score (about 1920), a public-domain scan on IMSLP.",
  excerpt: "w1a",
  sections: {
    intro: {
      name: "Introduction (Andantino)",
      meter: [6, 8],
      key: "A",
      bpm: 60,
      melody: `rh. | rq re A4e C#5e E5e | E5h.~ | E5q. E4e G#4e B4e |
        B4h.~ | B4q re B4e D5e F#5e | F#5h.~ | F#5q re B4e D5e F#5e |
        E5h.~ | E5q re A4e C#5e E5e | A5h.~ | A5q. rq. |
        A5h.~ | A5q re A4e D5e A5e | A5h.~ | A5q re A4e C#5e F#5e |
        F#5h.~ | F#5q re A4e C#5e E5e | E5h.~ | E5q re E4e G#4e D5e |
        D5h. | C#5q. E4q.`,
      chords: `A | A | A | A | E7 | E7 | E7 | E7 | A7 | A7 | D | D |
        Dm | Dm | A | A | A6 | A6 | A | E7 | E7 | E7`,
    },
    valse: {
      name: "Tempo di valse",
      meter: [3, 4],
      key: "D",
      bpm: 144,
      melody: `rq A4e G#4e A4q | rq B4e A#4e B4q | rq C#5e B#4e C#5q | D5q E5q F#5q |
        rq E5e D#5e E5q | rq F#5e E#5e F#5q | rq G5e F#5e G5q | G5q A5q B5q |
        rq G5e A5e B5e A4e | G5h.~ | G5q G5e A5e B5e A4e | F#5h.~ | F#5q F#5e G5e A5e A4e |
        @132 E5e re G5e re A4e re | D5e re G5e re A4e re | C#5e re G5e re A4e re |
        B4e re E5e re G4e re | A4e re D5e re F#4e re | G4e re C#5e re E4e re |
        @108 A4q rq rq | G4q rq rq | @66 E4q rq rq`,
      chords: `A | D | A7 | D | A7 | D | A7 | A7 | A7 | A7 | A7 | D | D |
        A7 | A7 | A7 | Em | D | A7 | A7 | A7 | A7`,
    },
    w1a: {
      name: "Waltz 1",
      key: "D",
      bpm: 160,
      melody: `D4q F#4q A4q | A4h A5q | A5q rq F#5q | F#5q rq D4q |
        D4q F#4q A4q | A4h A5q | A5q rq G5q | G5q rq C#4q |
        C#4q E4q B4q | B4h B5q | B5q rq G5q | G5q rq C#4q |
        C#4q E4q B4q | B4h B5q | B5q rq F#5q | F#5q rq D4q |
        D4q F#4q A4q | D5h D6q | D6q rq A5q | A5q rq D4q |
        D4q F#4q A4q | D5h D6q | D6q rq B5q | B5q rq E5q |
        E5q G5q B5e re | B5h. | B5q A#5q B5q | F#6h. |
        F#6q D6q F#5q | F#5h E5q | B5h A5q | D5q re D5e D5q |
        rq D6e re C#6e re`,
      chords: `D | D | D | D | D | D | D | A7 | A7 | A7 | A7 | A7 | A7 | A7 | A7 | D |
        D | D | D | D | D | D | G | G | Em | Em | F#7 | Bm | Bm | G | A7 | D | D`,
    },
    w1b: {
      name: "Waltz 1, second strain",
      key: "A",
      bpm: 160,
      melody: `C#6e re B5e re B5e re | rq B5e re A#5e re | A#5e re B5e re B5e re | rq E5e re E5e re |
        F#5h E5q | rq E5e re E5e re | B5h A5q | rq D6e re C#6e re |
        C#6e re B5e re B5e re | rq B5e re C#6e re | E6e re D6e re D6e re | rq D6e re B5e re |
        B5h A5q | A5q. F#6e D6e B5e | F#6e F#6e F#6q E6q`,
      chords: `E7 | E7 | E7 | E7 | A | A | A | D | E7 | E7 | E7 | B7 | A | E7 | E7`,
      endings: [
        { melody: `A5q D6e re C#6e re`, chords: `A` },
        { melody: `A5q rq rq | A5h.~ | A5h. | A5q rq rq`, chords: `A | A7 | A7 | A7` },
        { melody: `A5q rq`, chords: `A` },
      ],
    },
    w2a: {
      name: "Waltz 2",
      key: "D",
      bpm: 160,
      pickup: 1,
      melody: `A4q |
        G4q rq A4q | G4q rq A4q | F#5h. | F#5q E5q A4q |
        F#4q rq A4q | F#4q rq A4q | E5h. | E5q D5q A4q |
        G4q rq A4q | G4q rq A4q | F#5h. | F#5q E5q A4q |
        D5q E5q F#5q | A5h G5q | F#5e F#5e F#5q E5e re`,
      chords: `A7 | A7 | A7 | D | D | D | D | A7 | A7 | A7 | A7 | D | D | D7 | G | A7`,
      endings: [
        { melody: `D5q rq`, chords: `D` },
        { melody: `D5q rq rq`, chords: `D` },
        { melody: `D5q rq rq`, chords: `D` },
        { melody: `D5q rq Eb5e re`, chords: `D` },
      ],
    },
    w2b: {
      name: "Waltz 2, second strain",
      key: "Bb",
      bpm: 160,
      melody: `D6h. | D6q Eb6q D6q | C6q Bb5q A5q | Bb5h. |
        C6e re rq C6q | C6q G5q. F5e | F5h. | F5q rq F5q |
        D6h. | D6q Eb6q D6q | C6q Bb5q A5q | G5h. |
        F#5q rq F#5q | rq G5q. Bb5e | A5h. | A5q rq`,
      chords: `Bb | Bb | F7 | Bb | F7 | F7 | Bb | Bb | Bb | Bb | F7 | Gm | D7 | Gm | D | A7`,
    },
    w3a: {
      name: "Waltz 3",
      key: "G",
      bpm: 160,
      pickup: 1,
      melody: `D4q |
        B4q rq B4q | B4q D5q. C5e | B4q rq rq | rq rq D4q |
        B4q rq B4q | B4q E5q. D5e | C5q rq rq | rh. |
        C5q rq C5q | C5q F#5q. E5e | G5q B4e re B4q | B4h B4q |
        A4q rq A4q | A#4q rq A#4q | B4h.`,
      chords: `D7 | G | G | G | G | G | C | D7 | D7 | D7 | D7 | G | G | Am | C#dim | G`,
      endings: [
        { melody: `B4q rq`, chords: `G` },
        { melody: `B4q rq rq`, chords: `G` },
      ],
    },
    w3b: {
      name: "Waltz 3, second strain (Lebhaft)",
      key: "G",
      bpm: 168,
      melody: `B4e A4e G#4e A4e B4e A4e | A4e G4e F#4e G4e D5q | D5e C5e C5e re C5e re | C5e re B4e re B4e re |
        B4e A4e G#4e A4e B4e C5e | A4e G4e F#4e G4e G5q | G5e F#5e F#5e re F#5e re | F#5e re E5e re E5e re |
        B4e A4e G#4e A4e B4e A4e | A4e G4e F#4e G4e D5q | D5e C5e C5e re C5e re | C5e re B4e re B4e re |
        B4e A4e G#4e A4e B4e C5e | A4e G4e C6e re re A5e | G5h E5e C5e`,
      chords: `Am | G | D7 | G | Am | G | D7 | G | Am | G | D7 | G | Am | D7 | D7`,
      endings: [
        { melody: `G4q re B4e C5e B4e`, chords: `G` },
        { melody: `G4q rq`, chords: `G` },
        { melody: `G4q rq rq`, chords: `G` },
      ],
    },
    w4intro: {
      name: "Waltz 4, lead-in",
      key: "F",
      bpm: 160,
      melody: `G4h. | G4h. | G4q rq rq | rq rq`,
      chords: `C | C7 | C7 | C7`,
    },
    w4a: {
      name: "Waltz 4",
      key: "F",
      bpm: 160,
      pickup: 1,
      melody: `C4q |
        C4e F4e A4e C5e F5q | F5q E5q D5q | C#5q D5q E5e re | E5h. |
        C#5q D5q E5e re | E5h. | B4q C5q Db5q | C5h. |
        C4e F4e A4e C5e F5q | F5q E5q D5q | C#5q D5q E5e re | E5h.`,
      chords: `C7 | F | F | C7 | C7 | C7 | C7 | F | F | F | F | C7 | C7`,
      endings: [
        { melody: `F5q A4q D5q | C5q G4q A4q | F4h.~ | F4q rq`, chords: `Dm | C7 | F | F` },
        { melody: `F5q E5q D5q | D5h. | C#5q rq rq | rq C6q. B5e`, chords: `Dm | Gm | A7 | C7` },
        { melody: `F5q E5q D5q | C5h.`, chords: `Dm | C7` },
      ],
    },
    w4b: {
      name: "Waltz 4, second strain",
      key: "F",
      bpm: 160,
      melody: `C6h. | C6q C6q. B5e | C6h. | C6q F6q A5q |
        Bb5q. D6e E5q | re G5e G5q A5q | Bb5q. D6e E5q | rq G5e A5e Bb5e B5e |
        C6h. | C6q C6q. B5e | Bb5h. | C6q A6q C6q |
        B5q. F6e F6q | F6e E6e E6q D6q | D6e D6e D6q C6q`,
      chords: `F | C7 | F | F | C7 | C7 | C7 | C7 | F | C7 | C7 | F | G7 | C | C7`,
      endings: [
        { melody: `F5q C6q. B5e`, chords: `F` },
        { melody: `F5q rq`, chords: `F` },
        { melody: `F5q rq rq`, chords: `F` },
      ],
    },
    w5intro: {
      name: "Waltz 5, lead-in",
      key: "A",
      bpm: 160,
      melody: `C5h. | D5h D#5q | E5q C#5e E5e A5e C#6e | E6e re D6e re C#6e re |
        C#6q C#6e B#5e C#6e D6e | C#6e re B5e re A5e re | G#5e G#5e G#5e re A5e re | F#5q rq rq |
        E6q rq rq | E6q rq rq | A4q B4q C#5q`,
      chords: `Am | D | A | A | C#7 | F#m | C#7 | F#m | E7 | E7 | E7`,
    },
    w5a: {
      name: "Waltz 5",
      key: "A",
      bpm: 160,
      melody: `D5q F#4q. A4e | D5q F#4q. A4e | D5h. | D5q C#5q B4q |
        C#5q E4q. A4e | C#5q E4q. A4e | C#5h. | C#5q B4q A4q |
        G#4q B4q G#5q | G#5q F#5q D5q | C#5h. | C#5q B4q A4q`,
      chords: `Bm7 | Bm7 | Bm7 | Bm7 | A | A | A | A | E7 | E7 | A | A`,
      endings: [
        { melody: `G#4q B4q F#5q | F#5q E5q G#4q | A4h. | A4q B4q C#5q`, chords: `E7 | E7 | A | E7` },
        { melody: `G#4q A4q B#4q | C#5q D5q D#5q | E5q rq rq | rh.`, chords: `E7 | E7 | E7 | E7` },
      ],
    },
    w5b: {
      name: "Waltz 5, second strain",
      key: "A",
      bpm: 160,
      melody: `C#6q rq rq | C#6q rq rq | C#6h.~ | C#6q E5e G#5e A5e B5e |
        C#6q rq rq | C#6q rq rq | D6h.~ | D6q F#5e A#5e B5e C#6e |
        D6q rq rq | D6q rq rq | E6h.~ | E6q D6q C#6q |
        F#6h.~ | F#6q E6q D6q | C#6q rq rq | rh. |
        C#6q rq rq | C#6q rq rq | C#6h.~ | C#6q E5e G#5e A5e B5e |
        C#6q rq rq | C#6q rq rq | D6h.~ | D6q F#5e A#5e B5e C#6e |
        D6q rq rq | F#6q rq rq | A6h.~ | A6q G#6q F#6q | F#6q E6q D#6q`,
      chords: `A | A | A | E7 | A | A | Bm | F#7 | Bm | Bm | A | A | D | D | A | E7 |
        A | A | A | E7 | A | A | Bm | F#7 | Bm | D | D | D | B7`,
      endings: [
        { melody: `D6q C#6q B5q | A5h. | A4q B4q C#5q`, chords: `E7 | A | E7` },
        { melody: `D6q C#6q B5q`, chords: `E7` },
      ],
    },
    coda: {
      name: "Coda",
      key: "D",
      bpm: 160,
      pickup: 1,
      melody: `E4q |
        C#5q rq C#5q | C#5q E5q. F#5e | G5q C#5e re C#5q | C#5h. |
        F#5q rq F#5q | F#5q F#5q. G5e | A5q D#5e re D#5q | D#5h. |
        G5q rq G5q | rq G5q. A5e | B5q E5q rq | G5q C#5q rq | E5q A4e re B4q |
        A4q rq A4q | A5e re A4q A4q | A4q rq A4q | A5e re rq A4q | rh`,
      chords: `A7 | A7 | A7 | A7 | A7 | B7 | B7 | B7 | B7 | Em | Em | Em | A7 | A7 | A7 | A7 | A7 | A7 | A7`,
    },
    codaTurn: {
      name: "Coda: the turn to F major",
      key: "D",
      bpm: 160,
      melody: `D5q rq C5e re | Bb4e re rq C5e re | A4e re rq Bb4e re |
        G4h Bb5q | A5e re rq G5e re | F5e re rq G5e re | E5e re rq F5e re | D5h Bb4e C5e |
        D5e F5e Ab5e B5e D6q | D5e F5e Ab5e B5e D6q | G#5h.~ | G#5h. |
        A5q rq rq | A5e re rq rq | G5e re rq rq | rq rq`,
      chords: `D7 | Gm | D7 | Gm | A7 | Dm | C | Bb | Bb7 | Bb7 | Bb7 | Bb7 | A | A | Gm | C7`,
    },
    codaRise: {
      name: "Coda: back to D major",
      key: "F",
      bpm: 160,
      melody: `C#5q A5h | D5q A5h | E5q A5h | F#5q A5h |
        G5q E6h | G5q E6h | G5q E6h | G5q E6h | E6q rq rq | B4q rq rq | C#5q rq rq`,
      chords: `A | Dm | A | D | A7 | Edim | Em | Edim | A7 | A7 | A7`,
    },
    codaWaltz1: {
      name: "Coda: waltz 1 returns",
      key: "D",
      bpm: 160,
      melody: `D4q F#4q A4q | A4q rq A5q | A5q rq F#5q | F#5q rq D4q |
        D4q F#4q A4q | A4q rq A5q | A5q rq G5q | G5q rq C#4q |
        C#4q E4q B4q | B4q rq B5q | A5q rq G5q | G5q rq C#4q |
        C#4q E4q B4q | B4q rq B5q | A5q rq F#5q | F#5q rq D4q |
        D4q F#4q A4q | D5q rq D6q | D6q rq A5q | A5q rq D4q |
        D4q F#4q A4q | D5q rq D6q | D6q rq B5q | B5q rq E5q |
        E5q G5q B5e re | B5h. | B5q A#5q B5q | F#6h. |
        F#6q D6q F#5q | F#5h E5q | B5h A5q | rh.`,
      chords: `D | D | D | D | D | D | D | A7 | A7 | A7 | A7 | A7 | A7 | A7 | A7 | D |
        D | D | D | D | D | D | G | G | Em | Em | F#7 | Bm | Bm | Em | A7 | -`,
    },
    farewell: {
      name: "Coda: a quiet farewell",
      key: "D",
      bpm: 160,
      melody: `D5q F#5q A5q | A5h.~ | A5h. | A5q rq D5q |
        D5q F#5q A5q | G5h.~ | G5h. | G5q rq B4q |
        B4q D5q G5q | G5h.~ | G5h. | G5q rq rq | B4q C#5q G5q |
        F#5h.~ | F#5h.~ | F#5q rq rq | rh. |
        rh. | D5q F#5q A5q | D6h. | D6q rq rq |
        rh. | D5q G5q B5q | D6h. | D6q rq rq |
        rh. | E5q G5q B5q | C#6h.~ | C#6h. | D6q rq rq`,
      chords: `D | D7 | D7 | D7 | D | G | G | G | G | A7 | A7 | Em | A7 | D | D | D | D |
        D7 | D7 | D7 | D7 | G | G | G | G | A7 | A7 | A7 | A7 | D`,
    },
    finale: {
      name: "Coda: the final rush",
      key: "D",
      bpm: 160,
      melody: `D4e C#4e E4e D4e F#4e E4e | G4e F#4e B4e A4e A#4e B4e |
        D5e C#5e E5e D5e F#5e E5e | G5e F#5e B5e A5e A#5e B5e |
        E6e D6e C#6e D6e A5e F#5e | B5e A5e G#5e A5e F#5e D5e |
        G5e F#5e E#5e F#5e D5e A4e | E5e D5e C#5e D5e A4e F#4e |
        D4q rq rq | D5q rq re. A4s | D5h.`,
      chords: `D | G | D | G | D | D | D | D | D | D | D`,
    },
  },
  form: [
    "intro", "valse",
    "w1a", "w1b:1", "w1b:2", "w1a", "w1b:3",
    "w2a:1", "w2a:2", "w2b", "w2a:3",
    "w3a:1", "w3a:2", "w3b:1", "w3b:2", "w3a:2", "w3b:3",
    "w4intro", "w4a:1", "w4a:2", "w4b:1", "w4b:2", "w4a:2", "w4b:3",
    "w5intro", "w5a:1", "w5a:2", "w5b:1", "w5a:2", "w5b:2",
    "coda", "w2a:4", "codaTurn", "w4a:3", "codaRise", "codaWaltz1", "farewell", "finale",
  ],
};
