"use client";

import { VT323 } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { move1981 } from "@/lib/stickler/sparky";
import { updateProgress, withAchievement } from "@/lib/stickler/progress";
import styles from "./Terminal.module.css";

const vt = VT323({ weight: "400", subsets: ["latin"] });

/*
 * 1981 mode: the original game's behaviour on an IBM PC, step for step. You always start
 * with 23; anything that isn't 1–3 (or is more than what's left) is called
 * cheating; the computer plays the listing's formula, never truly randomises,
 * and concedes when it's left with one stick. The words are new.
 */

const INTRO = [
  "*** 23 STICKS ***",
  "",
  "WE START WITH 23 STICKS ON THE TABLE.",
  "YOU GO FIRST: TAKE 1, 2 OR 3.",
  "THEN IT'S MY TURN, SAME RULES.",
  "WHOEVER TAKES THE LAST STICK LOSES.",
  "BEST OF LUCK. YOU'LL NEED IT.",
  "",
];

type Props = { onExit: () => void; onUnlock: (ids: string[]) => void };

export function Terminal({ onExit, onUnlock }: Props) {
  const [lines, setLines] = useState<string[]>([...INTRO, "STICKS LEFT: 23", ""]);
  const [sticks, setSticks] = useState(23);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(raw: string) {
    const out = [...lines.slice(0, -1), `HOW MANY? ${raw}`];
    // BASIC's own INPUT rejects text before the program ever sees it; an empty answer counts as 0.
    if (raw.trim() && !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(raw.trim())) {
      setLines([...out, "?Redo from start", ""]);
      setInput("");
      return;
    }
    const h = Number(raw.trim() || "0");
    if (h > sticks || h !== Math.floor(h) || h <= 0 || h >= 4) {
      setLines([...out, "HEY! THAT'S AGAINST THE RULES. ONE MORE TRY.", ""]);
      setInput("");
      return;
    }
    let m = sticks - h;
    if (m === 0) {
      setLines([...out, "", "YOU TOOK THE LAST STICK. I WIN! AGAIN?", "", "STICKS LEFT: 23", ""]);
      setSticks(23);
      setInput("");
      return;
    }
    const c = move1981(m);
    if (c === "concede") {
      setLines([...out, "", "ONLY ONE LEFT FOR ME. FINE, YOU WIN. AGAIN?", "", "STICKS LEFT: 23", ""]);
      onUnlock(updateProgress((p) => withAchievement(p, "time-traveller")));
      setSticks(23);
      setInput("");
      return;
    }
    m -= c;
    setLines([...out, "", `I TAKE ${c}... STICKS LEFT: ${m}`, ""]);
    setSticks(m);
    setInput("");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={onExit}>
          ← Lobby
        </button>
        <p className={styles.note}>
          Plays exactly like the original on a PC: you always start, the computer&rsquo;s &ldquo;random&rdquo; move is always 1, and it
          gives up with one stick left. The wording is new.
        </p>
      </div>
      <div className={`${styles.crt} ${vt.className}`} onClick={() => inputRef.current?.focus()}>
        <div ref={screenRef} className={styles.screen} aria-live="polite">
          {lines.map((l, i) => (
            <div key={i} className={styles.line}>
              {i === lines.length - 1 ? (
                <label className={styles.prompt}>
                  HOW MANY?{" "}
                  <input
                    ref={inputRef}
                    className={styles.input}
                    value={input}
                    inputMode="numeric"
                    maxLength={6}
                    style={{ width: `${Math.max(0.2, input.length)}ch` }}
                    aria-label="How many sticks do you take?"
                    onChange={(e) => setInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit(input);
                      if (e.key === "Escape") onExit();
                    }}
                  />
                  <span className={styles.cursor} aria-hidden>
                    █
                  </span>
                </label>
              ) : (
                l || " "
              )}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.pad} role="group" aria-label="Quick keys">
        {["1", "2", "3"].map((k) => (
          <button key={k} type="button" onClick={() => submit(k)}>
            {k}
          </button>
        ))}
        <button type="button" onClick={() => submit("4")} title="Go on, try it">
          4?
        </button>
      </div>
    </div>
  );
}
