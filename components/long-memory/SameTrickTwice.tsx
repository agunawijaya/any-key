"use client";

import { useCallback, useEffect, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import { useShell } from "@/components/kit/shell-context";
import type { DocTab } from "@/components/kit/Story";
import { longMemoryManifest } from "@/lib/long-memory/manifest";
import type { MatchConfig } from "@/lib/long-memory/match";
import { useProgress } from "@/lib/long-memory/progress";
import { useCheatKey } from "./cheat";
import { Daily } from "./Daily";
import { useDarkAppearance } from "./hooks";
import { MatchScreen } from "./MatchScreen";
import { Menu } from "./Menu";
import { Pick } from "./Pick";
import { Records } from "./Records";
import { GameSettings } from "./GameSettings";
import { Terminal1978 } from "./Terminal1978";
import { useAttract } from "./useAttract";
import { useBoardScene } from "./useBoardScene";
import styles from "./SameTrickTwice.module.css";

/*
 * Same Trick Twice: one carved board on one canvas behind every screen. The
 * game menu lets it play itself; a match, the Daily Endgame and the Memory
 * Book all use the same board. The 1970s terminal, the records and the
 * settings cover it.
 */

export type Screen =
  | { kind: "menu" }
  | { kind: "pick" }
  | { kind: "match"; config: MatchConfig; key: number }
  | { kind: "daily"; key: number }
  | { kind: "terminal" }
  | { kind: "records" }
  | { kind: "settings" };

const SHORTCUTS = [
  { keys: "1–6", does: "Sow from your pits, left to right" },
  { keys: "← →  Enter", does: "Choose a pit and sow it" },
  { keys: "Drag", does: "Carry a pit's seeds and drop them by hand" },
  { keys: "Space", does: "Skip the sowing" },
  { keys: "Z", does: "Take back your move (against the Scholar or a friend)" },
  { keys: "B", does: "The Learner's Memory Book" },
];

export function SameTrickTwice({ docs }: { docs: DocTab[] }) {
  return (
    <GameShell game={longMemoryManifest} docs={docs} className={styles.app} shortcuts={SHORTCUTS}>
      <Game />
    </GameShell>
  );
}

function Game() {
  const shell = useShell();
  const dark = useDarkAppearance();
  const progress = useProgress();
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  const covered = screen.kind === "terminal" || screen.kind === "records" || screen.kind === "settings";
  const { canvasRef, board } = useBoardScene(dark, shell.tab === "play" && !covered);
  const { handle } = board;
  const attract = screen.kind === "menu" || screen.kind === "pick";
  useAttract(handle, attract, board.reduced);
  useCheatKey();

  useEffect(() => {
    handle.scene?.setTempo(progress.settings.speed);
  }, [handle, progress.settings.speed]);

  // The menu sets the board to the right, leaving the table on the left for the panel; play centres it.
  const framing = attract ? "menu" : "play";
  useEffect(() => {
    if (framing === "menu") handle.setSafeArea({ left: 0.42, right: 0.03, top: 0.12, bottom: 0.1 });
    else handle.setSafeArea({ left: 0.085, right: 0.085, top: 0.09, bottom: 0.15 });
  }, [framing, handle]);

  const toMenu = useCallback(() => setScreen({ kind: "menu" }), []);
  const start = useCallback((config: MatchConfig) => setScreen({ kind: "match", config, key: Date.now() }), []);

  return (
    <main className={styles.stage} data-screen={screen.kind}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {covered && <div className={styles.veil} aria-hidden="true" />}
      {board.failed && <p className={styles.noWebgl}>This browser cannot draw the carved board (it needs WebGL 2). The 1970s terminal still works.</p>}
      {screen.kind === "menu" && (
        <Menu
          progress={progress}
          onPlayLearner={() => start({ rules: "awari1978", seeds: 3, opponent: "learner", level: progress.settings.scholar, first: "south" })}
          onPick={() => setScreen({ kind: "pick" })}
          onDaily={() => setScreen({ kind: "daily", key: Date.now() })}
          onTerminal={() => setScreen({ kind: "terminal" })}
          onRecords={() => setScreen({ kind: "records" })}
          onSettings={() => setScreen({ kind: "settings" })}
        />
      )}
      {screen.kind === "pick" && <Pick settings={progress.settings} onStart={start} onBack={toMenu} />}
      {screen.kind === "match" && <MatchScreen key={screen.key} config={screen.config} board={board} onMenu={toMenu} onAgain={() => start(screen.config)} />}
      {screen.kind === "daily" && <Daily key={screen.key} board={board} onMenu={toMenu} onAgain={() => setScreen({ kind: "daily", key: Date.now() })} />}
      {screen.kind === "terminal" && <Terminal1978 onMenu={toMenu} />}
      {screen.kind === "records" && <Records progress={progress} onBack={toMenu} />}
      {screen.kind === "settings" && <GameSettings progress={progress} onBack={toMenu} />}
    </main>
  );
}
