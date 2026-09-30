import type { Arrangement, Patch, Role } from "../arrange/types";
import type { Song } from "../score";

/**
 * A printed score, part by part, as generated from a reading of the page (see
 * data/*.ts). `bars` lists every printed bar's length in beats. Each part's
 * `notes` is a line of tokens: "b12" starts printed bar 12, then
 * "onset.dur.pitch[.pitch…]" in 1/48 of a beat at concert pitch, with a
 * trailing "~" when the notes are tied into the next ones. `marks` holds the
 * dynamics and playing directions the same way: "b12 24:p 96:cresc".
 */
export type ScoreData = {
  bars: string;
  parts: Record<string, { notes: string; marks: string }>;
};

/** How one printed part sounds in Bop Box. */
export type PartSpec = {
  /** The part's name in the data, or several printed parts played by one instrument track. */
  part: string | string[];
  /** What the mixer shows. */
  name: string;
  role: Role;
  patch: Patch;
  /** Strings: the sound for passages marked pizz. */
  pizz?: Patch;
  pan?: number;
  volume?: number;
  reverb?: number;
  /** Percussion staff: written pitch → drum note of the kit. */
  drums?: Record<number, number>;
};

type ScoreInfo = {
  songId: string;
  /** A few words for the style card: "Mozart’s own orchestration". */
  label: string;
  /** One sentence for the Studio: whose orchestration, and from which edition. */
  credit: string;
};

/** The composer's own orchestration, played from a reading of the printed full score. */
export type ComposerScore = ScoreInfo & {
  kind: "composer";
  load: () => Promise<ScoreData>;
  parts: PartSpec[];
  /**
   * The printed bars behind each entry of the full version's form, in order:
   * "1-4", "5-19,21", "40-54,56". Repeats and endings follow the form.
   */
  form: string[];
  /** Performance directions per form entry: parts that sit out, a dynamic to start from. */
  directions?: Record<number, { tacet?: string[]; dynamic?: string }>;
  /** Scales every track's volume: a full band at ff needs less than a classical orchestra. */
  level?: number;
  /** Output gain, to even out loudness between scores. */
  gain?: number;
};

/** No full score to read: our own setting for the instruments the tune belongs to. */
export type OurScore = ScoreInfo & {
  kind: "ours";
  build: (song: Song) => Arrangement;
};

export type OriginalScore = ComposerScore | OurScore;
