import { MiniLander } from "@/components/dontcrater/Postcard";
import styles from "./DontCraterPreview.module.css";

const STARS = Array.from({ length: 34 }, (_, i) => ({ x: (i * 73) % 400, y: (i * 41) % 120, r: i % 6 === 0 ? 1.4 : 0.8 }));

/** The lander drops out of a starry sky, brakes, puffs dust, and plants a flag. Then again. */
export function DontCraterPreview() {
  return (
    <div className={styles.preview} role="img" aria-label="Animated preview: a small lander brakes above the Moon, touches down in a puff of dust and plants a flag">
      <svg viewBox="0 0 400 175" className={styles.art} aria-hidden>
        <defs>
          <linearGradient id="dcp-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#050716" />
            <stop offset="1" stopColor="#1a1f4a" />
          </linearGradient>
          <linearGradient id="dcp-ground" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d9d6cf" />
            <stop offset="1" stopColor="#6b6c78" />
          </linearGradient>
        </defs>
        <rect width="400" height="175" fill="url(#dcp-sky)" />
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={0.4 + (i % 3) * 0.2} />
        ))}
        <g transform="translate(330 38)">
          <circle r="16" fill="#4f8fe8" />
          <path d="M-8 -7c4 2 5 6 2 10-2 3-1 6 1 8-5 1-10-4-9-10 0-4 3-6 6-8z" fill="#56a05a" />
          <path d="M-16 0a16 16 0 0 0 28 10a16 16 0 0 1-28-10z" fill="#000814" opacity="0.55" />
        </g>
        <path d="M0 150 Q100 136 200 142 T400 146 V175 H0Z" fill="url(#dcp-ground)" />
        <ellipse cx="90" cy="160" rx="26" ry="4" fill="#8e8f99" opacity="0.6" />
        <ellipse cx="300" cy="164" rx="34" ry="5" fill="#8e8f99" opacity="0.6" />
        <g className={styles.dust}>
          <ellipse cx="200" cy="142" rx="34" ry="5" fill="#e9e6df" />
        </g>
        <g className={styles.flag}>
          <path d="M226 142 V112" stroke="#d8dbe2" strokeWidth="2" />
          <path d="M227 112 h20 v12 h-20z" fill="#6a48ff" />
          <path d="M227 112 h8 v12 h-8z" fill="#ffd23d" />
        </g>
        <g className={styles.drop}>
          <MiniLander />
        </g>
      </svg>
    </div>
  );
}
