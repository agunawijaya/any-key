import type { FinishId, MoveId } from "@/lib/sol-y-sombra/rules";

/*
 * Little pictures for the cards, drawn like the margins of an old bill:
 * the matador as a few strokes, the cape in red, the horns as two curves.
 */

const ink = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const cape = { fill: "var(--sy-red)", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const };

function Figure({ x, lean = 0 }: { x: number; lean?: number }) {
  return (
    <g transform={`translate(${x} 0) rotate(${lean} 0 40)`}>
      <circle cx="0" cy="9" r="3.6" {...ink} />
      <path d="M0 13 L0 28 M0 28 L-4 41 M0 28 L4 41" {...ink} />
    </g>
  );
}

function Horns({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${scale})`} d="M-7 2 C-9 -3 -6 -7 -2 -8 M7 2 C9 -3 6 -7 2 -8 M-7 2 Q0 6 7 2" {...ink} strokeWidth={2} />;
}

export function MoveIcon({ move }: { move: MoveId }) {
  return (
    <svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true" focusable="false">
      {move === "veronica" && (
        <>
          <path d="M14 22 Q32 16 50 22 L54 38 Q32 44 10 38 Z" {...cape} />
          <path d="M28 18 L16 22 M36 18 L48 22" {...ink} strokeWidth={1.8} />
          <Figure x={32} />
          <Horns x={56} y={26} scale={0.8} />
        </>
      )}
      {move === "outside" && (
        <>
          <path d="M40 16 L56 18 L58 40 Q48 43 40 38 Z" {...cape} />
          <path d="M24 17 L44 16" {...ink} strokeWidth={1.8} />
          <Figure x={22} />
          <Horns x={58} y={10} scale={0.7} />
        </>
      )}
      {move === "swirl" && (
        <>
          <path d="M14 30 Q12 18 28 15 Q46 13 50 24 Q52 34 40 37" {...ink} strokeDasharray="3 3" />
          <path d="M40 37 L45 33 M40 37 L44 41" {...ink} />
          <path d="M33 18 Q46 20 48 30 L40 31 Q38 24 33 22 Z" {...cape} />
          <Figure x={30} />
        </>
      )}
    </svg>
  );
}

export function FinishIcon({ finish }: { finish: FinishId }) {
  return (
    <svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true" focusable="false">
      {finish === "over-the-horns" ? (
        <>
          <path d="M8 28 Q14 38 24 40 L28 34 Q18 32 12 26 Z" {...cape} />
          <Figure x={24} lean={14} />
          <path d="M27 15 Q38 10 46 18" {...ink} />
          <Horns x={48} y={30} />
          <path d="M44 22 L52 22 M48 18 L52 22 L48 26" {...ink} strokeWidth={1.8} />
        </>
      ) : (
        <>
          <path d="M10 30 Q16 38 26 40 L28 34 Q20 33 14 27 Z" {...cape} />
          <Figure x={24} />
          <path d="M24 15 L34 12" {...ink} />
          <Horns x={52} y={30} />
          <path d="M60 30 L44 30 M48 26 L44 30 L48 34" {...ink} strokeWidth={1.8} />
        </>
      )}
    </svg>
  );
}
