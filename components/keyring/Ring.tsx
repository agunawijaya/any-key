"use client";

import { useEffect, useMemo, useRef } from "react";
import { KeycapArt } from "@/components/kit/Keycap";
import { prefersReducedMotion } from "@/lib/kit/appearance";
import type { AchievementTier } from "@/lib/kit/manifest";
import { RingMotion } from "./ring-physics";
import styles from "./Ring.module.css";

export type RingCap = { key: string; accent: string; emblem: string; tier: AchievementTier; title: string };

type Props = {
  caps: RingCap[];
  /** Plays the level-up light wave across the caps, left to right. */
  wave?: number;
};

const WIDTH = 900;
const HEIGHT = 640;
const CENTRE = { x: WIDTH / 2, y: 200 };
const RADIUS = 186;
/** Caps are drawn at 100 units and scaled up to this on the ring. */
const CAP_SCALE = 1.04;

/**
 * Every collected keycap hangs from one split ring. The ring can be dragged
 * round (or nudged with the arrow keys); the caps swing back to hang at the
 * bottom, and a slow breeze keeps them swaying.
 */
export function Ring({ caps, wave = 0 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const capRefs = useRef<(SVGGElement | null)[]>([]);
  const linkRefs = useRef<(SVGPathElement | null)[]>([]);
  const jumpRefs = useRef<(SVGEllipseElement | null)[]>([]);
  const motion = useMemo(() => new RingMotion(caps.length, RADIUS), [caps.length]);
  const scale = CAP_SCALE * (caps.length <= 22 ? 1 : Math.max(0.72, 1 - (caps.length - 22) * 0.012));

  // Long links hang in front of short ones; the centre of the bunch is on top.
  const order = useMemo(
    () => motion.hangers.map((h, i) => ({ i, h })).sort((a, b) => a.h.link - b.h.link || Math.abs(b.h.home) - Math.abs(a.h.home)).map(({ i }) => i),
    [motion],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let raf = 0;
    let last = performance.now();
    let visible = true;

    const draw = () => {
      motion.hangers.forEach((h, i) => {
        const p = motion.pivot(h, RADIUS);
        const px = CENTRE.x + p.x;
        const py = CENTRE.y + p.y;
        const deg = (-h.swing * 180) / Math.PI;
        capRefs.current[i]?.setAttribute("transform", `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${deg.toFixed(2)}) translate(${(-50 * scale).toFixed(2)} ${h.link.toFixed(2)}) scale(${scale})`);
        // The jump ring lies across the big ring, turned with it.
        const across = ((h.home + motion.spin) * 180) / Math.PI;
        jumpRefs.current[i]?.setAttribute("transform", `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${across.toFixed(2)})`);
        // The link runs from the jump ring down to the cap's hole.
        const ex = px + Math.sin(h.swing) * (h.link + 4 * scale);
        const ey = py + Math.cos(h.swing) * (h.link + 4 * scale);
        linkRefs.current[i]?.setAttribute("d", `M${px.toFixed(2)} ${py.toFixed(2)}L${ex.toFixed(2)} ${ey.toFixed(2)}`);
      });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const calm = prefersReducedMotion();
      // Small steps keep the swings stable even on a slow frame.
      for (let k = 0; k < 4; k++) motion.step(dt / 4, RADIUS, !calm);
      draw();
    };
    draw();
    raf = requestAnimationFrame(frame);

    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    seen.observe(svg);

    // Drag the ring round its centre.
    let grabbed: { angle: number; at: number } | null = null;
    const angleOf = (event: PointerEvent) => {
      const box = svg.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * WIDTH - CENTRE.x;
      const y = ((event.clientY - box.top) / box.height) * HEIGHT - CENTRE.y;
      return Math.atan2(-x, y);
    };
    const down = (event: PointerEvent) => {
      svg.setPointerCapture(event.pointerId);
      grabbed = { angle: angleOf(event), at: performance.now() };
      motion.grab();
    };
    const move = (event: PointerEvent) => {
      if (!grabbed) return;
      const angle = angleOf(event);
      let delta = angle - grabbed.angle;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      const now = performance.now();
      motion.turn(delta, (now - grabbed.at) / 1000);
      grabbed = { angle, at: now };
    };
    const up = () => {
      grabbed = null;
      motion.release();
    };
    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      seen.disconnect();
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
    };
  }, [motion, scale]);

  // Each new wave restarts the sheen: take the class off, let the browser notice, put it back.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !wave) return;
    svg.classList.remove("keyring-wave");
    void svg.getBoundingClientRect();
    svg.classList.add("keyring-wave");
  }, [wave]);

  function onKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      motion.flick(event.key === "ArrowLeft" ? 2.2 : -2.2);
    }
  }

  // Left to right along the ring, for the level-up wave.
  const waveOrder = useMemo(() => motion.hangers.map((h, i) => ({ i, home: h.home })).sort((a, b) => b.home - a.home).map(({ i }) => i), [motion]);

  return (
    <svg
      ref={svgRef}
      className={styles.ring}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="group"
      tabIndex={0}
      aria-label={`Your keyring: ${caps.length} keycap${caps.length === 1 ? "" : "s"}. Drag it, or press the left and right arrows, to spin it.`}
      onKeyDown={onKey}
    >
      <defs>
        <linearGradient id="ring-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className={styles.steelLight} />
          <stop offset="0.45" className={styles.steelMid} />
          <stop offset="0.7" className={styles.steelDark} />
          <stop offset="1" className={styles.steelMid} />
        </linearGradient>
        <radialGradient id="ring-pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className={styles.poolCore} />
          <stop offset="1" className={styles.poolEdge} />
        </radialGradient>
      </defs>

      <ellipse className={styles.pool} cx={CENTRE.x} cy={500} rx={420} ry={200} fill="url(#ring-pool)" />

      {/* The split ring: two turns of steel, slightly apart, with the split near the top. */}
      <circle className={styles.ringShadow} cx={CENTRE.x + 6} cy={CENTRE.y + 10} r={RADIUS} />
      <circle cx={CENTRE.x} cy={CENTRE.y} r={RADIUS} className={styles.edge} />
      <circle cx={CENTRE.x} cy={CENTRE.y} r={RADIUS} className={styles.steel} stroke="url(#ring-steel)" />
      <path
        className={styles.steelOuter}
        stroke="url(#ring-steel)"
        d={`M${CENTRE.x + Math.sin(0.5) * (RADIUS + 5)} ${CENTRE.y - Math.cos(0.5) * (RADIUS + 5)}A${RADIUS + 5} ${RADIUS + 5} 0 1 1 ${CENTRE.x - Math.sin(0.15) * (RADIUS + 5)} ${CENTRE.y - Math.cos(0.15) * (RADIUS + 5)}`}
      />
      <circle cx={CENTRE.x} cy={CENTRE.y} r={RADIUS - 3} className={styles.shine} />

      <g className={styles.bunch}>
      {order.map((i) => (
        <g key={caps[i].key}>
          <path ref={(el) => void (linkRefs.current[i] = el)} className={styles.link} />
          <ellipse ref={(el) => void (jumpRefs.current[i] = el)} rx={4.5} ry={10} className={styles.jump} />
          <g
            ref={(el) => void (capRefs.current[i] = el)}
            className={styles.cap}
            style={{ "--wave-delay": `${waveOrder.indexOf(i) * 70}ms`, "--wave-colour": caps[i].accent } as React.CSSProperties}
          >
            <title>{caps[i].title}</title>
            <circle cx={50} cy={4} r={5.5} className={styles.hole} />
            <KeycapArt id={`ring-${caps[i].key}`} accent={caps[i].accent} emblem={caps[i].emblem} tier={caps[i].tier} />
          </g>
        </g>
      ))}
      </g>
    </svg>
  );
}
