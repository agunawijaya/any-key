"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GameShell } from "@/components/kit/GameShell";
import type { DocTab } from "@/components/kit/Story";
import { solYSombraManifest } from "@/lib/sol-y-sombra/manifest";
import type { PassKind } from "@/lib/sol-y-sombra/rig/choreography";
import { Ring, type BeatRequest } from "@/lib/sol-y-sombra/rig/ring";
import { HeroStage } from "../hero/HeroStage";
import { Camera } from "../render/camera";
import { CAMERA_VIEWS, LabCamera, type CameraView } from "./labCamera";
import { LAB_DARK, LAB_LIGHT, LabPainter } from "./labPainter";
import { ScenarioStage } from "./ScenarioStage";
import styles from "./MotionLab.module.css";

/*
 * The motion prototype: a plain ring where the rig performs the three cape
 * moves against a charging bull, for judging movement before any art goes
 * on it. Buttons and keys pick the move, the camera, slow motion and the
 * judging aids. `?play=veronica|outside|swirl|loop`, `?cam=…` and `?t=…`
 * (seconds, then frozen) set it up from the address; `?record=1` hands the
 * clock to `window.__lab` so a recorder can step it frame by frame.
 */

type Program = PassKind | "loop";

/* The first pass goes by on the far side, so the stands camera sees the matador in front of the bull. */
const LOOP: BeatRequest[] = [
  { kind: "pass", pass: "veronica", side: -1, paw: true },
  { kind: "pass", pass: "veronica", side: 1 },
  { kind: "pass", pass: "veronica", side: -1 },
  { kind: "pass", pass: "outside", side: 1 },
  { kind: "pass", pass: "swirl", side: -1 },
  { kind: "walk-off", distance: 5 },
  { kind: "wait", seconds: 0.6 },
];

function programFor(play: Program): BeatRequest[] {
  if (play === "loop") return LOOP;
  // One move, alternating sides, with a walk to reset the distance after a swirl.
  const passes: BeatRequest[] = [
    { kind: "pass", pass: play, side: -1, paw: true },
    { kind: "pass", pass: play, side: 1 },
  ];
  return play === "swirl" ? [...passes.slice(0, 1), { kind: "walk-off", distance: 5 }, { kind: "wait", seconds: 0.5 }] : passes;
}

const readDark = () => document.documentElement.dataset.theme === "dark";

type LabState = {
  play: Program;
  view: CameraView;
  slow: boolean;
  bones: boolean;
  contacts: boolean;
  paused: boolean;
};

declare global {
  interface Window {
    __lab?: {
      frame(dt: number): void;
      time(): number;
      canvas: HTMLCanvasElement;
    };
  }
}

function Stage({ state, setState }: { state: LabState; setState: (s: Partial<LabState>) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const ringRef = useRef<Ring | null>(null);
  const [beat, setBeat] = useState("");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // A new program restarts the ring; a frozen moment from the address is run up to at once.
  useEffect(() => {
    const ring = new Ring({ program: programFor(state.play), loop: true });
    const frozenAt = new URLSearchParams(window.location.search).get("t");
    if (frozenAt !== null) ring.advance(Number(frozenAt));
    ringRef.current = ring;
  }, [state.play]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const painter = new LabPainter(ctx);
    const camera = new Camera();
    const rig = new LabCamera();
    const params = new URLSearchParams(window.location.search);
    const frozenAt = params.get("t");
    const recording = params.get("record") === "1";
    let dark = readDark();
    let snap = true;
    let lastLabel = "";

    const measure = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      camera.resize(box.width, box.height);
    };
    measure();
    const sizing = new ResizeObserver(measure);
    sizing.observe(canvas);
    const theme = new MutationObserver(() => (dark = readDark()));
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const paint = (dt: number) => {
      const ring = ringRef.current!;
      const s = stateRef.current;
      rig.view = s.view;
      rig.update(camera, ring, dt, snap);
      snap = false;
      painter.paint(ring, camera, dark ? LAB_DARK : LAB_LIGHT, {
        bones: s.bones,
        contacts: s.contacts,
      });
      const label = ring.current ? `${ring.current.kind} · ${ring.current.side > 0 ? "right" : "left"}` : ring.beatKind;
      if (label !== lastLabel) {
        lastLabel = label;
        setBeat(label);
      }
    };

    window.__lab = {
      frame: (dt) => {
        const ring = ringRef.current!;
        ring.advance(dt * (stateRef.current.slow ? ring.slowMotion() : 1));
        paint(dt);
      },
      time: () => ringRef.current!.time,
      canvas,
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ring = ringRef.current!;
      const s = stateRef.current;
      if (!recording && frozenAt === null && !s.paused) ring.advance(dt * (s.slow ? ring.slowMotion() : 1));
      if (!recording) paint(dt);
    };
    raf = requestAnimationFrame(loop);

    const drag = { on: false, x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      drag.on = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (stateRef.current.view !== "orbit") setState({ view: "orbit" });
    };
    const move = (e: PointerEvent) => {
      if (!drag.on) return;
      rig.yaw += (e.clientX - drag.x) * 0.006;
      rig.pitch = Math.max(0.05, Math.min(1.4, rig.pitch + (e.clientY - drag.y) * 0.004));
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const up = () => (drag.on = false);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      rig.distance = Math.max(4, Math.min(30, rig.distance * Math.exp(e.deltaY * 0.001)));
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      theme.disconnect();
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      canvas.removeEventListener("wheel", wheel);
      delete window.__lab;
    };
  }, [setState]);

  return (
    <div className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="The ring: a matador and a bull, drawn as a plain rig" />
      <p className={styles.beat} aria-live="polite">
        {beat}
      </p>
    </div>
  );
}

