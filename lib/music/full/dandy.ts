import type { FullSource } from "../score";

/*
 * Yankee Doodle is already whole in the 1981 program: a verse and the
 * "keep it up" chorus, sixteen bars. The full version plays it the way a fife and
 * drum band would on parade: three times round, then a tag that slows
 * down into the last phrase.
 */
export const dandy: FullSource = {
  id: "dandy",
  bpm: 116,
  meter: [2, 4],
  key: "G",
  about: "Three times round, parade style, with a tag that slows into the last phrase.",
  source: "Traditional tune (public domain). The same lead sheet as the 1981 version, played in parade form.",
  excerpt: ["verse", "chorus"],
  sections: {
    verse: {
      name: "Verse",
      melody: `G4e G4e A4e B4e | G4e B4e A4e D4e | G4e G4e A4e B4e | G4q F#4q |
        G4e G4e A4e B4e | C5e B4e A4e G4e | F#4e D4e E4e F#4e | G4q G4q`,
      chords: `G | G D | G | G D | G | C | D | G`,
    },
    chorus: {
      name: "Chorus",
      melody: `E4e. F#4s E4e D4e | E4e F#4e G4q | D4e. E4s D4e C4e | B3q D4q |
        E4e. F#4s E4e D4e | E4e F#4e G4e E4e | D4e G4e F#4e A4e | G4q G4q`,
      chords: `C | C G | D7 | G | C | C | G D7 | G`,
    },
    tag: {
      name: "Tag",
      melody: `@108 E4e. F#4s E4e D4e | E4e F#4e G4e E4e | @92 D4e G4e F#4e A4e | @80 G4h`,
      chords: `C | C | G D7 | G`,
    },
  },
  form: ["verse", "chorus", "verse", "chorus", "verse", "chorus", "tag"],
};
