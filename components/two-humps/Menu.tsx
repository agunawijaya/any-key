"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/kit/Dialog";
import { useHydrated } from "@/components/kit/hooks";
import { MoonIcon, SunIcon } from "@/components/kit/icons";
import type { DocTab } from "@/components/kit/Story";
import { dailyFor } from "@/lib/two-humps/daily";
import { LEGS } from "@/lib/two-humps/expedition";
import { twoHumpsManifest } from "@/lib/two-humps/manifest";
import type { Progress } from "@/lib/two-humps/progress";
import { PURSUER_NAMES } from "@/lib/two-humps/share";
import { CampIcon, JournalIcon, MapIcon, TerminalIcon, WalkIcon } from "./icons";
import { SceneCanvas } from "./SceneCanvas";
import { demoScene } from "./scene/demo";
import styles from "./Menu.module.css";

/*
 * The game menu: the trek going on by itself on the right, and on the left
 * the ways to play it. The panorama follows the appearance: a golden morning
 * in light, the blue hour in dark, with the player's last pursuer behind.
 */

type Props = {
  progress: Progress;
  dark: boolean;
  howTo?: DocTab;
  onCrossing: () => void;
  onExpedition: () => void;
  onDaily: () => void;
  onTerminal: () => void;
  onRecords: () => void;
  onTutorial: () => void;
};

export function Menu({ progress, dark, howTo, onCrossing, onExpedition, onDaily, onTerminal, onRecords, onTutorial }: Props) {
  const hydrated = useHydrated();
  const [reading, setReading] = useState(false);
  const pursuer = progress.choices.pursuer;
  const panorama = useMemo(() => demoScene(pursuer, dark ? 19.3 : 7.1, { anchor: 0.68 }), [pursuer, dark]);
  const today = hydrated ? dailyFor() : null;
  const todayDone = today ? progress.daily[today.key] : undefined;
  const leg = LEGS[progress.expedition.leg];

  return (
    <div className={styles.menu}>
      <SceneCanvas className={styles.canvas} hooks={panorama.hooks} frame={panorama.frame} label={`A Bactrian camel and its rider trek across the Gobi, with ${PURSUER_NAMES[pursuer]} following.`} />

      <section className={styles.panel} aria-labelledby="two-humps-title">
        <p className={styles.kicker}>A survival trek · first crossed in 1982</p>
        <h1 id="two-humps-title" className={styles.wordmark}>
          Two <em>Humps</em>
        </h1>
        <p className={styles.tagline}>Forty miles of Gobi on a camel with a mind of its own. Something is coming up behind you.</p>

        {!progress.tutorialSeen && (
          <button type="button" className={styles.firstTime} onClick={onTutorial}>
            <strong>New here?</strong> Take the one-minute tutorial <span aria-hidden>→</span>
          </button>
        )}

        <nav className={styles.modes} aria-label="Ways to play">
          <button type="button" className={styles.mode} data-primary onClick={onCrossing}>
            <span className={styles.modeIcon} aria-hidden>
              <WalkIcon size={26} />
            </span>
            <span className={styles.modeText}>
              <span className={styles.modeName}>Crossing</span>
              <span className={styles.modeBlurb}>Forty miles, with a storm, a rival or a gang of jerboas behind you.</span>
            </span>
            <span className={styles.modeMeta}>{progress.plays ? `${progress.wins} of ${progress.plays} won` : "Start here"}</span>
          </button>
          <button type="button" className={styles.mode} onClick={onExpedition}>
            <span className={styles.modeIcon} aria-hidden>
              <MapIcon size={26} />
            </span>
            <span className={styles.modeText}>
              <span className={styles.modeName}>Expedition</span>
              <span className={styles.modeBlurb}>Five legs through real places in the Gobi.</span>
            </span>
            <span className={styles.modeMeta}>{progress.expedition.leg > 0 ? `Leg ${progress.expedition.leg + 1} · ${leg.place}` : progress.expedition.finished ? `Crossed ×${progress.expedition.finished}` : "5 legs"}</span>
          </button>
          <button type="button" className={styles.mode} onClick={onDaily} disabled={!today}>
            <span className={styles.modeIcon} aria-hidden>
              <CampIcon size={26} />
            </span>
            <span className={styles.modeText}>
              <span className={styles.modeName}>Daily Crossing</span>
              <span className={styles.modeBlurb}>{todayDone ? "Done for today. Again for practice?" : "The same desert for everyone today."}</span>
            </span>
            <span className={styles.modeMeta}>
              {today ? (todayDone ? (todayDone.won ? `Won in ${todayDone.turns} turns` : "Not this time") : `#${today.number} · ${PURSUER_NAMES[today.config.pursuer]}`) : " "}
            </span>
          </button>
          <button type="button" className={styles.mode} onClick={onTerminal}>
            <span className={styles.modeIcon} aria-hidden>
              <TerminalIcon size={26} />
            </span>
            <span className={styles.modeText}>
              <span className={styles.modeName}>1982 mode</span>
              <span className={styles.modeBlurb}>The original rules and bugs, typed into a terminal.</span>
            </span>
            <span className={styles.modeMeta}>{progress.original.plays ? `${progress.original.wins} of ${progress.original.plays} made it` : "IBM PC, 1982"}</span>
          </button>
        </nav>

        <div className={styles.links}>
          <button type="button" className={styles.link} onClick={onRecords}>
            <JournalIcon size={18} /> Records and settings
          </button>
          {howTo && (
            <button type="button" className={styles.link} onClick={() => setReading(true)}>
              How to play
            </button>
          )}
          {progress.tutorialSeen && (
            <button type="button" className={styles.link} onClick={onTutorial}>
              Tutorial
            </button>
          )}
        </div>

        {today && (
          <aside className={styles.trivia} aria-label="From the field journal">
            <p className={styles.triviaKicker}>From the field journal</p>
            <p>{twoHumpsManifest.trivia[today.number % twoHumpsManifest.trivia.length]}</p>
          </aside>
        )}

        <p className={styles.themeNote}>
          {dark ? <MoonIcon size={14} /> : <SunIcon size={14} />} {dark ? "Dark appearance: treks set off at dusk." : "Light appearance: treks set off at dawn."} Switch it in the top bar.
        </p>
      </section>

      {reading && howTo && (
        <Dialog title="How to play" kicker="Two Humps" size="sheet" onClose={() => setReading(false)}>
          <div className={styles.doc} dangerouslySetInnerHTML={{ __html: howTo.html }} />
        </Dialog>
      )}
    </div>
  );
}
