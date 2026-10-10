"use client";

import { useCallback, useRef } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { useShell } from "@/components/kit/shell-context";
import type { Era } from "./eras/types";
import { useCanvasPainter } from "./hooks";
import { DemoLoop } from "./scene/demo";
import styles from "./OverShort.module.css";

/** The live battlefield behind the menus: the gun firing now and then, the arc crossing the land. Silent. */
export function Backdrop({ era }: { era: Era }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const calm = useReducedMotion();
  const { tab } = useShell();
  const make = useCallback((element: HTMLCanvasElement) => new DemoLoop(element, era, 7), [era]);
  useCanvasPainter(canvas, make, !calm && tab === "play");
  return <canvas ref={canvas} className={styles.backdrop} aria-hidden="true" />;
}
