/** Pitch and chord helpers. Beats are quarter notes; pitches are MIDI numbers. */

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** "F#4" → 66, "Bb3" → 58. */
export function parsePitch(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Bad pitch "${name}"`);
  const [, letter, accidental, octave] = match;
  const pc = LETTER_PC[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return 12 * (Number(octave) + 1) + pc;
}

export function pitchName(midi: number) {
  return `${SHARP_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;
export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(pitchClass(midi));
export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export type ChordQuality = "maj" | "min" | "dom7" | "maj7" | "min7" | "dim" | "sus4" | "maj6" | "min6";

export type Chord = {
  symbol: string;
  root: number; // pitch class
  quality: ChordQuality;
  /** Pitch classes of the chord, root first. */
  tones: number[];
};

const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  sus4: [0, 5, 7],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
};

/** "G", "D7", "Am", "Fmaj7", "Esus4", "Bbm7", "C#dim". */
export function parseChord(symbol: string): Chord {
  const match = /^([A-G])([#b]?)(.*)$/.exec(symbol);
  if (!match) throw new Error(`Bad chord "${symbol}"`);
  const [, letter, accidental, rest] = match;
  const root = pitchClass(LETTER_PC[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0));
  const qualityBySuffix: Record<string, ChordQuality> = {
    "": "maj",
    m: "min",
    "7": "dom7",
    maj7: "maj7",
    m7: "min7",
    dim: "dim",
    sus4: "sus4",
    "6": "maj6",
    m6: "min6",
  };
  const quality = qualityBySuffix[rest];
  if (!quality) throw new Error(`Unknown chord quality in "${symbol}"`);
  return { symbol, root, quality, tones: QUALITY_INTERVALS[quality].map((i) => pitchClass(root + i)) };
}

/** Jazz and lo-fi colour: triads grow sevenths (and the tonic gets a major seventh). */
export function enrich(chord: Chord, tonicPc: number): Chord {
  const upgrade: Partial<Record<ChordQuality, ChordQuality>> = {
    maj: chord.root === tonicPc ? "maj7" : "dom7",
    min: "min7",
    maj6: "maj7",
    min6: "min7",
  };
  const quality = upgrade[chord.quality] ?? chord.quality;
  if (quality === chord.quality) return chord;
  return {
    symbol: chord.symbol,
    root: chord.root,
    quality,
    tones: QUALITY_INTERVALS[quality].map((i) => pitchClass(chord.root + i)),
  };
}

/** The chord tone nearest to `near` (in MIDI) with the given pitch class. */
export function nearestWithPc(pc: number, near: number) {
  const base = near - pitchClass(near) + pc;
  const options = [base - 12, base, base + 12];
  return options.reduce((best, n) => (Math.abs(n - near) < Math.abs(best - near) ? n : best));
}

/**
 * A close voicing of the chord whose centre sits near `center`,
 * picked to move as little as possible from the previous voicing.
 */
export function voice(chord: Chord, center: number, previous?: number[], size = 3): number[] {
  const tones = chord.tones.slice(0, Math.max(size, 3));
  const candidates: number[][] = [];
  for (let inversion = 0; inversion < tones.length; inversion++) {
    const ordered = [...tones.slice(inversion), ...tones.slice(0, inversion)];
    let lowest = nearestWithPc(ordered[0], center - 5);
    const voicing = [lowest];
    for (const pc of ordered.slice(1)) {
      const n = lowest + ((pc - pitchClass(lowest) + 12) % 12 || 12);
      voicing.push(n);
      lowest = n;
    }
    candidates.push(voicing.slice(0, size));
  }
  const cost = (v: number[]) => {
    const middle = v.reduce((a, b) => a + b, 0) / v.length;
    const drift = Math.abs(middle - center);
    const motion = previous ? v.reduce((sum, n, i) => sum + Math.abs(n - (previous[i] ?? n)), 0) : 0;
    return drift * 1.2 + motion;
  };
  return candidates.reduce((best, v) => (cost(v) < cost(best) ? v : best));
}

/** Deterministic pseudo-random numbers, so every play of a remix sounds the same. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hashString(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
