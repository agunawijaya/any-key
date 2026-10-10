"use client";

import { useCallback, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import { usePrefs } from "@/components/kit/hooks";
import type { DocTab } from "@/components/kit/Story";
import { tankDifficulty } from "@/lib/lander/difficulty";
import { randomSeed } from "@/lib/lander/freeflight";
import { landerManifest } from "@/lib/lander/manifest";
import { MISSIONS } from "@/lib/lander/missions";
import { useProgress } from "@/lib/lander/progress";
import { Flight, type Session } from "./Flight";
import { FreeFlight, type FreeSpec } from "./FreeFlight";
import { Lobby, missionSession } from "./Lobby";
import { Terminal1979 } from "./Terminal1979";
import styles from "./DontCrater.module.css";

type Screen = { kind: "lobby" } | { kind: "flight"; session: Session; key: number } | { kind: "free"; spec: FreeSpec; key: number } | { kind: "terminal" };

const SHORTCUTS = [
  { keys: "Space", does: "Start the descent; hold for full burn" },
  { keys: "↑ ↓  0–9", does: "Throttle" },
  { keys: "← →", does: "Lean (Free Flight)" },
  { keys: "Q E", does: "Side jets, push left or right (Free Flight)" },
  { keys: "T  A  G", does: "Time warp, landing assist, burn guide" },
  { keys: "P", does: "Pause" },
];

export function DontCrater({ docs }: { docs: DocTab[] }) {
  const progress = useProgress();
  const { sound } = usePrefs();
  const [screen, setScreen] = useState<Screen>({ kind: "lobby" });

  const play = useCallback((session: Session) => setScreen({ kind: "flight", session, key: Date.now() }), []);
  const playFree = useCallback((spec: FreeSpec) => setScreen({ kind: "free", spec, key: Date.now() }), []);
  const toLobby = useCallback(() => setScreen({ kind: "lobby" }), []);

  const nextMission = (session: Session) => {
    const next = session.mission && MISSIONS.find((m) => m.id === session.mission!.id + 1);
    return next ? () => play(missionSession(next, progress.guide, progress.assist, tankDifficulty(progress.difficulty))) : undefined;
  };

  return (
    <GameShell game={landerManifest} docs={docs} className={styles.app} shortcuts={SHORTCUTS}>
      <main className={styles.main}>
        {screen.kind === "flight" ? (
          <Flight
            key={screen.key}
            session={screen.session}
            flag={progress.flag}
            sound={sound}
            onExit={toLobby}
            onRetry={() => setScreen({ ...screen, key: Date.now() })}
            onNext={nextMission(screen.session)}
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
          />
        ) : screen.kind === "terminal" ? (
          <Terminal1979 onExit={toLobby} />
        ) : (
          <Lobby onPlay={play} onFree={playFree} onTerminal={() => setScreen({ kind: "terminal" })} />
        )}
      </main>
    </GameShell>
  );
}
