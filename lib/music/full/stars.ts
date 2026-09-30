import type { FullSource } from "../score";

/*
 * The whole march, as Sousa published it for piano (Cincinnati: The John
 * Church Company, 1897): the fanfare, two strains played twice, the trio in
 * A-flat, then the "dogfight" break strain and the grandioso trio, twice.
 *
 * The notes come from the Mutopia Project's public-domain edition of that
 * print (its LilyPond source and MIDI), taking the tune from the right hand.
 * In the break strain the call is in the left hand, so it is written here an
 * octave up, with the right hand's answers after it. Chords are our reading
 * of Sousa's harmony, half a bar at a time.
 */
export const stars: FullSource = {
  id: "stars",
  bpm: 232,
  meter: [2, 2],
  key: "Eb",
  about: "The whole march as Sousa published it: the fanfare, two strains, the trio, the “dogfight” break strain and the grandioso finale.",
  source: "Sousa's piano edition (John Church Company, 1897), public domain, via the Mutopia Project's public-domain engraving.",
  excerpt: "trio",
  sections: {
    intro: {
      name: "Introduction",
      melody: `Eb5h D5q. Eb5e |
        C5q Eb5h F5q |
        Gb5q G5q Ab5q A5q |
        Bb5q rq Bb4h`,
      chords: `Eb | Cm | Cb | Bb`,
    },
    first: {
      name: "First strain",
      melody: `G5q re G5e G5q G5q |
        G5q re G5e Ab5q Ab5q |
        F5e E5e F5e G5e F5q Eb5q |
        D5q C5q D5q Bb4q |
        Bb5q re Bb5e Bb5q Bb5q |
        Bb5q re Bb5e B5q B5q |
        C6e B5e C6e Eb6e D6q C6q |
        B5h. B5q |
        Bb5q re Bb5e Eb6q re C6e |
        Bb5q A5q Bb5q G5q |
        F5q Bb4e A4e Bb4e A4e Bb4q |
        F5q Bb4e A4e Bb4e A4e Bb4q |
        Bb5q re Bb5e Eb6q re C6e |
        Bb5q A5q Bb5q Gb5q |
        F5q A4e G4e A4e G4e A4q`,
      chords: `Eb G7 | Cm Fm | Bb F7 | Bb Bb7 | Eb Bb7 | Eb G7 | Cm | G | Eb | Eb | Bb7 | Bb7 | Eb | Eb | F7`,
      endings: [
        { melody: `Bb4q rq Bb4h`, chords: `Bb` },
        { melody: `Bb4q rq Bb5q. Ab5e`, chords: `Bb Bb7` },
      ],
    },
    second: {
      name: "Second strain",
      melody: `G5h C6q. Bb5e |
        D5h C5h |
        Bb4h Ab5h |
        G5h F5q. G5e |
        Ab5q C6h Eb6q |
        F6h Eb6h |
        G5w |
        F5h Bb5q. Ab5e |
        G5h C6q. Bb5e |
        D5h C5h |
        Bb4h Ab5h |
        G5h F5q. G5e |
        Ab5q C6q F6q. Eb6e |
        G5q Bb5q Eb5q. G5e |
        F5w`,
      chords: `Eb | Bb7 | Bb7 | Eb | Ab | F7 | Eb | Bb7 | Eb | Bb7 | Bb7 | Eb Eb7 | Ab Abm | Eb | Bb7`,
      endings: [
        { melody: `Eb5q rq Bb5q. Ab5e`, chords: `Eb Bb7` },
        { melody: `Eb5q rq Eb5h`, chords: `Eb` },
      ],
    },
    trio: {
      name: "Trio",
      key: "Ab",
      melody: `Eb5h Db5q C5q |
        C5h B4q C5q |
        C5w~ |
        C5h B4q C5q |
        C5h B4q C5q |
        Eb5h C5q. Eb5e |
        Db5w |
        Bb4h Bb4h |
        Bb4h A4q Bb4q |
        Bb4h A4q Bb4q |
        Db5w~ |
        Db5h C5q Bb4q |
        C5q Eb5h. |
        F5h. F5q |
        Bb4w~ |
        Bb4h Eb5h |
        Eb5h Db5q C5q |
        C5h B4q C5q |
        C5w~ |
        C5h B4q C5q |
        C5h B4q C5q |
        Db5q C5q Bb4q. G5e |
        Bb4w |
        Ab4h Ab4h |
        Ab4h G4q Ab4q |
        Cb5h Bb4q Ab4q |
        Ab5w~ |
        Ab5q Ab4q Bb4q C5q |
        Eb5e re Ab4q Bb4q C5q |
        Eb5e re Eb4q F4q C5q |
        Bb4w |
        Ab4q rh.`,
      chords: `Ab | Ab | Ab | Ab | Ab | Ab | Eb7 | Eb7 | Eb7 | Eb7 | Eb7 | Eb7 | Ab | Db | Eb | Eb | Ab | Ab | Ab | Ab | C7 | C7 | Fsus4 | Fm | Dbm | Fb | Ab | Ab | Ab | Ab | Eb7 | Ab`,
    },
    break: {
      name: "Break strain",
      melody: `Ab4q G4e re G4q F4e re |
        F4q E4q F5q E5q |
        F4q E4q F5q G5q |
        E5h rh |
        C5q Bb4e re Bb4q Ab4e re |
        Ab4q G4q Ab5q G5q |
        Ab4q G4q Ab5q Bb5q |
        G5h Eb4e G4e Bb4e Db5e |
        Fb5q. Fb5e Fb5q Fb5q |
        Fb5q Eb5q D5q Db5q |
        C5q Cb5q Bb4q A4q |
        Ab4q Gb4q F4e A4e C5e Eb5e |
        Gb5q. Gb5e Gb5q Gb5q |
        Gb5q F5q E5q Eb5q |
        D5q Db5q C5q Cb5q |
        Bb4q Ab4q G4e Bb4e Eb5e G5e |
        Bb5q. Bb5e Bb5q Bb5q |
        Bb5q Bb5q G4e Bb4e Eb5e G5e |
        Bb5q. Bb5e Bb5q Bb5q |
        Bb5q Bb5q G4e Bb4e Eb5e G5e |
        Bb5q. Bb5e A5q. A5e |
        Ab5q. Ab5e G5q. G5e |
        Gb5q. Gb5e F5q. F5e |
        Fb5q Eb5q F5q Eb5q`,
      chords: `Fm | C7 | C7 Bbm | C | C7 | Fm | Fm Dbm | Eb Eb7 | Bbdim | Gdim Eb7 | Ab | Ab7 F7 | Cdim | Adim F7 | Bbm | Eb7 | Bbdim | Eb7 | Bbdim | Eb7 | Eb7 | Eb7 | Eb7 | Eb7`,
    },
    grandioso: {
      name: "Trio, grandioso",
      melody: `Eb6h Db6q C6q |
        C6h B5q C6q |
        C6w~ |
        C6h B5q C6q |
        C6h B5q C6q |
        Eb6h C6q. Eb6e |
        Db6w |
        Bb5h Bb5h |
        Bb5h A5q Bb5q |
        Bb5h A5q Bb5q |
        Db6w~ |
        Db6h C6q Bb5q |
        C6q Eb6h. |
        F6h. F6q |
        Bb5w~ |
        Bb5h Eb6h |
        Eb6h Db6q C6q |
        C6h B5q C6q |
        C6w~ |
        C6h B5q C6q |
        C6h B5q C6q |
        Db6q C6q Bb5q. G6e |
        Bb5w |
        Ab5h Ab5h |
        Ab5h G5q Ab5q |
        Cb6h Bb5q Ab5q |
        Ab6w~ |
        Ab6q Ab5q Bb5q C6q |
        Eb6e re Ab5q Bb5q C6q |
        Eb6e re Eb5q F5q C6q |
        Bb5w`,
      chords: `Ab | Ab | Ab | Ab | Ab | Ab | Eb7 | Eb7 | Eb7 | Eb7 | Eb7 | Eb7 | Ab | Db | Eb | Eb | Ab | Ab | Ab | Ab | C7 | C7 | Fsus4 | Fm | Dbm | Fb | Ab | Ab | Ab | Ab | Eb7`,
      endings: [
        { melody: `Ab5q rh.`, chords: `Ab` },
        { melody: `Ab5q rq Ab5q rq`, chords: `Ab` },
      ],
    },
  },
  form: ["intro", "first:1", "first:2", "second:1", "second:2", "trio", "break", "grandioso:1", "break", "grandioso:2"],
};
