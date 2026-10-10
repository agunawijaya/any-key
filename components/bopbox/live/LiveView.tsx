"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleId } from "@/lib/music/arrange";
import type { SoloInstrumentId } from "@/lib/music/arrange/patches";
import type { Arrangement } from "@/lib/music/arrange/types";
import { Performance } from "@/lib/music/perform/cues";
import { secondsAt } from "@/lib/music/tempo";
import { useReducedMotion } from "@/components/kit/hooks";
import type { Clock } from "../BopBox";
import { createShow } from "./lineup";
import type { Region, Theme } from "./stage";
import styles from "./LiveView.module.css";

type Props = {
  arrangement: Arrangement;
  clock: Clock;
  muted: Set<string>;
  onToggle: (trackId: string) => void;
  instrument: SoloInstrumentId;
  playing: boolean;
};

let software: boolean | undefined;

/**
 * True when the browser paints without a graphics card. Canvas drawing then
 * runs on the processor, and a big band's shading passes would cost it half
 * its frame rate, so those are skipped. Never on a real GPU: sharpness first.
 */
function drawsInSoftware() {
  if (software === undefined) {
    const gl = document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    software = !gl || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return software;
}

/** The style an arrangement was built in ("solo:violin" is the Solo style). */
const styleOf = (arrangement: Arrangement) => arrangement.styleId.split(":")[0] as StyleId;

/**
 * Live: someone performing what you hear, drawn for each style. The canvas
 * redraws every frame from the engine's clock; over each performer sits an
 * invisible button, so a click or the keyboard mutes them, as on the Stage.
 */
export function LiveView({ arrangement, clock, muted, onToggle, instrument, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const styleId = styleOf(arrangement);
  const show = useMemo(() => createShow(new Performance(arrangement), { styleId, instrument }), [arrangement, styleId, instrument]);
  const [regions, setRegions] = useState<Region[]>([]);
  const live = useRef({ muted, playing, reduced });

  useEffect(() => {
    live.current = { muted, playing, reduced };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const started = performance.now();
    const lite = drawsInSoftware();
    canvas.dataset.detail = lite ? "light" : "full";
    let frame = 0;
    let laidOut = "";
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        const beat = clock.beat();
        const theme: Theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        show.draw(ctx, w, h, dpr, {
          beat,
          t: secondsAt(arrangement.tempos, beat),
          wall: (performance.now() - started) / 1000,
          theme,
          reduced: live.current.reduced,
          software: lite,
          muted: live.current.muted,
          playing: live.current.playing,
        });
        // Click targets follow the layout, which only changes with the view's size.
        const key = `${w}x${h}`;
        if (key !== laidOut) {
          laidOut = key;
          setRegions(onePerPart(show.regions(w, h)));
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [arrangement, clock, show]);

  return (
    <div className={styles.view}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
      {regions.map((region) => {
        const off = region.ids.every((id) => muted.has(id));
        return (
          <button
            key={region.ids.join("+")}
            type="button"
            className={styles.performer}
            style={{ left: region.x, top: region.y, width: region.w, height: region.h }}
            aria-pressed={!off}
            aria-label={`${off ? "Unmute" : "Mute"} ${region.label}`}
            title={`${off ? "Unmute" : "Mute"} ${region.label}`}
            onClick={() => {
              // A performer playing several parts mutes (or brings back) all of them together.
              for (const id of region.ids) if (muted.has(id) !== !off) onToggle(id);
            }}
          />
        );
      })}
      <p className={styles.caption} data-caption>
        {show.caption}
      </p>
    </div>
  );
}

/** A section's players share one button (one part, one mute), covering all of them. */
function onePerPart(regions: Region[]): Region[] {
  const parts = new Map<string, Region>();
  for (const r of regions) {
    const key = r.ids.join("+");
    const seen = parts.get(key);
    if (!seen) parts.set(key, { ...r });
    else {
      const x1 = Math.max(seen.x + seen.w, r.x + r.w);
      const y1 = Math.max(seen.y + seen.h, r.y + r.h);
      seen.x = Math.min(seen.x, r.x);
      seen.y = Math.min(seen.y, r.y);
      seen.w = x1 - seen.x;
      seen.h = y1 - seen.y;
    }
  }
  return [...parts.values()];
}
