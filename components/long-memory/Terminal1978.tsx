"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayScreen } from "@/components/kit/shell-context";
import { NORTH_STORE, SOUTH_STORE } from "@/lib/long-memory/board";
import { Original1978, OriginalCrash, spokenPit, subscript } from "@/lib/long-memory/original";
import { updateProgress, withAchievement } from "@/lib/long-memory/progress";
import panel from "./panel.module.css";
import styles from "./Terminal1978.module.css";

/*
 * 1970s mode: the 1978 program, turn for turn, on a terminal. The model in
 * lib/long-memory/original.ts makes every decision exactly as the original
 * did (the leftover Q, the ninth-move slip, the table of 51 lessons); this
 * screen only types it out. Every line it prints is our own wording, laid
 * out the way such programs talked: a board of numbers, a question, an answer.
 *
 * Kept from the original: you always sow first; one extra move at most; the
 * computer names its pits 1–6 from its own left; a mistyped move is refused
 * and then asked for with the extra-move question; a decimal is taken and
 * rounded (and goes into the memory as typed); the last board shows twice
 * when your move empties the computer's row, and not at all when its move
 * empties yours; a new game starts as soon as one ends; and after the 51st
 * game it fails to win, the next one cannot start.
 */

type Line = { text: string; kind?: "you" | "board" | "mine" | "result" | "title" };

const pad = (n: number) => String(n).padStart(3, " ");

function boardLines(b: readonly number[]): Line[] {
  const north = [12, 11, 10, 9, 8, 7].map((h) => pad(b[h])).join(" ");
  const south = [0, 1, 2, 3, 4, 5].map((h) => pad(b[h])).join(" ");
  return [
    { text: "", kind: "board" },
    { text: `        ${north}`, kind: "board" },
    { text: `  [${pad(b[NORTH_STORE])}]${" ".repeat(24)}[${pad(b[SOUTH_STORE])}]`, kind: "board" },
    { text: `        ${south}`, kind: "board" },
    { text: `          1   2   3   4   5   6`, kind: "board" },
    { text: "", kind: "board" },
  ];
}

const FIRST = "WHICH PIT (1-6)";
const AGAIN = "SOW AGAIN";

const TITLE: Line[] = [
  { text: "SEEDS AND STORES", kind: "title" },
  { text: "A COMPUTER THAT KEEPS SCORE OF ITS LOSSES", kind: "title" },
  { text: "(AFTER A PROGRAM OF 1978)", kind: "title" },
];

/** Lines 20–35: a new game and its first board, or the error the 52nd game ran into. */
function openGame(machine: Original1978): { lines: Line[]; crashed: boolean } {
  try {
    machine.newGame();
    return { lines: [{ text: "" }, ...boardLines(machine.b)], crashed: false };
  } catch (error) {
    if (!(error instanceof OriginalCrash)) throw error;
    return { lines: [{ text: `?SUBSCRIPT OUT OF RANGE IN ${error.line}`, kind: "result" }], crashed: true };
  }
}

type Session = { machine: Original1978; lines: Line[]; prompt: string; extra: boolean; crashed: boolean; games: number };

function bootSession(title: Line[]): Session {
  const machine = new Original1978("run-once");
  const first = openGame(machine);
  return { machine, lines: [...title, ...first.lines], prompt: FIRST, extra: false, crashed: first.crashed, games: 0 };
}

const southEmpty = (b: readonly number[]) => [0, 1, 2, 3, 4, 5].every((i) => b[i] === 0);
const northEmpty = (b: readonly number[]) => [7, 8, 9, 10, 11, 12].every((i) => b[i] === 0);

