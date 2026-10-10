"use client";

import type { Engagement, TableRow } from "@/lib/over-short/engagement";
import { bandFilled, TABLE_BANDS } from "@/lib/over-short/progress";
import { distanceLabel, elevationLabel, type Units } from "@/lib/over-short/words";
import styles from "./FiringTable.module.css";

/*
 * The firing table: every round this gun has fired, elevation against where
 * it fell and how long it flew, in elevation order, so the next elevation
 * can be read off between two rows. From Chapter 4 the battery's own gun
 * keeps its table from mission to mission, and the rows it still lacks
 * show as gaps.
 */

type Row = { elevation: number; fell: string; time: number | null; source: "this" | "kept" | "issued" };

type Props = { engagement: Engagement; units: Units; precision: number; kept: TableRow[] | null };

export function FiringTable({ engagement: e, units, precision, kept }: Props) {
  const fromThis: Row[] = e.shots.map((s) => {
    const t = e.targets[s.target];
    // Where it fell as the player can work it out: the target's distance at the burst, plus or minus the report.
    const atBurst = s.targetDistance;
    const fell =
      s.report.call === "hit"
        ? `on target, ${distanceLabel(atBurst, units)}`
        : s.report.distance === null
          ? s.report.call
          : distanceLabel(atBurst + (s.report.call === "over" ? 1 : -1) * s.report.distance, units);
    return { elevation: s.elevation, fell: t.height ? `${fell} (target ${t.height > 0 ? "above" : "below"})` : fell, time: s.flight.time, source: "this" };
  });
  const issued: Row[] = e.rules.told.table.map((r) => ({ elevation: r.elevation, fell: distanceLabel(r.range, units), time: r.time, source: "issued" }));
  const keptRows: Row[] = (kept ?? []).filter((r) => !e.shots.some((s) => Math.abs(s.elevation - r.elevation) < 0.005)).map((r) => ({ elevation: r.elevation, fell: distanceLabel(r.range, units), time: r.time, source: "kept" }));
  const rows = [...fromThis, ...issued, ...keptRows].sort((a, b) => a.elevation - b.elevation);

  return (
    <div className={styles.wrap}>
      {kept && (
        <ol className={styles.bands} aria-label="Rows of the battery's range table">
          {TABLE_BANDS.map((b) => {
            const filled = bandFilled(kept, b) || e.shots.some((s) => s.elevation >= b && s.elevation < b + 5);
            return (
              <li key={b} data-filled={filled}>
                {b}–{b + 5}°
              </li>
            );
          })}
        </ol>
      )}
      {rows.length ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Elevation</th>
              <th scope="col">Fell at</th>
              <th scope="col">Flight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.source}-${r.elevation}-${i}`} data-source={r.source}>
                <td>{elevationLabel(r.elevation, precision)}</td>
                <td>{r.fell}</td>
                <td>{r.time === null ? "" : `${Math.round(r.time)} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.empty}>No rounds fired yet. Each one you fire goes in here.</p>
      )}
      <p className={styles.legend}>
        {issued.length > 0 && <span data-source="issued">issued with the gun</span>}
        {keptRows.length > 0 && <span data-source="kept">from earlier missions</span>}
        <span data-source="this">this {e.targets.length > 1 || e.rules.ammo.perTarget ? "game" : "mission"}</span>
      </p>
    </div>
  );
}
