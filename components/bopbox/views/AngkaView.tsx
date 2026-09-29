"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Song } from "@/lib/music/score";
import { nearestWithPc, parsePitch, pitchClass } from "@/lib/music/theory";
import type { Clock } from "../BopBox";
import styles from "./AngkaView.module.css";

/*
 * Not angka: the numbered notation Indonesian kids learn at school.
 * 1 = do of the key; a dot above or below moves an octave; underlines halve
 * a note; each dash holds it for another beat; a dot after a number adds half.
 */

const DEGREES: [string, string][] = [
  ["1", ""],
  ["1", "♯"],
  ["2", ""],
  ["2", "♯"],
  ["3", ""],
  ["4", ""],
  ["4", "♯"],
  ["5", ""],
  ["5", "♯"],
  ["6", ""],
  ["7", "♭"],
  ["7", ""],
];

type Token = {
  at: number;
  digit: string;
  accidental: string;
  octave: number;
  lines: number;
  dot: boolean;
  dashes: number;
};

function tokenize(song: Song) {
  const doPc = pitchClass(parsePitch(`${song.doName}4`));
  const pitches = song.notes.filter((n) => n.pitch !== null).map((n) => n.pitch!).sort((a, b) => a - b);
  const median = pitches[Math.floor(pitches.length / 2)] ?? 60;
  const base = nearestWithPc(doPc, median - 4);

  const bars: Token[][] = [];
  let barStart = 0;
  let barLength = song.pickup > 0 ? song.pickup : song.barBeats;
  let bar: Token[] = [];
  for (const note of song.notes) {
    while (note.at >= barStart + barLength - 1e-6) {
      bars.push(bar);
      bar = [];
      barStart += barLength;
      barLength = song.barBeats;
    }
    const [digit, accidental] = note.pitch === null ? ["0", ""] : DEGREES[(((note.pitch - base) % 12) + 12) % 12];
    const octave = note.pitch === null ? 0 : Math.floor((note.pitch - base) / 12);
    const whole = Math.floor(note.dur + 1e-6);
    const fraction = note.dur - whole;
    bar.push({
      at: note.at,
      digit,
      accidental,
      octave,
      lines: note.dur < 0.3 ? 2 : note.dur < 0.8 ? 1 : 0,
      dot: note.dur >= 1 ? Math.abs(fraction - 0.5) < 1e-6 : Math.abs(note.dur - 0.75) < 1e-6 || Math.abs(note.dur - 0.375) < 1e-6,
      dashes: Math.max(0, whole - 1),
    });
  }
  bars.push(bar);
  return { bars: bars.filter((b) => b.length), keyName: song.doName.replace("b", "♭").replace("#", "♯") };
}

export function AngkaView({ song, clock }: { song: Song; clock: Clock }) {
  const { bars, keyName } = useMemo(() => tokenize(song), [song]);
  const boxRef = useRef<HTMLDivElement>(null);
  const beats = useMemo(() => bars.flat().map((t) => t.at), [bars]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const tokens = Array.from(box.querySelectorAll<HTMLElement>("[data-token]"));
    let current = -1;
    let frame = 0;
    const tick = () => {
      const beat = clock.songBeat();
      let index = -1;
      if (beat !== null) for (let i = 0; i < beats.length && beats[i] <= beat + 1e-6; i++) index = i;
      if (index !== current) {
        tokens[current]?.classList.remove(styles.now);
        const el = tokens[index];
        el?.classList.add(styles.now);
        if (el) {
          const top = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
          box.scrollTo({ top, behavior: "smooth" });
        }
        current = index;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [beats, clock]);

  let tokenIndex = 0;
  return (
    <div ref={boxRef} className={styles.view}>
      <p className={styles.key}>
        1 = {keyName} · {song.meter.top}/{song.meter.bottom}
      </p>
      <div className={styles.bars}>
        {bars.map((bar, b) => (
          <div key={b} className={styles.bar}>
            {bar.map((token) => (
              <span key={tokenIndex} data-token={tokenIndex++} className={styles.token}>
                <span className={styles.note} data-lines={token.lines}>
                  <span className={styles.dotsAbove} aria-hidden>
                    {"•".repeat(Math.max(0, token.octave))}
                  </span>
                  <span className={styles.digit}>
                    {token.digit}
                    {token.accidental && <sup>{token.accidental}</sup>}
                  </span>
                  <span className={styles.dotsBelow} aria-hidden>
                    {"•".repeat(Math.max(0, -token.octave))}
                  </span>
                </span>
                {token.dot && <span className={styles.aug}>.</span>}
                {Array.from({ length: token.dashes }, (_, i) => (
                  <span key={i} className={styles.dash}>
                    –
                  </span>
                ))}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
