import { compileSong, type Song, type SongSource } from "./score";

/*
 * Eleven public-domain melodies, transcribed for this project from the
 * well-known tunes (not copied from the 1981 program's data). The letters
 * match the original menu, so pressing F still gets you the cockroach song.
 */
const SOURCES: SongSource[] = [
  {
    id: "march",
    letter: "A",
    title: "Funeral March of a Marionette",
    composer: "Charles Gounod, 1872",
    about: "A puppet's mock-serious funeral march. TV made it the theme of a famous mystery show.",
    meter: [6, 8],
    bpm: 120,
    doName: "F",
    tonic: "D",
    mode: "minor",
    pickup: 1.5,
    melody: `A3e D3q |
      D4e D4e C#4e B3e C#4e re | D4e E4e re A3e D3q | D4e D4e C#4e B3e C#4e re | D4e E4e re A3e D4e re |
      F4e A4q G4e F4e re | A4e C5q Bb4e A4e re | C#5e E5q D5e C#5e Bb4e | A4e G4e F4e E4e A3e D3e |
      D4e D4e C#4e B3e C#4e re | D4e E4e re A3e D3q | D4e D4e C#4e B3e C#4e re | D4e E4e re A3e D4e re |
      A3e F4e re A4e C5q | Bb4e A4e G4e F4e Eb4e G4e | Bb4e D4e C#4e D4e E4e re | F4e re E4q. D4e~ | D4q. rq.`,
    chords: `Dm | A7 | A7 Dm | A7 | A7 Dm | Dm | F | A7 | A7 | A7 | A7 Dm | A7 | A7 Dm | F | Gm Eb | A7 | A7 | Dm`,
    character: "spooky",
    ticksPerBeat: 6,
    color: "#7a5cff",
  },
  {
    id: "stars",
    letter: "B",
    title: "The Stars and Stripes Forever",
    composer: "John Philip Sousa, 1896",
    about: "The trio tune of the most famous march ever written. Piccolos not included. Yet.",
    meter: [4, 4],
    bpm: 116,
    doName: "G",
    tonic: "G",
    mode: "major",
    pickup: 0,
    melody: `D5q D5q C5e B4e B4q | A#4e B4e B4h. | A#4e B4e B4q A#4e B4e D5q | B4e D5e C5h. |
      A4q rq A4q G#4e A4e | A4q G#4e A4e C5h | B4q A4e B4e D5q E5q | E5e A4h. re |
      D5q D5q C5e B4e B4q | A#4e B4e B4h. | A#4e B4e B4q A#4e B4e C5e B4e | A4e. F#4s A4h rq |
      G4q re G4e G4q F#4e G4e | A#4q A4e G4e G5h | G4e A4e B4e D5e G4e A4e B4e D5e | D4e E4e. B4s A4h re | G4h rh`,
    chords: `G | G | G | D7 | D7 | D7 | Am7 D7 | D7 | G | G | G C | D7 | G | G7 | G | D7 | G`,
    character: "march",
    ticksPerBeat: 6,
    color: "#3a5bff",
  },
  {
    id: "forty",
    letter: "C",
    title: "Symphony No. 40",
    composer: "Wolfgang Amadeus Mozart, 1788",
    about: "The most restless opening in classical music: three notes, over and over, like a heartbeat.",
    meter: [4, 4],
    bpm: 176,
    doName: "Bb",
    tonic: "G",
    mode: "minor",
    pickup: 1,
    melody: `Eb5e D5e |
      D5q Eb5e D5e D5q Eb5e D5e | D5q Bb5q rq Bb5e A5e | G5q G5e F5e Eb5q Eb5e D5e | C5q C5q rq D5e C5e |
      C5q D5e C5e C5q D5e C5e | C5q A5q rq A5e G5e | F#5q F#5e Eb5e D5q D5e C5e | Bb4q Bb4q rq Bb5e A5e |
      A5q C6q F#5q A5q | G5q D5q rq Bb5e A5e | A5q C6q F#5q A5q | G5q Bb5q A5e G5e F5e Eb5e |
      D5q F#4q G4q A4q | Bb4q C5e Bb4e A4q G4q | D5h rh | G4h rh`,
    chords: `Gm | Gm | Gm | Gm | D7 | D7 | D7 | D7 | Gm | D7 | Gm | D7 | Gm Cm | D7 | Gm D7 | D7 | Gm`,
    character: "drama",
    ticksPerBeat: 4,
    color: "#ff4f9a",
  },
  {
    id: "hat",
    letter: "D",
    title: "Mexican Hat Dance",
    composer: "Traditional, Jalisco",
    about: "The jarabe tapatío: a courtship dance where the finale happens around a sombrero on the floor.",
    meter: [6, 8],
    bpm: 176,
    doName: "F",
    tonic: "F",
    mode: "major",
    pickup: 0,
    melody: `C5e F5e re C5e F5e re | C5e F5q rq. | C5e F5e G5e F5e E5q | F5e G5e rh |
      C5e E5e re C5e E5e re | C5e E5q rq. | C5e E5e F5e E5e D5q | E5e F5e rh |
      C6e B5e C6e A5e G#5e A5e | F5e E5e F5e C5e rq | A4e Bb4e C5e D5e E5e F5e | G5e A5e Bb5e G5e rq |
      Bb5e A5e Bb5e G5e F#5e G5e | E5e D#5e E5e C5e rq | C6e B5e C6e D6e C6e Bb5e | A5e G5e F5q rq`,
    chords: `F | F | C7 | C7 | C7 | C7 | C7 | F | F | F | F | C7 | C7 | C7 | F | C7 F`,
    character: "dance",
    ticksPerBeat: 4,
    color: "#ff6b1a",
  },
  {
    id: "humor",
    letter: "E",
    title: "Humoresque",
    composer: "Antonín Dvořák, 1894",
    about: "A little piano piece with a skip in its step. Everyone knows it; almost nobody knows its name.",
    meter: [2, 4],
    bpm: 84,
    doName: "G",
    tonic: "G",
    mode: "major",
    pickup: 0,
    melody: `G4e. A4s G4e. A4s | B4e. D5s E5e. D5s | G5e. F#5s A5e. G5s | F#5e. A5s G5e. E5s |
      D5e. D5s E5e. D5s | G5e. E5s D5e. B4s | A4h~ | A4q rq |
      G4e. A4s G4e. A4s | B4e. D5s E5e. D5s | E5e. F#5s A5e. G5s | F#5e. A5s G5e. E5s |
      D5e. D5s G5e. G4s | A4q D5q | G4h~ | G4q rq`,
    chords: `G | G | G D7 | D7 | G | G Em | D7 | D7 | G | G | Am | D7 | G | D7 | G | G`,
    character: "lyrical",
    ticksPerBeat: 4,
    color: "#13c2e3",
  },
  {
    id: "bug",
    letter: "F",
    title: "La Cucaracha",
    composer: "Traditional, Mexico",
    about: "“The cockroach” — a folk song that marched through the Mexican Revolution and never left.",
    meter: [4, 4],
    bpm: 132,
    doName: "G",
    tonic: "G",
    mode: "major",
    pickup: 1.5,
    melody: `D4e D4e D4e |
      G4q. B4q D4e D4e D4e | G4q. B4q. rq | G4e G4e F#4e F#4e E4e E4e D4q | D4h re D4e D4e D4e |
      F#4q. A4q D4e D4e D4e | F#4q. A4q. rq | D5e E5e D5e C5e B4e A4e G4q | G4h. rq`,
    chords: `D7 | G | G | D7 | D7 | D7 | D7 | D7 G | G`,
    character: "dance",
    ticksPerBeat: 4,
    color: "#c9f73a",
  },
  {
    id: "pop",
    letter: "G",
    title: "Pop! Goes the Weasel",
    composer: "Traditional, England",
    about: "A 1850s dance craze turned nursery rhyme. The “pop” is the whole point.",
    meter: [6, 8],
    bpm: 150,
    doName: "G",
    tonic: "G",
    mode: "major",
    pickup: 0,
    melody: `G4q G4e A4q A4e | B4e D5e B4e G4q D4e | G4q G4e A4q A4e | B4q. G4q D4e |
      G4q G4e A4q A4e | B4e D5e B4e G4q. | E5q. A4q C5e | B4q. G4q. |
      G5q G5e E5q G5e | F#5e A5e F#5e D5q. | G5q G5e E5q G5e | F#5q. D5q. |
      B4q C5e B4q C5e | D5q E5e F#5q G5e | E5q. A4q C5e | B4q. G4q.`,
    chords: `G | G | D7 | G | G | G | C D7 | G | C | D7 | C | D7 | G | D7 | C D7 | G`,
    character: "playful",
    ticksPerBeat: 4,
    color: "#ff5ca3",
  },
  {
    id: "dandy",
    letter: "H",
    title: "Yankee Doodle",
    composer: "Traditional, 1700s",
    about: "Written to tease, adopted with pride. The “dandy” in the chorus gave the 1981 menu its label.",
    meter: [2, 4],
    bpm: 116,
    doName: "G",
    tonic: "G",
    mode: "major",
    pickup: 0,
    melody: `G4e G4e A4e B4e | G4e B4e A4e D4e | G4e G4e A4e B4e | G4q F#4q |
      G4e G4e A4e B4e | C5e B4e A4e G4e | F#4e D4e E4e F#4e | G4q G4q |
      E4e. F#4s E4e D4e | E4e F#4e G4q | D4e. E4s D4e C4e | B3q D4q |
      E4e. F#4s E4e D4e | E4e F#4e G4e E4e | D4e G4e F#4e A4e | G4q G4q`,
    chords: `G | G D | G | G D | G | C | D | G | C | C G | D7 | G | C | C | G D7 | G`,
    character: "march",
    ticksPerBeat: 6,
    color: "#ffb020",
  },
  {
    id: "sakura",
    letter: "I",
    title: "Sakura Sakura",
    composer: "Traditional, Japan",
    about: "Cherry blossoms, as far as the eye can see. Built on a five-note scale that sounds instantly like Japan.",
    meter: [4, 4],
    bpm: 72,
    doName: "C",
    tonic: "A",
    mode: "in",
    pickup: 0,
    melody: `A4q A4q B4h | A4q A4q B4h | A4q B4q C5q B4q | A4q B4e A4e F4h |
      E4q C4q E4q F4q | E4q E4e C4e B3h | A4q B4q C5q B4q | A4q B4e A4e F4h |
      E4q C4q E4q F4q | E4q E4e C4e B3h | A4q A4q B4h | A4q A4q B4h |
      E4q F4q B4e A4e F4q | E4w`,
    chords: `Am | Am | Am | F | Am | Esus4 | Am | F | Am | Esus4 | Am | Am | Dm F | Esus4`,
    character: "lyrical",
    ticksPerBeat: 8,
    color: "#ff8fb8",
  },
  {
    id: "blue",
    letter: "J",
    title: "The Blue Danube",
    composer: "Johann Strauss II, 1866",
    about: "The waltz of waltzes. A century later it went to space, floating behind a spinning station in a film.",
    meter: [3, 4],
    bpm: 160,
    doName: "D",
    tonic: "D",
    mode: "major",
    pickup: 1,
    melody: `D4q |
      D4q F#4q A4q | A4h A5q | A5q rq F#5q | F#5q rq D4q | D4q F#4q A4q | A4h A5q | A5q rq G5q | G5q rq C#4q |
      C#4q E4q B4q | B4h B5q | B5q rq G5q | G5q rq C#4q | C#4q E4q B4q | B4h B5q | B5q rq F#5q | F#5q rq D4q |
      D4q F#4q A4q | D5h D6q | D6q rq A5q | A5q rq D4q | D4q F#4q A4q | D5h D6q | D6q rq B5q | B5q rq E4q |
      E4q G4q B4q | B4h.~ | B4h G#4q | A4q F#5h~ | F#5q D5q F#4q | F#4h E4q | B4h A4q | D4h.`,
    chords: `D | D | D | D | D | D | D | A7 | A7 | A7 | A7 | A7 | A7 | A7 | A7 | D | D |
      D | D | D | D | D | D | G | G | Em | Em | E7 | A7 | D | D | A7 | D`,
    character: "waltz",
    ticksPerBeat: 4,
    color: "#3ddcf5",
  },
  {
    id: "scales",
    letter: "K",
    title: "Scales",
    composer: "Everyone’s first piano lesson",
    about: "Up, down, then every single key. The 1981 version ran one key past each edge of its tiny piano.",
    meter: [4, 4],
    bpm: 112,
    doName: "C",
    tonic: "C",
    mode: "major",
    pickup: 0,
    melody: `C4e D4e E4e F4e G4e A4e B4e C5e | D5e E5e F5e G5e A5e B5e C6q | B5e A5e G5e F5e E5e D5e C5e B4e |
      A4e G4e F4e E4e D4e B3e C4q |
      C4s C#4s D4s D#4s E4s F4s F#4s G4s G#4s A4s A#4s B4s C5q | C5s B4s A#4s A4s G#4s G4s F#4s F4s E4s D#4s D4s C#4s C4q |
      C4h rh`,
    chords: `C | C | G7 | G7 C | C | G7 | C`,
    character: "drill",
    ticksPerBeat: 2,
    color: "#b69cff",
  },
];

export const songs: Song[] = SOURCES.map(compileSong);

export const songById = (id: string) => songs.find((s) => s.id === id) ?? songs[0];
