"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { afterTerminal, updateProgress } from "@/lib/over-short/progress";
import { bootTerminal, promptOf, typeLine, type Program, type TerminalState, type TerminalStep } from "@/lib/over-short/terminal";
import ui from "../ui.module.css";
import { cueSeconds, pcSpeaker } from "./speaker";
import styles from "./Terminal.module.css";

/*
 * A 1970s terminal: Gunner's teletype, printing in capitals on a roll of
 * paper, or Cannoneer's green screen and its speaker. The program is the
 * pure state machine in `lib/over-short/terminal.ts`; this screen prints
 * what it says (a character at a time on the teletype, a line at a time on
 * the screen), plays the speaker first where the program did, and types
 * what the player types at its prompt.
 */

type Props = { program: Program; onMenu: () => void; onOther: (program: Program) => void };

/** Characters a second: the teletype is slow and the screen is not. */
const SPEED: Record<Program, number> = { gunner: 55, cannoneer: 900 };

export function TerminalScreen({ program, onMenu, onOther }: Props) {
  const shell = useShell();
  const calm = useReducedMotion();
  const speaker = useMemo(() => pcSpeaker(), []);
  // Loaded as the screen opens: the introduction, the first gun and target, waiting to be printed.
  const [boot] = useState(() => bootTerminal(program));
  const [state, setState] = useState<TerminalState | null>(boot.state);
  const [printed, setPrinted] = useState<string[]>([]);
  const [queue, setQueue] = useState<string[]>(boot.lines);
  const [typing, setTyping] = useState("");
  const [paused, setPaused] = useState(false);
  const [holdUntil, setHoldUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const warStarted = useRef(true);

  useEffect(() => () => speaker.stop(), [speaker]);

  const take = useCallback(
    (step: TerminalStep) => {
      setState(step.state);
      if (program === "cannoneer" && step.sounds.length) {
        // The program waits for its speaker before it prints the result.
        speaker.play(step.sounds);
        setHoldUntil(performance.now() + cueSeconds(step.sounds) * 1000);
      }
      setQueue((q) => [...q, ...step.lines]);
      if (step.events.some((e) => e.kind === "gun")) warStarted.current = true;
      const total = step.events.find((e) => e.kind === "total");
      const found = step.events.some((e) => e.kind === "found");
      if ((total || found) && warStarted.current) {
        warStarted.current = false;
        updateProgress((p) => afterTerminal(p, program, !!total, total && total.kind === "total" ? total.rounds : 0));
      }
    },
    [program, speaker],
  );

  const load = useCallback(() => {
    setPrinted([]);
    setQueue([]);
    setTyping("");
    take(bootTerminal(program));
  }, [program, take]);

  // Printing: a character at a time on the teletype, a line at a time on the screen.
  const [partial, setPartial] = useState("");
  useEffect(() => {
    if (!queue.length || paused) return;
    const now = performance.now();
    if (now < holdUntil) {
      const timer = window.setTimeout(() => setTick((n) => n + 1), holdUntil - now);
      return () => window.clearTimeout(timer);
    }
    const line = queue[0];
    if (calm || program === "cannoneer") {
      const timer = window.setTimeout(
        () => {
          setPrinted((p) => [...p, line]);
          setQueue((q) => q.slice(1));
        },
        calm ? 0 : 1000 / 28,
      );
      return () => window.clearTimeout(timer);
    }
    if (partial.length >= line.length) {
      const timer = window.setTimeout(() => {
        setPrinted((p) => [...p, line]);
        setQueue((q) => q.slice(1));
        setPartial("");
      }, 120);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setPartial(line.slice(0, partial.length + 1)), 1000 / SPEED.gunner);
    return () => window.clearTimeout(timer);
  }, [queue, partial, paused, calm, program, holdUntil, tick]);

  const printing = queue.length > 0;

  // While the teletype chatters, any key brings the rest of the page up at once.
  useEffect(() => {
    if (!printing || program !== "gunner") return;
    const flush = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key === "Escape" || event.key === "Tab") return;
      event.preventDefault();
      setPrinted((p) => [...p, ...queue]);
      setQueue([]);
      setPartial("");
    };
    window.addEventListener("keydown", flush);
    return () => window.removeEventListener("keydown", flush);
  }, [printing, program, queue]);
  const prompt = state ? promptOf(state) : "";
  const ended = state !== null && state.waiting === null && !printing;

  useEffect(() => {
    paper.current?.scrollTo({ top: paper.current.scrollHeight });
  }, [printed, partial, typing]);

  useEffect(() => {
    if (!printing && !ended && shell.tab === "play") input.current?.focus({ preventScroll: true });
  }, [printing, ended, shell.tab]);

  const submit = () => {
    if (!state || printing || !state.waiting) return;
    const shown = program === "gunner" ? typing.toUpperCase() : typing;
    setPrinted((p) => [...p, `${prompt}${shown}`]);
    setTyping("");
    take(typeLine(state, typing));
  };

  usePlayScreen({
    screen: "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [{ label: "Load the program again", onSelect: load }],
    losesProgress: !ended && printed.length > 12,
    roundName: "this war",
    onMenu,
  });

  const other: Program = program === "gunner" ? "cannoneer" : "gunner";
  return (
    <div className={styles.room} data-program={program}>
      <div className={styles.bar}>
        <button type="button" className={ui.quiet} onClick={onMenu}>
          ← Game menu
        </button>
        <p className={styles.caption}>{program === "gunner" ? "Gunner · 1973 · a teletype" : "Cannoneer · IBM PC · a green screen"}</p>
        <button type="button" className={ui.quiet} onClick={() => onOther(other)}>
          {other === "gunner" ? "Gunner, 1973" : "Cannoneer, IBM PC"} →
        </button>
      </div>
      <div className={styles.machine}>
        <div ref={paper} className={styles.paper} role="log" aria-live="polite" aria-label={program === "gunner" ? "The teletype's paper" : "The screen"} onClick={() => input.current?.focus()}>
          {printed.map((line, i) => (
            <p key={i} className={styles.lineText}>
              {line || " "}
            </p>
          ))}
          {printing && partial && <p className={styles.lineText}>{partial}</p>}
          {!printing && state?.waiting && (
            <p className={styles.lineText}>
              {prompt}
              {program === "gunner" ? typing.toUpperCase() : typing}
              <span className={styles.cursor} aria-hidden="true" />
            </p>
          )}
        </div>
        <label className={ui.srOnly} htmlFor="os-terminal-input">
          {state?.waiting === "again" ? "Answer Y or N, then Enter" : "Type the elevation in degrees, then Enter"}
        </label>
        <input
          id="os-terminal-input"
          ref={input}
          className={styles.input}
          value={typing}
          autoComplete="off"
          spellCheck={false}
          disabled={printing || ended}
          onChange={(event) => setTyping(event.target.value.slice(0, 40))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              submit();
            }
          }}
        />
      </div>
      {ended && (
        <div className={`${ui.panel} ${styles.after}`}>
          <p className={ui.kicker}>The program has ended</p>
          <div className={ui.row}>
            <button type="button" className={ui.primary} onClick={load} data-autofocus>
              Load it again
            </button>
            <button type="button" className={ui.secondary} onClick={() => onOther(other)}>
              {other === "gunner" ? "Gunner, 1973" : "Cannoneer, IBM PC"}
            </button>
            <button type="button" className={ui.quiet} onClick={onMenu}>
              Game menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
