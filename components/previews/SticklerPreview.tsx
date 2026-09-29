import styles from "./SticklerPreview.module.css";

const STICKS = 11;

/** A row of matches on a little table; every few seconds three strike, flare and fly off, then the row refills. */
export function SticklerPreview() {
  return (
    <div className={styles.preview} role="img" aria-label="Animated preview: matches on a table; three strike and burn, then the row refills">
      <div className={styles.table}>
        <div className={styles.row}>
          {Array.from({ length: STICKS }, (_, i) => (
            <span key={i} className={`${styles.match} ${i >= STICKS - 3 ? styles.taken : ""}`} style={{ "--i": i, "--t": `${((i * 37) % 9) - 4}deg` } as React.CSSProperties}>
              <span className={styles.flame} />
              <span className={styles.head} />
              <span className={styles.stick} />
            </span>
          ))}
        </div>
        <span className={styles.count}>
          <b className={styles.from}>11</b>
          <b className={styles.to}>8</b>
          <small>left</small>
        </span>
      </div>
    </div>
  );
}
