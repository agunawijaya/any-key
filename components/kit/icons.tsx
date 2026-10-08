/*
 * The shell's icon set, drawn on a 24×24 grid with a 2-unit stroke so every
 * icon has the same weight. They inherit `currentColor`.
 */

type IconProps = { className?: string; size?: number };

function Icon({ className, size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5.5M11 5.5 4.5 12l6.5 6.5" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5.6v12.8a1 1 0 0 0 1.5.9l10-6.4a1 1 0 0 0 0-1.7l-10-6.4A1 1 0 0 0 8 5.6z" fill="currentColor" stroke="none" />
  </Icon>
);

/** A split key ring with one cap hanging from it. */
export const KeyringIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="5.5" />
    <path d="M12.6 12.4 14 14" />
    <rect x="12.5" y="13.5" width="8" height="7.5" rx="2" fill="currentColor" stroke="none" />
  </Icon>
);

export const SoundOnIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor" stroke="none" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
  </Icon>
);

export const SoundOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor" stroke="none" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" fill="currentColor" stroke="none" />
  </Icon>
);

/** Half sun, half moon: follow the system. */
export const SystemIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 5.5C5.5 4.2 8.7 4.2 12 6c3.3-1.8 6.5-1.8 9-.5V19c-2.5-1.3-5.7-1.3-9 .5-3.3-1.8-6.5-1.8-9-.5z" />
    <path d="M12 6v13.5" />
  </Icon>
);

export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </Icon>
);

export const RestartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v4h4" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
  </Icon>
);

export const HallIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 10.5 12 4l8.5 6.5" />
    <path d="M6 9v10.5h12V9" />
    <path d="M10 19.5v-5h4v5" />
  </Icon>
);

export const QuestionIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.3a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.2 1-1.2 1.8v.6" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </Icon>
);

export const StarIcon = ({ filled = true, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <path
      d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8L8 13.6l-4.3-4 5.8-.7z"
      fill={filled ? "currentColor" : "none"}
      strokeWidth={filled ? 1 : 1.6}
    />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
  </Icon>
);

export const DiceIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);

export const TargetIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <rect x="7" y="13" width="3.5" height="3.5" rx="0.6" fill="currentColor" stroke="none" />
  </Icon>
);

export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V3.5" />
    <path d="M5 4h11l-2.5 4L16 12H5" fill="currentColor" />
  </Icon>
);

export const CrownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 8.5 7.5 12 12 5l4.5 7 4-3.5-1.8 10.5H5.3z" fill="currentColor" />
  </Icon>
);

export const BulbIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 17.5h6M10 20.5h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
  </Icon>
);

export const HeartIcon = ({ filled = true, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10A4.4 4.4 0 0 1 12 7.4 4.4 4.4 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" fill={filled ? "currentColor" : "none"} />
  </Icon>
);

/** A filled triangle pointing up, down, left or right: touch pads and prev/next keys. */
export const ArrowIcon = ({ dir, ...p }: IconProps & { dir: "up" | "down" | "left" | "right" }) => {
  const turn = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <Icon {...p}>
      <path d="M12 5.5 19 17H5z" fill="currentColor" transform={`rotate(${turn} 12 12)`} />
    </Icon>
  );
};

export const ChevronIcon = ({ dir, ...p }: IconProps & { dir: "left" | "right" }) => (
  <Icon {...p}>
    <path d={dir === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"} strokeWidth="2.4" />
  </Icon>
);

export const BackspaceIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5h11a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H9l-6.5-7z" />
    <path d="M12 9.5l5 5M17 9.5l-5 5" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v4.5H15" />
  </Icon>
);
