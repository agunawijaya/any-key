import type { Skin } from "@/lib/stickler/progress";
import type { Mood } from "@/lib/stickler/sparky";
import styles from "./Sparky.module.css";

/**
 * Sparky: a round little match head with opinions. His colours follow the
 * stick style (flame red, neon, candy pink); his face follows his mood.
 */
export function Sparky({ mood, skin, size = 120, talking = false }: { mood: Mood; skin: Skin; size?: number; talking?: boolean }) {
  return (
    <span className={`${styles.sparky} ${styles[skin]} ${talking ? styles.talking : ""}`} data-mood={mood} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <g className={styles.flame}>
          <path d="M60 4 C 74 22, 78 34, 60 46 C 42 34, 46 22, 60 4 Z" className={styles.flameOuter} />
          <path d="M60 18 C 67 28, 68 36, 60 42 C 52 36, 53 28, 60 18 Z" className={styles.flameInner} />
        </g>
        <ellipse cx="60" cy="72" rx="40" ry="42" className={styles.body} />
        <ellipse cx="46" cy="52" rx="10" ry="7" className={styles.shine} />
        <Face mood={mood} />
        {mood === "worried" && <path d="M92 44 C 96 52, 96 58, 92 60 C 88 58, 88 52, 92 44 Z" className={styles.sweat} />}
      </svg>
    </span>
  );
}

function Face({ mood }: { mood: Mood }) {
  const eyes = {
    idle: <Eyes />,
    happy: (
      <g className={styles.ink}>
        <path d="M38 70 Q 46 62 54 70" />
        <path d="M66 70 Q 74 62 82 70" />
      </g>
    ),
    thinking: <Eyes look="up" />,
    smug: (
      <g>
        <Eyes lids />
      </g>
    ),
    worried: <Eyes brows="up" />,
    shocked: <Eyes big />,
    sad: <Eyes brows="sad" look="down" />,
    cross: <Eyes brows="cross" />,
  }[mood];

  const mouth = {
    idle: <path d="M48 88 Q 60 98 72 88" className={styles.ink} />,
    happy: <path d="M44 86 Q 60 106 76 86 Z" className={styles.mouthFill} />,
    thinking: <path d="M52 92 L 68 90" className={styles.ink} />,
    smug: <path d="M50 90 Q 64 96 74 84" className={styles.ink} />,
    worried: <path d="M48 94 Q 54 88 60 94 Q 66 100 72 92" className={styles.ink} />,
    shocked: <ellipse cx="60" cy="93" rx="7" ry="9" className={styles.mouthFill} />,
    sad: <path d="M48 96 Q 60 86 72 96" className={styles.ink} />,
    cross: <path d="M48 94 L 72 94" className={styles.ink} />,
  }[mood];

  return (
    <g>
      {eyes}
      <g className={styles.mouth}>{mouth}</g>
      <ellipse cx="34" cy="84" rx="7" ry="4" className={styles.blush} />
      <ellipse cx="86" cy="84" rx="7" ry="4" className={styles.blush} />
    </g>
  );
}

function Eyes({ look, brows, lids, big }: { look?: "up" | "down"; brows?: "up" | "sad" | "cross"; lids?: boolean; big?: boolean }) {
  const dy = look === "up" ? -4 : look === "down" ? 3 : 0;
  const r = big ? 9 : 7.5;
  return (
    <g>
      <circle cx="46" cy="68" r={r + 1.5} className={styles.eyeWhite} />
      <circle cx="74" cy="68" r={r + 1.5} className={styles.eyeWhite} />
      <circle cx="47" cy={68 + dy} r={big ? 4 : 4.5} className={styles.pupil} />
      <circle cx="75" cy={68 + dy} r={big ? 4 : 4.5} className={styles.pupil} />
      {lids && (
        <g className={styles.lid}>
          <path d="M36 66 L 56 66 L 56 58 L 36 58 Z" />
          <path d="M64 66 L 84 66 L 84 58 L 64 58 Z" />
        </g>
      )}
      {brows === "up" && (
        <g className={styles.ink}>
          <path d="M38 54 Q 46 48 54 54" />
          <path d="M66 54 Q 74 48 82 54" />
        </g>
      )}
      {brows === "sad" && (
        <g className={styles.ink}>
          <path d="M38 58 L 54 52" />
          <path d="M66 52 L 82 58" />
        </g>
      )}
      {brows === "cross" && (
        <g className={styles.ink}>
          <path d="M38 52 L 54 58" />
          <path d="M66 58 L 82 52" />
        </g>
      )}
    </g>
  );
}
