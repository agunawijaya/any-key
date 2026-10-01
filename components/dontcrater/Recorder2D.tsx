import styles from "./Recorder.module.css";
import own from "./Recorder2D.module.css";

/** One recorded moment: height above the ground (km), distance to the target (km, signed), throttle and tilt. */
export type Track = { t: number; alt: number; off: number; throttle: number; tilt: number }[];

type Props = {
  you: Track;
  ideal: Track;
  /** Scan assist was used: the recorder carries the 🛰️ mark, as the share text does. */
  scanned: boolean;
};

const W = 520;
const PAD = { l: 48, r: 10 };
const H1 = 118;
const H2 = 88;
const STRIP = 10;
const H = H1 + H2 + STRIP * 2 + 38;

/** Height on a log scale (metres), so the whole fall and the last few metres both show. */
function yHeight(km: number, top: number) {
  const max = Math.log10(1 + top * 1000);
  const v = Math.log10(1 + Math.max(0, km) * 1000) / max;
  return 8 + (1 - v) * (H1 - 16);
}

/** Distance to the target on a signed log scale, the target in the middle. */
function yOff(km: number, span: number) {
  const m = Math.log10(1 + Math.abs(km) * 1000) / Math.log10(1 + span * 1000);
  return H1 + H2 / 2 - Math.sign(km) * Math.min(1, m) * (H2 / 2 - 8);
}

/**
 * The Free Flight recorder: your height and your distance to the target over
 * time, each against the autopilot's flight (which knows every rock), with
 * your throttle and tilt as strips underneath.
 */
export function Recorder2D({ you, ideal, scanned }: Props) {
  const tMax = Math.max(you[you.length - 1]?.t ?? 1, ideal[ideal.length - 1]?.t ?? 1, 1);
  const top = Math.max(0.01, ...you.map((p) => p.alt), ...ideal.map((p) => p.alt));
  const span = Math.max(0.05, ...you.map((p) => Math.abs(p.off)), ...ideal.map((p) => Math.abs(p.off)));
  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);
  const line = (pts: Track, y: (p: Track[number]) => number) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p).toFixed(1)}`).join("");
  const heights = [100, 10, 1, 0.1, 0.01].filter((k) => k < top);
  const offs = [10, 1, 0.1].filter((k) => k < span);
  const sThrottle = H1 + H2 + 8;
  const sTilt = sThrottle + STRIP + 6;
  const fmt = (k: number) => (k >= 1 ? `${k} km` : `${Math.round(k * 1000)} m`);
  return (
    <figure className={styles.recorder}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flight recorder: your height and your distance from the target over time, compared with the autopilot's flight">
        {heights.map((k) => (
          <g key={`h${k}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yHeight(k, top)} y2={yHeight(k, top)} className={styles.grid} />
            <text x={PAD.l - 6} y={yHeight(k, top)} className={styles.tick}>
              {fmt(k)}
            </text>
          </g>
        ))}
        <text x={W - PAD.r} y={10} className={styles.labelEnd}>
          height
        </text>
        <line x1={PAD.l} x2={W - PAD.r} y1={H1 + H2 / 2} y2={H1 + H2 / 2} className={own.target} />
        <text x={PAD.l - 6} y={H1 + H2 / 2} className={styles.tick}>
          🎯
        </text>
        {offs.map((k) => (
          <g key={`o${k}`}>
            {[-1, 1].map((sgn) => (
              <g key={sgn}>
                <line x1={PAD.l} x2={W - PAD.r} y1={yOff(sgn * k, span)} y2={yOff(sgn * k, span)} className={styles.grid} />
                <text x={PAD.l - 6} y={yOff(sgn * k, span)} className={styles.tick}>
                  {sgn > 0 ? "▶ " : "◀ "}
                  {fmt(k)}
                </text>
              </g>
            ))}
          </g>
        ))}
        <text x={W - PAD.r} y={H1 + 12} className={styles.labelEnd}>
          target is
        </text>
        <path d={line(ideal, (p) => yHeight(p.alt, top))} className={styles.ideal} />
        <path d={line(you, (p) => yHeight(p.alt, top))} className={styles.you} />
        <path d={line(ideal, (p) => yOff(p.off, span))} className={styles.ideal} />
        <path d={line(you, (p) => yOff(p.off, span))} className={styles.you} />
        {you.map((p, i) =>
          i ? (
            <g key={i}>
              {p.throttle > 1 && <rect x={x(you[i - 1].t)} width={Math.max(0.6, x(p.t) - x(you[i - 1].t))} y={sThrottle} height={STRIP} className={styles.burn} style={{ opacity: 0.25 + (0.75 * p.throttle) / 100 }} />}
              {Math.abs(p.tilt) > 1 && <rect x={x(you[i - 1].t)} width={Math.max(0.6, x(p.t) - x(you[i - 1].t))} y={sTilt} height={STRIP} className={p.tilt > 0 ? own.right : own.left} style={{ opacity: 0.25 + (0.75 * Math.min(45, Math.abs(p.tilt))) / 45 }} />}
            </g>
          ) : null,
        )}
        <text x={PAD.l - 6} y={sThrottle + STRIP / 2} className={styles.tick}>
          burn
        </text>
        <text x={PAD.l - 6} y={sTilt + STRIP / 2} className={styles.tick}>
          tilt
        </text>
        <text x={W - PAD.r} y={H - 2} className={styles.labelEnd}>
          {Math.round(tMax)} s
        </text>
      </svg>
      <figcaption className={`${styles.legend} ${own.legend}`}>
        <span className={styles.keyYou}>You{scanned ? " 🛰️" : ""}</span>
        <span className={styles.keyIdeal} title="The autopilot knows every rock">
          Autopilot
        </span>
        <span className={own.keys}>
          tilt <i className={own.left} />
          left <i className={own.right} />
          right
        </span>
      </figcaption>
    </figure>
  );
}
