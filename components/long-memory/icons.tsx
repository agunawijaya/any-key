/* The game's own small icons, drawn on a 24-unit grid in the current text colour. */

type IconProps = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const BookIcon = ({ size = 20, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M3 5.2c3-.9 6-.6 9 1.3v13c-3-1.9-6-2.2-9-1.3zM21 5.2c-3-.9-6-.6-9 1.3v13c3-1.9 6-2.2 9-1.3z" />
      <path d="M5.4 4.7 3 5.2v2.4M18.6 4.7l2.4.5v2.4" />
    </>,
  );

export const UndoIcon = ({ size = 20, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>,
  );

export const SeedIcon = ({ size = 20, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
    <path d="M12 3.5c4.6 0 8 3.6 8 8.3 0 4.4-3.5 8.7-8 8.7s-8-4.3-8-8.7c0-4.7 3.4-8.3 8-8.3z" fill="currentColor" opacity="0.9" />
    <ellipse cx="9.2" cy="8.6" rx="2.2" ry="1.4" fill="white" opacity="0.4" transform="rotate(-28 9.2 8.6)" />
  </svg>
);

export const TerminalIcon = ({ size = 20, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="m7 10 3 2.5L7 15M12.5 15H17" />
    </>,
  );

export const CalendarIcon = ({ size = 20, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>,
  );
