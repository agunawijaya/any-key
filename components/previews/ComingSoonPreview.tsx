import type { GameManifest } from "@/lib/kit/manifest";
import styles from "./ComingSoonPreview.module.css";

/**
 * A neutral card for a game still on the drawing board: a blueprint sheet with
 * its emblem pencilled in. Deliberately plain, so it never promises art the
 * game hasn't got yet.
 */
export function ComingSoonPreview({ game }: { game: Pick<GameManifest, "emblem" | "title"> }) {
  return (
    <div className={styles.sheet} role="img" aria-label={`${game.title}: still being designed`}>
      <svg className={styles.emblem} viewBox="0 0 24 24" aria-hidden>
        <path d={game.emblem} />
      </svg>
      <span className={styles.stamp}>in design</span>
    </div>
  );
}
