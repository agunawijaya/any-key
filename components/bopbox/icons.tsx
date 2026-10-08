import type { StyleId } from "@/lib/music/arrange";
import type { InstrumentFamily } from "@/lib/music/arrange/types";

/*
 * Bop Box's own pictures for instruments and styles, drawn on a 24×24 grid
 * with the same stroke as the shell's icons, so the band reads at a glance
 * in the mixer, on the stage and on the style cards.
 */

type Props = { size?: number; className?: string };

function Glyph({ size = 20, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const solid = { fill: "currentColor", stroke: "none" } as const;

const FAMILY: Record<InstrumentFamily, React.ReactNode> = {
  keys: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 13v6M12 13v6M16 13v6" />
      <path d="M6.6 5h2.8v8H6.6zM10.6 5h2.8v8h-2.8zM14.6 5h2.8v8h-2.8z" {...solid} />
    </>
  ),
  musicbox: (
    <>
      <rect x="3.5" y="10" width="14" height="9" rx="1.5" />
      <path d="M3.5 10 6 5.5h9.5L17.5 10" />
      <path d="M17.5 14.5H21V11" />
      <circle cx="10.5" cy="14.5" r="1.7" />
    </>
  ),
  mallets: (
    <>
      <path d="M4 7v11M8 8v9M12 9v7M16 10v5" strokeWidth="2.6" />
      <path d="M14 4.5 19.5 10" />
      <circle cx="20.2" cy="10.7" r="1.7" {...solid} />
    </>
  ),
  bells: (
    <>
      <path d="M5.5 17c1.2-1.3 1.5-3.3 1.5-6.5a5 5 0 0 1 10 0c0 3.2.3 5.2 1.5 6.5z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
      <path d="M12 3.5v2" />
    </>
  ),
  organ: (
    <>
      <path d="M5 19v-8M9 19V6M13 19V8M17 19V4" strokeWidth="2.6" />
      <path d="M3 20.5h17" />
    </>
  ),
  accordion: (
    <>
      <rect x="2.5" y="6" width="4" height="12" rx="1" />
      <rect x="17.5" y="6" width="4" height="12" rx="1" />
      <path d="M6.5 7 9 9.5 11.5 7 14 9.5 17.5 7M6.5 17 9 14.5l2.5 2.5 2.5-2.5 3.5 2.5M9 9.5v5M14 9.5v5" />
    </>
  ),
  guitar: (
    <>
      <path d="M13.2 10.8a3.4 3.4 0 0 0-4.6.7 2.4 2.4 0 0 1-2 1 4.3 4.3 0 1 0 4.9 4.9 2.4 2.4 0 0 1 1-2 3.4 3.4 0 0 0 .7-4.6z" />
      <path d="M13.2 10.8 20 4M18.5 2.5 21.5 5.5" />
      <circle cx="9.3" cy="14.7" r="1.2" {...solid} />
    </>
  ),
  plucked: (
    <>
      <circle cx="8" cy="16" r="5" />
      <path d="M11.5 12.5 20 4M18.5 2.5 21.5 5.5M5.5 16h5" />
    </>
  ),
  bowed: (
    <>
      <path d="M12 4v4M9.5 8h5l-.5 3 1.8 1.8a3.8 3.8 0 0 1-2.7 6.4h-2.2a3.8 3.8 0 0 1-2.7-6.4L10 11z" />
      <path d="M3 21 21 7" strokeWidth="1.3" />
    </>
  ),
  harp: (
    <>
      <path d="M6 3v18h12C14.5 16.5 10.5 10 6 3z" />
      <path d="M9 9v12M12 13v8M15 17v4" strokeWidth="1.3" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </>
  ),
  brass: (
    <>
      <path d="M3 10.5h11M14 7.5l6-3v13l-6-3z" />
      <path d="M6 10.5v4M9 10.5v4M11.5 10.5v4M4.5 14.5h8" />
    </>
  ),
  horn: (
    <>
      <circle cx="10" cy="12" r="5.5" />
      <circle cx="10" cy="12" r="2" />
      <path d="M15.5 12h1.5l4-4.5v9L17 12" />
    </>
  ),
  sax: (
    <>
      <path d="M4.5 3.5 8.5 6v9a4.5 4.5 0 0 0 9 0v-1.5" />
      <path d="M14.8 13.5h5.4l-1-3.2h-3.4z" />
      <circle cx="8.5" cy="9" r="0.95" {...solid} />
      <circle cx="8.5" cy="12" r="0.95" {...solid} />
    </>
  ),
  woodwind: (
    <>
      <path d="M3.5 18.8 18.8 3.5l1.7 1.7L5.2 20.5z" />
      <circle cx="9.4" cy="14.6" r="1" {...solid} />
      <circle cx="12.2" cy="11.8" r="1" {...solid} />
      <circle cx="15" cy="9" r="1" {...solid} />
    </>
  ),
  synth: <path d="M3 17 9 7v10l6-10v10l6-10" />,
  pad: <path d="M7 18a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-1.2A4.1 4.1 0 0 1 17.5 18z" />,
  drums: (
    <>
      <ellipse cx="12" cy="10" rx="8" ry="3" />
      <path d="M4 10v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V10" />
      <path d="M8 2.5l3 5M16 2.5l-3 5" />
    </>
  ),
  "hand-drum": (
    <>
      <path d="M6.5 4.5c-1.6 5-1.6 10 0 15h11c1.6-5 1.6-10 0-15z" />
      <path d="M6.5 4.5h11M6.5 19.5h11M9.5 4.5l-.8 15M14.5 4.5l.8 15" />
    </>
  ),
  cowbell: (
    <>
      <path d="M8 5h8l2.5 13h-13z" />
      <path d="M10 5V2.5h4V5M5.5 18h13" />
    </>
  ),
  speaker: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <circle cx="12" cy="13.5" r="4" />
      <circle cx="12" cy="13.5" r="1" {...solid} />
      <path d="M8 7h8" />
    </>
  ),
};

