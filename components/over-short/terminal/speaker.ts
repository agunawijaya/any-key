import { effectsBus, isSoundOn } from "@/lib/kit/sound";
import type { SpeakerCue } from "@/lib/over-short/terminal";

/*
 * The IBM PC's speaker, as Cannoneer drove it with SOUND: square waves of
 * one pitch at a time, each held for a number of clock ticks (18.2 to the
 * second). The program's own timings: the round leaving at 400 Hz for half a
 * second; its whistle stepping from 3,000 to 4,000 Hz, 101 steps of about
 * 20 ms; a 150 Hz thud for half a second; a target's five quick sweeps from
 * 500 to 3,500 Hz; and the gun's own end, a 100 Hz drone of ten ticks.
 * Through the collection's effects bus, so the mute and the volume apply.
 */

const TICK = 1 / 18.2;

type Tone = { hz: number; seconds: number };

const CUES: Record<SpeakerCue, Tone[]> = {
  fire: [{ hz: 400, seconds: 0.5 }],
  whistle: Array.from({ length: 101 }, (_, k) => ({ hz: 3000 + k * 10, seconds: 0.02 })),
  thud: [{ hz: 150, seconds: 0.5 }],
  sweeps: Array.from({ length: 5 }, () => Array.from({ length: 31 }, (_, k) => ({ hz: 500 + k * 100, seconds: 0.35 * TICK }))).flat(),
  drone: [{ hz: 100, seconds: 10 * TICK }],
};

/** How long a run of cues lasts, in seconds: the program waits for its sounds before it prints again. */
export const cueSeconds = (cues: SpeakerCue[]) => cues.reduce((sum, cue) => sum + CUES[cue].reduce((s, t) => s + t.seconds, 0), 0);

export function pcSpeaker() {
  let bus: ReturnType<typeof effectsBus> | null = null;
  const live = new Set<OscillatorNode>();
  return {
    /** Plays the cues one after another, as the program queued them. */
    play(cues: SpeakerCue[]) {
      if (!cues.length || !isSoundOn()) return;
      bus ??= effectsBus(0.25);
      const { ctx, out } = bus;
      let at = ctx.currentTime + 0.02;
      const osc = ctx.createOscillator();
      osc.type = "square";
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(out);
      for (const tone of cues.flatMap((cue) => CUES[cue])) {
        osc.frequency.setValueAtTime(tone.hz, at);
        gain.gain.setValueAtTime(0.09, at);
        at += tone.seconds;
      }
      gain.gain.setValueAtTime(0.0001, at);
      osc.start();
      osc.stop(at + 0.05);
      live.add(osc);
      osc.onended = () => live.delete(osc);
    },
    stop() {
      for (const osc of live) {
        try {
          osc.stop();
        } catch {
          // Already stopped.
        }
      }
      live.clear();
    },
  };
}
