"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import type { HudAnchors } from "./hud/BoardHud";
import { BoardScene } from "./scene/BoardScene";
import type { SafeArea } from "./scene/Renderer";

export type PitEllipse = BoardScene["pitEllipses"][number];

/** A stable handle on the board for the screens; the scene itself arrives once the canvas exists. */
export class BoardHandle {
  scene: BoardScene | null = null;
  attach(scene: BoardScene | null) {
    this.scene = scene;
  }
  setSafeArea(safe: SafeArea, glide = true) {
    this.scene?.setSafeArea(safe, glide);
  }
}

/** The scene, or null where the browser cannot draw it (no WebGL2). */
function createScene(canvas: HTMLCanvasElement) {
  try {
    return new BoardScene(canvas);
  } catch {
    return null;
  }
}

export type BoardState = {
  handle: BoardHandle;
  anchors: (HudAnchors & { book: { x: number; y: number } }) | null;
  pits: PitEllipse[];
  counts: number[];
  reduced: boolean;
  failed: boolean;
};

/**
 * One carved board for the whole game: created once on the canvas, sized
 * with it, following the appearance, and resting while the page is hidden
 * or the Story tab is open.
 */
export function useBoardScene(dark: boolean, active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => new BoardHandle());
  const [anchors, setAnchors] = useState<BoardState["anchors"]>(null);
  const [pits, setPits] = useState<PitEllipse[]>([]);
  const [counts, setCounts] = useState<number[]>(() => Array(14).fill(0));
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();
  const darkRef = useRef(dark);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createScene(canvas);
    if (!scene) {
      // No WebGL2: the screens fall back to plain text and buttons.
      queueMicrotask(() => setFailed(true));
      return;
    }
    handle.attach(scene);
    scene.setAppearance(darkRef.current, true);
    scene.onCounts = setCounts;
    scene.onFailed = () => setFailed(true);
    const publish = () => {
      setAnchors(scene.hudAnchors());
      setPits([...scene.pitEllipses]);
    };
    scene.onCamera = publish;
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      scene.resize(box.width, box.height, Math.min(2, window.devicePixelRatio || 1));
      publish();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    scene.start();
    return () => {
      observer.disconnect();
      scene.dispose();
      handle.attach(null);
    };
  }, [handle]);

  useEffect(() => {
    darkRef.current = dark;
    handle.scene?.setAppearance(dark);
  }, [dark, handle]);

  // Rest while nobody can see the board.
  useEffect(() => {
    const sync = () => {
      const scene = handle.scene;
      if (!scene) return;
      if (active && document.visibilityState === "visible") scene.start();
      else scene.stop();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [active, handle]);

  const board: BoardState = { handle, anchors, pits, counts, reduced, failed };
  return { canvasRef, board };
}
