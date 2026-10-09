"use client";

import { useEffect, useState } from "react";
import { hasModifier, isTypingTarget } from "@/lib/kit/keys";
import { LEGS, type Leg } from "@/lib/two-humps/expedition";
import { FOSSIL_COUNT, type Progress } from "@/lib/two-humps/progress";
import type { PursuerKind } from "@/lib/two-humps/rules";
import { PURSUER_NAMES } from "@/lib/two-humps/share";
import { LadleIcon, PennantIcon, StormIcon } from "./icons";
import styles from "./ExpeditionMap.module.css";

/*
 * The Expedition's map, drawn like a page from a traveller's notebook: the
 * five places west to east, roughly where they really are, the route inked
 * in as you go, and the leg list beside it.
 */

type Props = {
  progress: Progress;
  onLeg: (index: number) => void;
  onBack: () => void;
};

const W = 1000;
const H = 600;

const PURSUER_ICON: Record<PursuerKind, (p: { size?: number }) => React.ReactNode> = { haboob: StormIcon, rival: PennantIcon, gang: LadleIcon };

const point = (leg: Leg) => [leg.map.x * W, leg.map.y * H] as const;

/** A gently wandering line through the places, as if inked by hand. */
function routePath(legs: Leg[]) {
  return legs
    .map((leg, i) => {
      const [x, y] = point(leg);
      if (i === 0) return `M${x} ${y}`;
      const [px, py] = point(legs[i - 1]);
      const bend = i % 2 ? -1 : 1;
      const cx = (px + x) / 2 + (y - py) * 0.18 * bend;
      const cy = (py + y) / 2 - (x - px) * 0.18 * bend;
      return `Q${cx} ${cy} ${x} ${y}`;
    })
    .join(" ");
}

