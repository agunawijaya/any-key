"use client";

import { VT323 } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { updateProgress, withAchievement } from "@/lib/two-humps/progress";
import { Desk1982, KEYS, PROMPTS, type Outcome } from "./desk1982";
import styles from "./Terminal1982.module.css";

const vt = VT323({ weight: "400", subsets: ["latin"] });

/*
 * 1982 mode: the original program's rules on an IBM PC screen, turn for turn
 * and bug for bug. Under the monitor, a panel says what BASIC keeps quiet
 * about: the strides the camel ran unseen, the return addresses piling up on
 * the stack, where the gang really is.
 */

type Props = { onExit: () => void };

function record(outcome: Outcome) {
  if (outcome.typo) updateProgress((p) => withAchievement(p, "typo"));
  const finished = outcome.finished;
  if (!finished) return;
  updateProgress((p) => {
    const next = { ...p, original: { plays: p.original.plays + 1, wins: p.original.wins + (finished.won ? 1 : 0) } };
    return finished.won ? withAchievement(next, "survivor-1982") : next;
  });
}

export function Terminal1982({ onExit }: Props) {
  const shell = useShell();
  const [desk] = useState(() => new Desk1982());
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const [input, setInput] = useState("");
  const [paused, setPaused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const { lines, mode } = desk;

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (!paused) inputRef.current?.focus({ preventScroll: true });
  }, [paused, mode]);

  usePlayScreen({
    screen: "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [
      {
        label: "Start a new 1982 trek",
        onSelect: () => {
          desk.restart();
          setPaused(false);
          refresh();
        },
      },
    ],
    losesProgress: desk.started && (mode === "command" || mode === "subcommand"),
    roundName: "this 1982 trek",
    onMenu: onExit,
  });

  function submit(raw: string) {
    setInput("");
    record(desk.submit(raw));
    refresh();
  }

  const keyPress = (n: number) => {
    if (mode === "command" || mode === "subcommand") submit(String(n));
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={shell.toMenu}>
          ← Game menu
        </button>
        <p className={styles.note}>
          The 1982 program&rsquo;s rules and numbers, turn for turn, bugs included. Every word on the screen is new, and the gang has replaced the original&rsquo;s pursuers. Like the original, it never shuffles its dice: each time you open 1982 mode, the desert plays out the same way.
        </p>
      </div>

      <div className={styles.monitor}>
        <div className={`${styles.crt} ${vt.className}`} onClick={() => inputRef.current?.focus()}>
          <div ref={screenRef} className={styles.screen} aria-live="polite">
            {lines.map((line, i) => (
              <div key={i} className={styles.line}>
                {line || " "}
              </div>
            ))}
            <label className={styles.prompt}>
              {PROMPTS[mode]}
              <input
                ref={inputRef}
                className={styles.input}
                value={input}
                maxLength={12}
                spellCheck={false}
                autoComplete="off"
                style={{ width: `${Math.max(0.2, input.length)}ch` }}
                aria-label={mode === "ended" ? "BASIC is waiting: type RUN to play again" : PROMPTS[mode].trim()}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  const fn = /^F([1-6])$/.exec(event.key);
                  if (fn) {
                    // The original put its six commands on the function keys.
                    event.preventDefault();
                    keyPress(Number(fn[1]));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    submit(input);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setPaused(true);
                  }
                }}
              />
              <span className={styles.cursor} aria-hidden>
                _
              </span>
            </label>
          </div>
          <div className={styles.keyLine} role="group" aria-label="Function keys">
            {KEYS.map((key) => (
              <button key={key.n} type="button" className={styles.fkey} onClick={() => keyPress(key.n)} disabled={mode !== "command"} aria-keyshortcuts={`F${key.n}`}>
                <span className={styles.fnum}>{key.n}</span>
                <span className={styles.flabel}>{key.label}</span>
              </button>
            ))}
            {mode === "subcommand" && (
              <>
                <button type="button" className={styles.fkey} onClick={() => submit("7")}>
                  <span className={styles.fnum}>7</span>
                  <span className={styles.flabel}>RUN</span>
                </button>
                <button type="button" className={styles.fkey} onClick={() => submit("8")}>
                  <span className={styles.fnum}>8</span>
                  <span className={styles.flabel}>WAIT</span>
                </button>
              </>
            )}
            {mode === "ended" && (
              <button type="button" className={styles.fkey} onClick={() => submit("RUN")}>
                <span className={styles.flabel}>RUN</span>
              </button>
            )}
          </div>
        </div>
        <div className={styles.chin} aria-hidden>
          <span className={styles.badge}>1982</span>
          <span className={styles.led} />
        </div>
      </div>

      <section className={styles.hidden} aria-label="What BASIC doesn't show">
        <h2>What BASIC doesn&rsquo;t show</h2>
        {desk.notes.map((note) => (
          <p key={note} className={styles.hiddenNote}>
            {note}
          </p>
        ))}
        <p className={styles.hiddenFacts}>{desk.facts}</p>
      </section>
    </div>
  );
}
