"use client";

import { useEffect, useMemo, useState } from "react";
import { DIFFICULTIES, withDifficulty, type Difficulty } from "@/lib/lander/difficulty";
import { NAMED_SITES, randomSeed, type FreeStart } from "@/lib/lander/freeflight";
import { dailyDrop, dailySetup, MISSIONS, missionSetup, type Mission } from "@/lib/lander/missions";
import { makeSetup } from "@/lib/lander/physics";
import { BadgeCap, badgeText } from "@/components/kit/BadgeCap";
import { Stars } from "@/components/kit/Stars";
import { FlagIcon, MoonIcon, SunIcon, TargetIcon } from "@/components/kit/icons";
import { ForgetButton } from "@/components/kit/ForgetButton";
import { FuelMark, GradeIcon, ModeIcon, RulerIcon, ScanIcon, WorldIcon } from "./icons";
import { landerManifest } from "@/lib/lander/manifest";
import { resetProgress, updateProgress, useProgress } from "@/lib/lander/progress";
import { worldById, WORLDS, type WorldId } from "@/lib/lander/worlds";
import type { Session } from "./Flight";
import { fmtSpeed } from "@/lib/lander/format";
import { Flag, FlagDesigner } from "./FlagDesigner";
import type { FreeSpec } from "./FreeFlight";
import { Postcard } from "./Postcard";
import styles from "./Lobby.module.css";

type Props = { onPlay: (s: Session) => void; onFree: (spec: FreeSpec) => void; onTerminal: () => void };

export function missionSession(m: Mission, guide: boolean, assist: boolean, difficulty: Difficulty): Session {
  return { mode: "mission", title: `Mission ${m.id} · ${m.name}`, world: m.world, setup: withDifficulty(missionSetup(m), difficulty), guide: guide && !m.noGuide, assist: assist && !m.noGuide, mission: m, difficulty };
}

/** Named sites unlock in order: one star on a site opens the next. */
export function siteUnlocked(index: number, sites: Record<string, { stars: number }>) {
  return index === 0 || (sites[NAMED_SITES[index - 1].id]?.stars ?? 0) > 0;
}

