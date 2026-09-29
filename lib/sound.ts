let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 8;
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(limiter).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: master! };
}

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A soft, bright pluck. Only call this from a user gesture the first time. */
export function pluck(midi: number) {
  const { ctx, out } = audio();
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
