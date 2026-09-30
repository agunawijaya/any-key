"use client";

import { useEffect, useRef, useState } from "react";
import type { Measure, Song } from "@/lib/music/score";
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
  [0.125, "32", false],
];

/** Pixels per quarter-note beat. Every note sits exactly where its time says, so the scroll never lurches. */
const PX_PER_BEAT = 110;
const SCALE = 1.2;
const STAVE_Y = 62;
const HEIGHT = 200;
/** Bars drawn together; a long piece is drawn a stretch at a time, just ahead of the music. */
const CHUNK_BARS = 16;

/** Splits a length into written note values ("a dotted half tied to an eighth"). */
function spell(length: number) {
  const parts: { code: string; dotted: boolean; beats: number }[] = [];
  let left = length;
  while (left > 0.1) {
    const fit = DURATIONS.find(([beats]) => beats <= left + 1e-6) ?? DURATIONS[DURATIONS.length - 1];
    parts.push({ code: fit[1], dotted: fit[2], beats: fit[0] });
    left -= fit[0];
  }
  return parts;
}

/** A note as written: one score note can become several tied ones. */
type Written = { key: string; code: string; dotted: boolean; rest: boolean; beat: number; tieOn: boolean; chord?: string };

/** Everything a bar's stave needs: where it goes and what it announces. */
type BarPlan = {
  measure: Measure;
  x: number;
  width: number;
  /** Where the bar's first beat sits, from the stave's left edge. */
  noteStart: number;
  clef: boolean;
  key?: { spec: string; cancel?: string };
  time?: string;
  section?: string;
  tempo?: number;
  end?: "double" | "end";
  notes: Written[];
};

const timeSpec = (m: Measure) => (m.meter.top === 2 && m.meter.bottom === 2 ? "C|" : `${m.meter.top}/${m.meter.bottom}`);

type VexFlow = typeof import("vexflow/bravura").default;

/** Works out every bar of the piece, without drawing anything yet. */
function plan(VF: VexFlow, song: Song): BarPlan[] {
  const chordAtBeat = new Map(song.chords.map((c) => [Math.round(c.at * 1000), c.chord.symbol]));
  const sectionAtBar = new Map<number, string>();
  for (const section of song.sections) {
    if (song.version !== "full") break;
    const bar = song.measures.findIndex((m) => section.at < m.at + m.len - 1e-6);
    if (bar >= 0 && !sectionAtBar.has(bar)) sectionAtBar.set(bar, section.name);
  }

  const bars: BarPlan[] = [];
  const plain = new VF.Stave(0, STAVE_Y, 100).getNoteStartX();
  let x = 10;
  let noteIndex = 0;
  song.measures.forEach((m, i) => {
    const previous = song.measures[i - 1];
    const next = song.measures[i + 1];
    const bar: BarPlan = { measure: m, x, width: 0, noteStart: 0, clef: i === 0, notes: [] };
    if (!previous || previous.key.doName !== m.key.doName) bar.key = { spec: m.key.doName, cancel: previous?.key.doName };
    if (!previous || timeSpec(previous) !== timeSpec(m)) bar.time = timeSpec(m);
    if (song.version === "full") {
      bar.section = sectionAtBar.get(i);
      if (previous && Math.abs(previous.bpm - m.bpm) > 0.5) bar.tempo = m.bpm;
    }
    if (!next) bar.end = "end";
    else if (next.key.doName !== m.key.doName || timeSpec(next) !== timeSpec(m)) bar.end = "double";

    const stave = decorate(VF, new VF.Stave(x, STAVE_Y, 100), bar);
    bar.noteStart = stave.getNoteStartX() - x;
    // Widths that keep every downbeat exactly its length in beats after the previous one, plus room for signatures.
    bar.width = m.len * PX_PER_BEAT + bar.noteStart - plain;
    x += bar.width;

    while (noteIndex < song.notes.length && song.notes[noteIndex].at < m.at + m.len - 1e-6) {
      const note = song.notes[noteIndex++];
      const parts = spell(note.dur);
      let at = note.at;
      parts.forEach((part, p) => {
        bar.notes.push({
          key: note.name ? `${note.name[0].toLowerCase()}${note.name.slice(1, -1)}/${note.name.slice(-1)}` : "b/4",
          code: part.code,
          dotted: part.dotted,
          rest: note.pitch === null,
          beat: at,
          tieOn: note.pitch !== null && (p < parts.length - 1 || !!note.tie),
          chord: p === 0 ? chordAtBeat.get(Math.round(note.at * 1000)) : undefined,
        });
        at += part.beats;
      });
    }
    bars.push(bar);
  });
  return bars;
}

