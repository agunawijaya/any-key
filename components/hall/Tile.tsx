"use client";

import { useRef } from "react";
import styles from "./Tile.module.css";

type Props = {
  children: React.ReactNode;
  className?: string;
  label?: string;
};

/** A bento tile that leans toward the pointer and catches a little light. */
export function Tile({ children, className = "", label }: Props) {
  const ref = useRef<HTMLElement>(null);

  function onPointerMove(event: React.PointerEvent) {
    const el = ref.current;
    if (!el || event.pointerType !== "mouse") return;
    const box = el.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width;
    const py = (event.clientY - box.top) / box.height;
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    el.style.setProperty("--ry", `${((px - 0.5) * 5).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - py) * 5).toFixed(2)}deg`);
  }

  function onPointerLeave() {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  }

  return (
    <article
      ref={ref}
      aria-label={label}
      className={`${styles.tile} ${className}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </article>
  );
}
