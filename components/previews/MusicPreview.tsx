"use client";

import { useEffect, useRef } from "react";
import styles from "./MusicPreview.module.css";

/*
 * A short original motif (not taken from any original program) scrolls across
 * a staff; whatever crosses the playhead lights its key below.
 * Steps count diatonic lines/spaces up from E4, the bottom line of the treble staff.
 */
const MOTIF: [step: number | null, beats: number][] = [
  [0, 0.5], [2, 0.5], [5, 1], [4, 0.5], [5, 0.5], [6, 1], [7, 0.5], [6, 0.5], [5, 0.5], [3, 0.5], [2, 2],
  [3, 0.5], [5, 0.5], [8, 1], [7, 0.5], [6, 0.5], [5, 1], [6, 0.5], [7, 0.5], [9, 2], [null, 1],
];

const COLORS = ["var(--pink)", "var(--cyan)", "var(--lime)", "var(--orange)", "var(--violet)", "var(--blue)"];

const W = 400;
const STAFF_BOTTOM = 84;
const LINE_GAP = 14;
const PLAYHEAD = 92;
const PX_PER_BEAT = 38;
const SECONDS_PER_BEAT = 0.36;
const KEYS_TOP = 120;
const KEYS_HEIGHT = 124;
const WHITE_KEYS = 14; // C4 to B5
const KEY_W = W / WHITE_KEYS;
const BLACK_AFTER = new Set([0, 1, 3, 4, 5]);

const NOTES = (() => {
  let at = 0;
  return MOTIF.map(([step, beats], i) => {
    const note = { step, beats, at, color: COLORS[i % COLORS.length] };
    at += beats;
    return note;
  });
})();
const TOTAL_BEATS = NOTES.reduce((sum, n) => sum + n.beats, 0);

const stepY = (step: number) => STAFF_BOTTOM - step * (LINE_GAP / 2);
const keyForStep = (step: number) => step + 2; // E4 is the third white key from C4

function noteAt(beat: number) {
  for (let i = NOTES.length - 1; i >= 0; i--) {
    if (NOTES[i].at <= beat) return NOTES[i].step === null ? -1 : i;
  }
  return -1;
}

export function MusicPreview() {
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const track = trackRef.current;
    if (!svg || !track) return;

    const bubbles = Array.from(svg.querySelectorAll<SVGCircleElement>("[data-bubble]"));
    let bubbleTurn = 0;
    let beat = 2.2; // start mid-phrase so even a still frame looks alive
    let current = -2;
    let last = 0;
    let frame = 0;

    function draw() {
      const loopBeat = beat % TOTAL_BEATS;
      track!.setAttribute("transform", `translate(${(-loopBeat * PX_PER_BEAT).toFixed(2)} 0)`);
      const index = noteAt(loopBeat);
      if (index === current) return;
      current = index;

      svg!.querySelectorAll(`.${styles.on}`).forEach((el) => el.classList.remove(styles.on));
      if (index < 0) return;

      const note = NOTES[index];
      const key = svg!.querySelector<SVGRectElement>(`[data-key="${keyForStep(note.step!)}"]`);
      key?.style.setProperty("--c", note.color);
      key?.classList.add(styles.on);
      track!.querySelectorAll(`[data-note="${index}"]`).forEach((el) => el.classList.add(styles.on));

      const bubble = bubbles[bubbleTurn++ % bubbles.length];
      bubble.setAttribute("cx", ((keyForStep(note.step!) + 0.5) * KEY_W).toFixed(1));
      bubble.style.setProperty("--c", note.color);
      bubble.classList.remove(styles.rise);
      void bubble.getBoundingClientRect(); // restart the CSS animation
      bubble.classList.add(styles.rise);
    }

    function tick(now: number) {
      if (last) beat += (now - last) / 1000 / SECONDS_PER_BEAT;
      last = now;
      draw();
      frame = requestAnimationFrame(tick);
    }

    draw();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      last = 0;
      if (entry.isIntersecting) frame = requestAnimationFrame(tick);
    });
    observer.observe(svg);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className={styles.svg}
      viewBox={`0 0 ${W} ${KEYS_TOP + KEYS_HEIGHT + 2}`}
      role="img"
      aria-label="Animated preview: notes scroll across a staff and light up piano keys"
    >
      <g className={styles.staff}>
        {[0, 1, 2, 3, 4].map((line) => (
          <line key={line} x1="0" x2={W} y1={STAFF_BOTTOM - line * LINE_GAP} y2={STAFF_BOTTOM - line * LINE_GAP} />
        ))}
      </g>

      <g ref={trackRef}>
        {[-1, 0, 1].map((copy) => (
          <g key={copy} data-copy={copy}>
            {NOTES.map((note, i) => {
              if (note.step === null) return null;
              const x = PLAYHEAD + (note.at + copy * TOTAL_BEATS) * PX_PER_BEAT;
              const y = stepY(note.step);
              const stemDown = note.step >= 4;
              return (
                <g
                  key={i}
                  data-note={i}
                  className={`${styles.note} ${note.beats >= 2 ? styles.hollow : ""}`}
                  style={{ "--c": note.color } as React.CSSProperties}
                >
                  <line
                    x1={stemDown ? x - 5.8 : x + 5.8}
                    x2={stemDown ? x - 5.8 : x + 5.8}
                    y1={y}
                    y2={stemDown ? y + 30 : y - 30}
                  />
                  <g className={styles.head}>
                    <ellipse cx={x} cy={y} rx="6.8" ry="5" transform={`rotate(-20 ${x} ${y})`} />
                  </g>
                </g>
              );
            })}
          </g>
        ))}
      </g>

      <line className={styles.playhead} x1={PLAYHEAD} x2={PLAYHEAD} y1="8" y2="104" />

      <g>
        {Array.from({ length: WHITE_KEYS }, (_, i) => (
          <rect
            key={i}
            data-key={i}
            className={styles.white}
            x={i * KEY_W + 0.6}
            y={KEYS_TOP}
            width={KEY_W - 1.2}
            height={KEYS_HEIGHT}
            rx="4"
          />
        ))}
        {Array.from({ length: WHITE_KEYS - 1 }, (_, i) =>
          BLACK_AFTER.has(i % 7) ? (
            <rect
              key={i}
              className={styles.black}
              x={(i + 1) * KEY_W - KEY_W * 0.29}
              y={KEYS_TOP - 1}
              width={KEY_W * 0.58}
              height={KEYS_HEIGHT * 0.6}
              rx="3"
            />
          ) : null,
        )}
      </g>

      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} data-bubble className={styles.bubble} cx="-20" cy={KEYS_TOP - 8} r="7" />
      ))}
    </svg>
  );
}
