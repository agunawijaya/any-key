"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppearanceMenu, SoundButton } from "@/components/kit/BarTools";
import { useHydrated, useKeyring } from "@/components/kit/hooks";
import { BackIcon } from "@/components/kit/icons";
import { TodayStrip } from "@/components/kit/TodayStrip";
import { games } from "@/lib/catalog";
import { isFreeKey, whenUnclaimed } from "@/lib/kit/keys";
import { levelOf, markLevelSeen, streakOf, xpOf } from "@/lib/kit/keyring";
import { isPlayable } from "@/lib/kit/manifest";
import { KeycapGrid } from "./KeycapGrid";
import { KeyringSettings } from "./KeyringSettings";
import { LevelPanel } from "./LevelPanel";
import { Ring, type RingCap } from "./Ring";
import styles from "./KeyringPage.module.css";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const playable = games.filter(isPlayable);
const totalCaps = playable.reduce((sum, game) => sum + game.achievements.length, 0);

/** Every keycap earned, oldest first, so new ones join the end of the bunch. */
function collectedCaps(unlocked: Record<string, Record<string, number>>): RingCap[] {
  const caps: (RingCap & { at: number })[] = [];
  for (const game of playable) {
    for (const a of game.achievements) {
      const at = unlocked[game.id]?.[a.id];
      if (at) caps.push({ key: `${game.id}:${a.id}`, accent: game.accent, emblem: game.emblem, tier: a.tier, title: `${a.title} · ${game.title}`, at });
    }
  }
  return caps.sort((a, b) => a.at - b.at);
}

export function KeyringPage() {
  const router = useRouter();
  const keyring = useKeyring();
  const hydrated = useHydrated();
  const xp = hydrated ? xpOf(keyring, games) : 0;
  const level = levelOf(xp);
  const caps = useMemo(() => (hydrated ? collectedCaps(keyring.unlocked) : []), [hydrated, keyring.unlocked]);
  const streak = streakOf(hydrated ? keyring.dailies : {});
  const [ceremony, setCeremony] = useState(0);

  // A level reached since the last visit gets its moment: the wave across the ring and the title stamped.
  useEffect(() => {
    if (!hydrated || keyring.levelSeen >= level.level) return;
    const start = window.setTimeout(() => setCeremony((n) => n + 1), 400);
    const seen = window.setTimeout(() => markLevelSeen(level.level), 2600);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(seen);
    };
  }, [hydrated, keyring.levelSeen, level.level]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isFreeKey(event, "Escape")) whenUnclaimed(event, () => router.push("/"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <button type="button" className={styles.back} onClick={() => router.push("/")}>
          <BackIcon size={18} />
          <span>Back to the Hall</span>
        </button>
        <div className={styles.brand}>
          <h1 className={styles.title}>Keyring</h1>
          <span className={styles.sub}>Every badge in every game is a keycap. Collect them all on one ring.</span>
        </div>
        <div className={styles.tools}>
          <SoundButton />
          <AppearanceMenu />
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-label="Your keyring">
          <div className={styles.ringSide}>
            <Ring caps={caps} wave={ceremony} />
            {hydrated && caps.length === 0 && <p className={styles.empty}>Your first keycap will hang here. Every game has some to earn.</p>}
            {caps.length > 0 && (
              <p className={styles.dragHint} aria-hidden>
                drag to spin
              </p>
            )}
          </div>

          <aside className={styles.side}>
            <LevelPanel level={level} xp={xp} collected={caps.length} total={totalCaps} stamp={ceremony} />

            <div className={styles.streak}>
              <p className={styles.streakHead}>
                <span>Daily streak</span>
                <b>
                  {streak.current} day{streak.current === 1 ? "" : "s"}
                </b>
              </p>
              <ol className={styles.week} aria-label="This week">
                {streak.week.map((day, i) => (
                  <li
                    key={day.key}
                    data-played={(hydrated && day.played) || undefined}
                    data-today={(hydrated && day.today) || undefined}
                    data-future={(hydrated && day.future) || undefined}
                    aria-label={`${day.key}${hydrated && day.played ? ", played" : ""}`}
                  >
                    {DAY_LETTERS[i]}
                  </li>
                ))}
              </ol>
              <p className={styles.streakNote}>Finish any game&rsquo;s daily to keep it going.</p>
            </div>
          </aside>
        </section>

        <TodayStrip className={styles.today} />

        <section className={styles.section} aria-labelledby="every-cap">
          <h2 id="every-cap" className={styles.sectionTitle}>
            Every keycap
          </h2>
          <p className={styles.legend}>
            <span data-tier="common">Common · matte plastic · 10 XP</span>
            <span data-tier="rare">Rare · lit from inside · 30 XP</span>
            <span data-tier="legendary">Legendary · engraved metal · 80 XP</span>
            <span>Each daily · 5 XP</span>
          </p>
          <KeycapGrid games={playable} keyring={keyring} hydrated={hydrated} />
        </section>

        <section className={styles.section} aria-labelledby="keyring-settings">
          <h2 id="keyring-settings" className={styles.sectionTitle}>
            Settings
          </h2>
          <KeyringSettings games={playable} />
        </section>
      </main>
    </div>
  );
}
