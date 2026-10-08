"use client";

import { effectsBus } from "@/lib/kit/sound";

/*
 * Every Don't Crater sound is synthesised on the spot: no audio files.
 * The engine is a bed of filtered noise over a low hum whose brightness and
 * loudness follow the throttle; callouts are short beeps; crashes are noise
 * bursts and falling tones.
 */

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;

function audio() {
  if (!ctx) {
    // The collection's master bus holds the limiter and follows mute and volume.
    ({ ctx, out } = effectsBus(0.8));
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    // Brown-ish noise: a warmer rumble than white noise.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.035 * (Math.random() * 2 - 1)) / 1.035;
      data[i] = last * 3.2;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: out!, noise: noise! };
}

function noiseBurst({ at = 0, dur, from, to, q = 1, level, type = "lowpass" as BiquadFilterType }: { at?: number; dur: number; from: number; to: number; q?: number; level: number; type?: BiquadFilterType }) {
  const { ctx, out, noise } = audio();
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
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
  src.start(t, Math.random());
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

/* ---------- The engine ---------- */

type Engine = { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; hum: OscillatorNode; humGain: GainNode };
let engine: Engine | null = null;

export function engineStart() {
  if (engine) return;
  const { ctx, out, noise } = audio();
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 200;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const hum = ctx.createOscillator();
  hum.type = "triangle";
  hum.frequency.value = 42;
  const humGain = ctx.createGain();
  humGain.gain.value = 0;
  src.connect(filter).connect(gain).connect(out);
  hum.connect(humGain).connect(out);
  src.start();
  hum.start();
  engine = { src, filter, gain, hum, humGain };
}

/** throttle 0–100; `rattle` adds grit near the ground. */
export function engineSet(throttle: number, rattle = 0) {
  if (!engine || !ctx) return;
  const t = ctx.currentTime;
  const x = Math.min(1, Math.max(0, throttle / 100));
  engine.gain.gain.setTargetAtTime(x > 0.001 ? 0.08 + 0.42 * Math.sqrt(x) : 0, t, 0.05);
  engine.filter.frequency.setTargetAtTime(160 + 1500 * x + 900 * rattle * x, t, 0.06);
  engine.humGain.gain.setTargetAtTime(x > 0.001 ? 0.05 + 0.1 * x : 0, t, 0.08);
  engine.hum.frequency.setTargetAtTime(38 + 22 * x, t, 0.1);
}

export function engineStop() {
  if (!engine || !ctx) return;
  const e = engine;
  engine = null;
  const t = ctx.currentTime;
  e.gain.gain.setTargetAtTime(0, t, 0.08);
  e.humGain.gain.setTargetAtTime(0, t, 0.08);
  e.src.stop(t + 0.6);
  e.hum.stop(t + 0.6);
}

/* ---------- One-shots ---------- */

export function callout(high = false) {
  tone({ freq: high ? 1320 : 880, dur: 0.09, level: 0.07, type: "sine" });
  tone({ at: 0.11, freq: high ? 1320 : 880, dur: 0.09, level: 0.07, type: "sine" });
}

export function warning() {
  tone({ freq: 740, dur: 0.12, level: 0.09, type: "square" });
  tone({ at: 0.16, freq: 560, dur: 0.14, level: 0.09, type: "square" });
}

export function click() {
  tone({ freq: 1200, dur: 0.03, level: 0.04, type: "triangle" });
}

export function turnWhoosh() {
  noiseBurst({ dur: 0.5, from: 300, to: 1800, q: 0.8, level: 0.2, type: "bandpass" });
}

export function touchdown(soft: boolean) {
  tone({ freq: soft ? 120 : 90, to: 45, dur: 0.35, level: soft ? 0.35 : 0.5 });
  noiseBurst({ dur: 0.6, from: 900, to: 150, level: soft ? 0.18 : 0.3 });
  if (soft) [0, 4, 7, 12].forEach((s, i) => tone({ at: 0.35 + i * 0.1, freq: 523.25 * 2 ** (s / 12), dur: 0.45, level: 0.1, type: "triangle" }));
}

export function crash(size: 1 | 2 | 3) {
  noiseBurst({ dur: 0.5 + size * 0.5, from: 2400, to: 60, q: 0.6, level: 0.35 + size * 0.15 });
  tone({ freq: 180, to: 30, dur: 0.6 + size * 0.3, level: 0.4 });
  for (let i = 0; i < 3 + size * 2; i++) tone({ at: 0.05 + Math.random() * 0.6, freq: 600 + Math.random() * 1800, to: 200, dur: 0.12, level: 0.05, type: "square" });
}

export function gusher() {
  for (let i = 0; i < 14; i++) tone({ at: 0.6 + i * 0.12, freq: 180 + Math.random() * 160, to: 90, dur: 0.14, level: 0.12, type: "sine" });
  noiseBurst({ at: 0.5, dur: 2.2, from: 200, to: 900, level: 0.18, type: "bandpass" });
}

export function flagFlap() {
  for (let i = 0; i < 3; i++) noiseBurst({ at: i * 0.14, dur: 0.1, from: 3200, to: 1600, q: 1.4, level: 0.08, type: "bandpass" });
}

export function fanfare() {
  [0, 4, 7, 12, 16, 19].forEach((s, i) => tone({ at: i * 0.08, freq: 392 * 2 ** (s / 12), dur: 0.6, level: 0.09, type: "triangle" }));
}

/* ---------- Free Flight ---------- */

/** The reaction-control thrusters: a short hiss of gas. */
export function rcs(level = 1) {
  noiseBurst({ dur: 0.11, from: 5200, to: 3400, q: 1.1, level: 0.05 * level, type: "highpass" });
}

/** Tipping over: a slow creak, then a scraping rattle as the legs fold. */
export function tipOver() {
  tone({ freq: 160, to: 90, dur: 0.9, level: 0.12, type: "sawtooth" });
  noiseBurst({ at: 0.9, dur: 0.7, from: 1800, to: 400, q: 2.5, level: 0.22, type: "bandpass" });
  for (let i = 0; i < 9; i++) tone({ at: 0.95 + i * 0.06 + Math.random() * 0.03, freq: 700 + Math.random() * 900, to: 300, dur: 0.07, level: 0.05, type: "square" });
  noiseBurst({ at: 1.25, dur: 0.5, from: 700, to: 120, level: 0.25 });
}

/** Into the sea: a splash, then a gurgle. */
export function splash() {
  noiseBurst({ dur: 0.9, from: 3000, to: 500, q: 0.7, level: 0.35, type: "bandpass" });
  tone({ freq: 140, to: 60, dur: 0.4, level: 0.25 });
  for (let i = 0; i < 12; i++) tone({ at: 0.7 + i * 0.13 + Math.random() * 0.05, freq: 220 + Math.random() * 260, to: 140, dur: 0.1, level: 0.08, type: "sine" });
}
