"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PrefsSync } from "@/components/hall/PrefsSync";
import { useHashTab } from "@/components/kit/useHashTab";
import { Story, type DocTab } from "@/components/kit/Story";
import { ThemeButton } from "@/components/ui/ThemeButton";
import { LADDER } from "@/lib/stickler/modes";
import { ACHIEVEMENTS, updateProgress, useProgress } from "@/lib/stickler/progress";
import { setPrefs, usePrefs } from "@/lib/use-prefs";
import { Board, type Session } from "./Board";
import { handfulsSession, Lobby } from "./Lobby";
import { StickDefs } from "./Stick";
import { Terminal } from "./Terminal";
import styles from "./Stickler.module.css";

type Screen = { kind: "lobby" } | { kind: "board"; session: Session; key: number; rematch: boolean } | { kind: "terminal" };

const TABS = ["play", "story"] as const;

export function Stickler({ docs }: { docs: DocTab[] }) {
  const progress = useProgress();
  const { sound } = usePrefs();
  const [tab, setTab] = useHashTab(TABS);
  const [screen, setScreen] = useState<Screen>({ kind: "lobby" });
  const [toasts, setToasts] = useState<string[]>([]);

  const unlock = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setToasts((t) => [...t, ...ids]);
    window.setTimeout(() => setToasts((t) => t.slice(ids.length)), 4200);
  }, []);

  const play = useCallback(
    (session: Session) => {
      // Picking a stick style counts towards the Collector badge once you actually play with it.
      unlock(
        updateProgress((p) => {
          const used = p.skinsUsed.includes(p.skin) ? p.skinsUsed : [...p.skinsUsed, p.skin];
          const next = { ...p, skinsUsed: used };
          return used.length >= 3 && !p.achievements.includes("collector") ? { ...next, achievements: [...next.achievements, "collector"] } : next;
        }),
      );
      setScreen({ kind: "board", session, key: Date.now(), rematch: false });
    },
    [unlock],
  );

  const nextTable = (session: Session) => {
    const next = LADDER.find((t) => t.id === (session.tableId ?? 0) + 1);
    if (!next) return undefined;
    return () => play({ mode: "ladder", title: `Ladder ${next.id} · ${next.name}`, rules: next.rules, level: next.level, tableId: next.id });
  };

  return (
    <div className={styles.app} data-skin={progress.skin}>
      <PrefsSync />
      <StickDefs />
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to the Any Key hall">
          <span aria-hidden>←</span>
          <span className={styles.backLabel}>any key</span>
        </Link>
        <div className={styles.brand}>
          <span className={styles.logo}>Stickler</span>
          <span className={styles.origin}>based on 23 MATCHES · 1973</span>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Sections">
          <button type="button" role="tab" aria-selected={tab === "play"} onClick={() => setTab("play")}>
            Play
          </button>
          <button type="button" role="tab" aria-selected={tab === "story"} onClick={() => setTab("story")}>
            Story
          </button>
        </div>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            aria-pressed={sound}
            aria-label={sound ? "Sound on" : "Sound off"}
            title={sound ? "Sound on" : "Sound off"}
            onClick={() => setPrefs({ sound: !sound })}
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <ThemeButton />
        </div>
      </header>

      <main className={styles.main}>
        {tab === "story" ? (
          <Story docs={docs} />
        ) : screen.kind === "board" ? (
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
            onUnlock={unlock}
          />
        ) : screen.kind === "terminal" ? (
          <Terminal onExit={() => setScreen({ kind: "lobby" })} onUnlock={unlock} />
        ) : (
          <Lobby onPlay={play} onTerminal={() => setScreen({ kind: "terminal" })} />
        )}
      </main>

      <div className={styles.toasts} aria-live="polite">
        {toasts.map((id, i) => {
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          return a ? (
            <p key={`${id}-${i}`} className={styles.toast}>
              <span aria-hidden>{a.icon}</span> <strong>{a.name}</strong> unlocked
            </p>
          ) : null;
        })}
      </div>
    </div>
  );
}
