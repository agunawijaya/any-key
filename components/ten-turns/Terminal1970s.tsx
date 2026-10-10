"use client";

import { VT323 } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayScreen } from "@/components/kit/shell-context";
import { recordTerminal } from "@/lib/ten-turns/awards";
import { updateProgress } from "@/lib/ten-turns/progress";
import { Desk1970s, type DeskOutcome, PROMPTS } from "./desk1970s";
import styles from "./Terminal1970s.module.css";

const vt = VT323({ weight: "400", subsets: ["latin"] });

/*
 * 1970s mode: the original program's rules on a green screen, turn for turn
 * and quirk for quirk. Beside it, a little plotter shows what the program
 * never drew: where you and the rabbit really are, so its slips can be seen.
 */

function record(outcome: DeskOutcome) {
  const f = outcome.finished;
  if (!f) return;
  updateProgress((p) => recordTerminal(p, f.outcome, { frozenTurns: f.frozenTurns, releasedUnderRabbit: f.releasedUnderRabbit }));
}

export function Terminal1970s({ onMenu }: { onMenu: () => void }) {
  const [desk] = useState(() => new Desk1970s());
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const [input, setInput] = useState("");
  const [paused, setPaused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const { lines, mode, game } = desk;

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight });
  });

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
        label: "Start a new 1970s game",
        onSelect: () => {
          desk.restart();
          setPaused(false);
          refresh();
        },
      },
    ],
    losesProgress: desk.started,
    roundName: "this 1970s game",
    onMenu,
  });

  const submit = (raw: string) => {
    setInput("");
    record(desk.submit(raw));
    refresh();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={onMenu}>
          ← Game menu
        </button>
        <p className={styles.note}>
          The 1970s program&rsquo;s rules and numbers, turn for turn, quirks and all: watch what running does to your second number. Every word on the screen is
          new.
        </p>
      </div>
      <div className={styles.desk}>
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
                maxLength={16}
                spellCheck={false}
                autoComplete="off"
                inputMode={mode === "angle" ? "numeric" : "text"}
                style={{ width: `${Math.max(0.2, input.length)}ch` }}
                aria-label={PROMPTS[mode].trim()}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit(input);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setPaused(true);
                  }
                }}
              />
              <span className={styles.cursor} aria-hidden="true">
                _
              </span>
            </label>
          </div>
        </div>
        <aside className={`${styles.plotter} ${vt.className}`} aria-label="Where everyone really is">
          <p className={styles.plotTitle}>PLOTTER</p>
          <pre className={styles.plot}>{plot(game.dropped ? game.player : null, game.rabbit, game.dropped)}</pre>
          <p className={styles.legend}>Y you · R rabbit · * both · the dots are the pit</p>
        </aside>
      </div>
    </div>
  );
}

/**
 * The pit as the plotter draws it: north at the top, one character per cell.
 * The paper stretches past the wall only when someone has run past it.
 */
function plot(player: { x: number; y: number } | null, rabbit: { x: number; y: number }, showRabbit: boolean): string {
  const spots = [...(player ? [player] : []), ...(showRabbit ? [rabbit] : [])];
  const reach = Math.max(10, ...spots.map((s) => Math.max(Math.abs(Math.round(s.x)), Math.abs(Math.round(s.y)))));
  const rows: string[] = [];
  for (let y = reach; y >= -reach; y--) {
    let row = "";
    for (let x = -reach; x <= reach; x++) {
      const you = player && Math.round(player.x) === x && Math.round(player.y) === y;
      const it = showRabbit && rabbit.x === x && rabbit.y === y;
      if (you && it) row += "*";
      else if (you) row += "Y";
      else if (it) row += "R";
      else if (x * x + y * y <= 100) row += x === 0 && y === 0 ? "+" : ".";
      else row += " ";
    }
    rows.push(row);
  }
  return rows.join("\n");
}
