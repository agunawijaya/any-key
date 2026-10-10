"use client";

import { useCallback, useState } from "react";
import { GameShell } from "@/components/kit/GameShell";
import type { DocTab } from "@/components/kit/Story";
import { overShortManifest } from "@/lib/over-short/manifest";
import { freshSeed, type Session } from "@/lib/over-short/playstyles";
import { updateSettings, useProgress } from "@/lib/over-short/progress";
import { Backdrop } from "./Backdrop";
import { CampaignMap } from "./CampaignMap";
import { ClassicBriefing, MissionBriefing } from "./Briefing";
import { eraById } from "./eras";
import { GameSettings } from "./GameSettings";
import { Menu } from "./Menu";
import { FiringScreen } from "./play/FiringScreen";
import { Records } from "./Records";
import ui from "./ui.module.css";
import styles from "./OverShort.module.css";

/*
 * Over / Short: the game menu and the screens it leads to. A game is a
 * session (Classic, or one Campaign mission); the firing screen plays it and
 * reports back when it is over.
 */

type Screen =
  | { kind: "menu" }
  | { kind: "classic" }
  | { kind: "campaign" }
  | { kind: "mission"; id: string }
  | { kind: "records" }
  | { kind: "settings" }
  | { kind: "play"; session: Session; key: number };

const SHORTCUTS = [
  { keys: "↑ ↓", does: "Raise or lower the barrel a degree (Shift: finer)" },
  { keys: "0–9 .", does: "Type an elevation" },
  { keys: "Enter  Space", does: "Fire" },
  { keys: "Space  click", does: "Skip to the fall of shot" },
  { keys: "M  T", does: "The observer's map and the firing table" },
  { keys: "P", does: "Pause" },
];

export function OverShort({ docs }: { docs: DocTab[] }) {
  const progress = useProgress();
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  const era = eraById(progress.settings.era);

  const toMenu = useCallback(() => setScreen({ kind: "menu" }), []);
  const start = useCallback((session: Session) => setScreen({ kind: "play", session, key: Date.now() }), []);
  const classic = () => start({ style: "classic", seed: freshSeed() });
  const mission = (id: string) => start({ style: "campaign", mission: id, seed: freshSeed() });

  const again = (session: Session) => start({ ...session, seed: freshSeed() });

  return (
    <GameShell game={overShortManifest} docs={docs} className={ui.app} shortcuts={SHORTCUTS}>
      <main className={styles.main}>
        {screen.kind === "play" ? (
          <FiringScreen key={screen.key} session={screen.session} era={era} settings={progress.settings} onAgain={() => again(screen.session)} onMenu={toMenu} onNextMission={(id) => setScreen({ kind: "mission", id })} />
        ) : (
          <>
            <Backdrop era={era} />
            <div className={styles.over}>
              {screen.kind === "classic" ? (
                <ClassicBriefing units={progress.settings.units} onStart={classic} onBack={toMenu} />
              ) : screen.kind === "campaign" ? (
                <CampaignMap progress={progress} era={era} onMission={(id) => setScreen({ kind: "mission", id })} onBack={toMenu} />
              ) : screen.kind === "mission" ? (
                <MissionBriefing id={screen.id} progress={progress} era={era} onStart={() => mission(screen.id)} onBack={() => setScreen({ kind: "campaign" })} />
              ) : screen.kind === "records" ? (
                <Records progress={progress} onBack={toMenu} />
              ) : screen.kind === "settings" ? (
                <GameSettings progress={progress} onBack={toMenu} />
              ) : (
                <Menu
                  progress={progress}
                  onClassic={() => {
                    updateSettings({ style: "classic" });
                    setScreen({ kind: "classic" });
                  }}
                  onCampaign={() => {
                    updateSettings({ style: "campaign" });
                    setScreen({ kind: "campaign" });
                  }}
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
