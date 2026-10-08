import type { AchievementTier } from "@/lib/kit/manifest";
import { mix, readableOn, shade, withAlpha } from "@/lib/kit/color";
import styles from "./Keycap.module.css";

/*
 * A keycap, drawn as SVG. Seen slightly from the front: the dished top face,
 * and below it the front wall of the cap. The tier sets the material:
 *
 * - common: matte ABS plastic in the game's accent colour;
 * - rare: translucent plastic with a light inside it;
 * - legendary: brushed metal tinted with the accent, the legend engraved.
 *
 * A locked cap is plain unlit plastic with a faint legend; a secret one is
 * blank with a "?". In the dark theme earned caps are backlit in their accent.
 */

export type KeycapState = "earned" | "locked" | "secret";

export type KeycapProps = {
  accent: string;
  /** The game's emblem: SVG path data on a 24×24 grid. */
  emblem: string;
  tier: AchievementTier;
  state?: KeycapState;
  /** Unique within the page: gradient ids are derived from it. */
  id: string;
  /** Text instead of the emblem (the level-title cap). */
  text?: string;
  /** A wide cap (2.25 units), for text. */
  wide?: boolean;
};

const NEUTRAL = "#d8d1c3";
const BODY_Y = 6;
const BODY_H = 88;

export const keycapSize = (wide = false) => ({ width: wide ? 210 : 100, height: 100 });

/** The cap's shapes, for use inside a larger SVG (the ring). Centred in a 100×100 (or 210×100) box. */
export function KeycapArt({ accent, emblem, tier, state = "earned", id, text, wide = false }: KeycapProps) {
  const { width } = keycapSize(wide);
  const g = (name: string) => `${id}-${name}`;
  const url = (name: string) => `url(#${g(name)})`;
  const earned = state === "earned";
  const material: AchievementTier | "plain" = earned ? tier : "plain";

  const base = earned ? accent : mix(NEUTRAL, accent, state === "secret" ? 0.04 : 0.14);
  const metal = mix("#c3c8d0", accent, 0.24);
  const face = { x: 15, y: 9, w: width - 30, h: 68, r: 12 };
  const cx = width / 2;
  const cy = 43;

  const ink = material === "legendary" ? shade(metal, -0.62) : material === "rare" ? "#ffffff" : earned ? readableOn(accent) : shade(base, -0.34);

  return (
    <g className={styles.cap} data-tier={material} data-state={state}>
      <defs>
        <linearGradient id={g("wall")} x1="0" y1="0" x2="0" y2="1">
          {material === "legendary" ? (
            <>
              <stop offset="0" stopColor={shade(metal, -0.28)} />
              <stop offset="1" stopColor={shade(metal, -0.55)} />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={shade(base, -0.16)} stopOpacity={material === "rare" ? 0.82 : 1} />
              <stop offset="1" stopColor={shade(base, -0.4)} stopOpacity={material === "rare" ? 0.9 : 1} />
            </>
          )}
        </linearGradient>
        <linearGradient id={g("face")} x1="0" y1="0" x2={material === "legendary" ? "0.25" : "1"} y2="1">
          {material === "legendary" ? (
            <>
              <stop offset="0" stopColor={shade(metal, 0.75)} />
              <stop offset="0.4" stopColor={shade(metal, 0.2)} />
              <stop offset="0.47" stopColor={shade(metal, -0.42)} />
              <stop offset="0.56" stopColor={shade(metal, -0.05)} />
              <stop offset="1" stopColor={shade(metal, 0.5)} />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={shade(base, 0.2)} stopOpacity={material === "rare" ? 0.6 : 1} />
              <stop offset="0.55" stopColor={base} stopOpacity={material === "rare" ? 0.5 : 1} />
              <stop offset="1" stopColor={shade(base, -0.08)} stopOpacity={material === "rare" ? 0.62 : 1} />
            </>
          )}
        </linearGradient>
        <radialGradient id={g("dish")} cx="0.42" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity={material === "legendary" ? 0.5 : 0.26} />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g("core")} cx="0.5" cy="0.45" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor={shade(accent, 0.55)} stopOpacity="0.75" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g("backlight")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={shade(accent, 0.25)} stopOpacity="0.75" />
          <stop offset="0.6" stopColor={accent} stopOpacity="0.25" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className={styles.shadow} cx={cx} cy={93} rx={width / 2 - 12} ry={7} />
      {earned && <ellipse className={styles.backlight} cx={cx} cy={58} rx={width / 2 + 14} ry={62} fill={url("backlight")} />}

      <rect x={6} y={BODY_Y} width={width - 12} height={BODY_H} rx={17} fill={url("wall")} />
      {material === "rare" && <rect x={10} y={14} width={width - 20} height={74} rx={14} fill={url("core")} />}
      {material === "legendary" && <rect x={6.5} y={BODY_Y + 0.5} width={width - 13} height={BODY_H - 1} rx={16.5} fill="none" stroke={withAlpha(accent, 0.75)} strokeWidth={1.6} />}

      <rect x={face.x} y={face.y} width={face.w} height={face.h} rx={face.r} fill={url("face")} />
      {material === "legendary" && <BrushedLines x={face.x} y={face.y} w={face.w} h={face.h} />}
      <rect x={face.x} y={face.y} width={face.w} height={face.h} rx={face.r} fill={url("dish")} />
      <path
        className={styles.rim}
        d={`M${face.x + face.r} ${face.y + 0.8}H${face.x + face.w - face.r}`}
        stroke={material === "legendary" ? "#ffffff" : withAlpha("#ffffff", material === "rare" ? 0.7 : 0.45)}
      />

      <Legend emblem={emblem} text={state === "secret" ? "?" : text} cx={cx} cy={cy} ink={ink} material={material} metal={metal} accent={accent} faint={state === "locked"} />

      <rect className={styles.wave} x={face.x} y={face.y} width={face.w} height={face.h} rx={face.r} />
    </g>
  );
}

