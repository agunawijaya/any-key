import type { FullSource } from "../score";

/*
 * The whole first movement (Molto allegro) of Mozart's Symphony No. 40 in
 * G minor, K. 550: exposition, development and recapitulation, 299 bars in
 * cut time, played once through (the exposition repeat is left out, as many
 * recordings do).
 *
 * The notes were read from Gaylon Babcock's concert-pitch engraving of the
 * full score (IMSLP, Creative Commons Attribution 4.0). The tune follows the
 * first violins, handing over to the winds where they carry it (the motif
 * passed between clarinet and bassoon in the codettas, the flute over the
 * hammered Ds) and to the basses in the development's fugato. The chords are
 * our reading of the full orchestra, half a bar at a time.
 */
export const forty: FullSource = {
  id: "forty",
  bpm: 216,
  meter: [2, 2],
  key: "Gm",
  about: "The whole first movement: the restless theme, the sighing second theme, the stormy development and the return, 299 bars without a break.",
  source: "Mozart, Symphony No. 40, K. 550, first movement; notes from Gaylon Babcock’s engraving of the full score (IMSLP, CC BY 4.0).",
  excerpt: "exposition",
  sections: {
    exposition: {
      name: "Exposition",
      melody: `rh. Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Bb5q rq Bb5e A5e |
        G5q G5e F5e Eb5q Eb5e D5e |
        C5q C5q rq D5e C5e |
        C5q D5e C5e C5q D5e C5e |
        C5q A5q rq A5e~ G5e |
        F#5q F#5e Eb5e D5q D5e C5e |
        Bb4q Bb4q rq Bb5e A5e |
        A5q C6q F#5q A5q |
        G5q D5q rq Bb5e A5e |
        A5q C6q F#5q A5q |
        G5q Bb5q A5e G5e F5e Eb5e |
        rq F#5q G5q A5q |
        Bb5q C6e Bb5e A5q G5q |
        D5h rq D4e D4e |
        D5q rq C#5h |
        D5q rq C#5h |
        D5q C#5q D5q C#5q |
        D4h rq Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Bb5q rq Bb5e A5e |
        G5q G5e F5e Eb5q Eb5e D5e |
        C5q C5q rq F5e~ Eb5e |
        Eb5q F5e Eb5e Eb5q F5e Eb5e |
        Eb5q C6q rq C6e Bb5e |
        A5q A5e G5e F5q F5e Eb5e |
        Bb5h.~ Bb5q |
        F5h. re F5e |
        Eb5q G5q Bb5q rq |
        D5q F5q Bb5q re D5e |
        C5q Eb5q G5q C5q |
        Bb4q D5q F5q re F5e |
        E5e F5e G5e A5e Bb5e C6e Db6e F5e |
        E5e F5e G5e A5e Bb5e C6e Db6e F5e |
        E5e F5e G5e A5e Bb5e C6e Db6e F5e |
        E5e F5e G5e A5e Bb5e C6e Db6e E5e |
        F5h C6q A5q |
        Db6h E5q G5q |
        F5h C6e A5e C6e A5e |
        Db6e Bb5e Db6e Bb5e E5e G5e E5e G5e |
        F5q rq F4q rq |
        rh. rq |
        F5h. E5q |
        Eb5h. F5s Eb5s D5s C5s |
        Bb4q Bb4q Bb4q C5q |
        D5q. Eb5e C5q rq |
        G5h. F#5q |
        F5q E5q Eb5q D5q |
        C5q Eb5h A4q |
        Bb4e A4e C5e Bb4e D5e C5e Eb5e D5e |
        F6h. E6q |
        Eb5h. F5s Eb5s D5s C5s |
        Bb4q Bb5q Bb5q C6q |
        D6q. Eb6e C6q rq |
        G4h. F#4q |
        F4q E4q Eb4q D4q |
        Db4h. C4q |
        Db4h. C4q |
        Db4h. C4q |
        Db4h. C4q |
        Db4e Db5e Db5e Db5e Db5h |
        Db5e Db6e Db6e Db6e Db6h |
        D6h.~ D6q |
        A5h.~ A5e G5s A5s |
        Bb5q D4e D4e D4e D4e Eb4e Eb4e |
        E4e E4e F4e F4e F#4e F#4e G4e G4e |
        Ab4q re. Ab4s G4q re. G4s |
        Eb5q re. Eb5s D5q re. D5s |
        G5h G5e F5e Eb5e D5e |
        C5e Bb4e A4e G4e F4e Eb4e D4e C4e |
        Bb3q rh G5e F5e |
        F5q G5e F5e F5q G5e F5e |
        F5q G5e F5e F5q G5e F5e |
        F5q G5e F5e F5q G5e~ F5e |
        F5q G5e F5e F5q Eb6e D6e |
        D6q Eb6e D6e D6q Eb6e D6e |
        D6h Eb6q. C6e |
        Bb5q. D6e C6q. A5e |
        Bb5q rh G5e F5e |
        F5q G5e F5e F5q G5e F5e |
        F5q G5e F5e F5q G5e F5e |
        F5q G5e F5e F5q G5e~ F5e |
        F5q G5e F5e F5q E6e D6e |
        D6q E6e D6e D6q E6e D6e |
        D6h E6q. C6e |
        Bb5q. D6e C6q. A5e |
        Bb5e F5e D6e C6e Bb5e A5e G5e F5e |
        E5e D5e C5e Bb4e A4e G4e F4e E4e |
        D5q F5q G5q A5q |
        Bb4e F4e D5e C5e Bb4e A4e G4e F4e |
        Eb4e D4e C4e Bb3e A3e C4e F4e Eb4e |
        D4q F5q G5q A5q |
        Bb5q G5q F5q A4q |
        Bb4e D5e F5e Bb5e A5e F5e C6e A5e |
        Bb5e F5e D6e Bb5e A5e F5e C6e A5e |
        Bb5e F5e D6e Bb5e A5e F5e C6e A5e |
        Bb5e D6e C6e A5e Bb5e D6e C6e A5e |
        Bb5q rh. |
        F#5q rh.`,
      chords: `Eb Gm | Gm | Gm | Gm7 Eb | Cm F7 | Cm F7 | D7 | D7 | Gm | F7 D7 | Gm | F7 D7 | Gm Gm7 | D7 Em7 | Eb7 | D Gb7 | D F#7 | D F#7 | D | D F7 | Gm D | Gm | Gm7 Gm | Cm7 | Cm7 | F7 | F7 | Bb Gm | F | Eb | Bb | Cm | Bb | C7 | C7 Eb7 | C7 Eb7 | C7 | F F7 | Bbm | F F7 | Bbm Gm7 | F | - | Bb Dm7 | F7 | Eb Gm | Bb Am | Cm Eb | F7 Gm7 | Cm F7 | Gm D7 | Dm Dm7 | F7 | Gm | Bb Am | Cm Cm7 | G7 F7 | Eb7 | Eb7 | Eb7 | Eb7 | Eb7 | C7 | Bb | F7 | Bb D7 | E7 G#7 | Bb7 Eb | F7 Bb | Eb G7 | F F7 | Bb Gm7 | Eb F7 | F7 Bb | Eb F7 | F7 Bb | D7 | Gm Cm | Bb F7 | Bb Gm7 | Cm7 F7 | F7 Gm7 | Cm7 F7 | Bb | D7 | Gm Cm | Bb F7 | Bb | Cm7 F7 | Bb Eb | Bb Gm7 | C7 F7 | Bb C7 | Gm Dm7 | Bb F7 | Bb F7 | Bb F7 | Bb | Bb - | D7 -`,
    },
    development: {
      name: "Development",
      melody: `G5q rq G#5q rq |
        D6h.~ D6q |
        C#6h rq D5e C#5e |
        C#5q D5e C#5e C#5q D5e C#5e |
        C#5q A5q rq A5e G#5e |
        F#5q F#5e E5e D5q D5e C#5e |
        B#4q B#4q rq C#5e B4e |
        B4q C#5e B4e B4q C#5e B4e |
        B4q G#5q rq G#5e~ F#5e |
        E#5q E#5e D5e C#5q C#5e B4e |
        A#4q A#4q rq B4e A4e |
        A4q B4e A4e A4q B4e A4e |
        A4q F#5q rq F#5e E5e |
        D#5q D#5e C5e rq C5e B4e |
        B4q C5e B4e B4q C5e B4e |
        B4q G5q rq G5e~ F#5e |
        E5q E5e D5e C5q C5e B4e |
        C6q A4q rq Bb5e A5e |
        A5q Bb5e A5e A5q Bb5e A5e |
        A5q F6q rq F6e E6e |
        D6q D6e C6e Bb5q Bb5e A5e |
        G5e D5e G3q rq A4e G4e |
        G4q A4e G4e G4q A4e~ G4e |
        G4q E5q rq E5e D5e |
        C5q C5e Bb4e A4q A4e G4e |
        A5q F4q rq G5e F5e |
        F5q G5e F5e F5q G5e F5e |
        F5q D6q rq D6e C6e |
        Bb5q Bb5e A5e G5q G5e F5e |
        Eb5q C6q rq C6e Bb5e |
        A5q A5e G5e F#5q F#5e~ E5e |
        D5q Bb5q Bb5q Bb5e A5e |
        G5q G5e F5e E5q E5e D5e |
        C#5q A5q F6q Bb5e A5e |
        A5q Bb5e A5e A5q Bb5e A5e |
        A5q A5q F6q Bb5e A5e |
        A5q Bb5e A5e A5q Bb5e A5e |
        A5q A5q rq Bb5e A5e |
        A5q Bb5e A5e A5q Bb5e A5e |
        A5q A5q Eb5q C6e~ Bb5e |
        Bb5q C6e Bb5e Bb5q C6e Bb5e |
        Bb5q Bb5q F5q C6e B5e |
        B5q C6e B5e B5q C6e B5e |
        B5q B5q F5q D6e C6e |
        C6q D6e C6e C6q D6e C6e |
        C6q C6q G5q Bb5e A5e |
        A5q Bb5e A5e A5q Bb5e A5e |
        A5q B5e C6e C6q G5e F#5e |
        F#5q G5e F#5e F#5q G5e F#5e |
        F#5q Eb6e D6e D6q Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q G6e F#6e F#6q D6e Eb6e |
        Eb6q C6q Eb6q Eb6e D6e |
        D6q Bb5q D6q D6e C#6e |
        C#6q E6q C#6q C#6e D6e |
        D6q A5q F#5q B5e C6e |
        C6q C6q F#6q A5e Bb5e |
        Bb5q D6q G6q G#5e A5e |
        A5q F#5e G5e G5q C#5e D5e |
        D5q Eb6e D6e D6h |
        D6q D6e C6e C6h |
        C6q C6e B5e Bb5h |
        E5h. Eb5e D5e |
        A5q A5e Ab5e G5h`,
      chords: `Gm C#7 | Bm | A E7 | F#m C# | F#m | F#m7 D | G#7 G#m7 | G7 | C#7 | Fm7 Eb7 | C7 Am7 | F7 | B7 | B7 D7 | Em B | Em | C7 Am | Am7 A7 | Dm A7 | Dm | G7 Gm | C7 G7 | Am7 G7 | C | C7 F | F F7 | Bb F7 | Gm7 Bb | Gm Gm7 | Gm7 Am7 | F G#7 | D7 Gm | Gm7 Em7 | A Dm | A Dm | A Dm | A Dm | A | A F7 | F7 | Bb Bbm | Bbm Db7 | G | G7 | C Cm | Cm | D7 | D7 | D7 | D7 | D7 | D7 | Ab7 Bm7 | Gm | C7 F#7 | Bm7 D | D7 | Gm G | D7 Gm | D | Em7 D7 | Dm7 Bb | D | G Gm`,
    },
    recapitulation: {
      name: "Recapitulation",
      melody: `G6h.~ G6q |
        D5q Bb5q rq Bb5e A5e |
        G5q G5e F5e Eb5q Eb5e D5e |
        C5q C5q rq D5e C5e |
        C5q D5e C5e C5q D5e C5e |
        C5q A5q rq A5e~ G5e |
        F#5q F#5e Eb5e D5q D5e C5e |
        Bb4q Bb4q rq Bb5e A5e |
        A5q C6q F#5q A5q |
        G5q D5q rq Bb5e A5e |
        A5q C6q F#5q A5q |
        G5q Bb5q A5e G5e F5e Eb5e |
        rq F#5q G5q A5q |
        Bb5q C6e Bb5e A5q G5q |
        D5h rq D4e D4e |
        D5q rq C#5h |
        D5q rq C#5h |
        D5q C#5q D5q C#5q |
        D4h rq Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Bb5q rq Bb5e Ab5e |
        G5q G5e F5e Eb5q F5e Eb5e |
        D5q D5q rq Bb5e~ Ab5e |
        Ab5q Bb5e Ab5e Ab5q Bb5e Ab5e |
        Ab5q Bb4q rq F5e Eb5e |
        D5q D5e C5e Bb4q Bb4e Ab4e |
        Eb5h.~ Eb5q |
        Bb5h. re Bb5e |
        Ab5q C6q Eb6q rq |
        G5q Bb5q Eb6q re G5e |
        F5q Ab5q C6q F5q |
        E5q G5q Bb5q Db5q |
        C5q E5q G5q Bb4q |
        Ab4e F4e C5e Ab4e F5e C5e Ab5e F5e |
        E5e G5e C6e Bb5e Ab5e G5e F5e Eb5e |
        Db5e F5e Bb5e Ab5e G5e F5e Eb5e Db5e |
        C5e Eb5e Ab5e G5e F5e Eb5e Db5e C5e |
        Bb4e Db5e G5e F5e E5e Db5e C5e Bb4e |
        Ab4q re C5e F5q Ab5q |
        Bb3q re F5e Bb5q D6q |
        Eb4q re Bb4e Eb5q G5q |
        Ab3q re C5e Ab5q C6q |
        D4q re A5e D6q F6q |
        G3q re D5e G5q B5q |
        C4q re G4e C5q Eb5q |
        D4q re C5e F#5q A5q |
        G4h.~ G4q |
        D5h. re D5e |
        C5q Eb5q G5q rq |
        Bb4q D5q G5q re Bb5e |
        A5q C6q Eb6q re F#5e |
        G5q Bb5q D6q re D5e |
        C#5e D5e E5e F5e G5e A5e Bb5e D5e |
        C#5e D5e E5e F5e G5e A5e Bb5e D5e |
        C#5e D5e E5e F5e G5e A5e Bb5e D5e |
        C#5e D5e E5e F5e G5e A5e Bb5e C#5e |
        D5h A5q F#5q |
        Bb5h C#5q E5q |
        D5h A5e F#5e A5e F#5e |
        Bb5e G5e Bb5e G5e C#5e E5e C#5e E5e |
        D5q rq D6q rq |
        rh. rq |
        D5h. C#5q |
        C6h. D6s C6s B5s A5s |
        G5q G4q G4q A4q |
        Bb4q. C5e A4q rq |
        Eb5h. D5q |
        C#5q C5q B4q Bb4q |
        A4q C5h F#4q |
        G5e F#5e A5e G5e Bb5e A5e C6e Bb5e |
        D6h. C#6q |
        C5h. D5s C5s Bb4s A4s |
        G4q G5q G5q A5q |
        Bb5q. C6e A5q rq |
        Eb5h. D5q |
        C#5q C5q B4q Bb4q |
        Ab4h. G4q |
        Ab4h. G4q |
        Ab4h. G4q |
        Ab4h. G4q |
        Ab4e A5e A5e A5e A5h |
        Ab5h Ab5h |
        A5h. A5e G5s A5s |
        Bb5h. Bb5e A5s Bb5s |
        B5h. B5e~ A5s B5s |
        C6h. C6e B5s C6s |
        G6h E6q C#6q |
        D6h.~ D6q |
        F#5h.~ F#5e E5s F#5s |
        G5q Bb3e Bb3e Bb3e Bb3e C4e C4e |
        C#4e C#4e D4e D4e Eb4e Eb4e E4e E4e |
        F4q re. F4s Eb4q re. Eb4s |
        C5q re. C5s Bb4q re. Bb4s |
        E5h E5e D5e. rs Bb4e |
        A4e G4e F#4e Eb4e D4e C4e Bb3e A3e |
        G3q rh Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Eb5e D5e D5q Ab5e G5e |
        G5q Ab5e G5e G5q Ab5e~ G5e |
        G5h Eb6q. C6e |
        Bb5q. D6e F#5q. A5e |
        G5q rh Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Eb5e D5e D5q Eb5e D5e |
        D5q Eb5e D5e D5q Ab5e G5e |
        G5q Ab5e G5e G5q Ab5e~ G5e |
        G5h Eb6q. C6e |
        Bb5q. G5e D6q. F#5e |
        G5e D5e Bb5e A5e G5e F5e Eb5e D5e |
        C5e Bb4e A4e G4e F#4e Eb4e D4e C4e |
        Bb3q D5q Eb5q F#4q |
        G4e D4e Bb4e A4e G4e F4e Eb4e D4e |
        C#4e E4e A4e G4e F#4e Eb4e D4e C4e |
        Bb5q G5h Ab5q |
        A5q A5h Bb5q |
        Bb5q B5h C6q |
        C6q C#6h re. D6s |
        D6h.~ D6q |
        F#5h.~ F#5q |
        G5q rh Ab5e G5e |
        G5q Ab5e G5e G5q Ab5e G5e |
        G5q C6h Bb5q |
        Bb5q A5h G5q |
        F#5h.~ F#5q |
        F5h.~ F5q |
        G5e D5e Bb5e G5e F#5e D5e A5e F#5e |
        G5e D5e Bb5e G5e F#5e D5e A5e F#5e |
        G5e D5e Bb5e G5e F#5e D5e A5e F#5e |
        G5e Bb5e A5e F#5e G5e Bb5e A5e F#5e |
        G5q rh. |
        G5q rq Bb5q rq |
        G3h rh`,
      chords: `D7 | Gm | Gm7 Eb | Cm F7 | Cm F7 | D7 Am7 | D7 | Gm | F7 D7 | Gm | F7 D7 | Gm Gm7 | D7 Em7 | Eb7 | D Gb7 | D F#7 | D F#7 | D | D F7 | Gm D | Gm | Eb | Bb7 | Abm Db7 | Bb7 Dm | Bb7 | Eb | Bb | Ab | Eb | Fm | C7 Eb7 | C C7 | Fm | C Cm | Bbm Eb7 | Ab Fm | Eb7 C7 | Fm | Bb7 | Eb | Ab Cm | Dm7 | G7 | Cm F7 | D7 | Gm | Dm | Cm | Gm | F7 Ab7 | Gm | A7 | A7 Eb7 | A7 Eb7 | A7 | D D7 | Gm | D D7 | Gm | D | - | Gm Bb | D7 | G7 Am7 | Gm Gbm | D7 Cm7 | A7 G | F7 D7 | Eb C7 | Bb | Ab7 C7 | G7 Am7 | Gm Gbm | F7 | A7 G | Bb7 | Bb7 | Bb7 | Bb7 | Bb7 | Bb7 E7 | B7 | Bbm | G7 Db7 | Cm | Eb7 | Gm | D7 | Gm C7 | Gb Cm | G7 Eb | D7 Gm | C C7 | D D7 | Gm | Cm D7 | D7 Gm | G D7 | D7 Gm | G7 | Cm | Gm D7 | Gm Eb | G Bm | G | G Bm | G | G7 | Cm | Gm D7 | Gm Gm7 | Cm7 Ab7 | Gm Cm | Gm Gm7 | A7 G#7 | C7 Em | Am7 Eb7 | Gm G7 | C Eb7 | Gm7 | D7 | G G7 | Gm7 G | Cm Cm7 | Cm7 Cm | G D7 | D7 Dm7 | Gm D7 | Gm D7 | Gm D7 | Gm | Gm - | Gm | Gm -`,
    },
  },
  form: ["exposition", "development", "recapitulation"],
};
