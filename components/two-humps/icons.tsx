/*
 * Two Humps' own icons, drawn as SVG on a 24-unit grid with round strokes,
 * to sit beside the kit's icons. Each takes a size and inherits its colour.
 */

type IconProps = { size?: number; className?: string };

function Icon({ size = 24, className, children, fill }: IconProps & { children: React.ReactNode; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** A felt-covered canteen on its strap. */
export const CanteenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 3.5h5M10.5 3.5v2.4M13.5 3.5v2.4" />
    <circle cx="12" cy="13.5" r="6.8" />
    <path d="M7.2 13.5c1.6 1.4 8 1.4 9.6 0" />
  </Icon>
);

/** A camel at a walk, side on. */
export const WalkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 13.5c0-2.6 1.6-4 3-4s1.6-2.2 2.9-2.2 1.5 2 2.4 2 1.1-2 2.5-2 1.9 2.4 2.4 3.4l1.4-2.6c.3-.6 1-.8 1.5-.4" />
    <path d="M5.5 14v5.5M9 14.5v5M14 14.5l.6 5M17.4 13.4l-.4 6.1" />
  </Icon>
);

/** A camel stretched out at full gallop, with speed lines. */
export const GallopIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5c0-2.4 1.5-3.6 2.8-3.6s1.5-2 2.7-2 1.4 1.8 2.2 1.8 1-1.8 2.3-1.8 1.8 2.2 2.3 3.1l1.6-2.1c.4-.5 1-.6 1.5-.2" />
    <path d="M6.5 13l-3 4.6M9.4 13.6l-1.6 5M14.3 13.6l3 4.4M17.6 12.6l3.4 3.2M1 9h2.4M1.6 12h1.6" />
  </Icon>
);

/** A small tent with a fire beside it. */
export const CampIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 19.5L9 6.5l6.5 13zM9 6.5v13M2 19.5h20" />
    <path d="M19 19.3c-1.6 0-2.4-1-2.4-2.2 0-1.6 1.6-2 1.8-3.8 1.2.9 3 2.2 3 3.8 0 1.2-.9 2.2-2.4 2.2z" />
  </Icon>
);

/** A brass spyglass. */
export const ScanIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 15.5l11-6.3 2 3.4-11 6.3zM14 9.2l3.6-2.1 2 3.5-3.6 2" />
    <path d="M8.5 17.5l1.6 3.5M7.4 18.1L5.6 21.2" />
  </Icon>
);

/** A hand mirror throwing a flash of light. */
export const SignalIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="15" r="4.2" />
    <path d="M5.2 18l-2.7 3.4M12.5 10.5L16 7M14 13.5l4.5-1.2M10.6 9l1-4.4" />
  </Icon>
);

/** One sip of water. */
export const DropIcon = (p: IconProps) => (
  <Icon {...p} fill>
    <path d="M12 2.8c3.3 4.3 6 7.7 6 11.2a6 6 0 0 1-12 0c0-3.5 2.7-6.9 6-11.2z" />
  </Icon>
);

/** A hump, for the camel's stamina. */
export const HumpIcon = (p: IconProps) => (
  <Icon {...p} fill>
    <path d="M2 20c1.2-7.4 4.6-12.5 10-12.5S20.8 12.6 22 20z" />
  </Icon>
);

/** An oasis: a desert poplar over a pool, with reeds. */
export const OasisIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 14.5V8.8M15 8.8c-2.6 0-4-1.6-4-3.4C11 3.6 12.8 2.5 15 2.5s4 1.1 4 2.9c0 1.8-1.4 3.4-4 3.4zM3 18.5c2.5-1.6 6.5-1.6 9 0s6.5 1.6 9 0M6 15.5v-3.5M8.4 15.5v-4.6" />
  </Icon>
);

/** A wall of dust rolling in. */
export const StormIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 18.5h18M3 18.5c-.3-3.6.5-7.8 3.4-8.4.6-3 3-4.6 5.4-3.4 1.7-1.5 4.6-.6 5.2 1.8 2.4.2 3.4 2.6 2.4 4.6M17 15h4.5M14 12.5h4" />
  </Icon>
);

/** A rival's pennant on a pole. */
export const PennantIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 21V3.5l12 4.2L6 12" />
  </Icon>
);

/** The gang's soup ladle. */
export const LadleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18.5 3.5L10 14M4 14.5h9a4.5 4.5 0 0 1-9 0z" />
  </Icon>
);

/** A handful of seeds. */
export const SeedsIcon = (p: IconProps) => (
  <Icon {...p} fill>
    <ellipse cx="8" cy="9" rx="2.2" ry="3.2" transform="rotate(-25 8 9)" />
    <ellipse cx="15.5" cy="8.5" rx="2.2" ry="3.2" transform="rotate(20 15.5 8.5)" />
    <ellipse cx="11.5" cy="16" rx="2.2" ry="3.2" transform="rotate(-8 11.5 16)" />
  </Icon>
);

/** Reins: pull to stop the camel running on. */
export const ReinsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19c4-1 7-5 8.5-10.5M20 19c-4-1-7-5-8.5-10.5M9 5.5h6" />
  </Icon>
);

/** A folded paper map with a dashed route. */
export const MapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6.5l5.5-2.5 7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20zM8.5 4v13.5M15.5 6.5V20" />
  </Icon>
);

/** An old monitor with a prompt on it. */
export const TerminalIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M7 9l2.5 2L7 13M11.5 13h4M9 20.5h6M12 17v3.5" />
  </Icon>
);

/** A notebook of records. */
export const JournalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3.5h11.5a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6zM6 3.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2M9.5 8h6M9.5 11.5h6M9.5 15h3.5" />
  </Icon>
);
