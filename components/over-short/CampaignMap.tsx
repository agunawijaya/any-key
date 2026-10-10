"use client";

import { useHydrated } from "@/components/kit/hooks";
import { chapterOpen, CHAPTERS, missionsIn } from "@/lib/over-short/missions";
import type { Progress } from "@/lib/over-short/progress";
import type { Era } from "./eras/types";
import { MedalIcon } from "./icons";
import ui from "./ui.module.css";
import styles from "./CampaignMap.module.css";

/*
 * The Campaign: five chapters of four missions. A chapter opens when the
 * last mission of the one before has been won; inside an open chapter the
 * missions can be flown in any order.
 */

type Props = { progress: Progress; era: Era; onMission: (id: string) => void; onBack: () => void };

export function CampaignMap({ progress, era, onMission, onBack }: Props) {
  const hydrated = useHydrated();
  const won = (id: string) => hydrated && (progress.campaign.missions[id]?.wins ?? 0) > 0;
  return (
    <section className={`${ui.panel} ${styles.map}`} aria-labelledby="os-campaign-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <div>
        <p className={ui.kicker}>Campaign · {era.name}</p>
        <h2 id="os-campaign-title" className={`${ui.heading} ${styles.heading}`}>
          Breaking the formula
        </h2>
      </div>
      <ol className={styles.chapters}>
        {CHAPTERS.map((chapter) => {
          const open = chapterOpen(chapter.chapter, won);
          const missions = missionsIn(chapter.chapter);
          const before = missionsIn(chapter.chapter - 1);
          return (
            <li key={chapter.chapter} className={styles.chapter} data-open={open}>
              <div className={styles.chapterHead}>
                <span className={styles.number}>{chapter.chapter}</span>
                <span>
                  <strong>{chapter.title}</strong>
                  <small>{open ? chapter.lesson : `Win mission ${before[before.length - 1]?.id} to open`}</small>
                </span>
              </div>
              <div className={styles.missions}>
                {missions.map((m) => {
                  const record = hydrated ? progress.campaign.missions[m.id] : undefined;
                  return (
                    <button key={m.id} type="button" className={styles.mission} disabled={!open} onClick={() => onMission(m.id)} data-won={!!record?.wins}>
                      <span className={styles.missionId}>{m.id}</span>
                      <span className={styles.missionTitle}>{m.title}</span>
                      <span className={styles.missionMedal}>{record?.medal ? <MedalIcon medal={record.medal} size={20} /> : <span className={styles.empty} aria-label="Not yet won" />}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
