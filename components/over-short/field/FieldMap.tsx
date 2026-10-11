"use client";

import type { FieldEngagement, FieldReport } from "@/lib/over-short/field";
import { inUnits, type Units } from "@/lib/over-short/words";
import styles from "./Field.module.css";

/*
 * The observer's map, seen from above: the target in the middle, the line
 * of fire running up the sheet (over is further up, short is lower), left
 * and right as they are. Every round at this target is plotted where the
 * observer said it fell; a round seen only by its flash is a mark on the
 * side it fell, and one lost in smoke is listed below.
 */

const SIZE = 300;
const MID = SIZE / 2;

/** Where the observer's report puts a round, in metres from the target (over, right), or null. */
export function reportedBurst(report: FieldReport): { over: number; right: number } | null {
  if (report.kind === "target") return { over: 0, right: 0 };
  if (report.kind !== "correction") return null;
  const over = report.range ? (report.range.word === "drop" ? 1 : -1) * report.range.metres : 0;
  const right = report.line ? (report.line.word === "left" ? 1 : -1) * report.line.metres : 0;
  return { over, right };
}

type Props = { engagement: FieldEngagement; units: Units };

export function FieldMap({ engagement: e, units }: Props) {
  const shots = e.shots.filter((s) => s.target === e.index);
  const plotted = shots.map((s) => ({ s, at: reportedBurst(s.report) })).filter((p) => p.at !== null) as { s: (typeof shots)[number]; at: { over: number; right: number } }[];
  const reach = Math.max(300, ...plotted.map((p) => Math.max(Math.abs(p.at.over), Math.abs(p.at.right)) * 1.2));
  const step = reach > 1200 ? 500 : reach > 600 ? 200 : 100;
  const px = (metres: number) => (metres / reach) * (MID - 22);
  const flashes = shots.filter((s) => s.report.kind === "flash");
  const lost = shots.filter((s) => s.report.kind === "lost");
  const target = e.targets[e.index];
  const grid = [];
  for (let m = -Math.floor(reach / step) * step; m <= reach; m += step) {
    grid.push(<line key={`v${m}`} x1={MID + px(m)} y1={14} x2={MID + px(m)} y2={SIZE - 14} className={m === 0 ? styles.gridMain : styles.grid} />);
    grid.push(<line key={`h${m}`} x1={14} y1={MID - px(m)} x2={SIZE - 14} y2={MID - px(m)} className={m === 0 ? styles.gridMain : styles.grid} />);
  }
  return (
    <figure className={styles.map}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Observer's map: ${shots.length} ${shots.length === 1 ? "round" : "rounds"} at this target, plotted over or short and left or right`}>
        <rect x={0} y={0} width={SIZE} height={SIZE} rx={10} className={styles.paper} />
        {grid}
        <text x={MID} y={12} textAnchor="middle" className={styles.edge}>
          over ↑
        </text>
        <text x={MID} y={SIZE - 4} textAnchor="middle" className={styles.edge}>
          ↓ short · to the gun
        </text>
        <text x={8} y={MID - 6} className={styles.edge}>
          left
        </text>
        <text x={SIZE - 8} y={MID - 6} textAnchor="end" className={styles.edge}>
          right
        </text>
        <text x={SIZE - 8} y={SIZE - 18} textAnchor="end" className={styles.scale}>
          squares {inUnits(step, units)} {units === "yd" ? "yd" : "m"}
        </text>
        <circle cx={MID} cy={MID} r={Math.max(4, px(target.radius))} className={styles.radius} />
        <path d={`M${MID - 6} ${MID + 5} L${MID} ${MID - 7} L${MID + 6} ${MID + 5} Z`} className={styles.targetMark} />
        {flashes.map((s) => {
          const r = s.report.kind === "flash" ? s.report : null;
          if (!r) return null;
          const y = r.range === "over" ? 30 : r.range === "short" ? SIZE - 30 : MID;
          const x = r.line === "right" ? SIZE - 40 : r.line === "left" ? 40 : MID;
          return (
            <g key={s.round} className={styles.flash}>
              <circle cx={x} cy={y} r={9} />
              <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle">
                {s.round}
              </text>
            </g>
          );
        })}
        {plotted.map(({ s, at }) => (
          <g key={s.round} className={styles.fall} data-hit={s.hit}>
            <circle cx={MID + px(at.right)} cy={MID - px(at.over)} r={9} />
            <text x={MID + px(at.right)} y={MID - px(at.over) + 0.5} textAnchor="middle" dominantBaseline="middle">
              {s.round}
            </text>
          </g>
        ))}
      </svg>
      {(lost.length > 0 || flashes.length > 0) && (
        <figcaption className={styles.calls}>
          {lost.map((s) => (
            <span key={s.round}>{s.round}: lost in the smoke</span>
          ))}
          {flashes.length > 0 && <span>Rounds at the edges were seen only by their flash</span>}
        </figcaption>
      )}
    </figure>
  );
}
