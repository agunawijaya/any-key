"use client";

import { useEffect, useMemo, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/kit/icons";
import { hasModifier, isTypingTarget } from "@/lib/kit/keys";
import type { Progress } from "@/lib/two-humps/progress";
import { DIFFICULTY, type Difficulty, type PursuerKind } from "@/lib/two-humps/rules";
import { PURSUER_NAMES } from "@/lib/two-humps/share";
import { LadleIcon, PennantIcon, StormIcon } from "./icons";
import { SceneCanvas } from "./SceneCanvas";
import { portraitScene } from "./scene/portraits";
import styles from "./PursuerPick.module.css";

/*
 * Before a Crossing: who is behind you, and how hard. Three cards, each with
 * its pursuer alive in a little scene of its own; the difficulty underneath,
 * with what it changes spelled out in numbers.
 */

type Props = {
  progress: Progress;
  dark: boolean;
  onStart: (pursuer: PursuerKind, difficulty: Difficulty) => void;
  onBack: () => void;
  onTutorial: () => void;
};

const PURSUERS: { kind: PursuerKind; grade: string; line: string; facts: string[]; icon: (p: { size?: number }) => React.ReactNode }[] = [
  {
    kind: "haboob",
    grade: "Steady",
    line: "A wall of sand that never sleeps. So when can you afford to camp?",
    facts: ["Rolls on day and night, a little slower after dark", "The sky darkens as it nears"],
    icon: StormIcon,
  },
  {
    kind: "rival",
    grade: "Tactical",
    line: "Captain Bluster wants your party. If he reaches an oasis first, he drinks it dry.",
    facts: ["Camps every night, gallops at dawn", "Watch his dust plume for a sprint"],
    icon: PennantIcon,
  },
  {
    kind: "gang",
    grade: "Hard",
    line: "Five pygmy jerboas with a very big ladle. They sleep all day and hop all night.",
    facts: ["Wild hops after dark: camping at night is a gamble", "Three handfuls of seeds stop them for a turn"],
    icon: LadleIcon,
  },
];

const DIFFICULTIES: { id: Difficulty; name: string }[] = [
  { id: "chill", name: "Chill" },
  { id: "normal", name: "Normal" },
  { id: "hard", name: "Hard" },
];

function difficultyLine(id: Difficulty) {
  const rules = DIFFICULTY[id];
  const pace = rules.pursuerPace < 1 ? "pursuers slower" : rules.pursuerPace > 1 ? "pursuers faster" : "pursuers at full pace";
  return `${rules.canteen} sips · ${pace} · help ${Math.round(rules.help * 100)}%`;
}

export function PursuerPick({ progress, dark, onStart, onBack, onTutorial }: Props) {
  const [pursuer, setPursuer] = useState<PursuerKind>(progress.choices.pursuer);
  const [difficulty, setDifficulty] = useState<Difficulty>(progress.choices.difficulty);
  const scenes = useMemo(() => Object.fromEntries(PURSUERS.map((p) => [p.kind, portraitScene(p.kind)])) as Record<PursuerKind, ReturnType<typeof portraitScene>>, []);

  // Esc goes back to the game menu; Enter sets off; arrows move between the cards.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (hasModifier(event) || isTypingTarget(event.target) || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const arrows = <T,>(list: T[], current: T, set: (value: T) => void) => (event: React.KeyboardEvent) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = list[(list.indexOf(current) + step + list.length) % list.length];
    set(next);
    const group = event.currentTarget as HTMLElement;
    requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  const record = (kind: PursuerKind) => progress.records[`${kind}/${difficulty}`];

  return (
    <div className={styles.pick}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Game menu <kbd>Esc</kbd>
        </button>
        <h1 className={styles.title}>
          Who&rsquo;s <em>behind you?</em>
        </h1>
        {!progress.tutorialSeen && (
          <button type="button" className={styles.tutorial} onClick={onTutorial}>
            First time? Try the one-minute tutorial
          </button>
        )}
      </header>

      <div className={styles.cards} role="radiogroup" aria-label="Pursuer" onKeyDown={arrows(PURSUERS.map((p) => p.kind), pursuer, setPursuer)}>
        {PURSUERS.map((p) => {
          const best = record(p.kind);
          const Glyph = p.icon;
          const checked = p.kind === pursuer;
          return (
            <button key={p.kind} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1} className={styles.card} data-kind={p.kind} onClick={() => setPursuer(p.kind)} onDoubleClick={() => onStart(p.kind, difficulty)}>
              <span className={styles.scene}>
                <SceneCanvas className={styles.canvas} hooks={scenes[p.kind].hooks} frame={scenes[p.kind].frame} seed={p.kind.length * 101} label={p.line} />
                <span className={styles.grade}>{p.grade}</span>
              </span>
              <span className={styles.cardBody}>
                <span className={styles.name}>
                  <Glyph size={20} /> {PURSUER_NAMES[p.kind]}
                </span>
                <span className={styles.line}>{p.line}</span>
                <span className={styles.facts}>
                  {p.facts.map((fact) => (
                    <span key={fact}>{fact}</span>
                  ))}
                </span>
                <span className={styles.record}>{best ? `${best.wins} of ${best.plays} won${best.bestTurns ? ` · best ${best.bestTurns} turns` : ""}` : "Not tried yet"}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.foot}>
        <div className={styles.difficulty} role="radiogroup" aria-label="Difficulty" onKeyDown={arrows(DIFFICULTIES.map((d) => d.id), difficulty, setDifficulty)}>
          {DIFFICULTIES.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={d.id === difficulty} tabIndex={d.id === difficulty ? 0 : -1} className={styles.level} onClick={() => setDifficulty(d.id)}>
              <span className={styles.levelName}>{d.name}</span>
              <span className={styles.levelLine}>{difficultyLine(d.id)}</span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.start} onClick={() => onStart(pursuer, difficulty)}>
          {dark ? <MoonIcon size={18} /> : <SunIcon size={18} />}
          Set off at {dark ? "dusk" : "dawn"} <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
