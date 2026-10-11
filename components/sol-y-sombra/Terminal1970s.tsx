"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayScreen } from "@/components/kit/shell-context";
import { createRng } from "@/lib/kit/rng";
import { afterTerminal } from "@/lib/sol-y-sombra/awards";
import { OriginalBull, type OriginalEvent, type Waiting } from "@/lib/sol-y-sombra/original";
import { updateProgress } from "@/lib/sol-y-sombra/progress";
import panel from "./panel.module.css";
import styles from "./Terminal1970s.module.css";

/*
 * 1970s mode: the 1978 program, question for question, on a terminal. The
 * model in lib/sol-y-sombra/original.ts makes every decision exactly as the
 * original did (its order of random draws, the crews drawn from the bull,
 * the inverted crew ratings, the kill choice it ignores, the crowd's three
 * rolls, the award after a fatal goring); this screen only types it out.
 * Every line it prints is our own wording, in a plain, neutral voice.
 *
 * Like the original, which never seeded its random numbers, the first
 * afternoon after opening the terminal is always the same one; later runs
 * carry on from where the numbers had got to.
 */

type Line = { text: string; kind?: "you" | "title" | "result" | "plain" };

const BULL = ["", "MAGNIFICENT", "BRAVE", "ORDINARY", "POOR", "HOPELESS"];
const JOB = ["", "MASTERLY", "GOOD", "FAIR", "POOR", "AWFUL"];
const AWARD = ["NO AWARD TODAY.", "AWARD: ONE TROPHY.", "AWARD: TWO TROPHIES.", "AWARD: THE GRAND PRIZE, TWO TROPHIES AND THE CUP."];

const PROMPTS: Record<Waiting, string> = {
  instructions: "WOULD YOU LIKE THE RULES",
  kill: "",
  cape: "CAPE MOVE (0, 1 OR 2)",
  run: "LEAVE THE RING",
  how: "HOW (4 OR 5)",
  done: "",
};

const RULES: Line[] = [
  "YOU ARE THE MATADOR. A BULL IS DRAWN FOR YOU, RATED",
  "1 (THE BEST, AND THE MOST DANGEROUS) TO 5 (THE WORST).",
  "YOUR PICADORES AND TOREADORES WORK THE BULL FIRST;",
  "GOOD WORK FROM THEM IMPROVES YOUR CHANCES.",
  "",
  "EACH PASS, CHOOSE A CAPE MOVE:",
  "  0  VERONICA     DARING, AND THE CROWD LOVES IT",
  "  1  OUTSIDE      LESS DARING",
  "  2  SWIRL        THE SAFEST, THE LEAST ADMIRED",
  "",
  "WHEN YOU ARE READY, TRY FOR THE KILL:",
  "  4  GO IN OVER THE HORNS",
  "  5  WAIT FOR THE CHARGE",
  "THE LONGER YOU WORK THE BULL, THE EASIER THE KILL.",
  "MANY WAIT UNTIL THE SEVENTH PASS.",
  "",
  "ANSWER YES OR NO EXACTLY SO, IN CAPITALS.",
].map((text) => ({ text, kind: "plain" as const }));

function describe(e: OriginalEvent): Line[] {
  switch (e.kind) {
    case "title":
      return [{ text: "A BULL IN THE AFTERNOON", kind: "title" }, { text: "(AFTER A PROGRAM OF 1978)", kind: "title" }, { text: "" }];
    case "ask-instructions":
      return [];
    case "instructions":
      return [...RULES, { text: "" }];
    case "bull":
      return [
        { text: `TODAY'S BULL IS CLASS ${e.quality}: ${BULL[e.quality]}.` },
        ...(e.quality === 5 ? [{ text: "A LUCKY DRAW." }] : e.quality === 1 ? [{ text: "STAND FIRM. AND GOOD LUCK." }] : []),
      ];
    case "crew": {
      const who = e.crew === "picadores" ? "PICADORES" : "TOREADORES";
      const word = JOB[e.rating];
      const lines: Line[] = [{ text: `THE ${who} DID ${/^[AEIOU]/.test(word) ? "AN" : "A"} ${word} JOB.` }];
      const { horses, men } = e.casualties;
      const parts: string[] = [];
      if (horses) parts.push(`${horses} ${horses === 1 ? "HORSE" : "HORSES"}`);
      if (men) parts.push(`${men} ${men === 1 ? "MAN" : "MEN"}`);
      if (parts.length) lines.push({ text: `${parts.join(" AND ")} HAD TO BE LED OUT OF THE RING.` });
      return lines;
    }
    case "pass":
      return [{ text: "" }, { text: `PASS ${e.number}`, kind: "result" }];
    case "ask-kill":
      return [];
    case "ask-cape":
      return [];
    case "bad-cape":
      return [{ text: "NO SUCH MOVE." }];
    case "bad-yes-no":
      return [{ text: "ANSWER YES OR NO." }];
    case "redo":
      return [{ text: "?REDO FROM START" }];
    case "pass-survived":
      return [{ text: "THE BULL GOES BY." }];
    case "gored":
      return [{ text: "THE HORN CATCHES YOU.", kind: "result" }];
    case "dead":
      return [{ text: "YOU DID NOT SURVIVE THE GORING.", kind: "result" }];
    case "alive":
      return [{ text: "YOU ARE HURT, BUT YOU CAN STAND." }];
    case "ask-run":
      return [];
    case "ran":
      return [{ text: "YOU LEAVE THE RING." }];
    case "stayed":
      return [{ text: "YOU STAY." }];
    case "gored-again":
      return [{ text: "THE BULL CATCHES YOU AGAIN.", kind: "result" }];
    case "moment-of-truth":
      return [{ text: "" }, { text: "THE MOMENT OF TRUTH.", kind: "result" }];
    case "ask-how":
      return [{ text: "4 GOES IN OVER THE HORNS, 5 WAITS FOR THE CHARGE." }];
    case "panicked":
      return [{ text: "YOU FREEZE." }];
    case "kill-attempt":
      return [];
    case "killed":
      return [{ text: "THE KILL SUCCEEDS.", kind: "result" }];
    case "boos":
      return [{ text: "THE CROWD BOOS. NOTHING FOR YOU TODAY.", kind: "result" }];
    case "cheers":
      return [{ text: e.wildly ? "THE CROWD CHEERS AND WILL NOT STOP." : "THE CROWD CHEERS." }];
    case "award":
      return [{ text: AWARD[e.tier], kind: "result" }];
    case "end":
      return [{ text: "" }, { text: "--- END OF THE AFTERNOON ---" }];
  }
}

