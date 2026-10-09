import { effectsBus, isSoundOn } from "@/lib/kit/sound";

/*
 * Two Humps' sounds, synthesised: no recordings. A bed of wind under
 * everything, soft camel footfalls (a walk's slow pairs, a gallop's quick
 * drum), the singing dunes' low hum and the storm's deeper one, a crackling
 * fire, a gust, water at an oasis, and the gang's squeaks.
 * Everything runs through the collection's effects bus, so the mute in the
 * top bar and the volume setting apply. Nothing starts until the player has
 * pressed something, as browsers require.
 */

export type TrekSound = {
  setEnabled(on: boolean): void;
  stop(): void;
  /** The wind bed, 0 (still) to 1 (the storm is on top of you). Starts it if it isn't playing. */
  wind(level: number): void;
  /** The storm's low roar as it closes in. */
  stormHum(): void;
  footfalls(gait: "walk" | "gallop", seconds: number): void;
  campfire(): void;
  singing(): void;
  gust(): void;
  water(): void;
  squeak(): void;
};

export function trekSound(): TrekSound {
  let enabled = true;
  let bus: ReturnType<typeof effectsBus> | null = null;
  let noise: AudioBuffer | null = null;
  const live = new Set<AudioScheduledSourceNode>();
  let bed: { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;

  const ready = () => {
    if (!enabled || !isSoundOn()) return null;
    bus ??= effectsBus(0.55);
    if (!noise) {
      const { ctx } = bus;
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return { ...bus, noise };
  };

  const track = <T extends AudioScheduledSourceNode>(node: T) => {
    live.add(node);
    node.onended = () => live.delete(node);
    return node;
  };

  /** A burst of filtered noise: the building block of footfalls, wind, crackle and splash. */
  const burst = (at: number, length: number, filter: BiquadFilterType, frequency: number, level: number, q = 1) => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const source = track(ctx.createBufferSource());
    source.buffer = audio.noise;
    const shape = ctx.createBiquadFilter();
    shape.type = filter;
    shape.frequency.value = frequency;
    shape.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + Math.min(0.02, length / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(shape).connect(env).connect(out);
    source.start(at, Math.random());
    source.stop(at + length + 0.05);
  };

  const tone = (at: number, length: number, frequency: number, level: number, type: OscillatorType = "sine", glideTo?: number) => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const osc = track(ctx.createOscillator());
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + length * 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  };

  const now = () => (bus ? bus.ctx.currentTime : 0) + 0.02;

  return {
    setEnabled(on) {
      enabled = on;
    },
    stop() {
      bed?.source.stop();
      bed = null;
      for (const node of live) {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      }
      live.clear();
    },
    wind(level) {
      const audio = ready();
      if (!audio) {
        bed?.gain.gain.setTargetAtTime(0, bed.gain.context.currentTime, 0.3);
        return;
      }
      const { ctx, out } = audio;
      if (!bed) {
        const source = ctx.createBufferSource();
        source.buffer = audio.noise;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.value = 0.6;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(out);
        source.start();
        bed = { source, gain, filter };
      }
      // A stronger wind is louder and rougher: the band slides down as it builds.
      const t = ctx.currentTime;
      bed.gain.gain.setTargetAtTime(0.025 + 0.16 * level, t, 0.8);
      bed.filter.frequency.setTargetAtTime(900 - 520 * level, t, 0.8);
    },
    stormHum() {
      if (!ready()) return;
      const t = now();
      tone(t, 2.8, 62, 0.18, "sawtooth", 55);
      burst(t, 2.6, "lowpass", 160, 0.3, 0.8);
    },
    footfalls(gait, seconds) {
      if (!ready()) return;
      const t = now();
      // Camels pace: a walk is a soft pair of thuds per stride, a gallop a quick four-beat drum.
      const beat = gait === "gallop" ? 0.13 : 0.42;
      for (let at = 0; at < seconds; at += beat) {
        const pair = gait === "walk" ? [0, 0.09] : [0];
        for (const offset of pair) burst(t + at + offset, 0.12, "lowpass", gait === "gallop" ? 260 : 180, gait === "gallop" ? 0.5 : 0.35);
      }
    },
    campfire() {
      if (!ready()) return;
      const t = now();
      burst(t, 3.2, "lowpass", 600, 0.08);
      for (let i = 0; i < 26; i++) burst(t + Math.random() * 3, 0.03, "highpass", 2200 + Math.random() * 2000, 0.18);
    },
    singing() {
      if (!ready()) return;
      const t = now();
      // Booming dunes hum low, around a hundred hertz, with a rough edge.
      tone(t, 3.4, 96, 0.22, "sawtooth", 92);
      tone(t, 3.4, 192, 0.08, "sine", 186);
      burst(t, 3.2, "bandpass", 110, 0.12, 6);
    },
    gust() {
      if (!ready()) return;
      const t = now();
      burst(t, 1.6, "bandpass", 700, 0.3, 0.7);
      burst(t + 0.2, 1.3, "highpass", 3000, 0.08);
    },
    water() {
      if (!ready()) return;
      const t = now();
      burst(t, 0.5, "highpass", 1800, 0.18);
      for (let i = 0; i < 5; i++) tone(t + 0.1 + i * 0.09, 0.12, 500 + Math.random() * 700, 0.06, "sine", 900 + Math.random() * 600);
    },
    squeak() {
      if (!ready()) return;
      const t = now();
      for (let i = 0; i < 4; i++) tone(t + i * 0.11, 0.09, 2600 + Math.random() * 900, 0.07, "triangle", 3600 + Math.random() * 900);
    },
  };
}