const MOVES: { play: Program; label: string; key: string }[] = [
  { play: "veronica", label: "Veronica", key: "1" },
  { play: "outside", label: "Outside pass", key: "2" },
  { play: "swirl", label: "Swirl", key: "3" },
  { play: "loop", label: "All, in a row", key: "4" },
];

function Controls({ state, setState }: { state: LabState; setState: (s: Partial<LabState>) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const move = MOVES.find((m) => m.key === e.key);
      let handled = true;
      if (move) setState({ play: move.play });
      else if (e.key === "c" || e.key === "C")
        setState({
          view: CAMERA_VIEWS[(CAMERA_VIEWS.indexOf(state.view) + 1) % CAMERA_VIEWS.length],
        });
      else if (e.key === "s" || e.key === "S") setState({ slow: !state.slow });
      else if (e.key === "b" || e.key === "B") setState({ bones: !state.bones });
      else if (e.key === "f" || e.key === "F") setState({ contacts: !state.contacts });
      else if (e.key === " ") setState({ paused: !state.paused });
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, setState]);

  return (
    <div className={styles.controls} role="toolbar" aria-label="Motion lab">
      <div className={styles.group} role="group" aria-label="Move">
        {MOVES.map((m) => (
          <button key={m.play} type="button" className={styles.button} aria-pressed={state.play === m.play} onClick={() => setState({ play: m.play })}>
            {m.label} <kbd>{m.key}</kbd>
          </button>
        ))}
      </div>
      <div className={styles.group} role="group" aria-label="Camera">
        {CAMERA_VIEWS.map((v) => (
          <button key={v} type="button" className={styles.button} aria-pressed={state.view === v} onClick={() => setState({ view: v })}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
        <span className={styles.hint}>
          <kbd>C</kbd> cycles, drag to orbit
        </span>
      </div>
      <div className={styles.group} role="group" aria-label="Aids">
        <button type="button" className={styles.button} aria-pressed={state.slow} onClick={() => setState({ slow: !state.slow })}>
          Slow motion <kbd>S</kbd>
        </button>
        <button type="button" className={styles.button} aria-pressed={state.bones} onClick={() => setState({ bones: !state.bones })}>
          Bones <kbd>B</kbd>
        </button>
        <button type="button" className={styles.button} aria-pressed={state.contacts} onClick={() => setState({ contacts: !state.contacts })}>
          Foot contact <kbd>F</kbd>
        </button>
        <button type="button" className={styles.button} aria-pressed={state.paused} onClick={() => setState({ paused: !state.paused })}>
          {state.paused ? "Play" : "Pause"} <kbd>Space</kbd>
        </button>
      </div>
    </div>
  );
}

const DEFAULTS: LabState = {
  play: "loop",
  view: "stands",
  slow: true,
  bones: false,
  contacts: false,
  paused: false,
};

/** The lab's setup from the address, for links and the recorder. */
function stateFromAddress(search: string): Partial<LabState> {
  if (!search) return {};
  const params = new URLSearchParams(search);
  const play = params.get("play") as Program | null;
  const view = params.get("cam") as CameraView | null;
  const next: Partial<LabState> = {
    slow: params.get("slow") !== "0",
    bones: params.get("bones") === "1",
    contacts: params.get("contacts") === "1",
  };
  if (play && MOVES.some((m) => m.play === play)) next.play = play;
  if (view && CAMERA_VIEWS.includes(view)) next.view = view;
  return next;
}

const noSubscription = () => () => {};

function Lab() {
  // The address is read only in the browser, so the server's render and the first browser render agree.
  const search = useSyncExternalStore(
    noSubscription,
    () => window.location.search,
    () => "",
  );
  const fromAddress = useMemo(() => stateFromAddress(search), [search]);
  const [choices, setChoices] = useState<Partial<LabState>>({});
  const state: LabState = { ...DEFAULTS, ...fromAddress, ...choices };
  const setState = useCallback((next: Partial<LabState>) => setChoices((c) => ({ ...c, ...next })), []);
  return (
    <div className={styles.lab}>
      <Stage state={state} setState={setState} />
      <Controls state={state} setState={setState} />
    </div>
  );
}

/** The lab, a hero frame when the address names a shot (`?shot=veronica`), or a whole scene (`?scene=gored`). */
function Workbench() {
  const search = useSyncExternalStore(
    noSubscription,
    () => window.location.search,
    () => "",
  );
  const params = new URLSearchParams(search);
  const shot = params.get("shot");
  const scene = params.get("scene");
  if (scene) return <ScenarioStage scene={scene} frozen={params.get("t")} />;
  return shot ? <HeroStage shot={shot} frozen={params.get("t")} /> : <Lab />;
}

export function MotionLab({ docs }: { docs: DocTab[] }) {
  return (
    <GameShell game={solYSombraManifest} docs={docs} className={styles.app}>
      <Workbench />
    </GameShell>
  );
}
