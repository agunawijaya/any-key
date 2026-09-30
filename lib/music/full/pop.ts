import type { FullSource } from "../score";

/*
 * Pop! Goes the Weasel is already whole in the 1981 program: the famous
 * strain and the second strain from the 1850s country dance. The full
 * version plays it the way the dancers needed it, three times through,
 * and holds back the very last "pop".
 */
export const pop: FullSource = {
  id: "pop",
  bpm: 150,
  meter: [6, 8],
  key: "G",
  about: "Three times through, as a dance band would play it, holding back the very last pop.",
  source: "Traditional English dance tune (public domain). The same lead sheet as the 1981 version, played in dance form.",
  excerpt: ["a", "b"],
  sections: {
    a: {
      name: "First strain",
      melody: `G4q G4e A4q A4e | B4e D5e B4e G4q D4e | G4q G4e A4q A4e | B4q. G4q D4e |
        G4q G4e A4q A4e | B4e D5e B4e G4q. | E5q. A4q C5e | B4q. G4q.`,
      chords: `G | G | D7 | G | G | G | C D7 | G`,
    },
    b: {
      name: "Second strain",
      melody: `G5q G5e E5q G5e | F#5e A5e F#5e D5q. | G5q G5e E5q G5e | F#5q. D5q. |
        B4q C5e B4q C5e | D5q E5e F#5q G5e | E5q. A4q C5e | B4q. G4q.`,
      chords: `C | D7 | C | D7 | G | D7 | C D7 | G`,
    },
    tag: {
      name: "Tag",
      melody: `@132 B4q C5e B4q C5e | D5q E5e F#5q G5e | @110 E5q. A4q C5e | @96 B4q. rq. | G5q. rq.`,
      chords: `G | D7 | C D7 | G | G`,
    },
  },
  form: ["a", "b", "a", "b", "a", "b", "tag"],
};
