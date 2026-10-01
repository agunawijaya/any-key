"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PrefsSync } from "@/components/hall/PrefsSync";
import { useHashTab } from "@/components/kit/useHashTab";
import { Story, type DocTab } from "@/components/kit/Story";
import { ThemeButton } from "@/components/ui/ThemeButton";
import { randomSeed } from "@/lib/lander/freeflight";
import { MISSIONS } from "@/lib/lander/missions";
import { ACHIEVEMENTS, useProgress } from "@/lib/lander/progress";
import { setPrefs, usePrefs } from "@/lib/use-prefs";
import { Flight, type Session } from "./Flight";
import { FreeFlight, type FreeSpec } from "./FreeFlight";
import { Lobby, missionSession } from "./Lobby";
import { Terminal1979 } from "./Terminal1979";
import styles from "./DontCrater.module.css";

type Screen = { kind: "lobby" } | { kind: "flight"; session: Session; key: number } | { kind: "free"; spec: FreeSpec; key: number } | { kind: "terminal" };

const TABS = ["play", "story"] as const;

export function DontCrater({ docs }: { docs: DocTab[] }) {
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

  const play = useCallback((session: Session) => setScreen({ kind: "flight", session, key: Date.now() }), []);
  const playFree = useCallback((spec: FreeSpec) => setScreen({ kind: "free", spec, key: Date.now() }), []);
  const toLobby = useCallback(() => setScreen({ kind: "lobby" }), []);

  const nextMission = (session: Session) => {
    const next = session.mission && MISSIONS.find((m) => m.id === session.mission!.id + 1);
    return next ? () => play(missionSession(next, progress.guide, progress.assist, progress.difficulty)) : undefined;
  };

  return (
    <div className={styles.app}>
      <PrefsSync />
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to the Any Key hall">
          <span aria-hidden>←</span>
          <span className={styles.backLabel}>any key</span>
        </Link>
        <div className={styles.brand}>
          <span className={styles.logo}>Don&rsquo;t Crater</span>
          <span className={styles.origin}>based on LANDER · 1979</span>
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
        ) : screen.kind === "flight" ? (
          <Flight
            key={screen.key}
            session={screen.session}
            flag={progress.flag}
            sound={sound}
            onExit={toLobby}
            onRetry={() => setScreen({ ...screen, key: Date.now() })}
            onNext={nextMission(screen.session)}
            onUnlock={unlock}
          />
        ) : screen.kind === "free" ? (
          <FreeFlight
            key={screen.key}
            spec={screen.spec}
            flag={progress.flag}
            sound={sound}
            guide={progress.guide}
            assist={progress.assist}
            scan={progress.scan}
            onExit={toLobby}
            onRetry={() => setScreen({ ...screen, key: Date.now() })}
            onNewSite={() => playFree({ ...screen.spec, pick: { seed: randomSeed() } })}
            onUnlock={unlock}
          />
        ) : screen.kind === "terminal" ? (
          <Terminal1979 onExit={toLobby} onUnlock={unlock} />
        ) : (
          <Lobby onPlay={play} onFree={playFree} onTerminal={() => setScreen({ kind: "terminal" })} />
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
