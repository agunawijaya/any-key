"use client";

import { useCallback, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import { usePrefs } from "@/components/kit/hooks";
import type { DocTab } from "@/components/kit/Story";
import { dailyFor } from "@/lib/two-humps/daily";
import type { Trek as Engine } from "@/lib/two-humps/engine";
import { LEGS } from "@/lib/two-humps/expedition";
import { twoHumpsManifest } from "@/lib/two-humps/manifest";
import { afterCrossing, afterLeg, getProgress, updateProgress, useProgress } from "@/lib/two-humps/progress";
import type { Difficulty, PursuerKind } from "@/lib/two-humps/rules";
import { dailyShare } from "@/lib/two-humps/share";
import { tutorialConfig } from "@/lib/two-humps/tutorial";
import { ExpeditionMap } from "./ExpeditionMap";
import { startClockFor, useDarkAppearance } from "./hooks";
import { Menu } from "./Menu";
import { PursuerPick } from "./PursuerPick";
import { Records } from "./Records";
import { Terminal1982 } from "./Terminal1982";
import { Trek, type Session } from "./Trek";
import styles from "./TwoHumps.module.css";

/*
 * Two Humps: the game menu and the screens it leads to. A trek is a session
 * (a Crossing, the Daily, an Expedition leg or the tutorial); when it ends,
 * the session decides what goes into the player's progress.
 */

type Screen =
  | { kind: "menu" }
  | { kind: "pick" }
  | { kind: "map" }
  | { kind: "records" }
  | { kind: "terminal" }
  | { kind: "trek"; session: Session; key: number };

const SHORTCUTS = [
  { keys: "1–6", does: "Drink, walk, gallop, make camp, scan, signal" },
  { keys: "Space", does: "Pull the reins while the camel runs on" },
  { keys: "Enter", does: "Let the camel run on; skip ahead" },
  { keys: "S", does: "Toss seeds to the Ladle Gang" },
  { keys: "C  W", does: "Chase the packs or wait (dust devil)" },
  { keys: "P", does: "Pause" },
];

/** A fresh desert for every crossing. */
const freshSeed = () => `two-humps/${Date.now().toString(36)}/${Math.floor(Math.random() * 2 ** 31).toString(36)}`;

function legSession(index: number, difficulty: Difficulty): Session {
  const leg = LEGS[index];
  return {
    kind: "expedition",
    config: { pursuer: leg.pursuer, difficulty, seed: freshSeed(), startClock: leg.startClock, twist: leg.twist },
    leg,
    legIndex: index,
    legs: LEGS.length,
  };
}

/** The same session again: new dice for a Crossing or a leg; the Daily again, now as practice. */
function again(session: Session): Session {
  if (session.kind === "crossing" || session.kind === "expedition") return { ...session, config: { ...session.config, seed: freshSeed() } };
  if (session.kind === "daily") return { ...session, practice: true };
  return session;
}

export function TwoHumps({ docs }: { docs: DocTab[] }) {
  const progress = useProgress();
  const { sound } = usePrefs();
  const dark = useDarkAppearance();
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });

  const toMenu = useCallback(() => setScreen({ kind: "menu" }), []);
  const go = (kind: "pick" | "map" | "records" | "terminal") => setScreen({ kind });
  const start = useCallback((session: Session) => setScreen({ kind: "trek", session, key: Date.now() }), []);

  const crossing = (pursuer: PursuerKind, difficulty: Difficulty) => {
    updateProgress((p) => ({ ...p, choices: { ...p.choices, pursuer, difficulty } }));
    start({ kind: "crossing", config: { pursuer, difficulty, seed: freshSeed(), startClock: startClockFor(dark) } });
  };

  const daily = () => {
    const today = dailyFor();
    start({ kind: "daily", config: today.config, number: today.number, key: today.key, practice: !!getProgress().daily[today.key] });
  };

  const tutorial = () => start({ kind: "tutorial", config: tutorialConfig(startClockFor(dark)) });

  const skipTutorial = () => {
    updateProgress((p) => ({ ...p, tutorialSeen: true }));
    go("pick");
  };

  /** Records a finished trek; returns the keycaps it unlocked. */
  const finish = (session: Session) => (trek: Engine) =>
    updateProgress((p) => {
      const share = session.kind === "daily" ? { key: session.key, share: dailyShare(trek, session.number) } : undefined;
      let next = afterCrossing(p, trek, session.kind, share);
      // Only the leg the expedition is on moves it forward; replaying an old leg is just for fun.
      if (session.kind === "expedition" && trek.state.ending === "arrived" && session.legIndex === p.expedition.leg) next = afterLeg(next, session.legs);
      return next;
    });

  const nextLeg = (session: Session) => {
    if (session.kind !== "expedition") return undefined;
    if (session.legIndex + 1 >= session.legs) return () => go("map");
    return () => start(legSession(session.legIndex + 1, getProgress().choices.difficulty));
  };

  return (
    <GameShell game={twoHumpsManifest} docs={docs} className={styles.app} shortcuts={SHORTCUTS}>
      <main className={styles.main}>
        {screen.kind === "trek" ? (
          <Trek
            key={screen.key}
            session={screen.session}
            units={progress.choices.units}
            sound={sound}
            onExit={toMenu}
            onAgain={() => start(again(screen.session))}
            onNextLeg={nextLeg(screen.session)}
            onFinish={finish(screen.session)}
            onSkipTutorial={skipTutorial}
          />
        ) : screen.kind === "pick" ? (
          <PursuerPick progress={progress} dark={dark} onStart={crossing} onBack={toMenu} onTutorial={tutorial} />
        ) : screen.kind === "map" ? (
          <ExpeditionMap progress={progress} onLeg={(index) => start(legSession(index, progress.choices.difficulty))} onBack={toMenu} />
        ) : screen.kind === "records" ? (
          <Records progress={progress} onBack={toMenu} />
        ) : screen.kind === "terminal" ? (
          <Terminal1982 onExit={toMenu} />
        ) : (
          <Menu
            progress={progress}
            dark={dark}
            howTo={docs.find((d) => d.id === "howtoplay")}
            onCrossing={() => go("pick")}
            onExpedition={() => go("map")}
            onDaily={daily}
            onTerminal={() => go("terminal")}
            onRecords={() => go("records")}
            onTutorial={tutorial}
          />
        )}
      </main>
    </GameShell>
  );
}
