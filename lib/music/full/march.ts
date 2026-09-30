import type { FullSource } from "../score";

/*
 * The whole Funeral March of a Marionette in Gounod's own orchestral version
 * (Paris: Lemoine, 1879): the marionette breaks, the troupe mourns, and the
 * procession sets off; the march, its big tutti (played twice), the shadows
 * in the bass, the trio in D major (played twice), and the tiptoe home.
 *
 * The notes were read from Oscar Lopez's engraving of the orchestral score,
 * which he dedicated to the public domain (via IMSLP), and checked against
 * Gounod's 1873 piano original. The tune is taken from whichever instrument
 * carries it at each point (the clarinet's solo, the oboes, the violins, the
 * cellos' bass line an octave up); the chords are our reading of the full
 * orchestra, bar by bar. Tempos follow the score: Allegro, a long pause,
 * Adagio, then Allegretto at dotted crotchet = 84.
 */
export const march: FullSource = {
  id: "march",
  bpm: 126,
  meter: [6, 8],
  key: "Dm",
  about: "The whole piece in Gounod’s orchestral version: the puppet breaks, the troupe mourns, the procession, a sweet trio in D major, and the tiptoe home.",
  source: "Gounod’s orchestral score (Lemoine, 1879), from Oscar Lopez’s public-domain engraving on IMSLP, checked against the 1873 piano original.",
  excerpt: "march",
  sections: {
    intro: {
      name: "The marionette breaks",
      bpm: 168,
      melody: `Bb4e A4e Bb4e A4e Bb4e A4e |
        Bb4e A4e Bb4e A4e Bb4e A4e |
        Bb4s A4s Bb4s A4s Bb4s A4s Bb4s A4s Bb4s A4s Bb4s A4s |
        Bb4s A4s Bb4s A4s Bb4s A4s Bb4s A4s Bb4s A4s Bb4s A4s |
        Bb4e rq E4e rq`,
      chords: `A7 | A7 | A7 | A7 | Bb E`,
    },
    pause: {
      name: "A long pause",
      bpm: 40,
      melody: `rh.`,
      chords: `-`,
    },
    regrets: {
      name: "Adagio: the troupe’s regrets",
      bpm: 63,
      melody: `Bb4h.~ |
        Bb4h. |
        A4h.~ |
        A4q rh |
        G#4h. |
        G4h. |
        A4q rh |
        A4q rh |
        A4q re`,
      chords: `Gm6 | Gm6 | A | A | Bb7 | Gm6 | A | A | A`,
    },
    march: {
      name: "The march",
      bpm: 126,
      pickup: 1.5,
      melody: `rq. |
        rq A3e A3e G3e A3e |
        Bb3e re Bb3e G3e rq |
        rq G3e G3e F3e G3e |
        A3e re A3e F3e rq |
        rq F3e F3e E3e F3e |
        G3e rq E3e rq |
        A3e rh re |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq F4e A4q G4e |
        F4e re A4e C5q Bb4e |
        A4e re C5e E5q D5e |
        C#5e Bb4e A4e G4e F4e E4e |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq A4e C5q Bb4e |
        A4e G4e F4e Eb4e G4e Bb4e |
        D4e C#4e D4e E4e re F4e |
        E4q. D4e rq`,
      chords: `- | Dm | Gm | C | F | Bb | Gm A7 | A | Dm | A7 | Dm | A7 | Dm A7 | Dm C7 | F E7 | A7 | Dm | A7 | Dm | A7 | Dm C7 | F Gm | Dm A7 | A7 Dm`,
    },
    tutti: {
      name: "Full orchestra",
      melody: `rq A4e A4e G#4e A4e |
        C#5e re B4e A4e re G#4e |
        rq A4e A4e G#4e A4e |
        C#5e re B4e A4e re G#4e |
        rq A4e Bb4e. C5s D5e |
        Eb5e re A4e Bb4e. C5s D5e |
        Eb5e re A4e A4e G4e F4e |
        G4e~ A4e G4e F4e re Eb4e |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        F4e re A4e C5q Bb4e |
        A4e G4e F4e Eb4e G4e Bb4e |
        D4e~ C#4e D4e E4e re F4e`,
      chords: `A | Dm E7 | A | Dm E7 | A Dm | A Gm | A7 Dm | Em7 A7 | Dm | A7 | Dm | A7 | Dm C7 | F Gm | Dm A7`,
      endings: [
        { melody: `E4q. D4e rq`, chords: `A7 Dm` },
        { melody: `D4e re D4e D4e C#4e B3e`, chords: `Dm` },
      ],
    },
    shadows: {
      name: "Shadows in the bass",
      melody: `C#4e re D4e E4e re C#4e |
        F4e re F4e D4e re D4e |
        G#4e re G#4e E4e re E4e |
        rq A4e A4e G#4e F#4e |
        G#4e re A4e B4e re G#4e |
        C5e re C5e A4e re A4e |
        C#5e re C#5e A4e re A4e |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e re C#4e |
        F4e re F4e D4e re D4e |
        G#4e re G#4e E4e re E4e |
        rq A4e A4e G#4e F#4e |
        G#4e re A4e B4e re G#4e |
        C5e re C5e A4e re A4e |
        C#5e re C#5e A4e re A4e |
        D5q. A4e re C5e |
        Bb4q. G4e re Bb4e |
        A4e re G4e F4e re E4e |
        F4q. D4e rq |
        F5q. C5e re Eb5e |
        D5q. Bb4e re D5e |
        C5e re Bb4e A4e re G4e |
        A4q. F4e rq |
        A5q. E5e re G5e |
        F#5q. D5e re F#5e |
        E5e re D5e C#5e re B4e |
        C#5q. A4e rq |
        A5q. E5e re G5e |
        F#5q. D5e re F#5e |
        E5e re D5e C#5e re B4e |
        A4e rh re`,
      chords: `A7 | Dm | E7 | Dm E7 | E | Am F | A | Dm | A7 | Dm | E7 | Am | E7 | Am C | Dm A7 | D7 | Gm | A7 | Dm | F7 | Bb | C7 | F | A7 | D | E7 | A | A7 | D | E7 | A7`,
    },
    again: {
      name: "The march again",
      melody: `rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq F4e A4q G4e |
        F4e re A4e C5q Bb4e |
        A4e re C5e E5q D5e |
        C#5e Bb4e A4e G4e F4e E4e |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        F4e re A4e C5q~ Bb4e |
        A4e G4e F4e Eb4e G4e Bb4e |
        D4e C#4e D4e E4e re F4e |
        E4q. D4e rq`,
      chords: `Dm | A7 | Dm | A7 | Dm A7 | Dm C7 | F E7 | A7 | Dm | A7 | Dm | A7 | Dm C7 | F Gm | Dm A7 | A7 Dm`,
    },
    trio: {
      name: "Trio in D major",
      key: "D",
      melody: `D5q re A4q re |
        F#5q re E5q re |
        D5q re D5e C#5e B4e |
        G5e re F#5e E5e re A5e |
        D5q re A4q re |
        F#5q re E5q re |
        D5q re D5e C#5e B4e |
        D5e re C#5e B4e rq |
        D5q re B4q re |
        D5e re A4e A4e B4e C5e |
        B4e re C5e D5e re E5e |
        A4e re C5e B4e re A4e |
        D5q re B4q re |
        D5e re A4e A4e B4e C5e |
        B4e re D5e C#5e re B4e |
        C#5e re D5e E5e re A5e |
        D5q re A4q re |
        F#5q re E5q re |
        D5q re D5e C#5e B4e |
        G5e re F#5e E5e re A5e |
        D5q re A4q re |
        F#5q re E5q re`,
      chords: `D | D F#7 | Bm | Em A7 | D | D F#7 | Bm | F#7 Bm | G | D7 | G | D7 | G | D7 | G | A7 | D | D F#7 | Bm | Em A7 | D | D F#7`,
      endings: [
        { melody: `D5e re B3e C4e D4e E4e |
        F#4e re F#4e B3e rq`, chords: `Bm C | F#7 Bm` },
        { melody: `D5e rq D5e C#5e B4e |
        G5e rq G5e F#5e E5e |
        C#5e rq C#5e B4e A4e`, chords: `Bm | Em | A7` },
      ],
    },
    dark: {
      name: "Darkness gathers",
      key: "Dm",
      melody: `A4e rh re |
        C#4e rq C#4e B3e A3e |
        A4e rh re |
        D4e rq D4e C4e Bb3e |
        A4e rh re |
        D#4e rq D#4e C#4e B3e |
        A4e rq E4e D4e C4e |
        A4e E4e D4e C#4e A4e E4e |
        D4e C#4e A4e E4e D4e C#4e |
        A4e Bb4e A4e G#4e G4e A4e |
        F#4e F4e A4e E4e Eb4e A4e`,
      chords: `A | A7 | A | Dm | A | A7 | Am | A7 | A7 | A7 | A7`,
    },
    last: {
      name: "The march once more",
      melody: `rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq F4e A4q G4e |
        F4e re A4e C5q Bb4e |
        A4e re C5e E5q D5e |
        C#5e Bb4e A4e G4e F4e E4e |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        rq D4e D4e C#4e B3e |
        C#4e re D4e E4e rq |
        F4e re A4e C5q Bb4e |
        A4e G4e F4e Eb4e G4e Bb4e |
        D4e D5e Db5e C5e Cb5e Bb4e |
        A4e A3e Bb3e B3e C4e C#4e |
        D4e rh re`,
      chords: `Dm | A7 | Dm | A7 | Dm A7 | Dm C7 | F E7 | A7 | Dm | A7 | Dm | A7 | Dm C7 | F Gm | Dm | A7 | Dm`,
    },
    coda: {
      name: "Coda: tiptoeing home",
      melody: `Eb4h. |
        rq E4e E4e D#4e E4e |
        A4e re G4e F4e re E4e |
        D4e rh re |
        Eb4h. |
        rq E4e E4e D#4e E4e |
        A4e re G4e F4e re E4e |
        re D4e E4e F4e G4e G#4e |
        A4h.~ |
        re D4e E4e F4e G4e G#4e |
        A4h.~ |
        A4e D4e E4e F4e G4e G#4e |
        re D4e E4e F4e G4e G#4e |
        A4e D4e E4e F4e G4e G#4e |
        A4e A4e Bb4e B4e C5e C#5e |
        D5e rh re |
        A4e rh re |
        D5e rh re`,
      chords: `D7 | Gm E7 | Dm A7 | Dm | D7 | Gm E7 | Dm A7 | Dm | A | Dm | A | Dm | A Dm | Dm | A7 | Dm | A | Dm`,
    },
  },
  form: ["intro", "pause", "regrets", "march", "tutti:1", "tutti:2", "shadows", "again", "trio:1", "trio:2", "dark", "last", "coda"],
};
