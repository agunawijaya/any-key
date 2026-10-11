import { effectsBus, isSoundOn } from "@/lib/kit/sound";

/*
 * Sol y Sombra's sounds, synthesised: no recordings, no words. The crowd is
 * a bed of filtered noise that swells with the afternoon, and its "olé" is
 * two vowels sung by thousands (formant filters over noise and a low buzz,
 * the mouth opening from o to e), never a word. Hooves are low thumps, the
 * bull's breath a short rush of air, the cape a swish of cloth, and the
 * fanfare a little brass figure of our own on two detuned saws.
 *
 * Everything runs through the collection's effects bus, so the mute in the
 * top bar and the volume setting apply. Nothing starts until the player has
 * pressed something, as browsers require.
 */

export type RingSound = {
  setEnabled(on: boolean): void;
  stop(): void;
  /** The crowd's bed, 0 a hushed ring to 1 a roaring one. Starts it if it isn't playing. */
  murmur(level: number): void;
  /** A swell of voices: approval, a gasp turned into a roar. */
  cheer(level: number): void;
  /** The stands' wordless "o–le" as the horns go by. */
  ole(level: number): void;
  hoof(level: number): void;
  /** The bull blowing hard through its nose before it charges. */
  snort(): void;
  /** The cape cutting the air. */
  swish(speed: number): void;
  /** A body meeting the sand: muffled, not harsh. */
  thud(): void;
  fanfare(kind: "paseo" | "honour"): void;
};

/** Formants (Hz) of the two vowels the crowd sings, and how wide each band is. */
const VOWELS = {
  o: [
    [430, 90],
    [820, 110],
    [2600, 180],
  ],
  e: [
    [480, 90],
    [1850, 140],
    [2650, 180],
  ],
} as const;

