"use client";

import { useCallback, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import { usePrefs } from "@/components/kit/hooks";
import type { DocTab } from "@/components/kit/Story";
import { COMPUTERS, nextScreen, SCREENS, type Screen } from "@/lib/outta/campaign";
import { dailyFor, shareText } from "@/lib/outta/daily";
import type { Game } from "@/lib/outta/engine";
import { LEVELS, type LevelId } from "@/lib/outta/levels";
import { outtaManifest } from "@/lib/outta/manifest";
import { earnedBy, getProgress, updateProgress, useProgress, withAchievement, type Progress } from "@/lib/outta/progress";
import { Lobby, type ModeId } from "./Lobby";
import { Play, type Finish, type Session } from "./Play";
import { isOpen, ScreensMap } from "./ScreensMap";
import { Terminal1980 } from "./Terminal1980";
import { Versus } from "./Versus";
import styles from "./OuttaHere.module.css";

type View = { kind: "lobby" } | { kind: "screens" } | { kind: "play"; session: Session } | { kind: "versus" } | { kind: "1980" };

const SHORTCUTS = [
  { keys: "Arrows  WASD", does: "Move (hold to keep going)" },
  { keys: "Space  B", does: "Drop a bomb" },
  { keys: "M  E", does: "Drop the Mega bomb you carry (Normal and Hard)" },
  { keys: "R  N", does: "Try again, new screen" },
  { keys: "P", does: "Pause" },
];

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
  const [view, setView] = useState<View>({ kind: "lobby" });

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

  const finished = useCallback((session: Session) => (g: Game, finish: Finish) => updateProgress((p) => record(p, g, session, finish)), []);

  let main: React.ReactNode;
  if (view.kind === "play") {
    const { session } = view;
    const next = session.screenId ? nextScreen(session.screenId) : undefined;
    main = (
      <Play
        key={`${session.kind}-${session.seed}-${session.screenId ?? ""}`}
        session={session}
        sound={sound}
        onExit={toLobby}
        onScreens={session.kind === "screen" ? toScreens : undefined}
        onNewScreen={session.kind === "run" ? () => setView({ kind: "play", session: runSession(session.settings.id as LevelId) }) : undefined}
        onNext={next && isOpen(progress.screens, next) ? () => setView({ kind: "play", session: screenSession(next) }) : undefined}
        onFinish={finished(session)}
      />
    );
  } else if (view.kind === "screens") main = <ScreensMap onPlay={(s) => setView({ kind: "play", session: screenSession(s) })} onExit={toLobby} />;
  else if (view.kind === "versus") main = <Versus level={progress.level} sound={sound} onExit={toLobby} />;
  else if (view.kind === "1980") main = <Terminal1980 onExit={toLobby} />;
  else main = <Lobby onChoose={choose} />;

  return (
    <GameShell game={outtaManifest} docs={docs} className={styles.app} shortcuts={SHORTCUTS} dataset={{ screen: view.kind }}>
      <main className={styles.main}>{main}</main>
    </GameShell>
  );
}
