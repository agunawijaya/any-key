"use client";

import { useHydrated } from "@/components/kit/hooks";
import { CHAPTERS, missionsIn, MISSIONS } from "@/lib/over-short/missions";
import { bandFilled, TABLE_BANDS, type Progress } from "@/lib/over-short/progress";
import { MedalIcon } from "./icons";
import ui from "./ui.module.css";
import styles from "./Records.module.css";

/** What the player has done, per play style. Keycaps live in the Keyring. */
export function Records({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const hydrated = useHydrated();
  const c = progress.classic;
  const missions = progress.campaign.missions;
  const medals = { gold: 0, silver: 0, bronze: 0 };
  for (const m of MISSIONS) {
    const medal = missions[m.id]?.medal;
    if (medal) medals[medal]++;
  }
  const bands = TABLE_BANDS.filter((b) => bandFilled(progress.campaign.table, b)).length;
  const won = MISSIONS.filter((m) => (missions[m.id]?.wins ?? 0) > 0).length;

  return (
    <section className={`${ui.panel} ${styles.records}`} aria-labelledby="os-records-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <div>
        <p className={ui.kicker}>Over / Short</p>
        <h2 id="os-records-title" className={ui.heading}>
          Records
        </h2>
      </div>
      {hydrated && (
        <div className={styles.columns}>
          <div>
            <h3 className={styles.title}>Classic</h3>
            <dl className={styles.figures}>
              <div>
                <dt>Games</dt>
                <dd>{c.games}</dd>
              </div>
              <div>
                <dt>All five down</dt>
                <dd>{c.complete}</dd>
              </div>
              <div>
                <dt>18 or fewer</dt>
                <dd>{c.standard}</dd>
              </div>
              <div>
                <dt>Best game</dt>
                <dd>{c.best === null ? "–" : `${c.best} rounds`}</dd>
              </div>
              <div>
                <dt>First-round hits</dt>
                <dd>{c.targets ? `${c.firstRoundHits} of ${c.targets}` : "–"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className={styles.title}>Campaign</h3>
            <dl className={styles.figures}>
              <div>
                <dt>Missions won</dt>
                <dd>
                  {won} of {MISSIONS.length}
                </dd>
              </div>
              <div>
                <dt>Medals</dt>
                <dd className={styles.medals}>
                  <MedalIcon medal="gold" /> {medals.gold} <MedalIcon medal="silver" /> {medals.silver} <MedalIcon medal="bronze" /> {medals.bronze}
                </dd>
              </div>
              <div>
                <dt>Range table</dt>
                <dd>
                  {bands} of {TABLE_BANDS.length} rows
                </dd>
              </div>
            </dl>
            <table className={styles.table}>
              <caption className={ui.srOnly}>Best rounds per mission</caption>
              <tbody>
                {CHAPTERS.map((chapter) => (
                  <tr key={chapter.chapter}>
                    <th scope="row">{chapter.chapter}</th>
                    {missionsIn(chapter.chapter).map((m) => {
                      const r = missions[m.id];
                      return (
                        <td key={m.id} title={m.title}>
                          {r?.medal ? <MedalIcon medal={r.medal} size={14} /> : null}
                          <span>{r?.best ?? "·"}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className={styles.note}>Keycaps are in the Keyring.</p>
    </section>
  );
}
