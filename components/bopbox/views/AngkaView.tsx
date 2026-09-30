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

type Segment = { key: string; meter: string; section?: string; bars: Token[][] };

const pretty = (name: string) => name.replace("b", "♭").replace("#", "♯");

/** Splits the tune into runs of bars that share a key and meter (a long piece has several). */
function tokenize(song: Song) {
  const segments: Segment[] = [];
  const full = song.version === "full";
  const sectionStarts = new Map(song.sections.map((s) => [Math.round(s.at * 1000), s.name]));
  let base = 60;
  let noteIndex = 0;

  song.measures.forEach((m, i) => {
    const previous = song.measures[i - 1];
    const meter = `${m.meter.top}/${m.meter.bottom}`;
    const section = full ? [...sectionStarts.entries()].find(([at]) => at >= Math.round(m.at * 1000) && at < Math.round((m.at + m.len) * 1000))?.[1] : undefined;
    const newKey = !previous || previous.key.doName !== m.key.doName;
    if (newKey || !previous || meter !== `${previous.meter.top}/${previous.meter.bottom}` || section) {
      segments.push({ key: pretty(m.key.doName), meter, section, bars: [] });
    }
    if (newKey) {
      // "1" sits near the middle of the notes that use this key, so dots above and below stay rare.
      let end = i;
      while (end + 1 < song.measures.length && song.measures[end + 1].key.doName === m.key.doName) end++;
      const until = song.measures[end].at + song.measures[end].len;
      const pitches = song.notes.filter((n) => n.pitch !== null && n.at >= m.at - 1e-6 && n.at < until - 1e-6).map((n) => n.pitch!).sort((a, b) => a - b);
      const median = pitches[Math.floor(pitches.length / 2)] ?? 60;
      base = nearestWithPc(pitchClass(parsePitch(`${m.key.doName}4`)), median - 4);
    }
    const bar: Token[] = [];
    while (noteIndex < song.notes.length && song.notes[noteIndex].at < m.at + m.len - 1e-6) {
      const note = song.notes[noteIndex++];
      const [digit, accidental] = note.pitch === null ? ["0", ""] : DEGREES[(((note.pitch - base) % 12) + 12) % 12];
      const octave = note.pitch === null ? 0 : Math.floor((note.pitch - base) / 12);
      const whole = Math.floor(note.dur + 1e-6);
      const fraction = note.dur - whole;
      bar.push({
        at: note.at,
        digit,
        accidental,
        octave,
        lines: note.dur < 0.15 ? 3 : note.dur < 0.3 ? 2 : note.dur < 0.8 ? 1 : 0,
        dot: note.dur >= 1 ? Math.abs(fraction - 0.5) < 1e-6 : Math.abs(note.dur - 0.75) < 1e-6 || Math.abs(note.dur - 0.375) < 1e-6,
        dashes: Math.max(0, whole - 1),
      });
    }
    if (bar.length) segments[segments.length - 1].bars.push(bar);
  });
  return segments.filter((s) => s.bars.length);
}

export function AngkaView({ song, clock }: { song: Song; clock: Clock }) {
  const segments = useMemo(() => tokenize(song), [song]);
  const boxRef = useRef<HTMLDivElement>(null);
  const beats = useMemo(() => segments.flatMap((s) => s.bars.flat().map((t) => t.at)), [segments]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const tokens = Array.from(box.querySelectorAll<HTMLElement>("[data-token]"));
    let current = -1;
    let frame = 0;
    const tick = () => {
      const beat = clock.songBeat();
      let index = -1;
      if (beat !== null) {
        for (let lo = 0, hi = beats.length - 1; lo <= hi; ) {
          const mid = (lo + hi) >> 1;
          if (beats[mid] <= beat + 1e-6) {
            index = mid;
            lo = mid + 1;
          } else hi = mid - 1;
        }
      }
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
      {segments.map((segment, s) => (
        <section key={s} className={styles.segment}>
          <p className={styles.key}>
            {segment.section && <span className={styles.section}>{segment.section} · </span>}1 = {segment.key} · {segment.meter}
          </p>
          <div className={styles.bars}>
            {segment.bars.map((bar, b) => (
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
        </section>
      ))}
    </div>
  );
}
