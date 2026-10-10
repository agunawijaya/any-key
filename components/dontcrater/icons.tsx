import type { FuelChoice } from "@/lib/lander/difficulty";
import type { GradeId } from "@/lib/lander/grades";
import type { WorldId } from "@/lib/lander/worlds";

/*
 * Don't Crater's small pictures: the four worlds as little planets in their
 * own colours, a mark for each way a flight can end, the modes, and the
 * flight tools. Drawn on a 24×24 grid; everything but the worlds takes
 * currentColor.
 */

type Props = { size?: number; className?: string };

function Glyph({ size = 18, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const solid = { fill: "currentColor", stroke: "none" } as const;

/* ---------- The worlds ---------- */

const WORLD_ART: Record<WorldId, React.ReactNode> = {
  moon: (
    <>
      <circle cx="12" cy="12" r="10" fill="#d8d4cb" />
      <circle cx="8.5" cy="9" r="2.3" fill="#b5b0a5" />
      <circle cx="15" cy="14.5" r="3" fill="#b5b0a5" />
      <circle cx="13.5" cy="7" r="1.2" fill="#b5b0a5" />
      <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 0 0-20z" fill="#000" opacity="0.12" />
    </>
  ),
  mars: (
    <>
      <circle cx="12" cy="12" r="10" fill="#cf5a2e" />
      <path d="M2.6 13.5c3.4 1.4 7 .2 10.2 1.6 3 1.3 5.6 1 8.4-.3a10 10 0 0 1-18.6-1.3z" fill="#9b3a1a" />
      <path d="M8 3c2.4-.9 5.6-.9 8 0-2.4.8-5.6.8-8 0z" fill="#fff4ea" />
      <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 0 0-20z" fill="#000" opacity="0.14" />
    </>
  ),
  psyche: (
    <>
      <path d="M5 7.5C7 3.6 13 2.5 17.2 4.6c3.7 1.9 4.6 6.6 3 10.3-1.8 4.2-6.8 6.4-11.3 5.1C4.3 18.6 2.7 12 5 7.5z" fill="#a8a49c" />
      <circle cx="9" cy="10" r="2" fill="#8a867e" />
      <circle cx="15.5" cy="14" r="1.6" fill="#8a867e" />
      <path d="M7.5 6.5c2-1.6 5-2 7.2-1.2" stroke="#e9e6df" strokeWidth="1.3" />
    </>
  ),
  earth: (
    <>
      <circle cx="12" cy="12" r="10" fill="#2f7de1" />
      <path d="M6 6.5c2 .3 3 1.8 2.5 3.4-.4 1.5 1 2.4.3 4-.6 1.5-2.4 1.6-3.9 1.4A10 10 0 0 1 6 6.5zM13.5 9c1.8-1 4 0 4.6 1.9.5 1.6-.4 3.4-2 4-1.7.7-3.4-.6-3.5-2.3 0-1.4-.6-2.6.9-3.6z" fill="#3fb36b" />
      <path d="M5 12.5c3-1 5.5 1.2 8.5.2 2.4-.8 4-.3 6 .6" stroke="#ffffff" strokeWidth="1.1" opacity="0.8" />
      <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 0 0-20z" fill="#000" opacity="0.14" />
    </>
  ),
};

export function WorldIcon({ world, size = 18, className }: Props & { world: WorldId }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {WORLD_ART[world]}
    </svg>
  );
}

/* ---------- How a flight ended ---------- */

const GRADE_ART: Record<GradeId, React.ReactNode> = {
  // A pat of butter, softening.
  butter: (
    <>
      <path d="M3 13l8.5-4.2L21 11.8v4.8l-8.5 4.2L3 17.8z" />
      <path d="M3 13l9.5 3 8.5-4.2M12.5 16v4.8" />
    </>
  ),
  smooth: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </>
  ),
  bumpy: <path d="M2.5 13c2-3 3.5-3 5 0s3.5 3 5 0 3.5-3 5 0 2.5 2 4 0" />,
  // Down, then over: the lander on its side.
  tipped: (
    <>
      <g transform="rotate(-62 12 13)">
        <path d="M8.5 11a3.5 3.5 0 0 1 7 0v1.5h-7zM6.5 12.5h11M8.5 12.5 6 17M15.5 12.5 18 17" />
      </g>
      <path d="M2.5 20.5h19" />
    </>
  ),
  splash: (
    <>
      <path d="M12 3c2.6 3 4 5.2 4 7.2a4 4 0 0 1-8 0C8 8.2 9.4 6 12 3z" />
      <path d="M3 17c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0M3 21c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
    </>
  ),
  dented: (
    <>
      <path d="M7 12.5a5 5 0 0 1 10 0v1.5H7z" />
      <path d="M11 7.6 12.4 10l-1.6 1.4" />
      <path d="M5 14h14M7 14l-2.5 5M17 14l2.5 5" />
    </>
  ),
  // Bits flying off in every direction.
  scrap: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
      <circle cx="12" cy="12" r="2.2" {...solid} />
    </>
  ),
  confetti: (
    <>
      <path d="M4 6.5l2.2-1M17.5 4l1 2.2M9.5 3.5l.4 2.3M20 11l-2.2.6M4.5 13l2-.9M14 9.5l1.2 2" />
      <rect x="8" y="16" width="2.4" height="2.4" rx="0.5" transform="rotate(20 9 17)" {...solid} />
      <rect x="15" y="15.5" width="2.4" height="2.4" rx="0.5" transform="rotate(-25 16 16.5)" {...solid} />
      <circle cx="12" cy="20" r="1.1" {...solid} />
    </>
  ),
  crater: (
    <>
      <ellipse cx="12" cy="15" rx="9.5" ry="4.5" />
      <ellipse cx="12" cy="15.5" rx="5" ry="2.2" {...solid} />
      <path d="M6 8l1.5 2.5M12 5.5v3M18 8l-1.5 2.5" />
    </>
  ),
  oil: (
    <>
      <path d="M12 2.5c3.4 4 5.5 7.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.8 2.1-6 5.5-10z" {...solid} />
      <path d="M9.5 13.5a2.6 2.6 0 0 0 2 2.5" stroke="var(--icon-shine, #ffffff)" strokeWidth="1.4" opacity="0.7" />
    </>
  ),
  // Heading off the wrong way: up, past the stars.
  lost: (
    <>
      <path d="M12 21V8M7.5 12.5 12 8l4.5 4.5" />
      <path d="M5 4.5h.01M18.5 3.5h.01M20 9h.01M3.5 10h.01" strokeWidth="2.6" />
    </>
  ),
};

