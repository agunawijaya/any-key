import type { Palette, World } from "@/lib/lander/worlds";
import styles from "./Postcard.module.css";

/*
 * A travel-poster postcard for each world. Both the day and the night palette
 * are handed to CSS, which picks one from the page theme: light is the day
 * side, dark is the night side.
 */

function vars(p: Palette, key: "d" | "n") {
  return {
    [`--sky0-${key}`]: p.sky[0],
    [`--sky1-${key}`]: p.sky[1],
    [`--sky2-${key}`]: p.sky[2],
    [`--g0-${key}`]: p.ground[0],
    [`--g1-${key}`]: p.ground[1],
    [`--g2-${key}`]: p.ground[2],
    [`--rim-${key}`]: p.rim,
    [`--shade-${key}`]: p.shade,
    [`--ink-${key}`]: p.ink,
    [`--paper-${key}`]: p.paper,
    [`--stars-${key}`]: String(p.stars),
    [`--sun-${key}`]: p.sun ?? "transparent",
    [`--body-${key}`]: p.moon?.color ?? "transparent",
    [`--glow-${key}`]: p.sunset ?? "transparent",
  };
}

const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97) % 240, y: (i * 53) % 150, r: i % 5 === 0 ? 1.3 : 0.7 }));

type Props = { world: World; size?: "card" | "hero"; lander?: boolean; className?: string };

export function Postcard({ world, size = "card", lander = true, className = "" }: Props) {
  const style = { ...vars(world.palette.day, "d"), ...vars(world.palette.night, "n") } as React.CSSProperties;
  const id = `pc-${world.id}-${size}`;
  return (
    <div className={`${styles.postcard} ${styles[size]} ${className}`} style={style} data-world={world.id}>
      <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMid slice" className={styles.art} aria-hidden>
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--sky0)" }} />
            <stop offset="0.6" style={{ stopColor: "var(--sky1)" }} />
            <stop offset="1" style={{ stopColor: "var(--sky2)" }} />
          </linearGradient>
          <linearGradient id={`${id}-ground`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--g0)" }} />
            <stop offset="1" style={{ stopColor: "var(--shade)" }} />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0" style={{ stopColor: "var(--glow)" }} />
            <stop offset="1" stopOpacity="0" style={{ stopColor: "var(--glow)" }} />
          </radialGradient>
        </defs>
        <rect width="240" height="300" fill={`url(#${id}-sky)`} />
        <g className={styles.stars}>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" />
          ))}
        </g>
        {world.id === "mars" && <circle cx="58" cy="176" r="90" fill={`url(#${id}-glow)`} className={styles.nightOnly} />}
        <circle cx={world.id === "mars" ? 58 : 50} cy={world.id === "mars" ? 60 : 52} r="13" style={{ fill: "var(--sun)" }} className={styles.sun} />
        {world.palette.day.moon && <SkyBody world={world} />}
        {/* Lifted a little so the label at the bottom doesn't hide the ground. */}
        <g transform="translate(0 -26)">
          <Terrain world={world} id={id} />
          {lander && <MiniLander className={styles.lander} />}
        </g>
      </svg>
      <div className={styles.label}>
        <span className={styles.visit}>Visit</span>
        <span className={styles.name}>{world.name}</span>
        <span className={styles.meta}>
          {world.realGravity} · from {world.startAlt} km
        </span>
      </div>
    </div>
  );
}

function SkyBody({ world }: { world: World }) {
  if (world.id === "moon")
    return (
      <g transform="translate(186 58)">
        <circle r="17" fill="#4f8fe8" />
        <path d="M-9 -8c4 2 6 7 3 11-3 3-2 7 1 9-6 1-11-5-10-11 0-4 3-7 6-9z" fill="#56a05a" />
        <path d="M4 -13c5 2 9 6 10 11" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M-17 0a17 17 0 0 0 30 11a17 17 0 0 1-30-11z" fill="#000814" opacity="0.55" />
      </g>
    );
  return (
    <g transform="translate(192 46)" className={styles.nightOnly}>
      <circle r="11" fill="#f1efe6" />
      <circle cx="-3" cy="-2" r="3.5" fill="#cfccc2" />
      <circle cx="4" cy="3" r="2.4" fill="#cfccc2" />
    </g>
  );
}

