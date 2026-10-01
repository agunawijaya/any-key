import type { Sample } from "./sim";
import styles from "./Recorder.module.css";

type Props = {
  samples: Sample[];
  ideal: { t: number; alt: number; throttle: number }[];
  startAlt: number;
};

const W = 520;
const H = 170;
const PAD = { l: 44, r: 10, t: 10, b: 30 };

/** Height on a log scale (metres), so the whole fall and the last few metres both show. */
function yFor(altKm: number, startAlt: number) {
  const top = Math.log10(1 + startAlt * 1000);
  const v = Math.log10(1 + Math.max(0, altKm) * 1000) / top;
  return PAD.t + (1 - v) * (H - PAD.t - PAD.b);
}

/** The flight recorder: your height over time against a perfect hoverslam, and your throttle underneath. */
export function Recorder({ samples, ideal, startAlt }: Props) {
  const tMax = Math.max(samples[samples.length - 1]?.t ?? 1, ideal[ideal.length - 1]?.t ?? 1, 1);
  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);
  const path = (pts: { t: number; alt: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${yFor(p.alt, startAlt).toFixed(1)}`).join("");
  const ticks = [100, 10, 1, 0.1, 0.01].filter((k) => k < startAlt);
  const stripY = H - PAD.b + 8;
  return (
    <figure className={styles.recorder}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flight recorder: your height over time compared with a perfect hoverslam">
        {ticks.map((k) => (
          <g key={k}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yFor(k, startAlt)} y2={yFor(k, startAlt)} className={styles.grid} />
            <text x={PAD.l - 6} y={yFor(k, startAlt)} className={styles.tick}>
              {k >= 1 ? `${k} km` : `${k * 1000} m`}
            </text>
          </g>
        ))}
        <path d={path(ideal)} className={styles.ideal} />
        <path d={path(samples)} className={styles.you} />
        {samples.map((s, i) =>
          i && s.throttle > 1 ? (
            <rect key={i} x={x(samples[i - 1].t)} width={Math.max(0.6, x(s.t) - x(samples[i - 1].t))} y={stripY} height={10} className={styles.burn} style={{ opacity: 0.25 + (0.75 * s.throttle) / 100 }} />
          ) : null,
        )}
        <text x={PAD.l} y={H - 2} className={styles.label}>
          throttle
        </text>
        <text x={W - PAD.r} y={H - 2} className={styles.labelEnd}>
          {Math.round(tMax)} s
        </text>
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.keyYou}>You</span>
        <span className={styles.keyIdeal}>Perfect hoverslam</span>
      </figcaption>
    </figure>
  );
}
