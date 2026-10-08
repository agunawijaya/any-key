"use client";

import { useState } from "react";
import { Dialog } from "@/components/kit/Dialog";
import { SettingsPanel } from "@/components/kit/SettingsPanel";
import { forgetEverything, forgetGame } from "@/lib/kit/forget";
import type { GameManifest } from "@/lib/kit/manifest";
import styles from "./KeyringSettings.module.css";

type Forget = { kind: "game"; game: GameManifest } | { kind: "all" } | null;

/** Sound, appearance and motion, and the two ways to forget: one game, or everything. */
export function KeyringSettings({ games }: { games: GameManifest[] }) {
  const [asking, setAsking] = useState<Forget>(null);
  const [done, setDone] = useState("");

  function confirm() {
    if (!asking) return;
    if (asking.kind === "game") {
      forgetGame(asking.game.id);
      setDone(`${asking.game.title} starts fresh.`);
    } else {
      forgetEverything(games.map((g) => g.id));
      setDone("Everything is forgotten. The Keyring starts fresh.");
    }
    setAsking(null);
  }

  return (
    <div className={styles.settings}>
      <section className={styles.block} aria-labelledby="kr-prefs">
        <h3 id="kr-prefs" className={styles.heading}>
          Sound, look and motion
        </h3>
        <SettingsPanel />
      </section>

      <section className={styles.block} aria-labelledby="kr-data">
        <h3 id="kr-data" className={styles.heading}>
          Your data
        </h3>
        <p className={styles.note}>Everything Any Key remembers stays in this browser. Nothing is sent anywhere.</p>
        <ul className={styles.forgetList}>
          {games.map((game) => (
            <li key={game.id}>
              <span className={styles.gameName} style={{ "--accent": game.accent } as React.CSSProperties}>
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d={game.emblem} />
                </svg>
                {game.title}
              </span>
              <button type="button" className={styles.forget} onClick={() => setAsking({ kind: "game", game })}>
                Forget my {game.title} data
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.forgetAll} onClick={() => setAsking({ kind: "all" })}>
          Forget everything
        </button>
        <p className={styles.done} role="status">
          {done}
        </p>
      </section>

      {asking && (
        <Dialog title={asking.kind === "game" ? `Forget ${asking.game.title}?` : "Forget everything?"} size="confirm" role="alertdialog" onClose={() => setAsking(null)}>
          <p className={styles.question}>
            {asking.kind === "game"
              ? `Its progress, its keycaps and its dailies go. Your other games keep theirs.`
              : "Every game's progress, every keycap, your level and your streak go. Your sound and look settings stay."}{" "}
            This can&rsquo;t be undone.
          </p>
          <div className={styles.answers}>
            <button type="button" className={styles.keep} data-autofocus onClick={() => setAsking(null)}>
              Keep it
            </button>
            <button type="button" className={styles.yes} onClick={confirm}>
              Forget
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
