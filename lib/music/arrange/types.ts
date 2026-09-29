import type { Meter } from "../score";

export type Role = "melody" | "counter" | "chords" | "bass" | "drums" | "pad" | "arp" | "perc";

export type Patch = {
  name: string;
  icon: string;
  program: number;
  bank?: number;
  drums?: boolean;
};

export type ArrNote = { at: number; dur: number; pitch: number; vel: number };

export type Automation =
  | { at: number; kind: "cc"; cc: number; value: number }
  | { at: number; kind: "bend"; value: number };

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
  styleId: string;
  label: string;
  bpm: number;
  meter: Meter;
  barBeats: number;
  feel: Feel;
  length: number;
  swing: number;
  tracks: Track[];
  /** Where each melody pass starts, in arrangement beats. */
  passes: { at: number; length: number }[];
  /** Arrangement beat → score beat (for the sheet and numbered views); null outside the tune. */
  toSongBeat: (beat: number) => number | null;
  /** Score beat → arrangement beat within the first pass (for switching styles mid-song). */
  fromSongBeat: (songBeat: number) => number;
  crackle?: boolean;
  /** Output gain, so a lone instrument is as loud as a full band. */
  gain: number;
};
