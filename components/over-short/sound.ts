import { effectsBus, isSoundOn } from "@/lib/kit/sound";

/*
 * Over / Short's sounds, synthesised: no recordings. The gun's report and
 * its echo off the hills; the shell's whistle climbing as the camera rides
 * it in (Cannoneer's PC speaker swept from 3,000 to 4,000 Hz for the same
 * moment); the distant crump of a round landing, a bigger one for a hit and
 * a rolling chain for a dump going up; the telephone line crackling before
 * the observer speaks, and the field telephone's ring; the enemy's incoming
 * shell, falling in pitch as it comes (where our own climbs as it goes); a
 * crew call before each round and a cheer for a target destroyed; the team
 * of horses and the limber's wheels when the gun moves; the pop and hiss of
 * a star shell; birds between barrages.
 * Everything runs through the collection's effects bus, so the top bar's
 * mute and the volume apply, and nothing starts before the player presses
 * something.
 */

export type BattleSound = {
  fire(): void;
  /** The shell's whistle over the `seconds` the flight plays on screen. */
  whistle(seconds: number): void;
  impact(power: number): void;
  destroyed(big: boolean): void;
  report(): void;
  incoming(): void;
  cheer(): void;
  limber(): void;
  /** The field telephone's ring before the observer speaks. */
  telephone(): void;
  /** A star shell: the pop of it bursting and the hiss of it burning. */
  starShell(): void;
  /** Called now and then while all is quiet: sometimes a bird. */
  quiet(day: boolean): void;
  /** Opens the audio ahead of the first sound: opening it takes a moment the first round should not wait for. */
  wake(): void;
  stop(): void;
};

