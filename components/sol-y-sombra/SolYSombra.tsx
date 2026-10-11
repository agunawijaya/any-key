"use client";

import { useCallback, useEffect, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import { useShell } from "@/components/kit/shell-context";
import type { DocTab } from "@/components/kit/Story";
import { solYSombraManifest } from "@/lib/sol-y-sombra/manifest";
import { useProgress } from "@/lib/sol-y-sombra/progress";
import { bannerFont, headlineFont, printFont } from "./fonts";
import { GameSettings } from "./GameSettings";
import { Menu } from "./Menu";
import { CorridaScreen } from "./play/CorridaScreen";
import { Records } from "./Records";
import { ATTRACT } from "./scene/attract";
import { useCorridaStage } from "./scene/useCorridaStage";
import { Terminal1970s } from "./Terminal1970s";
import styles from "./SolYSombra.module.css";

/*
 * Sol y Sombra: one poster on one canvas behind every screen. On the game
 * menu the ring plays a loop of passes by itself; an afternoon in the ring
 * takes over the same stage. The 1970s terminal, the records and the
 * settings cover it.
 */

export type Screen = { kind: "menu" } | { kind: "corrida"; seed: string; key: number } | { kind: "terminal" } | { kind: "records" } | { kind: "settings" };

const SHORTCUTS = [
  { keys: "1–3", does: "Choose a cape move (or a finish, or what to do when you're down)" },
  { keys: "K", does: "Go to the moment of truth" },
  { keys: "Space", does: "Skip ahead to the next choice" },
];

export function SolYSombra({ docs }: { docs: DocTab[] }) {
  return (
    <GameShell
      game={solYSombraManifest}
      docs={docs}
      className={`${styles.app} ${headlineFont.variable} ${bannerFont.variable} ${printFont.variable}`}
      shortcuts={SHORTCUTS}
    >
      <Game />
    </GameShell>
  );
}

/** A fresh afternoon each time; `?seed=` in the address replays a given one (for the tests and the screenshots). */
const newSeed = () =>
  new URLSearchParams(window.location.search).get("seed") ?? `corrida/${Date.now().toString(36)}/${Math.floor(Math.random() * 1e6).toString(36)}`;

function Game() {
  const shell = useShell();
  const progress = useProgress();
  const density = progress.settings.crowd === "half" ? 0.5 : 1;
  const { canvasRef, handle } = useCorridaStage(ATTRACT, density, progress.settings.style);
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  const covered = screen.kind === "terminal" || screen.kind === "records" || screen.kind === "settings";

  // The ring rests behind the Story and the covering screens.
  useEffect(() => {
    handle.freeze(shell.tab !== "play" || covered);
  }, [covered, handle, shell.tab]);

  // Back on the menu, the ring goes back to its loop.
  useEffect(() => {
    if (screen.kind !== "menu") return;
    handle.stage?.toMenu(ATTRACT, density);
  }, [density, handle, screen.kind]);

  const toMenu = useCallback(() => setScreen({ kind: "menu" }), []);
  const start = useCallback(() => setScreen({ kind: "corrida", seed: newSeed(), key: Date.now() }), []);

  return (
    <main className={styles.stage} data-screen={screen.kind}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {covered && <div className={styles.veil} aria-hidden="true" />}
      {screen.kind === "menu" && (
        <Menu
          progress={progress}
          onPlay={start}
          onTerminal={() => setScreen({ kind: "terminal" })}
          onRecords={() => setScreen({ kind: "records" })}
          onSettings={() => setScreen({ kind: "settings" })}
        />
      )}
      {screen.kind === "corrida" && <CorridaScreen key={screen.key} seed={screen.seed} handle={handle} density={density} onMenu={toMenu} onAgain={start} />}
      {screen.kind === "terminal" && <Terminal1970s onMenu={toMenu} />}
      {screen.kind === "records" && <Records progress={progress} onBack={toMenu} />}
      {screen.kind === "settings" && <GameSettings progress={progress} onBack={toMenu} />}
    </main>
  );
}
