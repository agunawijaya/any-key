import type { FullSource } from "../score";

/*
 * La Cucaracha as the song goes: the 1981 program played only the chorus.
 * The verse ("una cosa me da risa…") alternates with it, three choruses in
 * all, and a slower last phrase rounds it off. Traditional (public domain);
 * our own transcription in G, the chorus exactly as in the 1981 version.
 */
export const bug: FullSource = {
  id: "bug",
  bpm: 132,
  meter: [4, 4],
  key: "G",
  about: "The whole song: the chorus the 1981 program played, the verse it left out, and back again, three choruses in all.",
  source: "Traditional Mexican song (public domain), transcribed for Bop Box.",
  excerpt: "chorus",
  sections: {
    chorus: {
      name: "Chorus",
      pickup: 1.5,
      melody: `D4e D4e D4e |
        G4q. B4q D4e D4e D4e | G4q. B4q. rq | G4e G4e F#4e F#4e E4e E4e D4q | D4h re D4e D4e D4e |
        F#4q. A4q D4e D4e D4e | F#4q. A4q. rq | D5e E5e D5e C5e B4e A4e G4q | G4h. rq`,
      chords: `D7 | G | G | D7 | D7 | D7 | D7 | D7 G | G`,
    },
    verse: {
      name: "Verse",
      melody: `re D4q D4e G4e G4e B4e B4e | D5q. B4e~ B4q rq | re D5q E5e D5e C5e B4e D5e | C5q A4q rh |
        re D4q D4e F#4e F#4e A4e A4e | C5q. A4e~ A4q rq | re D5q E5e D5e C5e B4e A4e | G4h re`,
      chords: `G | G | D7 | D7 | D7 | D7 | D7 | G`,
    },
    close: {
      name: "Last phrase",
      melody: `@112 D5e E5e D5e C5e B4e A4e G4q | @96 G4h. rq`,
      chords: `D7 G | G`,
    },
  },
  form: ["chorus", "verse", "chorus", "verse", "chorus", "close"],
};