export function ExpeditionMap({ progress, onLeg, onBack }: Props) {
  const current = progress.expedition.leg;
  const [chosen, setChosen] = useState(current);
  const leg = LEGS[chosen];
  const done = (i: number) => i < current;
  const open = (i: number) => i <= current;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (hasModifier(event) || isTypingTarget(event.target) || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Game menu <kbd>Esc</kbd>
        </button>
        <h1 className={styles.title}>
          The <em>Expedition</em>
        </h1>
        <p className={styles.sub}>
          Five legs of {LEGS[0].twist.goal} miles across the southern Gobi.
          {progress.expedition.finished > 0 && ` Crossed ${progress.expedition.finished === 1 ? "once" : `${progress.expedition.finished} times`}.`}
        </p>
      </header>

      <div className={styles.body}>
        <figure className={styles.mapWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.map} role="img" aria-label={`Map of the Expedition. ${current} of ${LEGS.length} legs done.`}>
            <defs>
              <filter id="th-ink" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
                <feDisplacementMap in="SourceGraphic" scale="2.4" />
              </filter>
              <pattern id="th-dunes" width="46" height="22" patternUnits="userSpaceOnUse">
                <path d="M2 16c8-9 18-9 26 0M24 8c6-6 13-6 19 0" className={styles.duneStroke} />
              </pattern>
            </defs>

            <rect x="6" y="6" width={W - 12} height={H - 12} rx="18" className={styles.paper} />
            <rect x="18" y="18" width={W - 36} height={H - 36} rx="10" className={styles.frame} />

            <text x={W / 2} y={H * 0.17} className={styles.region} textAnchor="middle">
              G O B I
            </text>

            <g filter="url(#th-ink)">
              {/* The dune field round Khongoryn Els. */}
              <ellipse cx={W * 0.47} cy={H * 0.6} rx="150" ry="34" fill="url(#th-dunes)" className={styles.duneField} />
              {/* The mountains of the Gurvan Saikhan, with Yolyn Am in them. */}
              <g className={styles.mountains}>
                {Array.from({ length: 9 }, (_, i) => {
                  const x = W * 0.6 + i * 34;
                  const y = H * 0.76 - Math.sin(i * 0.9) * 10 - i * 3;
                  const h = 26 + ((i * 7) % 3) * 8;
                  return <path key={i} d={`M${x - 20} ${y}L${x} ${y - h}L${x + 20} ${y}M${x} ${y - h}l-6 ${h * 0.5}m6 -${h * 0.5}l7 ${h * 0.55}`} />;
                })}
              </g>
              <text x={W * 0.72} y={H * 0.86} className={styles.feature} textAnchor="middle">
                Gurvan Saikhan
              </text>
              {/* The red cliffs at Bayanzag and the canyons of Khermen Tsav. */}
              <path className={styles.cliff} d={`M${W * 0.69} ${H * 0.37}l14-10 12 8 16-12 14 9 18-7`} />
              <path className={styles.cliff} d={`M${W * 0.08} ${H * 0.75}l10 8-8 9 12 8-6 10 14 6M${W * 0.2} ${H * 0.74}l-6 9 9 8-9 10 8 9`} />
            </g>

            <path d={routePath(LEGS)} className={styles.route} />
            <path d={routePath(LEGS.slice(0, Math.max(1, current + 1)))} className={styles.routeDone} />

            {LEGS.map((l, i) => {
              const [x, y] = point(l);
              const state = done(i) ? "done" : i === current ? "next" : "ahead";
              return (
                <g key={l.id} transform={`translate(${x} ${y})`} className={styles.place} data-state={state} data-chosen={i === chosen || undefined}>
                  {state === "next" && <circle r="26" className={styles.pulse} />}
                  <circle r="17" className={styles.dot} />
                  {state === "done" ? <path d="M-7 0l5 5 9-10" className={styles.tick} /> : <text className={styles.num} textAnchor="middle" dy="5.5">{i + 1}</text>}
                  <text className={styles.placeName} textAnchor={l.map.x > 0.85 ? "end" : "middle"} x={l.map.x > 0.85 ? 22 : 0} y={-32}>
                    {l.place}
                  </text>
                </g>
              );
            })}

            <g transform={`translate(${W - 86} ${H - 92})`} className={styles.compass}>
              <circle r="30" />
              <path d="M0 -40L7 0L0 40L-7 0Z" />
              <path d="M0 -40L7 0L-7 0Z" className={styles.north} />
              <text y="-48" textAnchor="middle">
                N
              </text>
            </g>
            <text x="40" y={H - 36} className={styles.note}>
              Not to scale. Each leg is {LEGS[0].twist.goal} miles of trek.
            </text>
          </svg>
          <figcaption className={styles.fossils}>
            Fossils found: <strong>{progress.expedition.fossils.length}</strong> of {FOSSIL_COUNT}
          </figcaption>
        </figure>

        <section className={styles.legs} aria-label="Legs">
          <ol className={styles.list}>
            {LEGS.map((l, i) => {
              const Glyph = PURSUER_ICON[l.pursuer];
              return (
                <li key={l.id}>
                  <button type="button" className={styles.leg} aria-pressed={i === chosen} disabled={!open(i)} onClick={() => setChosen(i)}>
                    <span className={styles.legNum}>
                      {done(i) ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-label="done">
                          <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className={styles.legText}>
                      <span className={styles.legPlace}>{l.place}</span>
                      <span className={styles.legTwist}>{l.twistLine}</span>
                      <span className={styles.legMeta}>
                        <Glyph size={14} /> {PURSUER_NAMES[l.pursuer]} · sets off at {l.startClock < 12 ? "dawn" : "dusk"}
                      </span>
                    </span>
                    <span className={styles.legState}>{done(i) ? "Done" : i === current ? "Next" : "Locked"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" className={styles.go} onClick={() => onLeg(chosen)} disabled={!open(chosen)}>
            {done(chosen) ? `Walk ${leg.place} again` : `Set off for ${leg.place}`} <span aria-hidden>→</span>
          </button>
        </section>
      </div>
    </div>
  );
}
