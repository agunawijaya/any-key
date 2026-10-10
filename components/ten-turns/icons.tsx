/*
 * The game's own small icons, drawn as SVG on a 24 by 24 grid, filled with
 * the current text colour unless they carry their own.
 */

type IconProps = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode, label?: string) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
    {children}
  </svg>
);

export const CarrotIcon = ({ size = 22, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M14.8 9.2c1.6 1.6 1.4 3.6-.2 5.2L6.4 21.5c-1 .9-2.6-.6-1.7-1.7l7.1-8.2c1.4-1.6 3.4-1.9 3 .4z" fill="#ef8a2c" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M14.2 9.6c.2-2.3 1-4.7 2.4-6.6M15.2 9.4c1.5-1.4 3.6-2.4 6-2.7M15.6 8.4c1.4-.6 3-.8 4.6-.4" fill="none" stroke="#4f9a3a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.6 15.4l1.2 1.1M8 17.3l1 .9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </>,
  );

export const StoneIcon = ({ size = 22, className }: IconProps) =>
  svg(
    size,
    className,
    <g stroke="currentColor" strokeWidth="1.3">
      <ellipse cx="12" cy="18.5" rx="8" ry="3.4" fill="#b9b2a3" />
      <ellipse cx="12.3" cy="13.2" rx="5.8" ry="2.8" fill="#cdc5b4" />
      <ellipse cx="11.9" cy="8.8" rx="3.6" ry="2" fill="#e2dccd" />
    </g>,
  );

export const SpadeIcon = ({ size = 22, className }: IconProps) =>
  svg(
    size,
    className,
    <g stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M7 3.5h4.2" strokeLinecap="round" fill="none" />
      <path d="M9.1 3.5v8.4" strokeLinecap="round" fill="none" />
      <path d="M5.8 11.8h6.6l-.6 5.4c-.3 2-1.5 3.4-2.7 3.4s-2.4-1.4-2.7-3.4z" fill="#a8b4c4" />
      <path d="M15 20.5c1-1.8 3.2-2.6 5.5-2" fill="none" strokeLinecap="round" />
      <ellipse cx="17.5" cy="21" rx="3.6" ry="1.4" fill="#8a5a3b" />
    </g>,
  );

export const HatIcon = ({ size = 22, className, gone = false }: IconProps & { gone?: boolean }) =>
  svg(
    size,
    className,
    <g stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" opacity={gone ? 0.35 : 1}>
      <path d="M4.5 16.5c0-5 3.3-8.8 7.5-8.8s7.5 3.8 7.5 8.8z" fill="#2e8f88" />
      <rect x="3.6" y="15.2" width="16.8" height="3.8" rx="1.6" fill="#21706b" />
      <circle cx="12.6" cy="5.6" r="2.4" fill="#f7eedb" />
      {gone && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </g>,
  );

export const FootprintIcon = ({ size = 14, className, filled = true }: IconProps & { filled?: boolean }) => (
  <svg viewBox="0 0 12 16" width={size * 0.75} height={size} className={className} aria-hidden="true">
    <path
      d="M6 1.5c2.2 0 3.6 2.4 3.6 5.2S8.2 12 6 12 2.4 9.5 2.4 6.7 3.8 1.5 6 1.5zM3.4 13.2c.9-.4 4.3-.4 5.2 0 .6.3.5 1.3-.2 1.5-1 .3-3.8.3-4.8 0-.7-.2-.8-1.2-.2-1.5z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.2}
    />
  </svg>
);

/** An arrow pointing at an angle in degrees, counter-clockwise from east, as the pit counts them. */
export const StepArrow = ({ angle, size = 18 }: { angle: number; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ transform: `rotate(${-angle}deg)` }}>
    <path d="M4 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Two feet side by side: staying where you are. */
export const StayIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <g fill="currentColor">
      <ellipse cx="8.6" cy="11" rx="2.6" ry="4.4" />
      <ellipse cx="15.4" cy="11" rx="2.6" ry="4.4" />
      <ellipse cx="8.6" cy="17.6" rx="1.9" ry="1.6" />
      <ellipse cx="15.4" cy="17.6" rx="1.9" ry="1.6" />
    </g>,
  );

export const RabbitIcon = ({ size = 22, className }: IconProps) =>
  svg(
    size,
    className,
    <g stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M8.4 2.4c1.4-.3 2.2 1.8 2.3 4.8.1 1 0 2 0 2.8H8.4C7.8 8.6 7.4 7 7.2 5.6c-.3-1.8 0-3 1.2-3.2zM15.6 2.4c1.2.2 1.5 1.4 1.2 3.2-.2 1.4-.6 3-1.2 4.4h-2.3c0-.8-.1-1.8 0-2.8.1-3 .9-5.1 2.3-4.8z" fill="#fdf8f0" />
      <ellipse cx="12" cy="15.4" rx="7.4" ry="6.4" fill="#fdf8f0" />
      <circle cx="9.4" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="14" r="1" fill="currentColor" stroke="none" />
      <path d="M11 16.6h2l-1 1.1z" fill="#e8848f" />
    </g>,
  );
