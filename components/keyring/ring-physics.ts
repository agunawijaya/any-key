/*
 * How the keyring moves. The ring turns about its centre; the weight of the
 * caps pulls it back so they hang at the bottom. Each cap is a pendulum on
 * its jump ring: when the ring turns, the ring carries the jump ring along and
 * the cap swings behind it, and a slow breeze keeps the bunch gently alive.
 *
 * Units: drawing units (the SVG's), seconds, radians. y points down. Angles
 * on the ring are measured from its lowest point, clockwise as seen.
 */

export type Hanger = {
  /** Where the cap hangs on the ring when the ring is at rest. */
  home: number;
  /** Length of the link from the ring to the top of the cap. */
  link: number;
  /** Swing from straight down, and its speed. */
  swing: number;
  swingSpeed: number;
  /** This cap's own phase in the breeze. */
  breeze: number;
};

/** How hard the bunch pulls the ring back to hanging, and how quickly the ring settles. */
const RING_PULL = 7;
const RING_DAMPING = 1.9;
/** How quickly a swing dies away. */
const SWING_DAMPING = 1.35;
/** Gravity in drawing units per second squared: with links of 30–120 units, caps swing about once a second. */
const GRAVITY = 2400;
/** Distance from the jump ring to the cap's centre of mass, on top of the link. */
const CAP_DROP = 50;
/** The breeze's strength, in radians per second squared. */
const BREEZE = 0.7;

export class RingMotion {
  spin = 0;
  spinSpeed = 0;
  hangers: Hanger[] = [];
  private time = 0;
  private held = false;
  private lastSpinSpeed = 0;

  constructor(count: number, radius: number) {
    this.layout(count, radius);
  }

  /**
   * Spreads the caps over the lower part of the ring. The middle of the bunch
   * hangs lowest and the ends highest, like real keys gathering at the bottom,
   * with a little alternation so neighbours layer instead of lining up.
   */
  layout(count: number, radius: number) {
    const spread = Math.min(1.42, 0.3 + count * 0.058);
    this.hangers = Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const middle = 1 - Math.abs(t - 0.5) * 2;
      // A three-step offset: it never lines up with four games taking turns, so every colour gets to the front.
      const link = radius * (0.04 + 0.42 * middle * middle) + ((i * 2) % 3) * radius * 0.06;
      return { home: (t - 0.5) * 2 * spread, link, swing: 0, swingSpeed: 0, breeze: i * 2.39996 };
    });
  }

  grab() {
    this.held = true;
  }

  /** Turns the held ring by `delta` over `dt` seconds. */
  turn(delta: number, dt: number) {
    this.spin += delta;
    this.spinSpeed = dt > 0 ? delta / dt : 0;
  }

  release() {
    this.held = false;
  }

  /** A nudge, as if the ring had been flicked. */
  flick(speed: number) {
    this.spinSpeed += speed;
  }

  /** Where a cap's jump ring sits, relative to the ring's centre. */
  pivot(h: Hanger, radius: number) {
    const at = h.home + this.spin;
    return { x: -Math.sin(at) * radius, y: Math.cos(at) * radius };
  }

  step(dt: number, radius: number, breezy: boolean) {
    this.time += dt;
    if (!this.held) {
      const pull = -RING_PULL * Math.sin(this.spin) - RING_DAMPING * this.spinSpeed;
      this.spinSpeed += pull * dt;
      this.spin += this.spinSpeed * dt;
    }
    const spinAccel = (this.spinSpeed - this.lastSpinSpeed) / Math.max(dt, 1e-3);
    this.lastSpinSpeed = this.spinSpeed;

    for (const h of this.hangers) {
      const at = h.home + this.spin;
      // The jump ring's acceleration as the ring turns: along the ring, and in towards its centre.
      const along = radius * spinAccel;
      const inward = radius * this.spinSpeed * this.spinSpeed;
      const ax = -Math.cos(at) * along + Math.sin(at) * inward;
      const ay = -Math.sin(at) * along - Math.cos(at) * inward;
      const length = h.link + CAP_DROP;
      const tangential = -GRAVITY * Math.sin(h.swing) - (ax * Math.cos(h.swing) - ay * Math.sin(h.swing));
      const breeze = breezy ? BREEZE * Math.sin(this.time * 0.85 + h.breeze) * (0.6 + 0.4 * Math.sin(this.time * 0.31 + h.breeze * 0.7)) : 0;
      h.swingSpeed += (tangential / length - SWING_DAMPING * h.swingSpeed + breeze) * dt;
      h.swing = Math.max(-1.3, Math.min(1.3, h.swing + h.swingSpeed * dt));
    }
  }
}
