import { effectsBus, isSoundOn } from "@/lib/kit/sound";
import { isStore } from "@/lib/long-memory/board";

/*
 * The board's sounds, synthesised: no recordings. A seed landing on bare
 * wood knocks low (lower still in a deep store), a seed landing on other
 * seeds clicks bright and short, a handful lifting off whispers, and the
 * Memory Book turns a page and rings faintly when it remembers. Everything
 * goes through the collection's effects bus, so the top bar's mute and the
 * volume setting apply, and nothing plays until the player has pressed
 * something, as browsers require.
 */

type Bus = ReturnType<typeof effectsBus>;

let bus: Bus | null = null;
let noise: AudioBuffer | null = null;
let lastClick = 0;

function ready(): Bus | null {
  if (!isSoundOn()) return null;
  bus ??= effectsBus(0.5);
  if (!noise) {
    const { ctx } = bus;
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return bus;
}

function burst(b: Bus, at: number, duration: number, filter: { type: BiquadFilterType; frequency: number; q: number }, level: number) {
  const { ctx, out } = b;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const shape = ctx.createBiquadFilter();
  shape.type = filter.type;
  shape.frequency.value = filter.frequency;
  shape.Q.value = filter.q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(shape).connect(gain).connect(out);
  source.start(at, Math.random() * 0.5, duration + 0.02);
  return { shape, gain };
}

function tone(b: Bus, at: number, hz: number, duration: number, level: number, type: OscillatorType = "sine", attack = 0.002) {
  const { ctx, out } = b;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, at);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

/**
 * A seed hitting something. `speed` in cm/s from the physics; `onWood` when
 * it struck the hollow rather than another seed; `hole` for the depth.
 */
export function seedImpact(speed: number, onWood: boolean, hole: number) {
  const b = ready();
  if (!b) return;
  const now = b.ctx.currentTime;
  // A pile of seeds settling makes dozens of tiny knocks: keep the loud ones, thin out the rest.
  if (now - lastClick < 0.018) return;
  lastClick = now;
  const level = Math.min(1, (speed - 20) / 140) * (onWood ? 0.55 : 0.32);
  if (level <= 0.01) return;
  const deep = isStore(hole);
  if (onWood) {
    const body = (deep ? 170 : 245) * (0.92 + Math.random() * 0.16);
    tone(b, now, body, deep ? 0.16 : 0.11, level, "triangle");
    tone(b, now, body * 2.7, 0.04, level * 0.35, "sine");
    burst(b, now, 0.025, { type: "bandpass", frequency: 1800, q: 1.2 }, level * 0.5);
  } else {
    const click = 2600 + Math.random() * 1600;
    burst(b, now, 0.018, { type: "bandpass", frequency: click, q: 4 }, level);
    tone(b, now, click * 0.5, 0.03, level * 0.25, "sine");
  }
}

/** A handful lifting out of a pit. */
export function lift() {
  const b = ready();
  if (!b) return;
  const now = b.ctx.currentTime;
  const { shape } = burst(b, now, 0.22, { type: "bandpass", frequency: 700, q: 0.8 }, 0.12);
  shape.frequency.exponentialRampToValueAtTime(2600, now + 0.2);
}

/** The Memory Book turning a page. */
export function pageTurn() {
  const b = ready();
  if (!b) return;
  const now = b.ctx.currentTime;
  const { shape } = burst(b, now, 0.42, { type: "bandpass", frequency: 900, q: 0.7 }, 0.16);
  shape.frequency.exponentialRampToValueAtTime(4200, now + 0.38);
  // The paper settling.
  burst(b, now + 0.36, 0.08, { type: "highpass", frequency: 3000, q: 0.5 }, 0.06);
}

/** The faint ring of a remembered loss. */
export function remember() {
  const b = ready();
  if (!b) return;
  const now = b.ctx.currentTime;
  for (const [hz, delay, level] of [
    [659.3, 0, 0.07],
    [987.8, 0.12, 0.05],
    [1318.5, 0.26, 0.035],
  ] as const) {
    tone(b, now + delay, hz, 2.2, level, "sine", 0.25);
  }
}
