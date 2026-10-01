"use client";

import { COMPUTERS, SCREENS, type Screen } from "@/lib/outta/campaign";
import { useProgress } from "@/lib/outta/progress";
import { WORLDS } from "./render";
import styles from "./ScreensMap.module.css";

/** A fixed scatter of blocks for each computer's little screen. */
function cells(seed: number, density: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const out: number[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 24; c++) {
      if (c === 5 && r === 4) out.push(4);
      else if (c === 12 && r === 9) out.push(5);
      else if (r < 9 && rnd() < density) out.push(1 + Math.floor(rnd() * 3));
      else out.push(0);
    }
  }
  return out;
}

const PREVIEWS = COMPUTERS.map((c, i) => cells(11 + i * 13, 0.3));

/** A screen is open once the one before it is cleared. */
export const isOpen = (screens: Record<string, { stars: number }>, s: Screen) => {
  const i = SCREENS.indexOf(s);
  return i === 0 || !!screens[SCREENS[i - 1].id];
};

export function ScreensMap({ onPlay, onExit }: { onPlay: (s: Screen) => void; onExit: () => void }) {
  const progress = useProgress();
  const total = Object.values(progress.screens).reduce((a, b) => a + b.stars, 0);

  return (
    <div className={styles.map}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onExit}>
          ← Lobby
        </button>
        <div className={styles.titles}>
          <h2>Screens</h2>
          <p>Five old computers, six screens each. Every computer adds one trick, most of them from the 1980 program&rsquo;s own bugs.</p>
        </div>
        <p className={styles.total}>
          <span aria-hidden>★</span> {total} / {SCREENS.length * 3}
        </p>
      </header>

      <div className={styles.worlds}>
        {COMPUTERS.map((c, ci) => {
          const pal = WORLDS[c.id];
          const screens = SCREENS.filter((s) => s.computer === c.id);
          const open = isOpen(progress.screens, screens[0]);
          const colours = ["transparent", pal.wood, pal.glassBlock, pal.stone, pal.star, pal.exit];
          return (
            <section key={c.id} className={styles.world} data-open={open} style={{ "--edge": pal.seam, "--accent": pal.seam } as React.CSSProperties}>
              <div className={styles.bezel} style={{ background: pal.bg }} aria-hidden>
                <div className={styles.glass} style={{ background: pal.glass }}>
                  {PREVIEWS[ci].map((b, i) => (
                    <span key={i} style={{ background: colours[b] }} />
                  ))}
                </div>
              </div>
              <div className={styles.about}>
                <span className={styles.era}>{c.era}</span>
                <h3>{c.name}</h3>
                <span className={styles.twist}>{c.twist}</span>
                <p>{c.text}</p>
              </div>
              {open ? (
                <div className={styles.levels}>
                  {screens.map((s) => {
                    const record = progress.screens[s.id];
                    const ok = isOpen(progress.screens, s);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!ok}
                        onClick={() => onPlay(s)}
                        aria-label={`${c.name} screen ${s.index + 1}${ok ? `, ${record?.stars ?? 0} of 3 stars` : ", not reached yet"}`}
                      >
                        <span>{s.index + 1}</span>
                        <span className={styles.stars} aria-hidden>
                          {[0, 1, 2].map((k) => (
                            <i key={k} data-got={k < (record?.stars ?? 0)}>
                              ★
                            </i>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.lock}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  Clear {COMPUTERS[ci - 1].name} 6 to switch it on
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
