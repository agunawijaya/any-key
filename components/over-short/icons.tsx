import type { Medal } from "@/lib/over-short/missions";

/* Over / Short's own small icons, drawn on a 24-unit grid in the current colour. */

type IconProps = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** The receiver of a field telephone. */
export const TelephoneIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <path
      d="M6.6 3.5c.7-.3 1.5 0 1.9.6l1.7 2.6c.4.6.3 1.4-.2 1.9l-1.2 1.1c.9 1.9 2.4 3.4 4.3 4.3l1.1-1.2c.5-.5 1.3-.6 1.9-.2l2.6 1.7c.6.4.9 1.2.6 1.9l-.6 1.4c-.4.9-1.3 1.5-2.3 1.4C9.9 18.5 5.5 14.1 5 7.6c-.1-1 .5-1.9 1.4-2.3z"
      fill="currentColor"
    />,
  );

const MEDAL_COLORS: Record<Medal, { face: string; ribbon: string }> = {
  gold: { face: "#d8a933", ribbon: "#8f3a2a" },
  silver: { face: "#b9bdc2", ribbon: "#2f4f6e" },
  bronze: { face: "#b0723c", ribbon: "#3f5a37" },
};

/** A medal on its ribbon. */
export function MedalIcon({ medal, size = 18, className }: IconProps & { medal: Medal }) {
  const c = MEDAL_COLORS[medal];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} role="img" aria-label={`${medal} medal`}>
      <path d="M7 2h4l2 7H9zM13 2h4l-2 7h-4z" fill={c.ribbon} />
      <circle cx="12" cy="15" r="6.5" fill={c.face} stroke="rgb(0 0 0 / 0.35)" strokeWidth="1" />
      <path d="m12 11.2 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="rgb(255 255 255 / 0.55)" />
    </svg>
  );
}

/** A shell standing on its base: one round of ammunition. */
export const RoundIcon = ({ size = 18, className }: IconProps) =>
  svg(size, className, <path d="M12 2c2 2.2 3 4.8 3 7.6V20H9V9.6C9 6.8 10 4.2 12 2zm-3 19h6v1.5H9z" fill="currentColor" />);

/** A windsock on its pole, streaming. */
export const WindIcon = ({ size = 18, className }: IconProps) =>
  svg(size, className, <path d="M4 3h1.6v19H4zm2.4 1.5 13 2.2v5.6l-13 2.2zm2 1.8v6.4l2.4-.4V6.7zm4.6.8v4.8l2.4-.4V7.3z" fill="currentColor" />);

/** A stopwatch. */
export const ClockIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M10 1.5h4V3h-4z" fill="currentColor" />
      <circle cx="12" cy="13.5" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8.5v5.3l3.4 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>,
  );

/** Wheels and an arrow: move the gun. */
export const MoveIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <circle cx="7" cy="17" r="3.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9.5 15.5 20 9M3 6h9m0 0-3-3m3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  );

/** A burst: the enemy's rounds. */
export const BurstIcon = ({ size = 18, className }: IconProps) =>
  svg(size, className, <path d="m12 2 1.8 5.3L19 5l-2.3 5.1L22 12l-5.3 1.8L19 19l-5.2-2.3L12 22l-1.8-5.3L5 19l2.3-5.2L2 12l5.3-1.9L5 5l5.2 2.3z" fill="currentColor" />);

/** A star shell under its parachute, its light radiating. */
export const FlareIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M6 7a6 4 0 0 1 12 0z" fill="currentColor" />
      <path d="M6.3 7.2 12 15l5.7-7.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="16.5" r="2.4" fill="currentColor" />
      <path d="M12 20.5V23M7.6 18.8l-1.8 1.8M16.4 18.8l1.8 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>,
  );

/** Two crossed barrels: a duel. */
export const DuelIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <path d="m3 19 9.6-9.6 1.8 1.8L4.8 20.8zM21 19l-9.6-9.6-1.8 1.8 9.6 9.6zM2.5 15.5l3 3M21.5 15.5l-3 3M11 4h2v4h-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  );
