"use client";

import { useEffect, useRef, useState } from "react";
import type { Song } from "@/lib/music/score";
import type { Clock } from "../BopBox";
import styles from "./SheetView.module.css";

type Mark = { beat: number; el?: SVGElement };

const DURATIONS: [number, string, boolean][] = [
  [4, "w", false],
  [3, "h", true],
  [2, "h", false],
  [1.5, "q", true],
  [1, "q", false],
  [0.75, "8", true],
  [0.5, "8", false],
  [0.375, "16", true],
  [0.25, "16", false],
];

/** Pixels per quarter-note beat. Every note sits exactly where its time says, so the scroll never lurches. */
const PX_PER_BEAT = 110;
const SCALE = 1.2;

/** Splits a length into written note values ("a dotted half tied to an eighth"). */
function spell(length: number) {
  const parts: { code: string; dotted: boolean; beats: number }[] = [];
  let left = length;
  while (left > 0.2) {
    const fit = DURATIONS.find(([beats]) => beats <= left + 1e-6) ?? DURATIONS[DURATIONS.length - 1];
    parts.push({ code: fit[1], dotted: fit[2], beats: fit[0] });
    left -= fit[0];
  }
  return parts;
}

/**
 * Sheet music for the tune, drawn once with VexFlow on a strict time grid
 * (x = beat × a fixed width) and slid under a fixed playhead at constant speed.
 */
export function SheetView({ song, clock }: { song: Song; clock: Clock }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<Mark[]>([]);
  const originRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    (async () => {
      const VF = (await import("vexflow/bravura")).default;
      await VF.loadFonts("Bravura", "Academico");
      if (cancelled) return;
      host.innerHTML = "";
      const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Accidental, Dot, Annotation, StaveTie, Fraction } = VF;

      const barBeats = song.barBeats;
      const keySig = song.doName;
      const timeSig = `${song.meter.top}/${song.meter.bottom}`;

      // Group score notes into bars (the pickup, if any, is bar 0).
      type Bar = { start: number; length: number; notes: Song["notes"] };
      const bars: Bar[] = [];
      let start = 0;
      let length = song.pickup > 0 ? song.pickup : barBeats;
      while (start < song.length - 1e-6) {
        const end = start + length;
        bars.push({ start, length, notes: song.notes.filter((n) => n.at >= start - 1e-6 && n.at < end - 1e-6) });
        start = end;
        length = barBeats;
      }

      // How far a plain stave's first note sits from its left edge; the first stave also carries clef, key and time.
      const plainOffset = new Stave(0, 0, 100).getNoteStartX();
      const staveY = 50;
      const height = 190;
      const first = new Stave(10, staveY, 100).addClef("treble").addKeySignature(keySig).addTimeSignature(timeSig);
      const firstOffset = first.getNoteStartX() - 10;
      const totalWidth = 10 + firstOffset + song.length * PX_PER_BEAT + 40;

      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(totalWidth * SCALE, height * SCALE);
      const context = renderer.getContext();
      context.scale(SCALE, SCALE);

      const marks: Mark[] = [];
      const ties: InstanceType<typeof StaveTie>[] = [];
      // The last written note tied onward (inside a split note or across a barline).
      let pendingTie: InstanceType<typeof StaveNote> | null = null;
      let x = 10;
      let origin = 0;

      bars.forEach((bar, index) => {
        const stave = index === 0 ? first : new Stave(x, staveY, 100);
        const offset = stave.getNoteStartX() - x;
        // Widths that keep every downbeat exactly bar.length beats after the previous one.
        stave.setWidth(bar.length * PX_PER_BEAT + offset - plainOffset);
        stave.setContext(context).draw();

        const vfNotes: InstanceType<typeof StaveNote>[] = [];
        const noteBeats: number[] = [];
        for (const note of bar.notes) {
          const parts = spell(note.dur);
          let at = note.at;
          parts.forEach((part, p) => {
            const key = note.name ? `${note.name[0].toLowerCase()}${note.name.slice(1, -1)}/${note.name.slice(-1)}` : "b/4";
            const staveNote = new StaveNote({ keys: [key], duration: `${part.code}${note.pitch === null ? "r" : ""}`, autoStem: true });
            if (part.dotted) Dot.buildAndAttach([staveNote], { all: true });
            const chord = song.chords.find((c) => Math.abs(c.at - at) < 1e-6);
            if (chord && p === 0) {
              staveNote.addModifier(new Annotation(chord.chord.symbol).setVerticalJustification(Annotation.VerticalJustify.TOP), 0);
            }
            if (pendingTie && note.pitch !== null) {
              ties.push(new StaveTie({ firstNote: pendingTie, lastNote: staveNote, firstIndexes: [0], lastIndexes: [0] }));
            }
            pendingTie = note.pitch !== null && (p < parts.length - 1 || note.tie) ? staveNote : null;
            vfNotes.push(staveNote);
            noteBeats.push(at);
            at += part.beats;
          });
        }

        const voice = new Voice({ numBeats: Math.round(bar.length * (song.meter.bottom / 4) * 4) / 4, beatValue: song.meter.bottom });
        voice.setMode(Voice.Mode.SOFT);
        voice.addTickables(vfNotes);
        Accidental.applyAccidentals([voice], keySig);
        const beams = Beam.generateBeams(vfNotes, song.meter.bottom === 8 ? { groups: [new Fraction(3, 8)] } : undefined);
        new Formatter().joinVoices([voice]).format([voice], bar.length * PX_PER_BEAT);
        // Replace VexFlow's spacing with pure time: each note starts at (its beat) × PX_PER_BEAT.
        vfNotes.forEach((n, i) => n.getTickContext().setX((noteBeats[i] - bar.start) * PX_PER_BEAT));
        voice.draw(context, stave);
        beams.forEach((b) => b.setContext(context).draw());

        if (index === 0 && vfNotes.length) origin = vfNotes[0].getAbsoluteX() - noteBeats[0] * PX_PER_BEAT;
        vfNotes.forEach((n, i) => marks.push({ beat: noteBeats[i], el: n.getSVGElement() }));
        x += stave.getWidth();
      });
      ties.forEach((t) => t.setContext(context).draw());

      marksRef.current = marks.sort((a, b) => a.beat - b.beat);
      // A notehead's visual centre sits about 6 px right of its x.
      originRef.current = (origin + 6) * SCALE;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      setReady(false);
    };
  }, [song]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let current: SVGElement | undefined;
    const tick = () => {
      const scroller = scrollerRef.current;
      const marks = marksRef.current;
      if (scroller) {
        // Before the tune starts (an intro) this beat is negative, so the music glides in from the right.
        const beat = clock.scoreBeat();
        const x = originRef.current + beat * PX_PER_BEAT * SCALE;
        scroller.style.transform = `translate3d(${(-x).toFixed(2)}px, 0, 0)`;
        let now: SVGElement | undefined;
        if (clock.songBeat() !== null) {
          for (let i = marks.length - 1; i >= 0; i--) {
            if (marks[i].beat <= beat + 1e-6) {
              now = marks[i].el;
              break;
            }
          }
        }
        if (now !== current) {
          current?.classList.remove(styles.now);
          now?.classList.add(styles.now);
          current = now;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, clock]);

  return (
    <div className={styles.view}>
      <div className={styles.playhead} aria-hidden />
      <div ref={scrollerRef} className={styles.scroller}>
        <div ref={hostRef} className={styles.score} role="img" aria-label={`Sheet music for ${song.title}`} />
      </div>
      {!ready && <p className={styles.loading}>Writing the sheet music…</p>}
    </div>
  );
}