function BrushedLines({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const lines = [];
  for (let k = 1; k < 12; k++) {
    const ly = y + (h * k) / 12;
    lines.push(<path key={k} d={`M${x + 6} ${ly}H${x + w - 6}`} stroke="#ffffff" strokeOpacity={k % 3 === 0 ? 0.22 : 0.1} strokeWidth={0.6} />);
  }
  return <g aria-hidden>{lines}</g>;
}

type LegendProps = { emblem: string; text?: string; cx: number; cy: number; ink: string; material: AchievementTier | "plain"; metal: string; accent: string; faint: boolean };

function Legend({ emblem, text, cx, cy, ink, material, metal, accent, faint }: LegendProps) {
  const glyph = (fill: string, dy = 0, extra?: React.SVGProps<SVGPathElement & SVGTextElement>) =>
    text ? (
      <text
        x={cx}
        y={cy + 7 + dy}
        textAnchor="middle"
        className={text.length > 1 ? styles.word : styles.mark}
        // Long words shrink to stay on the face (about 0.58 em per letter in the display face).
        fontSize={text.length > 1 ? Math.min(26, (cx * 2 - 44) / (text.length * 0.58)) : undefined}
        fill={fill}
        {...extra}
      >
        {text}
      </text>
    ) : (
      <path d={emblem} transform={`translate(${cx - 18} ${cy - 18 + dy}) scale(1.5)`} fill={fill} {...extra} />
    );

  if (material === "legendary") {
    // Engraved: a light lower lip, then the dark cut.
    return (
      <g>
        {glyph(withAlpha("#ffffff", 0.75), 1)}
        {glyph(shade(metal, -0.6))}
      </g>
    );
  }
  if (material === "rare") {
    return (
      <g>
        {glyph("none", 0, { stroke: withAlpha(shade(accent, 0.6), 0.65), strokeWidth: text ? 3 : 2.2, strokeLinejoin: "round" })}
        {glyph(ink)}
      </g>
    );
  }
  return <g opacity={faint ? 0.55 : 0.94}>{glyph(ink)}</g>;
}

type StandaloneProps = KeycapProps & { size?: number; className?: string; title?: string };

/** A keycap on its own, for grids, toasts and results. */
export function Keycap({ size = 64, className, title, ...props }: StandaloneProps) {
  const { width, height } = keycapSize(props.wide);
  return (
    <svg
      className={`${styles.svg} ${className ?? ""}`}
      viewBox={`0 0 ${width} ${height}`}
      width={(size * width) / height}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <KeycapArt {...props} />
    </svg>
  );
}
