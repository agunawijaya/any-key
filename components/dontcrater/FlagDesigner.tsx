"use client";

import { EMBLEMS, FLAG_COLORS, FLAG_PATTERNS, FLAG_SHAPES, flagSvg, randomFlag, type FlagDesign } from "@/lib/lander/flags";
import styles from "./FlagDesigner.module.css";

/** The flag as inline SVG, waving on a pole. */
export function Flag({ design, id, waving = true, className = "" }: { design: FlagDesign; id: string; waving?: boolean; className?: string }) {
  return (
    <span className={`${styles.flagWrap} ${className}`} data-waving={waving || undefined}>
      <span className={styles.pole} aria-hidden />
      <span className={styles.cloth} dangerouslySetInnerHTML={{ __html: flagSvg(design, id) }} />
    </span>
  );
}

type Props = { design: FlagDesign; unlocked: string[]; onChange: (d: FlagDesign) => void; onClose: () => void };

export function FlagDesigner({ design, unlocked, onChange, onClose }: Props) {
  const set = (patch: Partial<FlagDesign>) => onChange({ ...design, ...patch });
  const setColor = (i: number, c: string) => {
    const colors = [...design.colors] as FlagDesign["colors"];
    colors[i] = c;
    set({ colors });
  };
  return (
    <section className={styles.designer} aria-label="Flag designer">
      <div className={styles.preview}>
        <Flag design={design} id="designer" />
        <p className={styles.hint}>Land at 5 km/h or less and your astronaut plants this flag.</p>
      </div>
      <div className={styles.controls}>
        <fieldset>
          <legend>Shape</legend>
          <div className={styles.row}>
            {FLAG_SHAPES.map((s) => (
              <button key={s.id} type="button" aria-pressed={design.shape === s.id} onClick={() => set({ shape: s.id })}>
                {s.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Pattern</legend>
          <div className={styles.row}>
            {FLAG_PATTERNS.map((p) => (
              <button key={p.id} type="button" aria-pressed={design.pattern === p.id} onClick={() => set({ pattern: p.id })}>
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>
        {[0, 1, 2].map((i) => (
          <fieldset key={i}>
            <legend>Colour {i + 1}</legend>
            <div className={styles.swatches}>
              {FLAG_COLORS.map((c) => (
                <button key={c} type="button" className={styles.swatch} style={{ background: c }} aria-label={`Colour ${i + 1}: ${c}`} aria-pressed={design.colors[i] === c} onClick={() => setColor(i, c)} />
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend>Emblem</legend>
          <div className={styles.emblems}>
            {EMBLEMS.map((e) => {
              const locked = !!e.unlock && !unlocked.includes(e.unlock);
              return (
                <button
                  key={e.emoji || "none"}
                  type="button"
                  className={styles.emblem}
                  aria-pressed={design.emblem === e.emoji}
                  disabled={locked}
                  title={locked ? "Earned with an achievement" : e.emoji || "No emblem"}
                  onClick={() => set({ emblem: e.emoji })}
                >
                  {locked ? "🔒" : e.emoji || "∅"}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className={styles.row}>
          <button type="button" className={styles.dice} onClick={() => onChange(randomFlag(unlocked))}>
            🎲 Surprise me
          </button>
          <button type="button" className={styles.done} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </section>
  );
}
