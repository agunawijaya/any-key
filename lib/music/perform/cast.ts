import type { Track } from "../arrange/types";
import { kitPiece } from "./hands";

/*
 * Who plays a track. The arrangement names an instrument (a General MIDI
 * program and a family); the stage needs a performer: a violinist, a horn
 * player, a drummer, a gendang player. Sections get more than one player
 * (a "String section" is three violinists bowing together), the way an
 * orchestra really seats them.
 */

export type Role =
  | "violin"
  | "viola"
  | "cello"
  | "bass"
  | "harp"
  | "flute"
  | "piccolo"
  | "oboe"
  | "clarinet"
  | "bassoon"
  | "sax"
  | "trumpet"
  | "trombone"
  | "horn"
  | "tuba"
  | "timpani"
  | "mallets"
  | "piano"
  | "organ"
  | "accordion"
  | "synth"
  | "guitar"
  | "bassGuitar"
  | "plucked"
  | "drumkit"
  | "handDrums"
  | "kendang"
  | "tambourine"
  | "suling"
  | "voice"
  | "koto"
  | "cowbell"
  | "speaker";

export type Casting = {
  role: Role;
  /** How many players share the part. */
  players: number;
  /** Plucked rather than bowed (pizzicato strings). */
  pizzicato?: boolean;
};

const BY_PROGRAM: Record<number, Role> = {
  0: "piano",
  1: "piano",
  4: "piano",
  9: "mallets",
  10: "mallets",
  11: "mallets",
  12: "mallets",
  14: "mallets",
  16: "organ",
  19: "organ",
  21: "accordion",
  24: "guitar",
  25: "guitar",
  26: "guitar",
  27: "guitar",
  28: "guitar",
  32: "bass",
  33: "bassGuitar",
  38: "synth",
  39: "synth",
  40: "violin",
  42: "cello",
  43: "bass",
  44: "violin",
  45: "violin",
  46: "harp",
  47: "timpani",
  48: "violin",
  49: "violin",
  50: "synth",
  52: "voice",
  53: "voice",
  56: "trumpet",
  57: "trombone",
  58: "tuba",
  59: "trumpet",
  60: "horn",
  61: "trumpet",
  62: "synth",
  64: "sax",
  65: "sax",
  66: "sax",
  67: "sax",
  68: "oboe",
  70: "bassoon",
  71: "clarinet",
  72: "piccolo",
  73: "flute",
  75: "flute",
  77: "suling",
  78: "flute",
  79: "flute",
  80: "synth",
  81: "synth",
  82: "organ",
  87: "synth",
  89: "synth",
  90: "synth",
  91: "synth",
  94: "synth",
  95: "synth",
  98: "mallets",
  102: "synth",
  104: "plucked",
  105: "plucked",
  107: "koto",
  108: "mallets",
  110: "violin",
  113: "cowbell",
  114: "mallets",
  116: "kendang",
  117: "kendang",
};

/** Words in a track's name that say more than its program number does. */
function byName(name: string): Role | undefined {
  const n = name.toLowerCase();
  if (/violas?\b/.test(n)) return "viola";
  if (/cell(o|i)/.test(n)) return "cello";
  if (/mandolin|banjo|vihuela|guitarr[oó]n/.test(n)) return "plucked";
  if (/double bass|contrabass|basses/.test(n)) return "bass";
  if (/euphonium/.test(n)) return "tuba";
  if (/ophicleide|tuba/.test(n)) return "tuba";
  if (/cornet/.test(n)) return "trumpet";
  if (/shakuhachi|fife|piccolo/.test(n)) return /piccolo|fife/.test(n) ? "piccolo" : "flute";
  if (/koto/.test(n)) return "koto";
  return undefined;
}

export function cast(track: Track): Casting {
  const { patch, name } = track;
  if (patch.drums) {
    const pieces = new Set(track.notes.map((n) => kitPiece(n.pitch)).filter(Boolean));
    const hand = ["congaOpen", "congaMute", "congaLow", "bongoHigh", "bongoLow", "guiro"];
    if ([...pieces].every((p) => hand.includes(p!) || p === "tambourine" || p === "splash")) return { role: "handDrums", players: 1 };
    if ([...pieces].every((p) => p === "tambourine" || p === "triangle" || p === "wood" || p === "claves")) return { role: "tambourine", players: 1 };
    return { role: "drumkit", players: 1 };
  }
  if (patch.family === "speaker") return { role: "speaker", players: 1 };
  const role = byName(name) ?? BY_PROGRAM[patch.program] ?? (patch.family === "keys" ? "piano" : "synth");
  const pizzicato = patch.program === 45 || /pizz/i.test(name);
  // Sections: a name in the plural, or a "section" sound, seats several players.
  const plural = /section|strings|violins|violas|cellos|celli|basses|horns|trumpets|trombones|flutes|oboes|clarinets|bassoons|fifes|tubas|saxophones|voices|choir/i.test(name) || patch.program === 48 || patch.program === 49;
  const players = role === "voice" ? 3 : plural ? (["violin", "viola", "cello"].includes(role) ? 3 : 2) : 1;
  return { role, players, pizzicato };
}
