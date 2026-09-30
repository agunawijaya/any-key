import type { FullSource } from "../score";

/*
 * Sakura Sakura is already whole in the 1981 program: the song has only
 * fourteen bars. It is sung twice (the second verse has new words on the
 * same melody), so the full version plays it twice and lets the last
 * phrase ring out slower, the way a koto player would close it.
 */
export const sakura: FullSource = {
  id: "sakura",
  bpm: 72,
  meter: [4, 4],
  key: { doName: "C", tonic: "A", mode: "in" },
  about: "Both verses, the way it is sung, with the last phrase ringing out slower like a koto player closing the piece.",
  source: "Traditional Japanese melody (public domain). The same lead sheet as the 1981 version, with both verses.",
  excerpt: "verse",
  sections: {
    verse: {
      name: "Verse",
      melody: `A4q A4q B4h | A4q A4q B4h | A4q B4q C5q B4q | A4q B4e A4e F4h |
        E4q C4q E4q F4q | E4q E4e C4e B3h | A4q B4q C5q B4q | A4q B4e A4e F4h |
        E4q C4q E4q F4q | E4q E4e C4e B3h | A4q A4q B4h | A4q A4q B4h |
        E4q F4q B4e A4e F4q | E4w`,
      chords: `Am | Am | Am | F | Am | Esus4 | Am | F | Am | Esus4 | Am | Am | Dm F | Esus4`,
    },
    close: {
      name: "Closing phrase",
      melody: `@60 A4q A4q B4h | @52 E4q F4q B4e A4e F4q | E4w`,
      chords: `Am | Dm F | Esus4`,
    },
  },
  form: ["verse", "verse", "close"],
};