function decorate(VF: VexFlow, stave: InstanceType<VexFlow["Stave"]>, bar: BarPlan) {
  if (bar.clef) stave.addClef("treble");
  if (bar.key) stave.addKeySignature(bar.key.spec, bar.key.cancel);
  if (bar.time) stave.addTimeSignature(bar.time);
  if (bar.section) stave.setSection(bar.section.toUpperCase(), -6, 0, 10, false);
  if (bar.tempo) stave.setTempo({ duration: "q", bpm: Math.round(bar.tempo) }, bar.section ? -2 : -14);
  if (bar.end === "double") stave.setEndBarType(VF.BarlineType.DOUBLE);
  if (bar.end === "end") stave.setEndBarType(VF.BarlineType.END);
  return stave;
}

/**
 * Sheet music for the tune, drawn with VexFlow on a strict time grid
 * (x = beat × a fixed width) and slid under a fixed playhead at constant speed.
 * Key, meter and tempo changes are printed where they happen.
 */
export function SheetView({ song, clock }: { song: Song; clock: Clock }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const stateRef = useRef<{ bars: BarPlan[]; marks: Mark[]; drawn: Set<number>; draw: (chunk: number) => void; shift: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const found = hostRef.current;
    if (!found) return;
    const host: HTMLDivElement = found;

    (async () => {
      const VF = (await import("vexflow/bravura")).default;
      await VF.loadFonts("Bravura", "Academico");
      if (cancelled) return;
      host.innerHTML = "";
      const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Accidental, Dot, Annotation, StaveTie, Fraction } = VF;

      const bars = plan(VF, song);
      const last = bars[bars.length - 1];
      const totalWidth = last.x + last.width + 40;
      host.style.width = `${totalWidth * SCALE}px`;
      host.style.height = `${HEIGHT * SCALE}px`;
      const marks: Mark[] = [];
      const drawn = new Set<number>();
      const state = { bars, marks, drawn, draw: drawChunk, shift: 0 };

      function drawChunk(chunk: number) {
        if (drawn.has(chunk) || cancelled) return;
        drawn.add(chunk);
        const first = chunk * CHUNK_BARS;
        const slice = bars.slice(first, first + CHUNK_BARS);
        if (!slice.length) return;
        const left = slice[0].x - (chunk === 0 ? 10 : 0);
        const right = slice[slice.length - 1].x + slice[slice.length - 1].width + (first + CHUNK_BARS >= bars.length ? 40 : 0);
        const box = document.createElement("div");
        box.className = styles.chunk;
        box.style.left = `${left * SCALE}px`;
        host.appendChild(box);
        const renderer = new Renderer(box, Renderer.Backends.SVG);
        renderer.resize((right - left) * SCALE, HEIGHT * SCALE);
        const context = renderer.getContext();
        context.scale(SCALE, SCALE);

        const ties: InstanceType<typeof StaveTie>[] = [];
        let pending: InstanceType<typeof StaveNote> | null = null;
        // A tie arriving from the previous stretch is drawn from this stretch's left edge.
        const before = bars[first - 1]?.notes.at(-1);
        let incoming = !!before?.tieOn;

        slice.forEach((bar, index) => {
          const stave = decorate(VF, new Stave(bar.x - left, STAVE_Y, 100), bar);
          stave.setWidth(bar.width);
          stave.setContext(context).draw();
          const m = bar.measure;

          const vfNotes = bar.notes.map((w) => {
            const n = new StaveNote({ keys: [w.key], duration: `${w.code}${w.rest ? "r" : ""}`, autoStem: true });
            if (w.dotted) Dot.buildAndAttach([n], { all: true });
            if (w.chord) n.addModifier(new Annotation(w.chord).setVerticalJustification(Annotation.VerticalJustify.TOP), 0);
            return n;
          });
          bar.notes.forEach((w, i) => {
            const n = vfNotes[i];
            if (w.rest) {
              incoming = false;
              pending = null;
              return;
            }
            if (pending) ties.push(new StaveTie({ firstNote: pending, lastNote: n, firstIndexes: [0], lastIndexes: [0] }));
            else if (incoming) ties.push(new StaveTie({ firstNote: null, lastNote: n, firstIndexes: [0], lastIndexes: [0] }));
            incoming = false;
            pending = w.tieOn ? n : null;
          });

          const voice = new Voice({ numBeats: Math.round(m.len * (m.meter.bottom / 4) * 4) / 4, beatValue: m.meter.bottom });
          voice.setMode(Voice.Mode.SOFT);
          voice.addTickables(vfNotes);
          Accidental.applyAccidentals([voice], m.key.doName);
          const groups = m.meter.bottom === 8 ? [new Fraction(3, 8)] : m.meter.bottom === 2 ? [new Fraction(2, 4)] : undefined;
          const beams = Beam.generateBeams(vfNotes, groups ? { groups } : undefined);
          new Formatter().joinVoices([voice]).format([voice], m.len * PX_PER_BEAT);
          // Replace VexFlow's spacing with pure time: each note starts at (its beat) × PX_PER_BEAT.
          vfNotes.forEach((n, i) => n.getTickContext().setX((bar.notes[i].beat - m.at) * PX_PER_BEAT));
          voice.draw(context, stave);
          beams.forEach((b) => b.setContext(context).draw());

          // The one constant VexFlow adds between a stave's note start and a notehead, measured on the very first note.
          if (chunk === 0 && index === 0 && vfNotes.length) state.shift = vfNotes[0].getAbsoluteX() - (stave.getNoteStartX() + (bar.notes[0].beat - m.at) * PX_PER_BEAT);
          vfNotes.forEach((n, i) => marks.push({ beat: bar.notes[i].beat, el: n.getSVGElement() }));
        });
        if (pending) ties.push(new StaveTie({ firstNote: pending, lastNote: null, firstIndexes: [0], lastIndexes: [0] }));
        ties.forEach((t) => t.setContext(context).draw());
        marks.sort((a, b) => a.beat - b.beat);
      }

      stateRef.current = state;
      state.draw(0);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      stateRef.current = null;
      setReady(false);
    };
  }, [song]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let current: SVGElement | undefined;
    const tick = () => {
      const scroller = scrollerRef.current;
      const state = stateRef.current;
      if (scroller && state) {
        const { bars, marks } = state;
        // Before the tune starts (an intro) this beat is negative, so the music glides in from the right.
        const beat = clock.scoreBeat();
        const index = barIndex(bars, beat);
        const bar = bars[index];
        const x = bar.x + bar.noteStart + (beat - bar.measure.at) * PX_PER_BEAT + state.shift + 6;
        scroller.style.transform = `translate3d(${(-x * SCALE).toFixed(2)}px, 0, 0)`;

        // Draw the stretch under the playhead first, then the next one ahead of it (one per frame).
        const chunk = Math.floor(index / CHUNK_BARS);
        const wanted = [chunk, chunk + 1, chunk - 1].find((c) => c >= 0 && c * CHUNK_BARS < bars.length && !state.drawn.has(c));
        if (wanted !== undefined) state.draw(wanted);

        let now: SVGElement | undefined;
        if (clock.songBeat() !== null) {
          for (let lo = 0, hi = marks.length - 1; lo <= hi; ) {
            const mid = (lo + hi) >> 1;
            if (marks[mid].beat <= beat + 1e-6) {
              now = marks[mid].el;
              lo = mid + 1;
            } else hi = mid - 1;
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

function barIndex(bars: BarPlan[], beat: number) {
  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (bars[mid].measure.at <= beat + 1e-9) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
