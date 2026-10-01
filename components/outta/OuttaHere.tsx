"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PrefsSync } from "@/components/hall/PrefsSync";
import { Story, type DocTab } from "@/components/kit/Story";
import { useHashTab } from "@/components/kit/useHashTab";
import { ThemeButton } from "@/components/ui/ThemeButton";
import { COMPUTERS, nextScreen, SCREENS, type Screen } from "@/lib/outta/campaign";
import { dailyFor, shareText } from "@/lib/outta/daily";
import type { Game } from "@/lib/outta/engine";
import { LEVELS, type LevelId } from "@/lib/outta/levels";
import { ACHIEVEMENTS, earnedBy, getProgress, updateProgress, useProgress, withAchievement, type Progress } from "@/lib/outta/progress";
import { setPrefs, usePrefs } from "@/lib/use-prefs";
import { Lobby, type ModeId } from "./Lobby";
import { Play, type Finish, type Session } from "./Play";
import { isOpen, ScreensMap } from "./ScreensMap";
import { Terminal1980 } from "./Terminal1980";
import { Versus } from "./Versus";
import styles from "./OuttaHere.module.css";

type View = { kind: "lobby" } | { kind: "screens" } | { kind: "play"; session: Session } | { kind: "versus" } | { kind: "1980" };

const TABS = ["play", "story"] as const;

const runSession = (level: LevelId, seed = 1 + Math.floor(Math.random() * 99999)): Session => ({
  kind: "run",
  title: `Run · ${LEVELS[level].name} · screen #${seed}`,
  settings: LEVELS[level],
  seed,
});

const screenSession = (s: Screen): Session => ({
  kind: "screen",
  title: `${COMPUTERS.find((c) => c.id === s.computer)!.name} · screen ${s.index + 1} of 6`,
  settings: s.settings,
  seed: s.seed,
  world: s.computer,
  screenId: s.id,
});

/** What a finished game changes in what this browser remembers. */
function record(p: Progress, g: Game, session: Session, finish: Finish): Progress {
  const won = g.state === "won";
  let next: Progress = { ...p, runs: p.runs + 1, escapes: p.escapes + (won ? 1 : 0) };
  if (session.kind === "run" && won) {
    const level = session.settings.id as LevelId;
    const best = next.best[level];
    next = {
      ...next,
      best: { ...next.best, [level]: { time: Math.min(best?.time ?? Infinity, g.t), score: Math.max(best?.score ?? 0, g.score()) } },
    };
  }
  if (session.kind === "screen" && won && session.screenId) {
    const stars = g.stars().filter(Boolean).length;
    const old = next.screens[session.screenId];
    next = { ...next, screens: { ...next.screens, [session.screenId]: { stars: Math.max(old?.stars ?? 0, stars), time: Math.min(old?.time ?? Infinity, g.t) } } };
    if (SCREENS.every((s) => next.screens[s.id])) next = withAchievement(next, "out-of-the-machine");
  }
  if (session.kind === "daily" && session.daily && !session.practice && !next.daily[session.daily.key]) {
    next = { ...next, daily: { ...next.daily, [session.daily.key]: { won, time: g.t, share: shareText(session.daily, g) } } };
    if (Object.values(next.daily).filter((d) => d.won).length >= 5) next = withAchievement(next, "daily-driver");
  }
  for (const id of earnedBy(g, finish)) next = withAchievement(next, id);
  return next;
}

export function OuttaHere({ docs }: { docs: DocTab[] }) {
  const progress = useProgress();
  const { sound } = usePrefs();
  const [tab, setTab] = useHashTab(TABS);
  const [view, setView] = useState<View>({ kind: "lobby" });
  const [toasts, setToasts] = useState<string[]>([]);

  const unlock = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setToasts((t) => [...t, ...ids]);
    window.setTimeout(() => setToasts((t) => t.slice(ids.length)), 4200);
  }, []);

  const toLobby = useCallback(() => setView({ kind: "lobby" }), []);
  const toScreens = useCallback(() => setView({ kind: "screens" }), []);

  const choose = useCallback((mode: ModeId) => {
    const p = getProgress();
    if (mode === "run") setView({ kind: "play", session: runSession(p.level) });
    else if (mode === "daily") {
      const daily = dailyFor();
      setView({
        kind: "play",
        session: { kind: "daily", title: `Daily Escape #${daily.number}`, settings: daily.settings, seed: daily.seed, daily, practice: !!p.daily[daily.key] },
      });
    } else setView({ kind: mode });
  }, []);

  const finished = useCallback(
    (session: Session) => (g: Game, finish: Finish) => unlock(updateProgress((p) => record(p, g, session, finish))),
    [unlock],
  );

  let main: React.ReactNode;
  if (tab === "story") main = <Story docs={docs} />;
  else if (view.kind === "play") {
    const { session } = view;
    const next = session.screenId ? nextScreen(session.screenId) : undefined;
    main = (
      <Play
        key={`${session.kind}-${session.seed}-${session.screenId ?? ""}`}
        session={session}
        sound={sound}
        exitLabel={session.kind === "screen" ? "Screens" : "Lobby"}
        onExit={session.kind === "screen" ? toScreens : toLobby}
        onNewScreen={session.kind === "run" ? () => setView({ kind: "play", session: runSession(session.settings.id as LevelId) }) : undefined}
        onNext={next && isOpen(progress.screens, next) ? () => setView({ kind: "play", session: screenSession(next) }) : undefined}
        onFinish={finished(session)}
      />
    );
  } else if (view.kind === "screens") main = <ScreensMap onPlay={(s) => setView({ kind: "play", session: screenSession(s) })} onExit={toLobby} />;
  else if (view.kind === "versus") main = <Versus level={progress.level} sound={sound} onExit={toLobby} />;
  else if (view.kind === "1980") main = <Terminal1980 onExit={toLobby} onUnlock={unlock} />;
  else main = <Lobby onChoose={choose} />;

  return (
    <div className={styles.app} data-view={tab === "story" ? "story" : view.kind}>
      <PrefsSync />
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to the Any Key hall">
          <span aria-hidden>←</span>
          <span className={styles.backLabel}>any key</span>
        </Link>
        <div className={styles.brand}>
          <span className={styles.logo}>Outta Here</span>
          <span className={styles.origin}>based on ESCAPE · TRS-80 BASIC · c. 1980</span>
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

      <main className={styles.main}>{main}</main>

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