/** The question the program is waiting on, worded by when it asks. */
function promptFor(bull: OriginalBull) {
  if (bull.waiting === "kill") return bull.state.pass < 3 ? "TRY FOR THE KILL NOW" : "IS IT TIME FOR THE KILL";
  return PROMPTS[bull.waiting];
}

type Session = { bull: OriginalBull; lines: Line[]; events: OriginalEvent[]; games: number };

export function Terminal1970s({ onMenu }: { onMenu: () => void }) {
  // One stream of numbers for the whole visit, never seeded from the clock: the first afternoon is always the same.
  const [rng] = useState(() => createRng("bullfght/1978"));
  const [session, setSession] = useState<Session>(() => boot(rng.float, 0));
  const [typed, setTyped] = useState("");
  const [paused, setPaused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const done = session.bull.waiting === "done";

  useEffect(() => {
    screen.current?.scrollTo({ top: screen.current.scrollHeight });
  }, [session.lines]);

  useEffect(() => {
    if (!paused) input.current?.focus();
  }, [paused, session.lines]);

  const submit = () => {
    const raw = typed;
    setTyped("");
    if (done) {
      // RUN again: a fresh afternoon, carrying on the same stream of numbers.
      const next = boot(rng.float, session.games);
      setSession({ ...next, lines: [...session.lines, { text: "" }, ...next.lines].slice(-500) });
      return;
    }
    const s = session;
    const echo: Line = { text: `${promptFor(s.bull)}? ${raw}`, kind: "you" };
    const events = s.bull.answer(raw);
    const lines = [...s.lines, echo, ...events.flatMap(describe)];
    const all = [...s.events, ...events];
    if (s.bull.waiting === "done") updateProgress((p) => afterTerminal(p, all));
    setSession({ ...s, lines: lines.slice(-500), events: all, games: s.bull.waiting === "done" ? s.games + 1 : s.games });
  };

  usePlayScreen({
    screen: "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [],
    losesProgress: !done && session.events.length > 2,
    roundName: "this afternoon at the terminal",
    onMenu,
  });

  return (
    <section className={styles.room} aria-label="1970s mode: the 1978 program on a terminal">
      <div className={styles.terminal}>
        <div ref={screen} className={styles.screen} aria-live="polite">
          {session.lines.map((line, i) => (
            <pre key={i} className={styles.line} data-kind={line.kind}>
              {line.text || " "}
            </pre>
          ))}
          <form
            className={styles.prompt}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label htmlFor="sys-terminal-input">{done ? "PRESS ENTER TO RUN IT AGAIN" : `${promptFor(session.bull)}?`}</label>
            <input
              id="sys-terminal-input"
              ref={input}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                // Esc leaves the line so the game's own Esc (pause) works.
                if (event.key === "Escape") input.current?.blur();
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
            />
          </form>
        </div>
      </div>
      <aside className={`${panel.panel} ${styles.side}`}>
        <p className={panel.kicker}>1970s mode</p>
        <p className={styles.note}>
          The 1978 program, answer for answer. Type <strong>YES</strong> or <strong>NO</strong> in capitals, as it insisted, and numbers for your moves; press
          Enter.
        </p>
        <ul className={styles.quirks}>
          <li>Its rules say good work from your crews helps you. Its arithmetic does the opposite.</li>
          <li>It asks how you want to kill, then treats 4 and 5 exactly alike.</li>
          <li>The crowd rolls its dice three times before it decides.</li>
          <li>It gives awards even when you did not survive.</li>
        </ul>
        <p className={styles.count}>
          Afternoons this visit: <strong>{session.games}</strong>
        </p>
        <div className={panel.row}>
          <button type="button" className={panel.secondary} onClick={onMenu}>
            Back to the game menu
          </button>
        </div>
      </aside>
    </section>
  );
}

function boot(random: () => number, games: number): Session {
  const bull = new OriginalBull(random);
  const events = bull.start();
  return { bull, lines: events.flatMap(describe), events, games };
}
