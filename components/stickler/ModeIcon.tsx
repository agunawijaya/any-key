import type { ModeId } from "@/lib/stickler/modes";

/*
 * Stickler's modes as small drawings: a lit match for the classic game, a
 * handful of sticks, the ladder, the daily calendar, two players, and the
 * 1981 screen. On a 24×24 grid, in currentColor.
 */

const ART: Record<ModeId, React.ReactNode> = {
  classic: (
    <>
      <path d="M12 9.5V21" strokeWidth="2.6" />
      <path d="M12 2c2.4 2.6 3.4 4.4 3.4 6a3.4 3.4 0 0 1-6.8 0c0-1.6 1-3.4 3.4-6z" fill="currentColor" stroke="none" />
    </>
  ),
  handfuls: (
    <>
      <path d="M6 21V8M10 21V6M14 21V6M18 21V8" strokeWidth="2.2" />
      <path d="M3.5 13.5c3 1.8 14 1.8 17 0" />
    </>
  ),
  ladder: <path d="M7 2.5v19M17 2.5v19M7 7h10M7 12h10M7 17h10" />,
  daily: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <rect x="7" y="13" width="3.5" height="3.5" rx="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  versus: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M2.5 20a5.5 5.5 0 0 1 11 0M10.5 20a5.5 5.5 0 0 1 11 0" />
    </>
  ),
  "1981": (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M7 9l2.5 2L7 13M12 13h4M9 20.5h6M12 17v3.5" />
    </>
  ),
};

export function ModeIcon({ mode, size = 26 }: { mode: ModeId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ART[mode]}
    </svg>
  );
}
