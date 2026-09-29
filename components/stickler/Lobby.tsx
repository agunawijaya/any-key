"use client";

import { useMemo, useState } from "react";
import { dailyPuzzle, LADDER, MODES, VERSUS_PRESETS, type ModeId } from "@/lib/stickler/modes";
import { ACHIEVEMENTS, resetProgress, SKINS, updateProgress, useProgress, type Skin } from "@/lib/stickler/progress";
import { describeRules } from "@/lib/stickler/rules";
import { LEVELS, type Level } from "@/lib/stickler/sparky";
import type { Session } from "./Board";
import { Sparky } from "./Sparky";
import { Stick } from "./Stick";
import styles from "./Lobby.module.css";

type Props = { onPlay: (session: Session) => void; onTerminal: () => void };

export function Lobby({ onPlay, onTerminal }: Props) {
  const progress = useProgress();
  const daily = useMemo(() => dailyPuzzle(), []);
  const [panel, setPanel] = useState<ModeId | null>(null);
  const todays = progress.daily[daily.key];
  const cleared = Object.keys(progress.ladder).length;
  const starCount = Object.values(progress.ladder).reduce((a, b) => a + b, 0);

  const setSkin = (skin: Skin) =>
    updateProgress((p) => ({ ...p, skin, skinsUsed: p.skinsUsed.includes(skin) ? p.skinsUsed : [...p.skinsUsed, skin] }));
  const setLevel = (level: Level) => updateProgress((p) => ({ ...p, level }));

  const playClassic = () => onPlay({ mode: "classic", title: "Classic 23", rules: { rows: [23], maxTake: 3, first: 0 }, level: progress.level });

  function choose(mode: ModeId) {
    if (mode === "classic") playClassic();
    else if (mode === "1981") onTerminal();
    else if (mode === "daily") onPlay({ mode: "daily", title: `Daily #${daily.number}`, rules: daily.rules, level: daily.level, daily: { key: daily.key, number: daily.number } });
    else setPanel(panel === mode ? null : mode);
  }

  return (
    <div className={styles.lobby}>
      <section className={styles.hero}>
        <div className={styles.matchbox}>
          <div className={styles.label}>
            <p className={styles.kicker}>Safety sticks · 23 per box</p>
            <h1 className={styles.wordmark}>Stickler</h1>
            <p className={styles.tagline}>Take 1, 2 or 3. Never the last one.</p>
            <div className={styles.heroSticks} aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Stick key={i} skin={progress.skin} color={i} state={i === 6 ? "burning" : "idle"} style={{ "--tilt": `${(i - 3) * 3}deg`, "--stick-w": "17px" } as React.CSSProperties} />
              ))}
            </div>
            <button type="button" className={styles.cta} onClick={playClassic}>
              Play Classic 23 →
            </button>
          </div>
          <div className={styles.striker} aria-hidden />
        </div>
        <div className={styles.host}>
          <Sparky mood="happy" skin={progress.skin} size={132} />
          <p className={styles.hostBubble}>
            I&rsquo;m Sparky, and I&rsquo;m a <strong>stickler</strong> for rules. The one who takes the last stick loses. Think you can
            make it me?
          </p>
        </div>
      </section>

      <section className={styles.settings} aria-label="Settings">
        <div className={styles.setting}>
          <h2 className={styles.h2}>Sparky&rsquo;s level</h2>
          <div className={styles.segmented} role="radiogroup" aria-label="Sparky's level">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={progress.level === l.id} onClick={() => setLevel(l.id)} title={l.blurb}>
                {l.name}
              </button>
            ))}
          </div>
          <p className={styles.hintText}>{LEVELS.find((l) => l.id === progress.level)?.blurb}. Used in Classic.</p>
        </div>
        <div className={styles.setting}>
          <h2 className={styles.h2}>Stick style</h2>
          <div className={styles.skins} role="radiogroup" aria-label="Stick style">
            {SKINS.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={progress.skin === s.id} className={styles.skin} data-skin={s.id} onClick={() => setSkin(s.id)}>
                <span className={styles.skinSticks} aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <Stick key={i} skin={s.id} color={i + 1} state="idle" style={{ "--stick-w": "12px", "--tilt": `${(i - 1) * 8}deg` } as React.CSSProperties} />
                  ))}
                </span>
                <span className={styles.skinName}>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.modes} aria-label="Modes">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={styles.mode} data-mode={m.id} aria-expanded={m.id === "ladder" || m.id === "versus" ? panel === m.id : undefined} onClick={() => choose(m.id)}>
            <span className={styles.modeEmoji} aria-hidden>
              {m.emoji}
            </span>
            <span className={styles.modeName}>{m.name}</span>
            <span className={styles.modeBlurb}>{m.blurb}</span>
            <span className={styles.modeMeta}>
              {m.id === "ladder" && `${cleared}/10 cleared · ${starCount}★`}
              {m.id === "daily" && (todays ? (todays.won ? "Solved today ✓" : "Burnt today · practice on") : `#${daily.number} · ${describeRules(daily.rules)}`)}
              {m.id === "classic" && `vs ${LEVELS.find((l) => l.id === progress.level)?.name} Sparky`}
              {m.id === "versus" && "2 players"}
              {m.id === "1981" && "green screen"}
            </span>
          </button>
        ))}
      </section>

      {panel === "ladder" && (
        <section className={styles.panel} aria-label="Ladder tables">
          <h2 className={styles.h2}>The Ladder</h2>
          <ol className={styles.ladder}>
            {LADDER.map((t, i) => {
              const stars = progress.ladder[t.id] ?? 0;
              const locked = i > 0 && !progress.ladder[LADDER[i - 1].id];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={styles.table}
                    disabled={locked}
                    onClick={() => onPlay({ mode: "ladder", title: `Ladder ${t.id} · ${t.name}`, rules: t.rules, level: t.level, tableId: t.id })}
                  >
                    <span className={styles.tableNum}>{t.id}</span>
                    <span className={styles.tableName}>{t.name}</span>
                    <span className={styles.tableRules}>{describeRules(t.rules)}</span>
                    <span className={styles.tableBlurb}>{locked ? "Clear the table before to unlock" : t.blurb}</span>
                    <span className={styles.tableStars} aria-label={`${stars} stars`}>
                      {"★".repeat(stars)}
                      <span>{"★".repeat(3 - stars)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {panel === "versus" && (
        <section className={styles.panel} aria-label="Versus tables">
          <h2 className={styles.h2}>Two players, one screen</h2>
          <div className={styles.presets}>
            {VERSUS_PRESETS.map((p) => (
              <button key={p.name} type="button" className={styles.preset} onClick={() => onPlay({ mode: "versus", title: `Versus · ${p.name}`, rules: p.rules, level: null })}>
                <strong>{p.name}</strong>
                <span>{describeRules(p.rules)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={styles.bottom}>
        <div className={styles.achievements}>
          <h2 className={styles.h2}>
            Achievements <span className={styles.count}>{progress.achievements.length}/12</span>
          </h2>
          <ul className={styles.badges}>
            {ACHIEVEMENTS.map((a) => {
              const got = progress.achievements.includes(a.id);
              return (
                <li key={a.id} className={styles.badge} data-got={got || undefined} title={a.how}>
                  <span className={styles.badgeIcon} aria-hidden>
                    {got ? a.icon : "🔒"}
                  </span>
                  <span className={styles.badgeName}>{a.name}</span>
                  <span className={styles.badgeHow}>{a.how}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={styles.stats}>
          <h2 className={styles.h2}>Your record</h2>
          <dl className={styles.statList}>
            <div>
              <dt>Wins</dt>
              <dd>{progress.wins}</dd>
            </div>
            <div>
              <dt>Losses</dt>
              <dd>{progress.losses}</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd>{progress.bestStreak}</dd>
            </div>
          </dl>
          <p className={styles.privacy}>Saved in this browser only.</p>
          <button
            type="button"
            className={styles.reset}
            onClick={() => {
              if (window.confirm("Forget all Stickler progress on this device?")) resetProgress();
            }}
          >
            Reset progress
          </button>
        </div>
      </section>
    </div>
  );
}
