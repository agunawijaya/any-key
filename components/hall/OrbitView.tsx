"use client";

import { useEffect, useRef, useState } from "react";
import { games } from "@/lib/catalog";
import { isPlayable, yearLabel, type GameManifest } from "@/lib/kit/manifest";
import { Sticker } from "@/components/ui/Sticker";
import { ChevronIcon } from "@/components/kit/icons";
import styles from "./OrbitView.module.css";

const TURN = Math.PI * 2;
const STEP = TURN / games.length;
const MOON_COLORS = ["var(--lime)", "var(--cyan)", "var(--orange)", "#ffffff", "var(--pink)", "var(--blue)"];

export function OrbitView() {
  const [selected, setSelected] = useState(0);
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const targetRef = useRef(0);
  const frameRef = useRef(0);
  const dragRef = useRef<{ x: number; from: number; moved: boolean; id: number } | null>(null);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function glide() {
    cancelAnimationFrame(frameRef.current);
    const tick = () => {
      const from = rotationRef.current;
      const gap = targetRef.current - from;
      rotationRef.current = Math.abs(gap) < 0.0005 ? targetRef.current : from + gap * 0.12;
      setRotation(rotationRef.current);
      if (rotationRef.current !== targetRef.current) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function select(index: number) {
    const n = games.length;
    const next = ((index % n) + n) % n;
    setSelected(next);
    // Of all equivalent angles, glide to the one closest to where we are now.
    const base = -next * STEP;
    targetRef.current = base + Math.round((rotationRef.current - base) / TURN) * TURN;
    glide();
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { x: event.clientX, from: rotationRef.current, moved: false, id: event.pointerId };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(drag.id);
      cancelAnimationFrame(frameRef.current);
    }
    rotationRef.current = drag.from + dx * 0.006;
    setRotation(rotationRef.current);
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) select(Math.round(-rotationRef.current / STEP));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") select(selected + 1);
    else if (event.key === "ArrowLeft") select(selected - 1);
    else return;
    event.preventDefault();
  }

  const program = games[selected];
  const single = games.length === 1;

  return (
    <section data-view="orbit" aria-label="Orbit" className={styles.orbit}>
      <div
        className={styles.stage}
        role="group"
        aria-roledescription="carousel"
        aria-label="Programs in orbit. Use left and right arrows to spin."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={styles.sky} aria-hidden>
          <span className={styles.starsNear} />
          <span className={styles.starsFar} />
        </div>
        <p className={styles.backdropText} aria-hidden>
          pick a world
        </p>

        <svg className={styles.path} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <ellipse cx="50" cy="50" rx="48" ry="16" />
        </svg>

        <div className={styles.field}>
          {games.map((p, i) => {
            const theta = rotation + i * STEP;
            const depth = Math.cos(theta);
            const nearness = (depth + 1) / 2;
            return (
              <button
                key={p.id}
                type="button"
                className={styles.slot}
                style={
                  {
                    // Rounded so the server and the browser write the same style.
                    left: `${(50 + Math.sin(theta) * 47).toFixed(3)}%`,
                    top: `${(46 + depth * 8).toFixed(3)}%`,
                    zIndex: Math.round(nearness * 20),
                    "--s": (0.45 + 0.55 * nearness).toFixed(3),
                    "--o": (0.35 + 0.65 * nearness).toFixed(3),
                  } as React.CSSProperties
                }
                aria-label={`${p.title}${i === selected ? " (in front)" : ""}`}
                aria-current={i === selected}
                onClick={() => select(i)}
              >
                <Planet program={p} />
              </button>
            );
          })}
        </div>

        <aside className={styles.panel} aria-live="polite">
          <p className={styles.kind}>{program.kind}</p>
          <h2 className={styles.title}>{program.title}</h2>
          <p className={styles.tagline}>{program.tagline}</p>

          {program.moons.length > 0 && (
            <p className={styles.moonsLabel}>
              {program.moons.length} {program.moonsName} in orbit
            </p>
          )}
          <ul className={styles.moons}>
            {program.moons.map((moon, k) => (
              <li key={moon} style={{ "--mc": MOON_COLORS[k % MOON_COLORS.length] } as React.CSSProperties}>
                {moon}
              </li>
            ))}
          </ul>

          <div className={styles.panelFoot}>
            {isPlayable(program) ? (
              <span className={styles.ctas}>
                <a className={styles.cta} href={program.route}>
                  Land here
                </a>
                <a className={styles.ctaStory} href={`${program.route}#story`} aria-label={`Read the story of ${program.title}`}>
                  Story
                </a>
              </span>
            ) : (
              <span className={styles.cta} aria-disabled>
                Landing soon
              </span>
            )}
            <Sticker color="var(--lime)" tilt={-4}>
              Est. {yearLabel(program)}
            </Sticker>
          </div>
        </aside>

        <div className={styles.nav}>
          <button type="button" onClick={() => select(selected - 1)} disabled={single} aria-label="Previous program">
            <ChevronIcon dir="left" size={22} />
          </button>
          <span className={styles.count}>
            {String(selected + 1).padStart(2, "0")} / {String(games.length).padStart(2, "0")}
          </span>
          <button type="button" onClick={() => select(selected + 1)} disabled={single} aria-label="Next program">
            <ChevronIcon dir="right" size={22} />
          </button>
        </div>
        <p className={styles.hint} aria-hidden>
          {single ? "More worlds are on their way" : "Drag to spin"}
        </p>
      </div>
    </section>
  );
}

function Planet({ program }: { program: GameManifest }) {
  const [c1, c2, c3] = program.palette;
  return (
    <div className={styles.scene} style={{ "--c1": c1, "--c2": c2, "--c3": c3 } as React.CSSProperties}>
      <div className={styles.halo} />
      <div className={styles.sphere}>
        <span className={styles.bands} />
        <span className={styles.storms} />
        <span className={styles.shade} />
      </div>
      <div className={styles.plane}>
        <div className={styles.moonTrack} />
        <div className={styles.vinyl} />
        {program.moons.map((moon, k) => (
          <div
            key={moon}
            className={styles.moonOrbit}
            style={{ "--delay": `${(-k / program.moons.length) * 44}s` } as React.CSSProperties}
          >
            <span
              className={styles.moon}
              style={
                {
                  "--mc": MOON_COLORS[k % MOON_COLORS.length],
                  "--ms": `${14 + ((k * 7) % 3) * 4}px`,
                } as React.CSSProperties
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
