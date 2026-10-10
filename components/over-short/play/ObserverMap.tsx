"use client";

import type { Engagement } from "@/lib/over-short/engagement";
import { distanceLabel, inUnits, type Units } from "@/lib/over-short/words";
import { lateralOf } from "./lateral";
import styles from "./ObserverMap.module.css";

/*
 * The observer's map: a sketch from above with the target in the middle
 * and every fall of shot at this target plotted with its round number, so
 * the bracket shows. Only what the observer reported is plotted: when the
 * line gives only "over" or "short", those rounds are listed at the edges,
 * since the observer never said how far.
 */

const WIDTH = 360;
const HEIGHT = 200;
const MID = { x: WIDTH / 2, y: HEIGHT / 2 + 8 };

type Props = { engagement: Engagement; units: Units; textbookMiss: number | null };

export function ObserverMap({ engagement: e, units, textbookMiss }: Props) {
  const shots = e.shots.filter((s) => s.target === e.index);
  const target = e.targets[e.index];
  const plotted = shots.filter((s) => s.report.call === "hit" || s.report.distance !== null);
  const signed = (s: (typeof shots)[number]) => (s.report.call === "hit" ? s.miss : (s.report.call === "over" ? 1 : -1) * (s.report.distance ?? 0));
  // Wide enough for every reported round, never narrower than a kilometre each way.
  const reach = Math.max(1000, ...plotted.map((s) => Math.abs(signed(s)) * 1.15), textbookMiss === null ? 0 : Math.min(4000, Math.abs(textbookMiss) * 1.15));
  const x = (metres: number) => MID.x + (metres / reach) * (WIDTH / 2 - 26);
  const y = (metres: number) => MID.y - metres * 0.9;
  const step = reach > 2600 ? 1000 : 500;
  const grid = [];
  for (let m = -Math.floor(reach / step) * step; m <= reach; m += step) {
    grid.push(
      <g key={m}>
        <line x1={x(m)} y1={20} x2={x(m)} y2={HEIGHT - 18} className={m === 0 ? styles.gridMain : styles.grid} />
        <text x={x(m)} y={HEIGHT - 6} className={styles.gridLabel} textAnchor="middle">
          {m === 0 ? "target" : `${m > 0 ? "+" : "−"}${inUnits(Math.abs(m), units).toLocaleString("en-GB")}`}
        </text>
      </g>,
    );
  }
  const unplotted = shots.filter((s) => s.report.call !== "hit" && s.report.distance === null);
  return (
    <figure className={styles.map}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Observer's map: ${shots.length} ${shots.length === 1 ? "round" : "rounds"} at this target`}>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={10} className={styles.paper} />
        {grid}
        <text x={10} y={15} className={styles.edge}>
          ← to the gun · {distanceLabel(Math.round(target.distance + target.speed * e.time - e.gunAt), units)}
        </text>
        <text x={WIDTH - 10} y={15} className={styles.edge} textAnchor="end">
          over →
        </text>
        <circle cx={x(0)} cy={MID.y} r={Math.max(5, (target.radius / reach) * (WIDTH / 2 - 26))} className={styles.radius} />
        <path d={`M${x(0) - 7} ${MID.y + 6} L${x(0)} ${MID.y - 8} L${x(0) + 7} ${MID.y + 6} Z`} className={styles.target} />
        {textbookMiss !== null && Math.abs(textbookMiss) <= reach && (
          <g className={styles.textbook}>
            <line x1={x(textbookMiss)} y1={28} x2={x(textbookMiss)} y2={HEIGHT - 22} />
            <text x={x(textbookMiss)} y={30} textAnchor="middle">
              textbook
            </text>
          </g>
        )}
        {plotted.map((s) => {
          const cx = x(signed(s));
          const cy = y(lateralOf(s.round));
          return (
            <g key={s.round} className={styles.fall} data-call={s.report.call}>
              <circle cx={cx} cy={cy} r={9} />
              <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle">
                {s.round}
              </text>
            </g>
          );
        })}
      </svg>
      {unplotted.length > 0 && (
        <figcaption className={styles.calls}>
          {unplotted.map((s) => (
            <span key={s.round} data-call={s.report.call}>
              {s.round}: {s.report.call}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