function Terrain({ world, id }: { world: World; id: string }) {
  const fill = `url(#${id}-ground)`;
  switch (world.id) {
    case "moon":
      return (
        <g>
          <path d="M0 196 Q40 182 72 190 T150 184 T240 192 V300 H0Z" style={{ fill: "var(--g2)" }} />
          <path d="M0 214 Q60 200 120 208 T240 204 V300 H0Z" fill={fill} />
          <ellipse cx="60" cy="236" rx="30" ry="6" style={{ fill: "var(--shade)" }} opacity="0.45" />
          <ellipse cx="60" cy="234" rx="30" ry="6" fill="none" style={{ stroke: "var(--rim)" }} strokeWidth="1.4" opacity="0.7" />
          <ellipse cx="176" cy="252" rx="42" ry="8" style={{ fill: "var(--shade)" }} opacity="0.4" />
          <ellipse cx="176" cy="250" rx="42" ry="8" fill="none" style={{ stroke: "var(--rim)" }} strokeWidth="1.4" opacity="0.7" />
          <ellipse cx="120" cy="222" rx="14" ry="3" style={{ fill: "var(--shade)" }} opacity="0.5" />
        </g>
      );
    case "mars":
      return (
        <g>
          <path d="M0 184 L30 184 L40 170 L78 170 L88 186 L150 186 L160 176 L196 176 L206 188 L240 188 V300 H0Z" style={{ fill: "var(--g2)" }} />
          <path d="M0 206 Q50 192 100 204 T190 198 T240 206 V300 H0Z" style={{ fill: "var(--g1)" }} />
          <path d="M0 226 Q70 212 140 224 T240 220 V300 H0Z" fill={fill} />
          <circle cx="40" cy="244" r="4" style={{ fill: "var(--shade)" }} />
          <circle cx="196" cy="252" r="6" style={{ fill: "var(--shade)" }} />
          <circle cx="140" cy="262" r="3" style={{ fill: "var(--shade)" }} />
        </g>
      );
    case "psyche":
      return (
        <g>
          <path d="M0 200 Q30 170 70 186 Q110 150 150 180 Q200 160 240 190 V300 H0Z" style={{ fill: "var(--g2)" }} />
          <path d="M0 222 Q60 200 110 214 Q170 196 240 216 V300 H0Z" fill={fill} />
          <ellipse cx="80" cy="240" rx="22" ry="5" style={{ fill: "var(--shade)" }} opacity="0.5" />
          <ellipse cx="80" cy="238" rx="22" ry="5" fill="none" style={{ stroke: "var(--rim)" }} strokeWidth="1.2" />
          {[
            [40, 230],
            [150, 226],
            [196, 250],
            [110, 262],
          ].map(([x, y]) => (
            <path key={`${x}`} d={`M${x} ${y - 4}v8M${x - 4} ${y}h8`} style={{ stroke: "var(--rim)" }} strokeWidth="1.3" className={styles.glint} />
          ))}
        </g>
      );
    default:
      return (
        <g>
          <path d="M0 196 Q20 184 44 192 Q70 176 96 190 L104 198 H0Z" style={{ fill: "var(--g2)" }} />
          <g className={styles.lights}>
            {[12, 30, 48, 62, 80].map((x) => (
              <circle key={x} cx={x} cy={194 - (x % 3)} r="1.2" fill="#ffc766" />
            ))}
          </g>
          <rect x="0" y="198" width="240" height="102" fill={fill} />
          {[212, 226, 244, 266].map((y, i) => (
            <path key={y} d={`M${20 + i * 30} ${y}h${40 - i * 4}`} style={{ stroke: "var(--rim)" }} strokeWidth="1.2" opacity="0.5" />
          ))}
          <rect x="134" y="222" width="70" height="7" rx="1" fill="#2b2f38" />
          <path d="M134 229h70" stroke="#ffd23d" strokeWidth="2" strokeDasharray="5 4" />
          <g opacity="0.9" className={styles.dayOnly}>
            <ellipse cx="180" cy="120" rx="28" ry="8" fill="#fff" />
            <ellipse cx="164" cy="116" rx="14" ry="8" fill="#fff" />
            <ellipse cx="60" cy="140" rx="20" ry="5" fill="#fff" />
          </g>
        </g>
      );
  }
}

/** The lander as a tiny SVG, for postcards and the Hall card. */
export function MiniLander({ className = "", flame = true }: { className?: string; flame?: boolean }) {
  return (
    <g className={className}>
      {flame && <path d="M-4 18 Q0 36 4 18Z" fill="#ffb35c" className="dc-flame" />}
      <path d="M-9 8 L-15 20 M9 8 L15 20" stroke="#9aa0ab" strokeWidth="2" strokeLinecap="round" />
      <path d="M-11 8 H11 L10 0 H-10Z" fill="#e8b341" />
      <path d="M-2.5 8 H2.5 L3.5 12 H-3.5Z" fill="#3a3d48" />
      <path d="M-10 0 H10 Q11 -12 0 -16 Q-11 -12 -10 0Z" fill="#f4f1ea" />
      <rect x="-10" y="-4" width="20" height="2" fill="#ff6b1a" />
      <circle cx="0.5" cy="-8.5" r="4" fill="#1b2a4a" stroke="#23262f" strokeWidth="1.2" />
      <circle cx="-0.8" cy="-9.8" r="1.2" fill="#8fc2ff" />
    </g>
  );
}
