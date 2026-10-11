"use client";

import { firingTable, type FieldGun } from "@/lib/over-short/fieldModel";
import { inUnits, type Units } from "@/lib/over-short/words";
import styles from "./Field.module.css";

/*
 * The firing table issued with the gun, for the charge in the breech: for
 * each elevation the range over level ground in still air, the time of
 * flight, the highest point of the path, and what a 1 m/s wind does: how far
 * one across the line drifts the round, how far one behind the gun carries
 * it on. The row nearest the elevation laid is marked.
 */

type Props = { gun: FieldGun; charge: number; elevation: number; units: Units };

export function FieldTable({ gun, charge, elevation, units }: Props) {
  const rows = firingTable(gun, charge);
  const nearest = rows.reduce((best, r) => (Math.abs(r.elevation - elevation) < Math.abs(best.elevation - elevation) ? r : best), rows[0]);
  const unit = units === "yd" ? "yd" : "m";
  return (
    <div className={styles.table}>
      <p className={styles.tableTitle}>Firing table · charge {charge}</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Elev.</th>
            <th scope="col">Range</th>
            <th scope="col">Time</th>
            <th scope="col">Top</th>
            <th scope="col" title={`${unit} of drift per m/s of wind across the line`}>
              Drift
            </th>
            <th scope="col" title={`${unit} added per m/s of wind behind the gun`}>
              Tail
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.elevation} data-near={r === nearest}>
              <td>{r.elevation}°</td>
              <td>{inUnits(r.range, units).toLocaleString("en-GB")}</td>
              <td>{r.time.toFixed(1)} s</td>
              <td>{inUnits(r.apex, units).toLocaleString("en-GB")}</td>
              <td>{(units === "yd" ? r.drift / 0.9144 : r.drift).toFixed(1)}</td>
              <td>{inUnits(r.tail, units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.tableNote}>
        Level ground, still air. Drift: {unit} sideways per m/s of wind across the line. Tail: {unit} further per m/s of wind behind you (less, into a headwind). Above 45° is the high
        road: steeper, slower, shorter.
      </p>
    </div>
  );
}
