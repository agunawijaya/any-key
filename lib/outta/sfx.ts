import { effectsBus } from "@/lib/kit/sound";

/*
 * Outta Here sounds, all synthesised: a tick for placing a bomb, a thump and
 * a glass shatter for the blast, a rising run for a chain, chimes for pickups,
 * a buzz when something gets you and a little fanfare on the way out.
 */

let ctx: AudioContext | null = null;
let out: GainNode | null = null;

function audio() {
  if (!ctx) {
    // The collection's master bus follows mute and volume.
    ({ ctx, out } = effectsBus(0.5));
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: out! };
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number) {
  const { ctx, out } = audio();
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, cutoff: number, when = 0) {
  const { ctx, out } = audio();
  const t = ctx.currentTime + when;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, t);
  filter.frequency.exponentialRampToValueAtTime(120, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(t);
}

export const sfx = {
  bomb: () => tone(660, 0.06, "square", 0.08),
  boom: (broken: number, chain: boolean) => {
    tone(120, 0.35, "sine", 0.5, 0, 45);
    noise(0.3, 0.35, 2400);
    for (let i = 0; i < Math.min(broken, chain ? 10 : 3); i++) tone(1800 + ((i * 377) % 900), 0.08, "triangle", 0.05, 0.03 + i * (chain ? 0.045 : 0.03));
    if (chain) for (let i = 0; i < 5; i++) tone(440 * 2 ** (i / 4), 0.12, "triangle", 0.08, 0.05 + i * 0.07);
  },
  pickup: (big: boolean) => {
    tone(880, 0.1, "triangle", 0.12);
    tone(big ? 1320 : 1175, 0.14, "triangle", 0.12, 0.07);
    if (big) tone(1760, 0.2, "triangle", 0.1, 0.14);
  },
  hit: () => {
    tone(220, 0.25, "sawtooth", 0.14, 0, 90);
    noise(0.12, 0.15, 900);
  },
  bump: () => tone(140, 0.05, "square", 0.04),
  dive: () => tone(520, 0.12, "sine", 0.1, 0, 260),
  rise: () => tone(260, 0.12, "sine", 0.1, 0, 520),
  tunnel: () => tone(700, 0.08, "sine", 0.07, 0, 1100),
  win: () => [0, 4, 7, 12].forEach((s, i) => tone(523 * 2 ** (s / 12), 0.22, "triangle", 0.14, i * 0.09)),
  lose: () => [0, -3, -7].forEach((s, i) => tone(330 * 2 ** (s / 12), 0.3, "sine", 0.12, i * 0.14)),
};
