"use client";

import { useCallback, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import type { DocTab } from "@/components/kit/Story";
import { dailyBarrage } from "@/lib/over-short/daily";
import type { DuelPlayer } from "@/lib/over-short/duel";
import { overShortManifest } from "@/lib/over-short/manifest";
import { freshSeed, type PlayStyleId, type Session } from "@/lib/over-short/playstyles";
import { updateSettings, useProgress } from "@/lib/over-short/progress";
import type { Program } from "@/lib/over-short/terminal";
import { Backdrop } from "./Backdrop";
import { CampaignMap } from "./CampaignMap";
import { ClassicBriefing, MissionBriefing } from "./Briefing";
import { DuelScreen } from "./duel/DuelScreen";
import { DuelSetup } from "./duel/DuelSetup";
import { eraById } from "./eras";
import { DailyBriefing, FieldBriefing, FieldMissions } from "./field/FieldMissions";
import type { FieldSession } from "./field/FieldOutcome";
import { FieldScreen } from "./field/FieldScreen";
import { GameSettings } from "./GameSettings";
import { Menu } from "./Menu";
import { FiringScreen } from "./play/FiringScreen";
import { Records } from "./Records";
import { Terminals } from "./terminal/Terminals";
import { TerminalScreen } from "./terminal/TerminalScreen";
import ui from "./ui.module.css";
import styles from "./OverShort.module.css";

/*
 * Over / Short: the game menu and the screens it leads to. A game is a
 * session (Classic, a Campaign mission, a Field Artillery shoot or the
 * Daily Barrage, a duel, a 1970s terminal); its screen plays it and reports
 * back when it is over.
 */

type Screen =
  | { kind: "menu" }
  | { kind: "classic" }
  | { kind: "campaign" }
  | { kind: "mission"; id: string }
  | { kind: "field" }
  | { kind: "field-mission"; id: string }
  | { kind: "daily" }
  | { kind: "duel" }
  | { kind: "terminals" }
  | { kind: "records" }
  | { kind: "settings" }
  | { kind: "play"; session: Session; key: number }
  | { kind: "field-play"; session: FieldSession; key: number }
  | { kind: "duel-play"; west: DuelPlayer; east: DuelPlayer; seed: string; key: number }
  | { kind: "terminal"; program: Program; key: number };

const SHORTCUTS = [
  { keys: "↑ ↓", does: "Raise or lower the barrel a degree (Shift: finer)" },
  { keys: "← →", does: "Field Artillery: lay the line a mil left or right (Shift: ten)" },
  { keys: "C", does: "Field Artillery: the next charge (Shift: the one before)" },
  { keys: "0–9 .", does: "Type an elevation" },
  { keys: "Enter  Space", does: "Fire" },
  { keys: "Space  click", does: "Skip to the fall of shot" },
  { keys: "M  T", does: "The observer's map and the firing table" },
  { keys: "L  R", does: "Field Artillery: a star shell; move the gun" },
  { keys: "P", does: "Pause" },
];

export function OverShort({ docs }: { docs: DocTab[] }) {
  const progress = useProgress();
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  const era = eraById(progress.settings.era);

  const toMenu = useCallback(() => setScreen({ kind: "menu" }), []);
  const start = useCallback((session: Session) => setScreen({ kind: "play", session, key: Date.now() }), []);
  const startField = useCallback((session: FieldSession) => setScreen({ kind: "field-play", session, key: Date.now() }), []);
  const classic = () => start({ style: "classic", seed: freshSeed() });
  const mission = (id: string) => start({ style: "campaign", mission: id, seed: freshSeed() });
  const fieldMission = (id: string) => startField({ kind: "mission", mission: id, seed: freshSeed(), difficulty: progress.settings.difficulty });
  const daily = () => startField({ kind: "daily", daily: dailyBarrage() });
  const go = (style: PlayStyleId, next: Screen) => {
    updateSettings({ style });
    setScreen(next);
  };

  const again = (session: Session) => start({ ...session, seed: freshSeed() });
  const againField = (session: FieldSession) => startField(session.kind === "daily" ? { ...session, daily: dailyBarrage() } : { ...session, seed: freshSeed(), difficulty: progress.settings.difficulty });

  const playing = screen.kind === "play" || screen.kind === "field-play" || screen.kind === "duel-play" || screen.kind === "terminal";

  return (
    <GameShell game={overShortManifest} docs={docs} className={ui.app} shortcuts={SHORTCUTS}>
      <main className={styles.main}>
        {screen.kind === "play" && (
          <FiringScreen key={screen.key} session={screen.session} era={era} settings={progress.settings} onAgain={() => again(screen.session)} onMenu={toMenu} onNextMission={(id) => setScreen({ kind: "mission", id })} />
        )}
        {screen.kind === "field-play" && (
          <FieldScreen
            key={screen.key}
            session={screen.session}
            era={era}
            settings={progress.settings}
            onAgain={() => againField(screen.session)}
            onMenu={toMenu}
            onNextMission={(id) => setScreen({ kind: "field-mission", id })}
          />
        )}
        {screen.kind === "duel-play" && (
          <DuelScreen
            key={screen.key}
            west={screen.west}
            east={screen.east}
            seed={screen.seed}
            era={era}
            settings={progress.settings}
            onAgain={() => setScreen({ ...screen, seed: freshSeed(), key: Date.now() })}
            onMenu={toMenu}
          />
        )}
        {screen.kind === "terminal" && <TerminalScreen key={screen.key} program={screen.program} onMenu={toMenu} onOther={(program) => setScreen({ kind: "terminal", program, key: Date.now() })} />}
        {!playing && (
          <>
            <Backdrop era={era} />
            <div className={styles.over}>
              {screen.kind === "classic" ? (
                <ClassicBriefing units={progress.settings.units} onStart={classic} onBack={toMenu} />
              ) : screen.kind === "campaign" ? (
                <CampaignMap progress={progress} era={era} onMission={(id) => setScreen({ kind: "mission", id })} onBack={toMenu} />
              ) : screen.kind === "mission" ? (
                <MissionBriefing id={screen.id} progress={progress} era={era} onStart={() => mission(screen.id)} onBack={() => setScreen({ kind: "campaign" })} />
              ) : screen.kind === "field" ? (
                <FieldMissions progress={progress} era={era} onMission={(id) => setScreen({ kind: "field-mission", id })} onBack={toMenu} />
              ) : screen.kind === "field-mission" ? (
                <FieldBriefing id={screen.id} progress={progress} era={era} onStart={() => fieldMission(screen.id)} onBack={() => setScreen({ kind: "field" })} />
              ) : screen.kind === "daily" ? (
                <DailyBriefing daily={dailyBarrage()} progress={progress} era={era} onStart={daily} onBack={toMenu} />
              ) : screen.kind === "duel" ? (
                <DuelSetup progress={progress} onStart={(west, east) => setScreen({ kind: "duel-play", west, east, seed: freshSeed(), key: Date.now() })} onBack={toMenu} />
              ) : screen.kind === "terminals" ? (
                <Terminals progress={progress} onOpen={(program) => setScreen({ kind: "terminal", program, key: Date.now() })} onBack={toMenu} />
              ) : screen.kind === "records" ? (
                <Records progress={progress} onBack={toMenu} />
              ) : screen.kind === "settings" ? (
                <GameSettings progress={progress} onBack={toMenu} />
              ) : (
                <Menu
                  progress={progress}
                  onClassic={() => go("classic", { kind: "classic" })}
                  onCampaign={() => go("campaign", { kind: "campaign" })}
                  onField={() => go("field", { kind: "field" })}
                  onDuel={() => go("duel", { kind: "duel" })}
                  onDaily={() => go("daily", { kind: "daily" })}
                  onTerminals={() => go("terminals", { kind: "terminals" })}
                  onRecords={() => setScreen({ kind: "records" })}
                  onSettings={() => setScreen({ kind: "settings" })}
                />
              )}
            </div>
          </>
        )}
      </main>
    </GameShell>
  );
}