export function GradeIcon({ grade, ...props }: Props & { grade: GradeId }) {
  return <Glyph {...props}>{GRADE_ART[grade]}</Glyph>;
}

/* ---------- Modes ---------- */

export type LanderMode = "live" | "free" | "ten" | "missions" | "daily" | "1979";

const MODE_ART: Record<LanderMode, React.ReactNode> = {
  live: (
    <>
      <path d="M12 2.5c3 2.3 4.3 5.6 4.1 9.6l2.4 3v4.3l-3.2-1.5H8.7l-3.2 1.5v-4.3l2.4-3C7.7 8.1 9 4.8 12 2.5z" />
      <circle cx="12" cy="9.5" r="1.7" />
      <path d="M10.5 20.5 12 23l1.5-2.5" />
    </>
  ),
  free: (
    <>
      <path d="M2 19.5 8 9l3.5 5.5L14.5 10l7.5 9.5z" />
      <path d="M6.6 11.5 8 9l1.6 2.5" />
    </>
  ),
  ten: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5" />
    </>
  ),
  missions: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" {...solid} />
    </>
  ),
  daily: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <rect x="7" y="13" width="3.5" height="3.5" rx="0.6" {...solid} />
    </>
  ),
  "1979": (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M7 9l2.5 2L7 13M12 13h4M9 20.5h6M12 17v3.5" />
    </>
  ),
};

