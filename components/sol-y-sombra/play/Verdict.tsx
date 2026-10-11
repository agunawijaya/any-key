"use client";

import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/lib/sol-y-sombra/corrida";
import { SWING, THRESHOLDS, TIERS, type Cap } from "@/lib/sol-y-sombra/verdict";
import panel from "../panel.module.css";
import styles from "./play.module.css";

/*
 * The crowd's one roll, shown as it happens: the band the needle can land
 * in (the meter's value, give or take the crowd's swing), the award zones
 * across it with their odds, and the needle settling where the roll put
 * it. The zone it stops in is the award.
 */

const NAMES = ["Silence", "Applause", "Lap", "Shoulders"];

export function VerdictDial({ verdict, cap, reduced, onLanded }: { verdict: Verdict; cap: Cap; reduced: boolean; onLanded: () => void }) {
  const lo = verdict.total - SWING;
  const hi = verdict.total + SWING;
  const span = hi - lo;
  const at = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / span) * 100;
  const [needle, setNeedle] = useState(reduced ? at(verdict.needle) : 0);
  const [landed, setLanded] = useState(false);
  const told = useRef(false);
  const button = useRef<HTMLButtonElement>(null);

  // The needle sweeps across the band, overshoots and settles where the roll put it.
  useEffect(() => {
    const target = at(verdict.needle);
    if (reduced) {
      const id = window.setTimeout(() => setLanded(true), 400);
      return () => window.clearTimeout(id);
    }
    const start = performance.now();
    const length = 2600;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / length);
      // A swing that crosses the whole band once, then rings down onto the value.
      const sweep = t < 0.45 ? (t / 0.45) * 100 : 100 + (target - 100) * (1 - Math.exp(-(t - 0.45) * 9) * Math.cos((t - 0.45) * 16));
      setNeedle(Math.max(0, Math.min(100, sweep)));
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        setNeedle(target);
        setLanded(true);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // The roll is fixed when the dial opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (landed) button.current?.focus();
  }, [landed]);

  const proceed = () => {
    if (told.current) return;
    told.current = true;
    onLanded();
  };

  // Each zone's stretch of the band; zones above the cap belong to the cap.
  const edges = [-Infinity, THRESHOLDS[1], THRESHOLDS[2], THRESHOLDS[3], Infinity];
  const zones = [0, 1, 2, 3].map((t) => ({ tier: t, from: at(edges[t]), to: at(edges[t + 1]), odds: verdict.odds[t], locked: t > cap }));

  return (
    <div className={styles.verdict} role="dialog" aria-modal="false" aria-labelledby="sys-verdict">
      <div className={`${panel.panel} ${styles.verdictCard}`}>
        <p className={panel.kicker}>The crowd decides · one roll</p>
        <h2 id="sys-verdict" className={panel.heading} aria-live="polite">
          {landed ? TIERS[verdict.tier].name : "The ring holds its breath"}
        </h2>
        <div className={styles.dial} aria-hidden="true">
          {zones.map(
            (z) =>
              z.to > z.from && (
                <div key={z.tier} className={styles.zone} data-tier={z.tier} data-locked={z.locked} style={{ left: `${z.from}%`, width: `${z.to - z.from}%` }}>
                  <span>{NAMES[z.tier]}</span>
                </div>
              ),
          )}
          <div className={styles.needle} style={{ left: `${needle}%` }} />
        </div>
        <p className={styles.dialOdds}>
          {zones
            .filter((z) => z.odds > 0)
            .map((z) => `${NAMES[z.tier]} ${Math.round(z.odds * 100)}%`)
            .join(" · ")}
          {cap < 2 ? " · no lap or shoulders without a finish" : ""}
        </p>
        <p className={panel.lede}>
          {landed ? TIERS[verdict.tier].line : `The crowd's mood stands at ${verdict.total.toFixed(1)}; it may swing ${SWING} either way.`}
        </p>
        <div className={panel.row}>
          <button ref={button} type="button" className={panel.primary} onClick={proceed} disabled={!landed}>
            {landed ? "Continue" : "Rolling…"}
          </button>
        </div>
      </div>
    </div>
  );
}
