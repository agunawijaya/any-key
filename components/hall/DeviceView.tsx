"use client";

import { useRef, useState } from "react";
import { programs } from "@/lib/catalog";
import { ProgramPreview } from "@/components/previews/ProgramPreview";
import styles from "./DeviceView.module.css";

const KNOB_SWEEP = 270;
const GRILLE_HOLES = 48;

export function DeviceView() {
  const [index, setIndex] = useState(0);
  const [factIndex, setFactIndex] = useState<number | null>(null);
  const [bump, setBump] = useState(0);
  const knobDrag = useRef<{ angle: number; id: number } | null>(null);

  const program = programs[index];
  const n = programs.length;
  const knobAngle = n > 1 ? -KNOB_SWEEP / 2 + (KNOB_SWEEP * index) / (n - 1) : 0;
  const [c1, c2, c3] = program.palette;

  function go(next: number) {
    if (next < 0 || next >= n) {
      setBump((b) => b + 1); // nothing there: the knob wiggles instead
      return;
    }
    setIndex(next);
    setFactIndex(null);
  }

  function onKnobKey(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowUp: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index - 1,
      Home: 0,
      End: n - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    go(moves[event.key]);
  }

  function pointerAngle(event: React.PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (box.left + box.width / 2);
    const y = event.clientY - (box.top + box.height / 2);
    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  function onKnobDown(event: React.PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    knobDrag.current = { angle: pointerAngle(event), id: event.pointerId };
  }

  function onKnobMove(event: React.PointerEvent<HTMLElement>) {
    const drag = knobDrag.current;
    if (!drag) return;
    const angle = pointerAngle(event);
    let delta = angle - drag.angle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    if (Math.abs(delta) >= 35) {
      drag.angle = angle;
      go(index + Math.sign(delta));
    }
  }

  function showNextFact() {
    setFactIndex((current) => {
      if (current === null) return 0;
      return current + 1 < program.trivia.length ? current + 1 : null;
    });
  }

  return (
    <section data-view="device" aria-label="Device" className={styles.stage}>
      <div className={styles.rig}>
        <div className={styles.slot} aria-hidden>
          <div
            key={program.id}
            className={styles.cart}
            style={{ "--c1": c1, "--c2": c2, "--c3": c3 } as React.CSSProperties}
          >
            <span className={styles.cartLabel}>{program.title}</span>
            <span className={styles.cartYear}>{program.original.year}</span>
          </div>
        </div>

        <div className={styles.device}>
          <span className={`${styles.screw} ${styles.tl}`} aria-hidden />
          <span className={`${styles.screw} ${styles.tr}`} aria-hidden />
          <span className={`${styles.screw} ${styles.bl}`} aria-hidden />
          <span className={`${styles.screw} ${styles.br}`} aria-hidden />

          <div className={styles.left}>
            <div className={styles.bezel}>
              <div className={styles.screen}>
                <div className={styles.statusRow}>
                  <span>SLOT A</span>
                  <span>
                    {String(index + 1).padStart(2, "0")}/{String(n).padStart(2, "0")}
                  </span>
                  <span className={styles.ready}>
                    <i aria-hidden /> {program.status === "playable" ? "READY" : "SOON"}
                  </span>
                </div>

                <div className={styles.display} aria-live="polite">
                  {factIndex === null ? (
                    <ProgramPreview id={program.id} />
                  ) : (
                    <div className={styles.fact}>
                      <span className={styles.factHead}>
                        FACT {factIndex + 1}/{program.trivia.length}
                      </span>
                      <p>{program.trivia[factIndex]}</p>
                    </div>
                  )}
                </div>

                <h2 className={styles.screenTitle}>{program.title}</h2>
                <p className={styles.screenMeta}>
                  {program.stats.map((s) => `${s.value} ${s.label}`).join(" · ")}
                </p>
              </div>
            </div>
            <div className={styles.brand}>
              <span>any key</span>
              <span>AK-81 · program player</span>
            </div>
          </div>

          <div className={styles.right}>
            <div className={styles.knobBlock}>
              <div className={styles.ticks} aria-hidden>
                {Array.from({ length: 11 }, (_, i) => (
                  <span key={i} style={{ "--a": `${-135 + i * 27}deg` } as React.CSSProperties} />
                ))}
              </div>
              <div
                key={bump}
                className={`${styles.knob} ${bump ? styles.bump : ""}`}
                role="slider"
                tabIndex={0}
                aria-label="Program"
                aria-valuemin={1}
                aria-valuemax={n}
                aria-valuenow={index + 1}
                aria-valuetext={program.title}
                style={{ "--angle": `${knobAngle}deg` } as React.CSSProperties}
                onKeyDown={onKnobKey}
                onPointerDown={onKnobDown}
                onPointerMove={onKnobMove}
                onPointerUp={() => (knobDrag.current = null)}
                onPointerCancel={() => (knobDrag.current = null)}
              >
                <span className={styles.knobCap} />
              </div>
              <span className={styles.label}>program</span>
            </div>

            <div className={styles.grille} aria-hidden>
              {Array.from({ length: GRILLE_HOLES }, (_, i) => (
                <span key={i} style={{ "--d": `${(i % 8) * 90 + Math.floor(i / 8) * 60}ms` } as React.CSSProperties} />
              ))}
            </div>

            <div className={styles.meter} aria-hidden>
              <div className={styles.bars}>
                {Array.from({ length: 18 }, (_, i) => (
                  <i
                    key={i}
                    style={
                      {
                        "--t": `${520 + ((i * 137) % 420)}ms`,
                        "--d": `${-((i * 211) % 900)}ms`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
              <span className={styles.label}>level</span>
            </div>

            <div className={styles.keys}>
              <KeyButton label="prev" onClick={() => go(index - 1)}>
                ◀
              </KeyButton>
              <KeyButton label="next" onClick={() => go(index + 1)}>
                ▶
              </KeyButton>
              <KeyButton label="info" onClick={showNextFact} pressed={factIndex !== null}>
                i
              </KeyButton>
              {program.status === "playable" && program.href ? (
                <a className={`${styles.key} ${styles.play}`} href={program.href}>
                  <span className={styles.keyFace}>PLAY</span>
                  <span className={styles.label}>play</span>
                </a>
              ) : (
                <button type="button" className={`${styles.key} ${styles.play}`} disabled>
                  <span className={styles.keyFace}>SOON</span>
                  <span className={styles.label}>play</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.shelf}>
          <p className={styles.shelfTitle}>Cartridges</p>
          <div className={styles.shelfRow}>
            {programs.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={styles.shelfCart}
                aria-pressed={i === index}
                onClick={() => go(i)}
                style={{ "--c1": p.palette[0], "--c2": p.palette[1], "--c3": p.palette[2] } as React.CSSProperties}
              >
                <span className={styles.shelfCartTitle}>{p.title}</span>
                <span className={styles.shelfCartState}>{i === index ? "in the slot" : "insert"}</span>
              </button>
            ))}
            <div className={styles.shelfEmpty} aria-hidden>
              <span>+</span>
            </div>
            <div className={styles.shelfEmpty} aria-hidden>
              <span>+</span>
            </div>
          </div>
          <p className={styles.shelfNote}>More cartridges arrive as programs get rebuilt.</p>
        </div>
      </div>
    </section>
  );
}

function KeyButton({
  label,
  children,
  onClick,
  pressed,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button type="button" className={styles.key} onClick={onClick} aria-label={label} aria-pressed={pressed}>
      <span className={styles.keyFace} aria-hidden>
        {children}
      </span>
      <span className={styles.label} aria-hidden>
        {label}
      </span>
    </button>
  );
}