export function ModeIcon({ mode, ...props }: Props & { mode: LanderMode }) {
  return <Glyph {...props}>{MODE_ART[mode]}</Glyph>;
}

/* ---------- Flight tools and marks ---------- */

export const WarpIcon = (p: Props) => (
  <Glyph {...p}>
    <path d="M3.5 6.5v11L11 12zM12.5 6.5v11L20 12z" {...solid} />
  </Glyph>
);

/** Landing assist: a lifebuoy. */
export const AssistIcon = (p: Props) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.8" />
    <path d="M6 6l3.3 3.3M18 6l-3.3 3.3M6 18l3.3-3.3M18 18l-3.3-3.3" strokeWidth="2.6" />
  </Glyph>
);

/** Burn guide: a crosshair. */
export const GuideIcon = (p: Props) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" />
  </Glyph>
);

/** Scan assist: a satellite. */
export const ScanIcon = (p: Props) => (
  <Glyph {...p}>
    <rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)" />
    <path d="M7.8 7.8 4 4M16.2 16.2 20 20" />
    <path d="M2.5 6.5l4-4 3 3-4 4zM21.5 17.5l-4 4-3-3 4-4z" {...solid} />
    <path d="M16.5 4.5a4 4 0 0 1 3 3" />
  </Glyph>
);

/** Side jets: a puff of gas behind an arrow pointing the way they push. */
export function JetIcon({ dir, ...p }: Props & { dir: "left" | "right" }) {
  return (
    <Glyph {...p}>
      <g transform={dir === "left" ? "matrix(-1 0 0 1 24 0)" : undefined}>
        <path d="M10 12h10M15 7l5 5-5 5" strokeWidth="2.2" />
        <circle cx="6" cy="12" r="2.1" {...solid} />
        <circle cx="2.4" cy="12" r="1.3" {...solid} />
      </g>
    </Glyph>
  );
}

/** A narrow ledge: a ruler. */
export const RulerIcon = (p: Props) => (
  <Glyph {...p}>
    <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
    <path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4" />
  </Glyph>
);

/** Diverted: landed safely, but somewhere else. */
export const DivertIcon = (p: Props) => (
  <Glyph {...p}>
    <path d="M4 19V11a5 5 0 0 1 5-5h9" />
    <path d="M15 2.5 18.5 6 15 9.5" />
  </Glyph>
);

/** The fuel setting's mark: a green drop of plenty, a flame for Tight, a blue loop for Unlimited. Standard has none. */
export function FuelMark({ difficulty, size = 14 }: { difficulty: FuelChoice; size?: number }) {
  if (difficulty === "standard") return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {difficulty === "unlimited" ? (
        <path d="M12 12c-1.7-2.3-3.1-3.4-4.7-3.4a3.4 3.4 0 0 0 0 6.8c1.6 0 3-1.1 4.7-3.4s3.1-3.4 4.7-3.4a3.4 3.4 0 0 1 0 6.8c-1.6 0-3-1.1-4.7-3.4z" fill="none" stroke="#2f7df6" strokeWidth="2.6" strokeLinecap="round" />
      ) : difficulty === "generous" ? (
        <path d="M12 2.5c3.4 4 5.5 7.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.8 2.1-6 5.5-10z" fill="#1fbf6f" />
      ) : (
        <path d="M12 2.5c3 3.4 6 6.5 6 10.5a6 6 0 0 1-12 0c0-2.4 1.3-4.2 3-5.5 0 2 1 3.2 2.3 3.6C11 8.5 11.2 5.5 12 2.5z" fill="#ff6b1a" />
      )}
    </svg>
  );
}
