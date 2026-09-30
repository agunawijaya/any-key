import { DRUM, PATCH } from "../arrange/patches";
import { blueDanube, fifeAndDrum, kotoShakuhachi, mariachi, pianoLesson, quadrilleBand, violinAndPiano } from "./ours";
import type { OriginalScore } from "./types";

/*
 * The "Original Score" style: each tune played by the orchestration written
 * for it. Where the composer's own full score survives in a public-domain
 * edition, the notes come from a reading of that score (data/*.ts). The parts
 * are grouped into at most 15 instrument tracks, because that is how many
 * sounds one General MIDI synthesiser can play at once.
 */

const left = 44;
const right = 84;

export const ORIGINAL_SCORES: OriginalScore[] = [
  {
    songId: "forty",
    kind: "composer",
    label: "Mozart’s own orchestration",
    credit: "Mozart’s own orchestration, read from Gaylon Babcock’s engraving of the full score (CC BY 4.0)",
    load: () => import("./data/forty").then((m) => m.data),
    parts: [
      { part: "Flute", name: "Flute", role: "counter", patch: PATCH.flute, pan: 72 },
      { part: "Oboes", name: "Oboes", role: "counter", patch: PATCH.oboe, pan: 60 },
      { part: "Clarinets", name: "Clarinets", role: "counter", patch: PATCH.clarinet, pan: 54 },
      { part: "Bassoons", name: "Bassoons", role: "bass", patch: PATCH.bassoon, pan: 70 },
      { part: ["Horn 1", "Horn 2"], name: "Horns", role: "pad", patch: PATCH.horns, pan: 40, volume: 92 },
      { part: "Violins 1", name: "First violins", role: "melody", patch: PATCH.violinsFast, pan: 30 },
      { part: "Violins 2", name: "Second violins", role: "chords", patch: PATCH.violins2Fast, pizz: PATCH.violins2Pizz, pan: 48 },
      { part: "Violas", name: "Violas", role: "chords", patch: PATCH.violasFast, pizz: PATCH.violasPizz, pan: 80 },
      { part: "Cellos", name: "Cellos", role: "bass", patch: PATCH.celliFast, pizz: PATCH.celliPizz, pan: 92 },
      { part: "Basses", name: "Double basses", role: "bass", patch: PATCH.contrabass, pizz: PATCH.bassesPizz, pan: 100 },
    ],
    form: ["1-100", "101-164", "165-299"],
  },
  {
    songId: "march",
    kind: "composer",
    label: "Gounod’s own orchestration",
    credit: "Gounod’s own orchestration of 1879, read from Oscar Lopez’s public-domain engraving of the full score",
    load: () => import("./data/march").then((m) => m.data),
    gain: 1.5,
    parts: [
      { part: ["Piccolo", "Flute"], name: "Piccolo & flute", role: "counter", patch: PATCH.flute, pan: 74 },
      { part: "Oboes", name: "Oboes", role: "counter", patch: PATCH.oboe, pan: 62 },
      { part: "Clarinets in A", name: "Clarinets", role: "melody", patch: PATCH.clarinet, pan: 54 },
      { part: "Bassoons", name: "Bassoons", role: "bass", patch: PATCH.bassoon, pan: 70 },
      { part: "Horns in D", name: "Horns", role: "pad", patch: PATCH.horns, pan: 40 },
      { part: "Trumpets in A", name: "Trumpets", role: "counter", patch: PATCH.trumpet, pan: 56, volume: 88 },
      { part: ["Trombones 1-2", "Trombone 3"], name: "Trombones", role: "chords", patch: PATCH.trombone, pan: 84, volume: 90 },
      { part: "Ophicleide", name: "Ophicleide (tuba)", role: "bass", patch: PATCH.tuba, pan: 90, volume: 90 },
      { part: "Timpani", name: "Timpani", role: "perc", patch: PATCH.timpani, pan: 64 },
      { part: "Violins 1", name: "First violins", role: "melody", patch: PATCH.violinsFast, pizz: PATCH.violinsPizz, pan: 30 },
      { part: "Violins 2", name: "Second violins", role: "chords", patch: PATCH.violins2Fast, pizz: PATCH.violins2Pizz, pan: 48 },
      { part: "Violas", name: "Violas", role: "chords", patch: PATCH.violasFast, pizz: PATCH.violasPizz, pan: 80 },
      { part: "Cellos", name: "Cellos", role: "bass", patch: PATCH.celliFast, pizz: PATCH.celliPizz, pan: 92 },
      { part: "Basses", name: "Double basses", role: "bass", patch: PATCH.contrabass, pizz: PATCH.bassesPizz, pan: 100 },
    ],
    form: ["1-5", "6", "7-15", "16-39", "40-55", "40-54,56", "57-87", "88-103", "104-127", "104-125,128-130", "131-141", "142-158", "159-176"],
  },
  {
    songId: "stars",
    kind: "composer",
    label: "Sousa’s own band scoring",
    credit: "Sousa’s own band scoring, read from the United States Marine Band’s public-domain edition (2016), with its directions for each repeat",
    load: () => import("./data/stars").then((m) => m.data),
    level: 0.8,
    parts: [
      { part: "Piccolo", name: "Piccolo", role: "counter", patch: PATCH.piccolo, pan: right },
      { part: "Flutes", name: "Flutes", role: "counter", patch: PATCH.flute, pan: 76 },
      { part: "Oboes", name: "Oboes", role: "counter", patch: PATCH.oboe, pan: 70 },
      {
        part: ["Eb Clarinet", "Clarinet 1", "Clarinets 2-3", "Alto Clarinet", "Bass Clarinet"],
        name: "Clarinets",
        role: "melody",
        patch: PATCH.clarinet,
        pan: 58,
      },
      { part: "Bassoons", name: "Bassoons", role: "bass", patch: PATCH.bassoon, pan: 72 },
      { part: ["Alto Sax", "Tenor Sax", "Baritone Sax"], name: "Saxophones", role: "chords", patch: PATCH.altoSax, pan: 66, volume: 84 },
      { part: ["Eb Cornet", "Solo Cornet", "Cornet 1", "Cornets 2-3"], name: "Cornets", role: "melody", patch: PATCH.cornet, pan: left, volume: 92 },
      { part: ["Horns 1-2", "Horns 3-4"], name: "Horns", role: "chords", patch: PATCH.horns, pan: 36 },
      { part: ["Trombones 1-2", "Bass Trombone"], name: "Trombones", role: "counter", patch: PATCH.trombone, pan: 52, volume: 94 },
      { part: "Euphonium", name: "Euphonium", role: "counter", patch: PATCH.euphonium, pan: 62, volume: 88 },
      { part: "Tuba", name: "Tubas", role: "bass", patch: PATCH.tuba, pan: 64 },
      { part: ["Harp", "Harp LH"], name: "Harp", role: "arp", patch: PATCH.harp, pan: 90, volume: 90 },
      { part: "Bells", name: "Bells", role: "perc", patch: PATCH.glock, pan: 80, volume: 80 },
      {
        part: "Drums",
        name: "Snare, bass drum & cymbals",
        role: "drums",
        patch: PATCH.kitOrchestra,
        drums: { 76: DRUM.snare, 75: DRUM.snare, 69: DRUM.bassDrum },
      },
    ],
    form: ["1-4", "5-20", "5-19,21", "22-37", "38-53", "54-85", "86-109", "110-141", "86-109", "110-139,142-143"],
    directions: {
      // The grandioso trio twice: softly the first time, the trombones' countermelody,
      // the oboes and the first cornets saved for the second (the edition's "2nd X only").
      7: { dynamic: "p", tacet: ["Trombones 1-2", "Bass Trombone", "Euphonium", "Oboes", "Cornet 1"] },
      9: { dynamic: "ff" },
    },
  },
  {
    songId: "blue",
    kind: "ours",
    label: "Our orchestration, after Strauss",
    credit:
      "Arranged for Bop Box after Strauss’s own scoring: his tune and harmony, and his choice of instruments for each strain (the horn’s call, the cellos’ first waltz, the flute over the cellos), with parts of our own. His full score survives only as a worn scan that can’t be read part by part",
    build: blueDanube,
  },
  {
    songId: "dandy",
    kind: "ours",
    label: "Fifes and drums, 1770s style",
    credit: "Arranged for Bop Box for a fife and drum corps, the band the tune marched with in the 1770s: fifes in two parts, snare and bass drum",
    build: fifeAndDrum,
  },
  {
    songId: "hat",
    kind: "ours",
    label: "A mariachi, with harp",
    credit: "Arranged for Bop Box for a mariachi: violins, trumpets, vihuela, guitarrón and the harp of the old jarabe bands",
    build: (song) => mariachi(song, { harp: true }),
  },
  {
    songId: "bug",
    kind: "ours",
    label: "A mariachi, trumpets first",
    credit: "Arranged for Bop Box for a mariachi: trumpets on the tune, violins in harmony, vihuela and guitarrón",
    build: (song) => mariachi(song, { trumpetsLead: true }),
  },
  {
    songId: "sakura",
    kind: "ours",
    label: "Koto and shakuhachi",
    credit: "Arranged for Bop Box for two kotos and a shakuhachi, the instruments the song was first played on",
    build: kotoShakuhachi,
  },
  {
    songId: "pop",
    kind: "ours",
    label: "A Victorian dance band",
    credit: "Arranged for Bop Box for a small dance band of the 1850s, when the tune was a London dance craze: violin, cornet, clarinet, piano and bass",
    build: quadrilleBand,
  },
  {
    songId: "humor",
    kind: "ours",
    label: "Violin and piano",
    credit: "Arranged for Bop Box for violin and piano, the way the world came to know Dvořák’s piano piece; the tune and harmony are his",
    build: violinAndPiano,
  },
  {
    songId: "scales",
    kind: "ours",
    label: "Piano and metronome",
    credit: "Arranged for Bop Box for the instrument scales are learned on: a piano, both hands an octave apart, and a ticking metronome",
    build: pianoLesson,
  },
];

export const originalFor = (songId: string) => ORIGINAL_SCORES.find((s) => s.songId === songId);
