"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Arrangement } from "@/lib/music/arrange/types";
import { pitchName } from "@/lib/music/theory";
import { indexTracks, soundingIn, startingIn } from "@/lib/music/timeline";
import type { Clock } from "../BopBox";
import styles from "./StageView.module.css";

const ROLE_LABEL: Record<string, string> = {
  melody: "Tune",
  counter: "Second voice",
  chords: "Chords",
  pad: "Pad",
  arp: "Arpeggio",
  bass: "Bass",
  drums: "Rhythm",
  perc: "Percussion",
};

type Props = { arrangement: Arrangement; clock: Clock; muted: Set<string>; onToggle: (trackId: string) => void };

/** The band on stage: every musician lights up when they play. Tap one to mute them. */
export function StageView({ arrangement, clock, muted, onToggle }: Props) {
  const indexes = useMemo(() => indexTracks(arrangement), [arrangement]);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-track]"));
    const notes = Array.from(grid.querySelectorAll<HTMLElement>("[data-note]"));
    const energy = indexes.map(() => 0);
    let last = clock.beat();
    let frame = 0;
    const tick = () => {
      const beat = clock.beat();
      const from = beat < last || beat - last > 1 ? beat : last;
      indexes.forEach((index, i) => {
        const hits = startingIn(index, from, beat + 1e-6);
        const strongest = hits.reduce((m, n) => Math.max(m, n.vel / 127), 0);
        energy[i] = Math.max(energy[i] * 0.9, strongest);
        cards[i]?.style.setProperty("--pulse", energy[i].toFixed(3));
        if (notes[i] && !index.track.patch.drums) {
          const sounding = soundingIn(index, beat).sort((a, b) => b.pitch - a.pitch)[0];
          notes[i].textContent = sounding ? pitchName(sounding.pitch) : "·";
        }
      });
      last = beat;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [indexes, clock]);

  return (
    <div className={styles.view}>
      <div ref={gridRef} className={styles.grid} data-count={indexes.length}>
        {indexes.map(({ track }) => (
          <button
            key={track.id}
            type="button"
            data-track={track.id}
            className={styles.card}
            aria-pressed={!muted.has(track.id)}
            style={{ "--track": track.color } as React.CSSProperties}
            onClick={() => onToggle(track.id)}
            title={muted.has(track.id) ? `Unmute ${track.name}` : `Mute ${track.name}`}
          >
            <span className={styles.icon} aria-hidden>
              {track.patch.icon}
            </span>
            <span className={styles.name}>{track.name}</span>
            <span className={styles.role}>{ROLE_LABEL[track.role] ?? track.role}</span>
            <span className={styles.note} data-note aria-hidden>
              ·
            </span>
            {muted.has(track.id) && <span className={styles.muted}>muted</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