const STYLE_ONLY: Partial<Record<StyleId, React.ReactNode>> = {
  house: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M5 13h14M12 6v14M7.2 8.5h9.6M7.2 17.5h9.6M12 6V2" />
    </>
  ),
  koplo: <path d="M12 3c3 3.4 6 6.5 6 10.5a6 6 0 0 1-12 0c0-2.4 1.3-4.2 3-5.5 0 2 1 3.2 2.3 3.6C11 9 11.2 6 12 3z" />,
  lofi: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8.5" cy="11.5" r="2" />
      <circle cx="15.5" cy="11.5" r="2" />
      <path d="M8.5 9.5h7M7 18l1.5-3h7l1.5 3" />
    </>
  ),
  hiphop: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4" height="6.5" rx="1.5" />
      <rect x="17" y="14" width="4" height="6.5" rx="1.5" />
    </>
  ),
  remix: (
    <>
      <path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3" />
      <path d="M7.4 15h9.2" />
    </>
  ),
  original: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M15 3v3h3M9 10h6M9 13h6M9 16h6" />
      <circle cx="10.5" cy="16" r="1.4" {...solid} />
    </>
  ),
};

/** Styles that are best told by their lead instrument. */
const STYLE_FAMILY: Partial<Record<StyleId, InstrumentFamily>> = {
  orchestra: "bowed",
  pop: "voice",
  jazz: "sax",
  dangdut: "hand-drum",
  solo: "keys",
  pc81: "speaker",
};

export function InstrumentIcon({ family, ...props }: Props & { family: InstrumentFamily }) {
  return <Glyph {...props}>{FAMILY[family]}</Glyph>;
}

export function StyleIcon({ style, ...props }: Props & { style: StyleId }) {
  const family = STYLE_FAMILY[style];
  return <Glyph {...props}>{family ? FAMILY[family] : STYLE_ONLY[style]}</Glyph>;
}