export function ringSound(): RingSound {
  let enabled = true;
  let bus: ReturnType<typeof effectsBus> | null = null;
  let noise: AudioBuffer | null = null;
  const live = new Set<AudioScheduledSourceNode>();
  let bed: { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;

  const ready = () => {
    if (!enabled || !isSoundOn()) return null;
    bus ??= effectsBus(0.6);
    if (!noise) {
      const { ctx } = bus;
      noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
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

  const now = () => (bus ? bus.ctx.currentTime : 0) + 0.02;

  /** Filtered noise with an attack and a fall: thumps, breath, cloth, voices. */
  const burst = (at: number, attack: number, length: number, type: BiquadFilterType, frequency: number, level: number, q = 1, glideTo?: number) => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const source = track(ctx.createBufferSource());
    source.buffer = audio.noise;
    const shape = ctx.createBiquadFilter();
    shape.type = type;
    shape.frequency.setValueAtTime(frequency, at);
    if (glideTo) shape.frequency.exponentialRampToValueAtTime(glideTo, at + length);
    shape.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(shape).connect(env).connect(out);
    source.start(at, Math.random() * 2);
    source.stop(at + length + 0.05);
  };

  /** Thousands of voices on one vowel glide: noise and a low buzz through three formant bands that move from `from` to `to`. */
  const chant = (at: number, length: number, level: number, from: keyof typeof VOWELS, to: keyof typeof VOWELS) => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + 0.12);
    env.gain.setValueAtTime(level, at + length * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    env.connect(out);
    // The voices: noise for the breath of the crowd, three buzzes a little apart for its pitch.
    const sources: AudioScheduledSourceNode[] = [];
    const air = ctx.createBufferSource();
    air.buffer = audio.noise;
    sources.push(air);
    const voices = ctx.createGain();
    voices.gain.value = 0.22;
    for (const pitch of [138, 146, 155, 196]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(pitch * (1 + (Math.random() - 0.5) * 0.02), at);
      // The "le" rises a little, as a shout does.
      osc.frequency.linearRampToValueAtTime(pitch * 1.12, at + length * 0.7);
      osc.connect(voices);
      sources.push(osc);
    }
    const mouth = ctx.createGain();
    air.connect(mouth);
    voices.connect(mouth);
    VOWELS[from].forEach(([f, width], i) => {
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.setValueAtTime(f, at);
      band.frequency.setValueAtTime(f, at + length * 0.3);
      band.frequency.exponentialRampToValueAtTime(VOWELS[to][i][0], at + length * 0.5);
      band.Q.value = f / width;
      const weight = ctx.createGain();
      weight.gain.value = [1, 0.6, 0.25][i];
      mouth.connect(band).connect(weight).connect(env);
    });
    track(air);
    air.start(at, Math.random() * 2);
    air.stop(at + length + 0.05);
    for (const s of sources) {
      if (s === air) continue;
      track(s);
      s.start(at);
      s.stop(at + length + 0.05);
    }
  };

  /** One brass note: two detuned saws through a filter that opens as the note speaks. */
  const brass = (at: number, length: number, frequency: number, level: number) => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(frequency * 1.5, at);
    filter.frequency.exponentialRampToValueAtTime(frequency * 6, at + 0.06);
    filter.frequency.exponentialRampToValueAtTime(frequency * 3, at + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + 0.04);
    env.gain.setValueAtTime(level * 0.8, at + length * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    filter.connect(env).connect(out);
    for (const detune of [-7, 6]) {
      const osc = track(ctx.createOscillator());
      osc.type = "sawtooth";
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(at);
      osc.stop(at + length + 0.05);
    }
  };

  return {
    setEnabled(on) {
      enabled = on;
      if (!on) bed?.gain.gain.setTargetAtTime(0, bed.gain.context.currentTime, 0.2);
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
    murmur(level) {
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
      // A louder crowd is also a brighter one.
      bed.gain.gain.setTargetAtTime(0.025 + 0.09 * level, ctx.currentTime, 0.6);
      bed.filter.frequency.setTargetAtTime(420 + 700 * level, ctx.currentTime, 0.6);
    },
    cheer(level) {
      const at = now();
      burst(at, 0.25, 2.6, "bandpass", 900, 0.12 + 0.2 * level, 0.5, 1300);
      burst(at + 0.1, 0.4, 2.2, "highpass", 2400, 0.04 + 0.06 * level, 0.4);
    },
    ole(level) {
      chant(now(), 1.15, 0.12 + 0.16 * level, "o", "e");
    },
    hoof(level) {
      const at = now();
      burst(at, 0.004, 0.16, "lowpass", 160, 0.25 * level, 0.8);
      burst(at, 0.002, 0.05, "bandpass", 1300, 0.05 * level, 1.2);
    },
    snort() {
      const at = now();
      burst(at, 0.03, 0.45, "bandpass", 700, 0.16, 0.9, 380);
      burst(at + 0.5, 0.03, 0.35, "bandpass", 650, 0.1, 0.9, 400);
    },
    swish(speed) {
      const level = Math.min(0.14, 0.02 + speed * 0.008);
      burst(now(), 0.05, 0.32, "bandpass", 1600, level, 0.7, 700);
    },
    thud() {
      const at = now();
      burst(at, 0.006, 0.4, "lowpass", 220, 0.3, 0.7);
    },
    fanfare(kind) {
      const at = now();
      // Our own figure: a rising call, and for an honour a held answer above it.
      const call = kind === "paseo" ? [392, 523, 659, 784, 659, 784] : [523, 659, 784, 1047, 988, 1047];
      const lengths = kind === "paseo" ? [0.18, 0.18, 0.18, 0.5, 0.18, 0.9] : [0.16, 0.16, 0.16, 0.42, 0.16, 1.2];
      let t = at;
      call.forEach((f, i) => {
        brass(t, lengths[i] * 0.95, f, 0.07);
        if (kind === "honour") brass(t, lengths[i] * 0.95, f * 0.75, 0.04);
        t += lengths[i];
      });
    },
  };
}

/** The one sound set for the game. */
export const sound = ringSound();