export function Lobby({ onPlay, onFree, onTerminal }: Props) {
  const progress = useProgress();
  const daily = useMemo(() => dailyDrop(), []);
  const [panel, setPanel] = useState<"missions" | "flag" | "free" | null>(null);
  const [seedText, setSeedText] = useState("");

  // Esc closes an open panel first; with none open, the shell takes the player back to the Hall.
  useEffect(() => {
    if (!panel) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPanel(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [panel]);
  const world = worldById(progress.world);
  const today = progress.daily[daily.key];
  const cleared = MISSIONS.filter((m) => progress.missions[m.id]).length;
  const stars = Object.values(progress.missions).reduce((a, b) => a + b, 0);

  const pick = (id: WorldId) => updateProgress((p) => ({ ...p, world: id }));
  const difficulty = progress.difficulty;
  const live = () => onPlay({ mode: "live", title: `Live · ${world.name}`, world: world.id, setup: withDifficulty(makeSetup(world), difficulty), guide: progress.guide, assist: progress.assist, difficulty });
  const ten = () => onPlay({ mode: "ten", title: `Ten-Second · ${world.name}`, world: world.id, setup: withDifficulty(makeSetup(world), difficulty), guide: progress.guide, assist: progress.assist, difficulty });
  const siteStars = NAMED_SITES.reduce((a, n) => a + (progress.sites[n.id]?.stars ?? 0), 0);
  const flyFree = (pick: FreeSpec["pick"], worldId = world.id) => onFree({ world: worldId, start: progress.freeStart, pick, difficulty });
  const flySeed = () => {
    const typed = Number.parseInt(seedText.replace(/\D/g, ""), 10);
    const seed = typed > 0 ? Math.min(typed, 999_999) : randomSeed();
    flyFree({ seed });
  };
  const setStart = (start: FreeStart) => updateProgress((p) => ({ ...p, freeStart: start }));
  const playDaily = () => {
    const w = worldById(daily.world);
    onPlay({ mode: "daily", title: `Daily Drop #${daily.number}`, world: w.id, setup: withDifficulty(dailySetup(daily), difficulty), guide: progress.guide, assist: progress.assist, daily, difficulty });
  };

  return (
    <div className={styles.lobby}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>A descent simulator · first flown in 1979</p>
          <h1 className={styles.wordmark}>
            Don&rsquo;t
            <br />
            Crater
          </h1>
          <p className={styles.tagline}>
            You&rsquo;re falling at <strong>5,000 km/h</strong>. Touch down under 20 to walk away. Under 5, and you get to plant your flag.
          </p>
          <div className={styles.ctaRow}>
            <button type="button" className={styles.cta} onClick={live}>
              Fly to {world.id === "moon" ? "the Moon" : world.name} →
            </button>
            <button type="button" className={styles.flagButton} onClick={() => setPanel(panel === "flag" ? null : "flag")} aria-expanded={panel === "flag"}>
              <Flag design={progress.flag} id="lobby-mini" waving={false} className={styles.miniFlag} />
              Your flag
            </button>
          </div>
          <p className={styles.themeNote}>
            <SunIcon size={14} /> Light theme lands on the day side. <MoonIcon size={14} /> Dark theme, the night side.
          </p>
        </div>
        <Postcard world={world} size="hero" className={styles.heroCard} />
      </section>

      {panel === "flag" && <FlagDesigner design={progress.flag} unlocked={progress.achievements} onChange={(flag) => updateProgress((p) => ({ ...p, flag }))} onClose={() => setPanel(null)} />}

      <section className={styles.worlds} aria-label="Choose a world">
        <h2 className={styles.h2}>Pick a world</h2>
        <div className={styles.worldGrid} role="radiogroup" aria-label="World">
          {WORLDS.map((w) => {
            const best = progress.best[w.id];
            return (
              <button key={w.id} type="button" role="radio" aria-checked={w.id === world.id} className={styles.world} onClick={() => pick(w.id)}>
                <Postcard world={w} lander={w.id === world.id} />
                <span className={styles.worldInfo}>
                  <span className={styles.worldTag}>{w.tagline}</span>
                  <span className={styles.worldBest}>
                    {best !== undefined ? `Best ${fmtSpeed(best)}` : "Not landed yet"}
                    {progress.flagged.includes(w.id) && (
                      <span title="Flag planted">
                        {" "}
                        · <FlagIcon size={13} />
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.modes} aria-label="Ways to fly">
        <button type="button" className={styles.mode} data-mode="live" onClick={live}>
          <span className={styles.modeIcon} aria-hidden>
            <ModeIcon mode="live" size={26} />
          </span>
          <span className={styles.modeName}>Live</span>
          <span className={styles.modeBlurb}>Real time, with a throttle lever and time warp while nothing&rsquo;s happening.</span>
          <span className={styles.modeMeta}>
            <WorldIcon world={world.id} size={14} /> {world.name}
          </span>
        </button>
        <button type="button" className={styles.mode} data-mode="free" onClick={() => setPanel(panel === "free" ? null : "free")} aria-expanded={panel === "free"}>
          <span className={styles.modeIcon} aria-hidden>
            <ModeIcon mode="free" size={26} />
          </span>
          <span className={styles.modeName}>Free Flight</span>
          <span className={styles.modeBlurb}>Tilt, kill your drift, and put it down on a ledge between the rocks.</span>
          <span className={styles.modeMeta}>
            <WorldIcon world={world.id} size={14} /> {world.name} · {siteStars} of 18 stars
          </span>
        </button>
        <button type="button" className={styles.mode} data-mode="ten" onClick={ten}>
          <span className={styles.modeIcon} aria-hidden>
            <ModeIcon mode="ten" size={26} />
          </span>
          <span className={styles.modeName}>Ten-Second</span>
          <span className={styles.modeBlurb}>The original rhythm: set a burn, watch ten seconds play out, see where it takes you.</span>
          <span className={styles.modeMeta}>
            <WorldIcon world={world.id} size={14} /> {world.name}
          </span>
        </button>
        <button type="button" className={styles.mode} data-mode="missions" onClick={() => setPanel(panel === "missions" ? null : "missions")} aria-expanded={panel === "missions"}>
          <span className={styles.modeIcon} aria-hidden>
            <ModeIcon mode="missions" size={26} />
          </span>
          <span className={styles.modeName}>Missions</span>
          <span className={styles.modeBlurb}>Ten landings with a twist: cargo, short tanks, hot entries, dead instruments.</span>
          <span className={styles.modeMeta}>
            {cleared}/10 cleared · {stars} of 30 stars
          </span>
        </button>
        <button type="button" className={styles.mode} data-mode="daily" onClick={playDaily}>
          <span className={styles.modeIcon} aria-hidden>
            <ModeIcon mode="daily" size={26} />
          </span>
          <span className={styles.modeName}>Daily Drop</span>
          <span className={styles.modeBlurb}>Everyone gets the same world, speed and load today. Your first try counts.</span>
          <span className={styles.modeMeta}>
            {today ? (
              <>
                <GradeIcon grade={today.grade} size={14} /> {fmtSpeed(today.speed)} today · practice on
              </>
            ) : (
              <>
                #{daily.number} · <WorldIcon world={daily.world} size={14} /> {worldById(daily.world).name} · {daily.speed.toLocaleString("en-US")} km/h
              </>
            )}
          </span>
        </button>
        <button type="button" className={styles.mode} data-mode="1979" onClick={onTerminal}>
          <span className={styles.modeIcon} aria-hidden>
            <ModeIcon mode="1979" size={26} />
          </span>
          <span className={styles.modeName}>1979 mode</span>
          <span className={styles.modeBlurb}>The original: type a burn rate every ten seconds on a blocky black-and-white screen.</span>
          <span className={styles.modeMeta}>exact 1979 maths</span>
        </button>
      </section>

      <div className={styles.toggles}>
        <div className={styles.fuelSetting} role="radiogroup" aria-label="Fuel">
          <span className={styles.fuelLabel}>
            <strong>Fuel</strong> · for every mode but 1979 mode
          </span>
          <span className={styles.fuelOptions}>
            {DIFFICULTIES.map((d) => (
              <button key={d.id} type="button" role="radio" aria-checked={difficulty === d.id} className={styles.fuelOption} onClick={() => updateProgress((p) => ({ ...p, difficulty: d.id }))} title={d.how}>
                <FuelMark difficulty={d.id} />
                {d.name}
              </button>
            ))}
          </span>
          <span className={styles.fuelHow}>{DIFFICULTIES.find((d) => d.id === difficulty)!.how}</span>
        </div>
        <label className={styles.guideToggle}>
          <input type="checkbox" checked={progress.guide} onChange={(e) => updateProgress((p) => ({ ...p, guide: e.target.checked }))} />
          <span className={styles.switch} aria-hidden />
          <span>
            <strong>Burn guide</strong> · shows where a full burn would stop you, and when to start. Turn it off once you&rsquo;ve got the feel.
          </span>
        </label>
        <label className={styles.guideToggle}>
          <input type="checkbox" checked={progress.assist} onChange={(e) => updateProgress((p) => ({ ...p, assist: e.target.checked }))} />
          <span className={styles.switch} aria-hidden />
          <span className={styles.assistText}>
            <strong>Landing assist</strong> · two lines to fly by. Keep the lander above the <em className={styles.soft}>green line</em> to land under
            5 km/h and plant your flag; never let it sink below the <em className={styles.limit}>amber line</em>, the 20 km/h limit.
          </span>
        </label>
      </div>

      {panel === "free" && (
        <section className={`${styles.panel} ${styles.freePanel}`} aria-label="Free Flight">
          <div className={styles.freeHead}>
            <div>
              <h2 className={styles.h2}>Free Flight</h2>
              <p className={styles.freeLead}>
                Lean with <kbd>←</kbd> <kbd>→</kbd> to steer. Your landing site is planned and marked <b className={styles.landHere}>LAND HERE</b>: get there, kill your drift, and come down upright. The ground around it is rough; any flat ground (under 8°, 8 m wide for your feet) saves you, but only the target earns all three stars.
              </p>
            </div>
            <div className={styles.startChoice} role="radiogroup" aria-label="Start">
              {(
                [
                  ["final", "Final approach", "From 3 km up. Short and replayable."],
                  ["full", "Full descent", "From orbit height at 5,000 km/h, drifting sideways."],
                ] as const
              ).map(([id, name, how]) => (
                <button key={id} type="button" role="radio" aria-checked={progress.freeStart === id} className={styles.startOption} onClick={() => setStart(id)}>
                  <strong>{name}</strong>
                  <span>{how}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.freeRow}>
            <button type="button" className={styles.cta} onClick={() => flyFree({ seed: randomSeed() })}>
              New site on {world.id === "moon" ? "the Moon" : world.name} →
            </button>
            <label className={styles.seedField}>
              <span>Site #</span>
              <input
                inputMode="numeric"
                placeholder={progress.freeSeed ? String(progress.freeSeed) : "48213"}
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") flySeed();
                }}
                aria-label="Site number to replay"
              />
              <button type="button" onClick={flySeed}>
                Fly
              </button>
            </label>
            <label className={`${styles.guideToggle} ${styles.scanToggle}`}>
              <input type="checkbox" checked={progress.scan} onChange={(e) => updateProgress((p) => ({ ...p, scan: e.target.checked }))} />
              <span className={styles.switch} aria-hidden />
              <span>
                <strong>Scan assist</strong> · shades the ground near you <em className={styles.soft}>green</em> where it is flat enough. Flights with it get a <ScanIcon size={14} />.
              </span>
            </label>
          </div>
          <h3 className={styles.h3}>Named sites</h3>
          <ol className={styles.sites}>
            {NAMED_SITES.map((n, i) => {
              const best = progress.sites[n.id];
              const open = siteUnlocked(i, progress.sites);
              const w = worldById(n.world);
              return (
                <li key={n.id}>
                  <button type="button" className={styles.site} data-world={n.world} disabled={!open} onClick={() => flyFree({ named: n.id }, n.world)}>
                    <span className={styles.siteName}>
                      <WorldIcon world={w.id} size={15} /> {n.name}
                    </span>
                    <span className={styles.missionBlurb}>{open ? n.blurb : "Earn a star on the site before to unlock"}</span>
                    <span className={styles.siteMeta}>
                      <Stars value={best?.stars ?? 0} className={styles.siteStars} size={14} />
                      {best?.narrow && (
                        <span title="Stood on a narrow ledge">
                          <RulerIcon size={15} />
                        </span>
                      )}
                      {best?.centre && (
                        <span title="Dead centre">
                          <TargetIcon size={15} />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {panel === "missions" && (
        <section className={styles.panel} aria-label="Missions">
          <h2 className={styles.h2}>Missions</h2>
          <ol className={styles.missions}>
            {MISSIONS.map((m, i) => {
              const got = progress.missions[m.id] ?? 0;
              const locked = i > 0 && !progress.missions[MISSIONS[i - 1].id];
              const w = worldById(m.world);
              return (
                <li key={m.id}>
                  <button type="button" className={styles.mission} disabled={locked} onClick={() => onPlay(missionSession(m, progress.guide, progress.assist, difficulty))}>
                    <span className={styles.missionNum}>{m.id}</span>
                    <span className={styles.missionName}>
                      {m.name} <WorldIcon world={w.id} size={15} />
                    </span>
                    <span className={styles.missionBlurb}>{locked ? "Clear the mission before to unlock" : m.blurb}</span>
                    <Stars value={got} className={styles.missionStars} size={14} />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className={styles.bottom}>
        <div>
          <h2 className={styles.h2}>
            Achievements <span className={styles.count}>{progress.achievements.length}/{landerManifest.achievements.length}</span>
          </h2>
          <ul className={styles.badges}>
            {landerManifest.achievements.map((a) => {
              const got = progress.achievements.includes(a.id);
              const { title, hint } = badgeText(a, got);
              return (
                <li key={a.id} className={styles.badge} data-got={got || undefined} title={hint}>
                  <span className={styles.badgeIcon} aria-hidden>
                    <BadgeCap game={landerManifest} achievement={a} earned={got} />
                  </span>
                  <span className={styles.badgeName}>{title}</span>
                  <span className={styles.badgeHow}>{hint}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={styles.stats}>
          <h2 className={styles.h2}>Flight log</h2>
          <dl className={styles.statList}>
            <div>
              <dt>Flights</dt>
              <dd>{progress.flights}</dd>
            </div>
            <div>
              <dt>Landings</dt>
              <dd>{progress.landings}</dd>
            </div>
            <div>
              <dt>Craters</dt>
              <dd>{progress.craters}</dd>
            </div>
          </dl>
          <p className={styles.privacy}>Saved in this browser only.</p>
          <ForgetButton gameTitle="Don't Crater" keeps="Your flag stays." onForget={resetProgress} className={styles.reset} />
        </div>
      </section>
    </div>
  );
}
