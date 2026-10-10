"use client";

import { useHydrated } from "@/components/kit/hooks";
import { dailyDate } from "@/lib/kit/daily";
import { tenTurnsManifest } from "@/lib/ten-turns/manifest";
import { type PlayStyle, type Progress, updateProgress } from "@/lib/ten-turns/progress";
import panel from "./panel.module.css";
import styles from "./Menu.module.css";

/*
 * The game menu, over the pit playing itself: how to play (the play style),
 * then the ways in.
 */

type Props = {
  progress: Progress;
  onPlay: () => void;
  onDaily: () => void;
  onTerminal: () => void;
  onRecords: () => void;
  onSettings: () => void;
};

const STYLES: { id: PlayStyle | "arena"; name: string; blurb: string; ready: boolean }[] = [
  { id: "classic", name: "Classic", blurb: "The 1970s game, put right: drop in blind, then last ten turns.", ready: true },
  { id: "tactics", name: "Tactics", blurb: "See its next pounce, use burrows, carrots and stones: twenty pits in five chapters.", ready: true },
  { id: "arena", name: "Arena", blurb: "A real-time escape. Coming soon.", ready: false },
];

export function Menu({ progress, onPlay, onDaily, onTerminal, onRecords, onSettings }: Props) {
  const hydrated = useHydrated();
  const style = progress.settings.playStyle;
  const today = hydrated ? dailyDate(new Date(), tenTurnsManifest.daily?.epoch) : null;
  const daily = today ? progress.daily[today.key] : undefined;
  const choose = (playStyle: PlayStyle) => updateProgress((p) => ({ ...p, settings: { ...p.settings, playStyle } }));
  const survived = Object.values(progress.pits).filter((r) => r.best.survived).length;

  return (
    <section className={`${panel.panel} ${styles.menu}`} aria-labelledby="tt-title">
      <p className={panel.kicker}>A pit, ten turns, one hungry rabbit</p>
      <h1 id="tt-title" className={panel.title}>
        Ten Turns <em className={styles.amp}>in the</em> Pit
      </h1>
      <p className={panel.lede}>{tenTurnsManifest.tagline} Last ten turns and a ladder comes down.</p>

      <fieldset className={styles.styles}>
        <legend className={styles.legend}>Play style</legend>
        {STYLES.map((s) => (
          <label key={s.id} className={styles.style} data-checked={s.id === style} data-ready={s.ready}>
            <input type="radio" name="play-style" value={s.id} checked={s.id === style} disabled={!s.ready} onChange={() => s.ready && choose(s.id as PlayStyle)} />
            <span className={styles.styleName}>{s.name}</span>
            <span className={styles.styleBlurb}>{s.blurb}</span>
          </label>
        ))}
      </fieldset>

      <div className={panel.actions}>
        <button type="button" className={panel.primary} onClick={onPlay} data-autofocus>
          <span className={panel.label}>
            {style === "classic" ? "Play Classic" : "Play Tactics"}
            <small>
              {style === "classic"
                ? hydrated && progress.classic.played
                  ? `Out alive ${progress.classic.released + progress.classic.squished} of ${progress.classic.played}`
                  : "Ten turns, one rabbit, no help"
                : hydrated
                  ? `${survived} of 20 pits survived`
                  : "Twenty pits in five chapters"}
            </small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className={panel.secondary} onClick={onDaily}>
          <span className={panel.label}>
            Daily Pit{today ? ` #${today.number}` : ""}
            <small>{daily ? (daily.survived ? "Survived today · play it again for fun" : "Caught today · try again for fun") : "One Tactics pit, the same for everyone"}</small>
          </span>
        </button>
        <button type="button" className={panel.secondary} onClick={onTerminal}>
          <span className={panel.label}>
            1970s mode
            <small>The original on a terminal, every quirk intact</small>
          </span>
        </button>
      </div>

      <div className={panel.row}>
        <button type="button" className={panel.quiet} onClick={onRecords}>
          Records
        </button>
        <button type="button" className={panel.quiet} onClick={onSettings}>
          Game settings
        </button>
      </div>
    </section>
  );
}
