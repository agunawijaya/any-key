import { effectsBus, isSoundOn } from "@/lib/kit/sound";
import type { SoundName } from "./play/choreography";

/*
 * The pit's sounds, all synthesised. A bed of meadow air under everything
 * (a breeze and the odd bird by day, crickets by night), and short effects
 * for what happens in the pit: steps, landings, the rustle of grass, the
 * sting before a pounce, the squish, the crunch, the chime of release.
 * Everything runs through the collection's effects bus, so the top bar's
 * mute and the volume setting apply. Nothing plays before the player has
 * pressed something, as browsers require.
 */

export type PitSound = {
  play(name: SoundName): void;
  /** The meadow bed, by day or by night; null stops it. */
  ambience(mode: "day" | "night" | null): void;
  stop(): void;
};

export function pitSound(): PitSound {
  let bus: ReturnType<typeof effectsBus> | null = null;
  let noise: AudioBuffer | null = null;
  let bed: { stop: () => void; mode: "day" | "night" } | null = null;
  let chirps = 0;

  const ready = () => {
    if (!isSoundOn()) return null;
    bus ??= effectsBus(0.5);
    if (bus.ctx.state === "suspended") void bus.ctx.resume();
    if (!noise) {
      const { ctx } = bus;
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return bus;
  };

  /** A burst of filtered noise: rustles, dust, crunches. */
  const hiss = (start: number, length: number, filter: BiquadFilterType, frequency: number, level: number, q = 1) => {
    const b = ready();
    if (!b) return;
    const { ctx, out } = b;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = frequency;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + Math.min(0.02, length / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + length + 0.05);
  };

  /** A sliding tone: thumps, bonks, chimes, the sting. */
  const tone = (start: number, length: number, type: OscillatorType, from: number, to: number, level: number) => {
    const b = ready();
    if (!b) return;
    const { ctx, out } = b;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const t = ctx.currentTime + start;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + length + 0.05);
  };

  const effects: Record<SoundName, () => void> = {
    step: () => hiss(0, 0.08, "bandpass", 900, 0.12, 2),
    thump: () => {
      tone(0, 0.22, "sine", 120, 48, 0.5);
      hiss(0, 0.18, "lowpass", 500, 0.18);
    },
    rustle: () => {
      for (let i = 0; i < 4; i++) hiss(i * 0.06, 0.12, "highpass", 2400 + i * 300, 0.08, 0.7);
    },
    sting: () => {
      // Two close notes rubbing against each other, rising: something is about to happen.
      tone(0, 0.32, "triangle", 330, 392, 0.12);
      tone(0, 0.32, "triangle", 349, 415, 0.1);
    },
    again: () => {
      // The same rub, higher and shorter: it is going again.
      tone(0, 0.2, "triangle", 440, 523, 0.11);
      tone(0, 0.2, "triangle", 466, 554, 0.09);
    },
    squish: () => {
      tone(0, 0.35, "sawtooth", 260, 60, 0.12);
      hiss(0.02, 0.3, "lowpass", 700, 0.3, 4);
    },
    crunch: () => {
      for (let i = 0; i < 5; i++) hiss(i * 0.05, 0.08, "bandpass", 1600 - i * 180, 0.35, 3);
      tone(0.05, 0.3, "square", 90, 40, 0.15);
    },
    chime: () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(i * 0.11, 0.9, "sine", f, f, 0.16));
    },
    bonk: () => {
      tone(0, 0.12, "square", 520, 380, 0.1);
      tone(0.08, 0.45, "sine", 900, 220, 0.12);
    },
    toss: () => hiss(0, 0.3, "bandpass", 1200, 0.12, 0.8),
    dig: () => {
      for (let i = 0; i < 3; i++) hiss(i * 0.12, 0.1, "bandpass", 700, 0.22, 1.5);
    },
    pop: () => tone(0, 0.09, "sine", 900, 1500, 0.18),
    munch: () => {
      for (let i = 0; i < 6; i++) hiss(i * 0.09, 0.05, "bandpass", 2200, 0.2, 4);
    },
  };

  /** The meadow bed: a soft moving breeze, with birds by day and crickets by night. */
  const startBed = (mode: "day" | "night") => {
    const b = ready();
    if (!b) return null;
    const { ctx, out } = b;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = mode === "day" ? 650 : 420;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(mode === "day" ? 0.05 : 0.04, ctx.currentTime + 1.5);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const depth = ctx.createGain();
    depth.gain.value = 220;
    lfo.connect(depth).connect(f.frequency);
    src.connect(f).connect(g).connect(out);
    src.start();
    lfo.start();
    chirps = window.setInterval(() => {
      if (!isSoundOn()) return;
      if (mode === "day") {
        if (Math.random() < 0.35) {
          const base = 2400 + Math.random() * 1200;
          for (let i = 0; i < 3; i++) tone(i * 0.09, 0.07, "sine", base, base * 1.25, 0.03);
        }
      } else if (Math.random() < 0.7) {
        for (let i = 0; i < 4; i++) tone(i * 0.05, 0.03, "triangle", 4200, 4300, 0.015);
      }
    }, 1400);
    return {
      mode,
      stop: () => {
        window.clearInterval(chirps);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        src.stop(ctx.currentTime + 0.5);
        lfo.stop(ctx.currentTime + 0.5);
      },
    };
  };

  return {
    play: (name) => effects[name](),
    ambience(mode) {
      if (bed?.mode === mode) return;
      bed?.stop();
      bed = mode ? startBed(mode) : null;
    },
    stop() {
      bed?.stop();
      bed = null;
    },
  };
}
