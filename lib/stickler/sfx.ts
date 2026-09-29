"use client";

/*
 * Every Stickler sound is synthesised on the spot: no audio files.
 * A match strike is a burst of filtered noise; the big "fwoosh" is a noise
 * swell; Sparky "talks" in little pitched blips, one per word.
 */

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.gain.value = 0.8;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    out.connect(limiter).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: out!, noise: noise! };
}

function noiseBurst({ at = 0, dur, from, to, q = 1, level, type = "bandpass" as BiquadFilterType }: { at?: number; dur: number; from: number; to: number; q?: number; level: number; type?: BiquadFilterType }) {
  const { ctx, out, noise } = audio();
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(level, t + Math.min(0.02, dur / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone({ at = 0, freq, to, dur, level, type = "sine" as OscillatorType }: { at?: number; freq: number; to?: number; dur: number; level: number; type?: OscillatorType }) {
  const { ctx, out } = audio();
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(level, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export type SkinSound = "matches" | "glow" | "candy";

/** Taking sticks: a strike and flare, a snap and shimmer, or a crunchy pop. */
export function take(skin: SkinSound, count: number) {
  for (let i = 0; i < count; i++) {
    const at = i * 0.09;
    if (skin === "matches") {
      noiseBurst({ at, dur: 0.12, from: 5200, to: 1800, q: 1.2, level: 0.5 });
      noiseBurst({ at: at + 0.05, dur: 0.5, from: 500, to: 1400, q: 0.7, level: 0.18, type: "lowpass" });
    } else if (skin === "glow") {
      noiseBurst({ at, dur: 0.05, from: 3000, to: 3000, q: 4, level: 0.5 });
      tone({ at: at + 0.02, freq: 880 * (1 + i * 0.25), to: 1760 * (1 + i * 0.25), dur: 0.35, level: 0.12 });
    } else {
      noiseBurst({ at, dur: 0.08, from: 2500, to: 900, q: 2, level: 0.45 });
      tone({ at, freq: 520 + i * 90, to: 1040 + i * 180, dur: 0.14, level: 0.14, type: "triangle" });
    }
  }
}

export function select() {
  tone({ freq: 660, dur: 0.06, level: 0.05, type: "triangle" });
}

/** The last stick: a big swell of fire, a neon blow-out, or a sugar crash. */
export function fwoosh(skin: SkinSound) {
  if (skin === "matches") {
    noiseBurst({ dur: 1.2, from: 180, to: 3200, q: 0.6, level: 0.7, type: "lowpass" });
    noiseBurst({ at: 0.1, dur: 0.9, from: 900, to: 300, q: 0.8, level: 0.35 });
  } else if (skin === "glow") {
    tone({ freq: 1400, to: 60, dur: 0.9, level: 0.25, type: "sawtooth" });
    noiseBurst({ dur: 0.4, from: 6000, to: 800, q: 0.8, level: 0.3 });
  } else {
    tone({ freq: 700, to: 90, dur: 0.8, level: 0.25, type: "triangle" });
    noiseBurst({ at: 0.05, dur: 0.3, from: 3000, to: 500, q: 1.5, level: 0.3 });
  }
}

export function win() {
  [0, 4, 7, 12, 16].forEach((semi, i) => tone({ at: i * 0.09, freq: 523.25 * 2 ** (semi / 12), dur: 0.5, level: 0.14, type: "triangle" }));
}

export function protest() {
  tone({ freq: 220, dur: 0.12, level: 0.15, type: "square" });
  tone({ at: 0.14, freq: 180, dur: 0.18, level: 0.15, type: "square" });
}

/** Sparky "talks": a blip per word, pitched by mood. */
export function voice(text: string, mood: string) {
  const words = text.split(/\s+/).filter(Boolean).slice(0, 10);
  const base = mood === "sad" ? 300 : mood === "cross" ? 360 : mood === "happy" || mood === "smug" ? 560 : 460;
  words.forEach((_, i) => {
    const wobble = 1 + (Math.sin(i * 2.3) * 0.18);
    tone({ at: i * 0.075, freq: base * wobble, dur: 0.06, level: 0.045, type: "square" });
  });
}
