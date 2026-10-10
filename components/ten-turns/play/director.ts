/*
 * The play screens' clock for animation: a queue of beats, each a few tenths
 * of a second of something happening (a hop, a pounce, a landing). Beats run
 * one after another; Space finishes them all at once. The rules have already
 * decided everything by the time a beat starts: beats only show it.
 */

export type Beat = {
  /** Seconds at normal speed. */
  duration: number;
  start?: () => void;
  /** Called every frame with progress from 0 to 1. */
  update?: (progress: number) => void;
  end?: () => void;
};

export class Director {
  private queue: Beat[] = [];
  private current: { beat: Beat; elapsed: number } | null = null;

  add(...beats: Beat[]) {
    this.queue.push(...beats);
  }

  get busy() {
    return !!this.current || this.queue.length > 0;
  }

  /** Moves time on by `dt` seconds (the caller scales it for slower or brisker play). */
  advance(dt: number) {
    let left = dt;
    while (left > 0) {
      if (!this.current) {
        const beat = this.queue.shift();
        if (!beat) return;
        beat.start?.();
        this.current = { beat, elapsed: 0 };
      }
      const { beat } = this.current;
      const length = Math.max(0.0001, beat.duration);
      const room = length - this.current.elapsed;
      const used = Math.min(room, left);
      this.current.elapsed += used;
      left -= used;
      beat.update?.(Math.min(1, this.current.elapsed / length));
      if (this.current.elapsed >= length - 1e-9) {
        this.current = null;
        beat.end?.();
      } else return;
    }
  }

  /** Plays everything left straight to its end. */
  skip() {
    if (this.current) {
      this.current.beat.update?.(1);
      this.current.beat.end?.();
      this.current = null;
    }
    // A beat's end may queue more beats (a chain of pounces); finish those too.
    for (let guard = 0; guard < 500 && this.queue.length; guard++) {
      const beat = this.queue.shift()!;
      beat.start?.();
      beat.update?.(1);
      beat.end?.();
    }
  }

  clear() {
    this.queue = [];
    this.current = null;
  }
}

export const ease = {
  out: (t: number) => 1 - (1 - t) * (1 - t),
  in: (t: number) => t * t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  /** Overshoots and settles, for things landing with a bounce. */
  back: (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2,
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