export function Terminal1978({ onMenu }: { onMenu: () => void }) {
  const [session, setSession] = useState(() => bootSession(TITLE));
  const [typed, setTyped] = useState("");
  const [paused, setPaused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const { machine, lines, prompt, crashed } = session;

  useEffect(() => {
    screen.current?.scrollTo({ top: screen.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (!paused && !crashed) input.current?.focus();
  }, [paused, crashed, lines]);

  /** Lines 80–95, then straight into the next game, as the original did. */
  const endGame = (s: Session, more: Line[]): Session => {
    const m = s.machine;
    const d = m.b[SOUTH_STORE] - m.b[NORTH_STORE];
    m.finish();
    updateProgress((p) => ({ ...p, terminal: { ...p.terminal, games: p.terminal.games + 1 } }));
    const next = openGame(m);
    if (next.crashed) updateProgress((p) => withAchievement({ ...p, terminal: { ...p.terminal, crashes: p.terminal.crashes + 1 } }, "subscript"));
    const result: Line[] = [
      { text: "THAT IS THE GAME.", kind: "result" },
      { text: d < 0 ? `I FINISH ${-d} AHEAD.` : d > 0 ? `YOU FINISH ${d} AHEAD.` : "DEAD EVEN.", kind: "result" },
    ];
    return { ...s, lines: [...s.lines, ...more, ...result, ...next.lines].slice(-400), prompt: FIRST, extra: false, crashed: next.crashed, games: s.games + 1 };
  };

  /** Lines 60–75: its move, and one more if it ended in its store. */
  const computerTurn = (s: Session, more: Line[]): Session => {
    const m = s.machine;
    let said = `MINE: ${spokenPit(m.playMine().decision.pit)}`;
    // An empty row on its own side sends the program through its board printer on the way out.
    let fellThrough = !southEmpty(m.b) && northEmpty(m.b);
    if (!m.over && m.lastHole === NORTH_STORE) {
      said += `,${spokenPit(m.playMine(true).decision.pit)}`;
      fellThrough = !southEmpty(m.b) && northEmpty(m.b);
    }
    const printed: Line[] = [...more, { text: said, kind: "mine" }, ...(fellThrough ? boardLines(m.b) : [])];
    if (m.over) return endGame(s, printed);
    return { ...s, lines: [...s.lines, ...printed, ...boardLines(m.b)].slice(-400), prompt: FIRST, extra: false };
  };

  const submit = () => {
    const raw = typed.trim();
    setTyped("");
    // Played once per press, here in the handler: the model changes as the original's variables did.
    setSession(answer(session));
    function answer(s: Session): Session {
      const m = s.machine;
      const echo: Line = { text: `${s.prompt}? ${raw}`, kind: "you" };
      const x = Number(raw);
      if (raw === "" || Number.isNaN(x)) return { ...s, lines: [...s.lines, echo, { text: "?REDO FROM START" }] };
      // Refused, then asked again with the extra-move question, as the original did.
      if (!m.accepts(x)) return { ...s, lines: [...s.lines, echo, { text: "THAT PIT WON'T DO." }], prompt: AGAIN };
      const last = m.playYours(subscript(x - 1), s.extra, x);
      const twice = !southEmpty(m.b) && northEmpty(m.b);
      const printed: Line[] = [echo, ...boardLines(m.b), ...(twice ? boardLines(m.b) : [])];
      if (m.over) return endGame(s, printed);
      if (last === SOUTH_STORE && !s.extra) return { ...s, lines: [...s.lines, ...printed], prompt: AGAIN, extra: true };
      return computerTurn(s, printed);
    }
  };

  const restart = () => setSession(bootSession([{ text: "SEEDS AND STORES", kind: "title" }, { text: "A FRESH START: NOTHING LEARNED YET", kind: "title" }]));

  usePlayScreen({
    screen: "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [{ label: "Start a fresh session", onSelect: () => (setPaused(false), restart()) }],
    losesProgress: session.games > 0 || machine.turns.length > 0,
    roundName: "this session (the 1978 program forgets everything when it stops)",
    onMenu,
  });

  const lessons = machine.n;

  return (
    <section className={styles.room} aria-label="1970s mode: the 1978 program on a terminal">
      <div className={styles.terminal}>
        <div ref={screen} className={styles.screen} aria-live="polite">
          {lines.map((line, i) => (
            <pre key={i} className={styles.line} data-kind={line.kind}>
              {line.text || " "}
            </pre>
          ))}
          {!crashed && (
            <form
              className={styles.prompt}
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label htmlFor="stt-terminal-input">{prompt}?</label>
              <input
                id="stt-terminal-input"
                ref={input}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  // Esc leaves the line so the game's own Esc (pause) works.
                  if (event.key === "Escape") input.current?.blur();
                }}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                maxLength={8}
              />
            </form>
          )}
        </div>
      </div>
      <aside className={`${panel.panel} ${styles.side}`}>
        <p className={panel.kicker}>1970s mode</p>
        <p className={styles.note}>
          Type a pit, 1 to 6, and press Enter. The computer answers with its own pits, 1 to 6 from its side. It writes down every game it fails to win,
          and forgets them all when you leave.
        </p>
        <p className={styles.count}>
          Lessons this session: <strong>{lessons}</strong> of 51
        </p>
        <button type="button" className={panel.secondary} onClick={onMenu}>
          Leave the terminal
        </button>
      </aside>
      {crashed && (
        <div className={styles.crash} role="alertdialog" aria-labelledby="stt-crash">
          <p id="stt-crash" className={styles.crashCode}>
            ?SUBSCRIPT OUT OF RANGE IN 30
          </p>
          <p className={styles.crashText}>
            The book is full. In 1978 the program stopped right here, after the fifty-first game it failed to win, and everything it had learned went
            with it.
          </p>
          <div className={panel.row}>
            <button type="button" className={panel.primary} onClick={restart} data-autofocus>
              Start a fresh session
            </button>
            <button type="button" className={panel.secondary} onClick={onMenu}>
              Leave the terminal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
