import type { Meter } from "../score";

export type Role = "melody" | "counter" | "chords" | "bass" | "drums" | "pad" | "arp" | "perc";

/** Which picture an instrument gets in the mixer and on the stage. */
export type InstrumentFamily =
  | "keys"
  | "musicbox"
  | "mallets"
  | "bells"
  | "organ"
  | "accordion"
  | "guitar"
  | "plucked"
  | "bowed"
  | "harp"
  | "voice"
  | "brass"
  | "horn"
  | "sax"
  | "woodwind"
  | "synth"
  | "pad"
  | "drums"
  | "hand-drum"
  | "cowbell"
  | "speaker";

export type Patch = {
  name: string;
  family: InstrumentFamily;
  program: number;
  bank?: number;
  drums?: boolean;
};

export type ArrNote = { at: number; dur: number; pitch: number; vel: number };

export type Automation =
  | { at: number; kind: "cc"; cc: number; value: number }
  | { at: number; kind: "bend"; value: number }
  /** A change of sound on the same channel: strings going pizzicato and back, say. */
  | { at: number; kind: "program"; patch: Patch };

export type Track = {
  id: string;
  name: string;
  role: Role;
  patch: Patch;
  color: string;
  notes: ArrNote[];
  automation: Automation[];
  volume: number;
  pan: number;
  reverb: number;
  chorus: number;
  /** Pitch-bend range in semitones, for bent drums and slides. */
  bendRange?: number;
};

export type Feel = "four" | "three" | "compound" | "two";

export type Arrangement = {
  songId: string;
  version: "short" | "full";
  styleId: string;
  label: string;
  bpm: number;
  meter: Meter;
  barBeats: number;
  feel: Feel;
  length: number;
  swing: number;
  tracks: Track[];
  /** Where each melody pass (or each part of a long piece) starts, in arrangement beats. */
  passes: { at: number; length: number }[];
  /** Every bar, in arrangement beats: bars change length when the meter does. */
  grid: { at: number; len: number }[];
  /** Tempo changes in arrangement beats; the first one is at 0 (a piece may open slower or faster than `bpm`). */
  tempos: { at: number; bpm: number }[];
  /** Arrangement beat → score beat (for the sheet and numbered views); null outside the tune. */
  toSongBeat: (beat: number) => number | null;
  /** Score beat → arrangement beat within the first pass (for switching styles mid-song). */
  fromSongBeat: (songBeat: number) => number;
  crackle?: boolean;
  /** Output gain, so a lone instrument is as loud as a full band. */
  gain: number;
};
