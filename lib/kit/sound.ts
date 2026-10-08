/*
 * One audio context and one master bus for the whole collection. Every
 * game's sound effects run into `effectsBus`; the master follows the
 * collection's mute and volume, so the switch in the top bar silences
 * everything at once. Bop Box's synthesiser needs its own context (it runs an
 * audio worklet at its own latency); it hangs `followMasterVolume` at the end
 * of its chain instead.
 */

import { getPrefs, subscribePrefs } from "./appearance";

/** The loudest the master gets at volume 1, leaving headroom for the limiter. */
const MASTER_LEVEL = 0.9;

/** The shared context and the input of its master bus (a limiter in front of the volume). */
let shared: { ctx: AudioContext; input: AudioNode } | null = null;

const levelFor = () => {
  const { sound, volume } = getPrefs();
  return sound ? volume * MASTER_LEVEL : 0;
};

/** A gain node at the end of `ctx`'s chain that tracks mute and volume. Call `stop` when the context closes. */
export function followMasterVolume(ctx: BaseAudioContext): { gain: GainNode; stop: () => void } {
  const gain = ctx.createGain();
  gain.gain.value = levelFor();
  gain.connect(ctx.destination);
  const stop = subscribePrefs(() => gain.gain.setTargetAtTime(levelFor(), ctx.currentTime, 0.03));
  return { gain, stop };
}

function sharedAudio() {
  if (!shared) {
    const ctx = new AudioContext();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    limiter.connect(followMasterVolume(ctx).gain);
    shared = { ctx, input: limiter };
  }
  if (shared.ctx.state === "suspended") void shared.ctx.resume();
  return shared;
}

/**
 * The shared context and a fresh input into the master bus at `level`.
 * Call it from a user gesture the first time: browsers only start audio then.
 */
export function effectsBus(level = 0.8): { ctx: AudioContext; out: GainNode } {
  const { ctx, input } = sharedAudio();
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(input);
  return { ctx, out };
}

/** The shared context, resumed if the browser had suspended it. */
export function audioContext(): AudioContext {
  return sharedAudio().ctx;
}

export const isSoundOn = () => getPrefs().sound && getPrefs().volume > 0;

/* ---------- The Hall's key sounds ---------- */

let pluckBus: { ctx: AudioContext; out: GainNode } | null = null;

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A soft, bright pluck. */
export function pluck(midi: number) {
  pluckBus ??= effectsBus(0.7);
  const { ctx, out } = pluckBus;
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime;
  const hz = midiToHz(midi);

  const body = ctx.createOscillator();
  body.type = "triangle";
  body.frequency.value = hz;

  const sparkle = ctx.createOscillator();
  sparkle.type = "sine";
  sparkle.frequency.value = hz * 2;
  const sparkleLevel = ctx.createGain();
  sparkleLevel.gain.value = 0.18;

  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.setValueAtTime(hz * 10, t);
  tone.frequency.exponentialRampToValueAtTime(hz * 1.6, t + 0.45);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

  body.connect(tone);
  sparkle.connect(sparkleLevel).connect(tone);
  tone.connect(env).connect(out);

  body.start(t);
  sparkle.start(t);
  body.stop(t + 1);
  sparkle.stop(t + 1);
}

const PENTATONIC = [0, 2, 4, 7, 9];

/** Maps any letter or digit to a note of C major pentatonic, so mashing keys always sounds nice. */
export function noteForKey(key: string) {
  const ch = key.toLowerCase();
  const index = /[a-z]/.test(ch) ? ch.charCodeAt(0) - 97 : 26 + Number(ch);
  const octave = Math.floor(index / PENTATONIC.length) % 3;
  return 60 + octave * 12 + PENTATONIC[index % PENTATONIC.length];
}

/* ---------- The Keyring's click ---------- */

/** The soft click of a keycap landing on the ring: a short filtered tick and a tiny metallic ring. */
export function keycapClick() {
  if (!isSoundOn()) return;
  const { ctx, out } = effectsBus(0.6);
  const t = ctx.currentTime;

  const tick = ctx.createOscillator();
  tick.type = "square";
  tick.frequency.setValueAtTime(2400, t);
  tick.frequency.exponentialRampToValueAtTime(900, t + 0.025);
  const tickEnv = ctx.createGain();
  tickEnv.gain.setValueAtTime(0.0001, t);
  tickEnv.gain.exponentialRampToValueAtTime(0.18, t + 0.002);
  tickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  const tickTone = ctx.createBiquadFilter();
  tickTone.type = "bandpass";
  tickTone.frequency.value = 1800;
  tick.connect(tickTone).connect(tickEnv).connect(out);

  const ring = ctx.createOscillator();
  ring.type = "sine";
  ring.frequency.value = 3150;
  const ringEnv = ctx.createGain();
  ringEnv.gain.setValueAtTime(0.0001, t + 0.01);
  ringEnv.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
  ringEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  ring.connect(ringEnv).connect(out);

  tick.start(t);
  tick.stop(t + 0.06);
  ring.start(t + 0.01);
  ring.stop(t + 0.4);
}
