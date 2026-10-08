"use client";

import { useCallback, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import { usePrefs } from "@/components/kit/hooks";
import type { DocTab } from "@/components/kit/Story";
import { sticklerManifest } from "@/lib/stickler/manifest";
import { LADDER } from "@/lib/stickler/modes";
import { updateProgress, useProgress } from "@/lib/stickler/progress";
import { Board, type Session } from "./Board";
import { handfulsSession, Lobby } from "./Lobby";
import { StickDefs } from "./Stick";
import { Terminal } from "./Terminal";
import styles from "./Stickler.module.css";

type Screen = { kind: "lobby" } | { kind: "board"; session: Session; key: number; rematch: boolean } | { kind: "terminal" };

const SHORTCUTS = [
  { keys: "1–9", does: "Pick that many sticks" },
  { keys: "Enter", does: "Take them" },
  { keys: "↑ ↓", does: "Choose a row (several rows)" },
  { keys: "H", does: "Ask the coach for a hint" },
];

export function Stickler({ docs }: { docs: DocTab[] }) {
  const progress = useProgress();
  const { sound } = usePrefs();
  const [screen, setScreen] = useState<Screen>({ kind: "lobby" });

  const play = useCallback((session: Session) => {
    // Picking a stick style counts towards the Collector badge once you actually play with it.
    updateProgress((p) => {
      const used = p.skinsUsed.includes(p.skin) ? p.skinsUsed : [...p.skinsUsed, p.skin];
      const next = { ...p, skinsUsed: used };
      return used.length >= 3 && !p.achievements.includes("collector") ? { ...next, achievements: [...next.achievements, "collector"] } : next;
    });
    setScreen({ kind: "board", session, key: Date.now(), rematch: false });
  }, []);

  const nextTable = (session: Session) => {
    const next = LADDER.find((t) => t.id === (session.tableId ?? 0) + 1);
    if (!next) return undefined;
    return () => play({ mode: "ladder", title: `Ladder ${next.id} · ${next.name}`, rules: next.rules, level: next.level, tableId: next.id });
  };

  return (
    <GameShell game={sticklerManifest} docs={docs} className={styles.app} shortcuts={SHORTCUTS} dataset={{ skin: progress.skin }}>
      <main className={styles.main}>
        <StickDefs />
        {screen.kind === "board" ? (
          <Board
            key={screen.key}
            session={screen.session}
            skin={progress.skin}
            sound={sound}
            seed={screen.key % 1_000_000}
            rematch={screen.rematch}
            onRematch={() => {
              // A surprise pile is drawn again for every rematch; every other table stays as it was.
              const key = Date.now();
              const { session } = screen;
              const next = session.handfuls?.surprise && session.level ? handfulsSession(session.handfuls, session.level, key % 1_000_000) : session;
              setScreen({ ...screen, session: next, key, rematch: true });
            }}
            onExit={() => setScreen({ kind: "lobby" })}
            onNext={screen.session.mode === "ladder" ? nextTable(screen.session) : undefined}
          />
        ) : screen.kind === "terminal" ? (
          <Terminal onExit={() => setScreen({ kind: "lobby" })} />
        ) : (
          <Lobby onPlay={play} onTerminal={() => setScreen({ kind: "terminal" })} />
        )}
      </main>
    </GameShell>
  );
}
