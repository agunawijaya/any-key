"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { useDarkAppearance } from "@/components/long-memory/hooks";
import { BoardScene } from "@/components/long-memory/scene/BoardScene";
import { useAttract } from "@/components/long-memory/useAttract";
import { BoardHandle } from "@/components/long-memory/useBoardScene";
import styles from "./LongMemoryPreview.module.css";

/** The carved board playing itself, silently: a sunlit courtyard by day, the lamp at night. Rests when out of view. */
export function LongMemoryPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dark = useDarkAppearance();
  const reduced = useReducedMotion();
  const [handle] = useState(() => new BoardHandle());
  const [visible, setVisible] = useState(false);
  const darkRef = useRef(dark);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: BoardScene | null = null;
    try {
      scene = new BoardScene(canvas);
    } catch {
      return;
    }
    const s = scene;
    handle.attach(s);
    s.setAppearance(darkRef.current, true);
    s.frameBoardOnly();
    s.setSafeArea({ left: 0.03, right: 0.03, top: 0.06, bottom: 0.06 });
    s.setTempo("relaxed");
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      s.resize(box.width, box.height, Math.min(2, window.devicePixelRatio || 1));
    };
    measure();
    const sized = new ResizeObserver(measure);
    sized.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) s.start();
      else s.stop();
    });
    seen.observe(canvas);
    return () => {
      sized.disconnect();
      seen.disconnect();
      s.dispose();
      handle.attach(null);
    };
  }, [handle]);

  useEffect(() => {
    darkRef.current = dark;
    handle.scene?.setAppearance(dark);
  }, [dark, handle]);

  useAttract(handle, visible, reduced, 404);

  return (
    <div className={styles.preview}>
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label="Animated preview: seeds sown one by one round a carved wooden mancala board" />
    </div>
  );
}
