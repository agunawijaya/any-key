import type { Skin } from "@/lib/stickler/progress";
import styles from "./Stick.module.css";

export type StickState = "idle" | "selected" | "hinted" | "sparky" | "burning" | "flying" | "doomed";

export const GLOW_COLORS = ["#39ff88", "#ff3df0", "#3dd8ff", "#fff23d", "#ff8a3d", "#a36bff"];
export const CANDY_COLORS = [
  ["#ff4f7b", "#fff4f7"],
  ["#2fc6a8", "#f2fffb"],
  ["#8f6bff", "#f7f3ff"],
  ["#ff9b3d", "#fff8ef"],
];

/** Gradients and patterns shared by every stick on the page (one copy, many uses). */
export function StickDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="st-wood" x1="0" x2="1">
          <stop offset="0" stopColor="#d9a86c" />
          <stop offset="0.45" stopColor="#f4d3a1" />
          <stop offset="1" stopColor="#c68d4f" />
        </linearGradient>
        <radialGradient id="st-head" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ff8a7a" />
          <stop offset="0.45" stopColor="#e63b2e" />
          <stop offset="1" stopColor="#8e1b12" />
        </radialGradient>
        <radialGradient id="st-burnt" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#6b5a52" />
          <stop offset="1" stopColor="#1e1714" />
        </radialGradient>
        <radialGradient id="st-flame" cx="0.5" cy="0.8" r="0.8">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.35" stopColor="#ffd23d" />
          <stop offset="0.7" stopColor="#ff7a1f" />
          <stop offset="1" stopColor="#e63b2e" stopOpacity="0" />
        </radialGradient>
        {CANDY_COLORS.map(([stripe, base], i) => (
          <pattern key={i} id={`st-candy-${i}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="12" height="12" fill={base} />
            <rect width="6" height="12" fill={stripe} />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

type Props = { skin: Skin; color: number; state: StickState; style?: React.CSSProperties; className?: string };

/** One stick. The flame sits above the head, so the view box reaches up to y = -44. */
export function Stick({ skin, color, state, style, className = "" }: Props) {
  return (
    <span className={`${styles.stick} ${styles[state] ?? ""} ${styles[skin]} ${className}`} style={style} aria-hidden>
      <svg viewBox="0 -44 24 194" className={styles.svg}>
        {skin === "matches" && <Match />}
        {skin === "glow" && <Glow color={GLOW_COLORS[color % GLOW_COLORS.length]} />}
        {skin === "candy" && <Candy color={color % CANDY_COLORS.length} />}
      </svg>
    </span>
  );
}

function Match() {
  return (
    <>
      <rect x="8" y="24" width="8" height="122" rx="2" fill="url(#st-wood)" />
      <rect x="8" y="24" width="8" height="122" rx="2" className={styles.char} />
      <ellipse cx="12" cy="16" rx="8.5" ry="13" fill="url(#st-head)" className={styles.head} />
      <ellipse cx="12" cy="16" rx="8.5" ry="13" fill="url(#st-burnt)" className={styles.burntHead} />
      <ellipse cx="9" cy="10" rx="2.4" ry="3.6" fill="#fff" opacity="0.45" className={styles.shine} />
      <g className={styles.flame}>
        <path d="M12 -40 C 22 -20, 24 -4, 12 8 C 0 -4, 2 -20, 12 -40 Z" fill="url(#st-flame)" />
        <path d="M12 -22 C 17 -10, 18 -2, 12 5 C 6 -2, 7 -10, 12 -22 Z" fill="#fffbe0" opacity="0.9" />
      </g>
    </>
  );
}

function Glow({ color }: { color: string }) {
  return (
    <g style={{ "--glow": color } as React.CSSProperties} className={styles.glowGroup}>
      <rect x="5" y="4" width="14" height="142" rx="7" fill={color} opacity="0.35" />
      <rect x="7" y="8" width="10" height="134" rx="5" fill={color} />
      <rect x="10" y="12" width="3" height="120" rx="1.5" fill="#fff" opacity="0.7" />
      <rect x="6" y="140" width="12" height="8" rx="3" fill="#2a2440" />
      <circle cx="12" cy="4" r="3" fill="#2a2440" />
    </g>
  );
}

function Candy({ color }: { color: number }) {
  const [stripe] = CANDY_COLORS[color];
  return (
    <>
      <rect x="7" y="4" width="10" height="140" rx="5" fill={`url(#st-candy-${color})`} />
      <rect x="7" y="4" width="10" height="140" rx="5" fill="none" stroke={stripe} strokeOpacity="0.5" />
      <rect x="9" y="8" width="2.5" height="126" rx="1.2" fill="#fff" opacity="0.55" />
      <path d="M6 136 L18 136 L20 148 L4 148 Z" fill="#fff" opacity="0.9" />
    </>
  );
}
