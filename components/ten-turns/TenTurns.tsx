"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import { useReducedMotion } from "@/components/kit/hooks";
import { useShell } from "@/components/kit/shell-context";
import type { DocTab } from "@/components/kit/Story";
import { recordGame, type GameSummary } from "@/lib/ten-turns/awards";
import { tenTurnsManifest } from "@/lib/ten-turns/manifest";
import { PITS } from "@/lib/ten-turns/pits";
import { updateProgress, useProgress } from "@/lib/ten-turns/progress";
import type { PitPlan } from "@/lib/ten-turns/tactics";
import { ChapterMap } from "./ChapterMap";
import { bookFont, shoutFont } from "./fonts";
import { GameSettings } from "./GameSettings";
import { useDarkAppearance } from "./hooks";
import { Menu } from "./Menu";
import { createDemo } from "./play/demo";
import { PitScreen, type PitGame } from "./PitScreen";
import { Records } from "./Records";
import { pitSound } from "./sound";
import { Terminal1970s } from "./Terminal1970s";
import { useDailyPit } from "./useDailyPit";
import { usePitCanvas } from "./usePitCanvas";
import styles from "./TenTurns.module.css";

/*
 * Ten Turns in the Pit: one canvas behind every screen, drawn by the chosen
 * style. The menu and the chapter map let the pit play itself; a game takes
 * it over; the 1970s terminal, the records and the settings cover it.
 */

type Screen =
  | { kind: "menu" }
  | { kind: "chapters" }
  | { kind: "pit"; game: PitGame; key: number }
  | { kind: "daily"; key: number }
  | { kind: "terminal" }
  | { kind: "records" }
  | { kind: "settings" };

const SHORTCUTS = [
  { keys: "Q W E · A D · Z X C", does: "Step in eight directions (the number pad and arrows work too; two arrows for a diagonal)" },
  { keys: "Enter", does: "Drop in, or use a tool, at the highlighted cell" },
  { keys: "1  2  3", does: "Tactics: toss a carrot, set a stone, dig in" },
  { keys: "I (hold)", does: "Tactics: see the rabbit's plan, when it's set to show on request" },
  { keys: "Space", does: "Skip the rabbit's pounces" },
];

export function TenTurns({ docs }: { docs: DocTab[] }) {
  return (
    <GameShell game={tenTurnsManifest} docs={docs} className={`${styles.app} ${bookFont.variable} ${shoutFont.variable}`} shortcuts={SHORTCUTS}>
      <Game />
    </GameShell>
  );
}

function Game() {
  const shell = useShell();
  const dark = useDarkAppearance();
  const reduced = useReducedMotion();
  const progress = useProgress();
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  const covered = screen.kind === "terminal" || screen.kind === "records" || screen.kind === "settings";
  const { canvasRef, api: canvas, size } = usePitCanvas(progress.settings.style, dark, shell.tab === "play" && !covered);
  const [sound] = useState(() => pitSound());

  // The pit plays itself behind the menu and the chapter map.
  const attract = screen.kind === "menu" || screen.kind === "chapters" || covered;
  const { setPainter } = canvas;
  useEffect(() => {
    if (!attract) return;
    const demo = createDemo(Date.now(), reduced);
    setPainter((time, dt) => ({ kind: "pit", frame: demo(time, dt) }));
    return () => setPainter(null);
  }, [attract, reduced, setPainter]);

  // The meadow's sound bed plays during a game, by day or by night.
  const inPit = screen.kind === "pit" || screen.kind === "daily";
  useEffect(() => {
    sound.ambience(inPit && shell.tab === "play" ? (dark ? "night" : "day") : null);
  }, [dark, inPit, shell.tab, sound]);
  useEffect(() => () => sound.stop(), [sound]);

  const toMenu = useCallback(() => setScreen({ kind: "menu" }), []);
  const startPit = useCallback((game: PitGame) => setScreen({ kind: "pit", game, key: Date.now() }), []);
  const record = useCallback((summary: GameSummary) => updateProgress((p) => recordGame(p, summary)), []);
  const play = useCallback(() => (progress.settings.playStyle === "classic" ? startPit({ kind: "classic" }) : setScreen({ kind: "chapters" })), [progress.settings.playStyle, startPit]);
  const nextPit = (plan: PitPlan) => {
    const index = PITS.findIndex((p) => p.id === plan.id);
    const next = PITS[index + 1];
    if (next) startPit({ kind: "tactics", plan: next, last: index + 1 === PITS.length - 1 });
  };

  return (
    <main className={styles.stage} data-screen={screen.kind}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {covered && <div className={styles.veil} aria-hidden="true" />}
      {screen.kind === "menu" && (
        <Menu
          progress={progress}
          onPlay={play}
          onDaily={() => setScreen({ kind: "daily", key: Date.now() })}
          onTerminal={() => setScreen({ kind: "terminal" })}
          onRecords={() => setScreen({ kind: "records" })}
          onSettings={() => setScreen({ kind: "settings" })}
        />
      )}
      {screen.kind === "chapters" && <ChapterMap progress={progress} onPick={(plan, last) => startPit({ kind: "tactics", plan, last })} onBack={toMenu} />}
      {screen.kind === "pit" && (
        <PitScreen
          key={screen.key}
          game={screen.game}
          canvas={canvas}
          canvasSize={size}
          settings={progress.settings}
          onRecord={record}
          onSound={sound.play}
          onMenu={toMenu}
          onAgain={() => startPit(screen.game)}
          onNext={screen.game.kind === "tactics" ? () => nextPit((screen.game as { plan: PitPlan }).plan) : undefined}
        />
      )}
      {screen.kind === "daily" && <DailyScreen key={screen.key} canvas={canvas} canvasSize={size} onRecord={record} onSound={sound.play} onMenu={toMenu} onAgain={() => setScreen({ kind: "daily", key: Date.now() })} />}
      {screen.kind === "terminal" && <Terminal1970s onMenu={toMenu} />}
      {screen.kind === "records" && <Records progress={progress} onBack={toMenu} />}
      {screen.kind === "settings" && <GameSettings progress={progress} onBack={toMenu} />}
    </main>
  );
}

/** The Daily: wait for today's pit to be dug, then play it. */
function DailyScreen({ canvas, canvasSize, onRecord, onSound, onMenu, onAgain }: Pick<Parameters<typeof PitScreen>[0], "canvas" | "canvasSize" | "onRecord" | "onSound" | "onMenu" | "onAgain">) {
  const { pit, failed } = useDailyPit();
  const progress = useProgress();
  const game = useMemo<PitGame | null>(() => (pit ? { kind: "daily", plan: pit.plan, number: pit.number, key: pit.key } : null), [pit]);
  const { setPainter } = canvas;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (game) return;
    const demo = createDemo("daily-wait", reduced);
    setPainter((time, dt) => ({ kind: "pit", frame: demo(time, dt) }));
    return () => setPainter(null);
  }, [game, reduced, setPainter]);
  if (!game)
    return (
      <p className={styles.digging} role="status">
        {failed ? "Today's pit wouldn't dig. Try again in a moment." : "Digging today's pit…"}
      </p>
    );
  return <PitScreen game={game} canvas={canvas} canvasSize={canvasSize} settings={progress.settings} onRecord={onRecord} onSound={onSound} onMenu={onMenu} onAgain={onAgain} />;
}