export function battleSound(): BattleSound {
  let bus: ReturnType<typeof effectsBus> | null = null;
  let noise: AudioBuffer | null = null;
  const live = new Set<AudioScheduledSourceNode>();

  const ready = () => {
    if (!isSoundOn()) return null;
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

  /** Filtered noise with a sharp attack and an exponential tail: every bang, crump and crackle starts here. */
  const noiseHit = (at: number, length: number, type: BiquadFilterType, frequency: number, level: number, q = 0.7) => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime + at;
    const source = track(ctx.createBufferSource());
    source.buffer = audio.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    source.connect(filter).connect(gain).connect(out);
    source.start(t, Math.random() * 1.5);
    source.stop(t + length + 0.05);
  };

  /** A falling sine: the chest-thump under every explosion. */
  const thump = (at: number, from: number, to: number, length: number, level: number) => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime + at;
    const osc = track(ctx.createOscillator());
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.05);
  };

  /** A tone gliding from one pitch to another, with a little waver: whistles and bird calls. */
  const glide = (at: number, length: number, from: number, to: number, level: number, wobble = 0, type: OscillatorType = "sine") => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime + at;
    const osc = track(ctx.createOscillator());
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + Math.min(0.08, length * 0.3));
    gain.gain.setValueAtTime(level, t + length * 0.85);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    if (wobble) {
      const lfo = track(ctx.createOscillator());
      lfo.frequency.value = 7;
      const depth = ctx.createGain();
      depth.gain.value = wobble;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + length + 0.05);
    }
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.05);
  };

  /** A shout from the crew: a buzzy voice through two vowel formants, pitch falling at the end. */
  const call = (at: number, pitch: number, length: number, level: number) => {
    const audio = ready();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime + at;
    const voice = track(ctx.createOscillator());
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(pitch, t);
    voice.frequency.linearRampToValueAtTime(pitch * 1.12, t + length * 0.3);
    voice.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    for (const [frequency, q, share] of [
      [760, 6, 1],
      [1180, 8, 0.6],
    ]) {
      const formant = ctx.createBiquadFilter();
      formant.type = "bandpass";
      formant.frequency.value = frequency;
      formant.Q.value = q;
      const mix = ctx.createGain();
      mix.gain.value = share;
      voice.connect(formant).connect(mix).connect(gain);
    }
    gain.connect(out);
    voice.start(t);
    voice.stop(t + length + 0.05);
  };

  return {
    fire() {
      call(0, 165, 0.32, 0.12);
      // The report: a hard crack, a deep thump, then the hills answering twice.
      noiseHit(0.42, 0.5, "lowpass", 2400, 0.9);
      thump(0.42, 110, 32, 0.7, 0.9);
      noiseHit(0.82, 0.9, "lowpass", 700, 0.18);
      noiseHit(1.45, 1.2, "lowpass", 420, 0.1);
    },
    whistle(seconds) {
      // Climbing as it comes in, loudest just before it lands.
      glide(0.6, Math.max(0.8, seconds - 0.6), 1400, 2600, 0.035, 18);
      noiseHit(0.6, Math.max(0.8, seconds - 0.4), "bandpass", 2400, 0.025, 4);
    },
    impact(power) {
      noiseHit(0, 1.4 + power * 0.4, "lowpass", 380, 0.7 * power);
      thump(0, 70, 26, 1.2, 0.6 * power);
    },
    destroyed(big) {
      noiseHit(0, 2.2, "lowpass", 520, 1);
      thump(0, 80, 24, 1.6, 1);
      if (!big) return;
      // The secondaries, ragged, for a few seconds.
      for (let k = 0; k < 7; k++) {
        const at = 0.4 + k * 0.5 + Math.random() * 0.25;
        noiseHit(at, 1.2, "lowpass", 300 + Math.random() * 400, 0.35 + Math.random() * 0.3);
        thump(at, 60, 25, 0.9, 0.3);
      }
      noiseHit(0.6, 4, "bandpass", 1800, 0.05, 0.6);
    },
    report() {
      // The line opens with a crackle and a click before the voice.
      for (let k = 0; k < 9; k++) noiseHit(k * 0.05 + Math.random() * 0.03, 0.04, "bandpass", 1800 + Math.random() * 1500, 0.1, 3);
      noiseHit(0.5, 0.03, "highpass", 3000, 0.15);
    },
    incoming() {
      // Theirs falls in pitch and swells as it comes down on you; ours climbs as it goes away.
      glide(0, 0.8, 2900, 620, 0.07, 40, "triangle");
      noiseHit(0, 0.85, "bandpass", 1600, 0.05, 2);
    },
    cheer() {
      call(0, 210, 0.45, 0.07);
      call(0.08, 175, 0.5, 0.07);
      call(0.15, 240, 0.4, 0.06);
    },
    limber() {
      call(0, 140, 0.4, 0.1);
      // Hooves at the walk, four beats a stride; the limber's iron tyres rumbling; the harness chinking.
      for (let k = 0; k < 18; k++) {
        const at = 0.5 + k * 0.24 + (k % 2) * 0.03;
        noiseHit(at, 0.06, "bandpass", 900 + (k % 4) * 140, 0.22, 4);
        thump(at, 120, 70, 0.08, 0.12);
      }
      noiseHit(1.4, 3.2, "lowpass", 180, 0.18, 0.8);
      for (let k = 0; k < 6; k++) glide(1.5 + k * 0.5 + Math.random() * 0.2, 0.05, 5200, 4800, 0.02);
    },
    telephone() {
      // A magneto ring: a buzz chopped twice.
      for (const at of [0, 0.32]) glide(at, 0.22, 920, 900, 0.035, 25, "square");
    },
    starShell() {
      noiseHit(0, 0.12, "highpass", 1800, 0.35);
      thump(0, 220, 90, 0.15, 0.25);
      noiseHit(0.15, 2.6, "highpass", 3200, 0.04, 0.5);
    },
    quiet(day) {
      if (!day || Math.random() > 0.35) return;
      const at = Math.random() * 0.5;
      for (let k = 0; k < 3; k++) glide(at + k * 0.13, 0.09, 3800 + Math.random() * 1200, 5200 + Math.random() * 900, 0.018);
    },
    wake() {
      ready();
    },
    stop() {
      for (const node of live) {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      }
      live.clear();
    },
  };
}
