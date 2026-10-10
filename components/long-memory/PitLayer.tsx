"use client";

import { useRef } from "react";
import { isStore, pitIndexOf, sideOf, type Side } from "@/lib/long-memory/board";
import type { PitEllipse } from "./useBoardScene";
import styles from "./PitLayer.module.css";

/*
 * Invisible buttons over the carved pits: what the mouse, the keyboard and
 * screen readers actually press. A click sows. A press that moves picks the
 * seeds up instead, and the screen lets the player carry them by hand.
 */

type Props = {
  pits: PitEllipse[];
  counts: number[];
  /** Pits that can be sown now. */
  movable: number[];
  names: Record<Side, string>;
  focus: number | null;
  /** The pit the hidden help suggests, said in its label too. */
  hint?: number | null;
  onFocusPit: (pit: number | null) => void;
  onHover: (pit: number | null) => void;
  onSow: (pit: number) => void;
  onDragStart: (pit: number, x: number, y: number) => boolean;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
};

const DRAG_THRESHOLD = 7;

const possessive = (name: string) => (name === "You" ? "Your" : name.endsWith("s") ? `${name}'` : `${name}'s`);

export function PitLayer({ pits, counts, movable, names, focus, hint = null, onFocusPit, onHover, onSow, onDragStart, onDragMove, onDragEnd }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const press = useRef<{ pit: number; x: number; y: number; dragging: boolean; id: number } | null>(null);

  const local = (event: React.PointerEvent) => {
    const box = layer.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  return (
    <div ref={layer} className={styles.layer}>
      {pits
        .filter((p) => !isStore(p.hole))
        .map((p) => {
          const side = sideOf(p.hole);
          const enabled = movable.includes(p.hole);
          const n = counts[p.hole];
          const label = `${possessive(names[side])} pit ${pitIndexOf(p.hole) + 1}, ${n} ${n === 1 ? "seed" : "seeds"}${hint === p.hole ? ", suggested" : ""}`;
          return (
            <button
              key={p.hole}
              type="button"
              className={styles.pit}
              data-focus={focus === p.hole}
              disabled={!enabled}
              aria-label={label}
              style={{ left: `${p.cx - p.rx}px`, top: `${p.cy - p.ry}px`, width: `${p.rx * 2}px`, height: `${p.ry * 2}px` }}
              onPointerEnter={() => onHover(p.hole)}
              onPointerLeave={() => onHover(null)}
              onFocus={() => onFocusPit(p.hole)}
              onBlur={() => onFocusPit(null)}
              onPointerDown={(event) => {
                if (!enabled || event.button !== 0) return;
                const at = local(event);
                press.current = { pit: p.hole, ...at, dragging: false, id: event.pointerId };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const held = press.current;
                if (!held || held.id !== event.pointerId) return;
                const at = local(event);
                if (!held.dragging && Math.hypot(at.x - held.x, at.y - held.y) > DRAG_THRESHOLD) {
                  held.dragging = onDragStart(held.pit, at.x, at.y);
                }
                if (held.dragging) onDragMove(at.x, at.y);
              }}
              onPointerUp={(event) => {
                const held = press.current;
                press.current = null;
                if (!held || held.id !== event.pointerId) return;
                const at = local(event);
                if (held.dragging) onDragEnd(at.x, at.y);
                else onSow(held.pit);
              }}
              onPointerCancel={(event) => {
                const held = press.current;
                press.current = null;
                if (held?.dragging) {
                  const at = local(event);
                  onDragEnd(at.x, at.y);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (enabled) onSow(p.hole);
                }
              }}
            />
          );
        })}
    </div>
  );
}
