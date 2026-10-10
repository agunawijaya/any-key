"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { act, currentTarget, type Action, type Engagement, type Shot } from "@/lib/over-short/engagement";
import { vacuumRange } from "@/lib/over-short/ballistics";
import { engage, type Session } from "@/lib/over-short/playstyles";
import { afterEngagement, updateProgress, useProgress, type Settings } from "@/lib/over-short/progress";
import type { Era } from "../eras/types";
import { battleSound } from "../sound";
import { Battlefield } from "./Battlefield";
import { Director, type Cue, type DirectorOptions } from "./director";
import { ElevationControl } from "./ElevationControl";
import { FiringTable } from "./FiringTable";
import { Hud } from "./Hud";
import { ObserverMap } from "./ObserverMap";
import { Outcome } from "./Outcome";
import { ReportSlip } from "./ReportSlip";
import ui from "../ui.module.css";
import styles from "./FiringScreen.module.css";

/*
 * The firing screen. React keeps the engagement and plays the engine: each
 * order (fire, or move the gun) goes through `act`, and the events it
 * returns are handed to the director, which plays them on the battlefield.
 * The heads-up panels show the engagement as it was before the order until
 * the sequence on screen is over, so nothing gives the result away early.
 */

type Props = {
  session: Session;
  era: Era;
  settings: Settings;
  onAgain: () => void;
  onMenu: () => void;
  onNextMission: (id: string) => void;
};

const startingElevation = (e: Engagement) => (e.rules.elevation.min > 45 ? 60 : 30);

export function FiringScreen({ session, era, settings, onAgain, onMenu, onNextMission }: Props) {
  const progress = useProgress();
  const shell = useShell();
  const calm = useReducedMotion();
  const [engagement, setEngagement] = useState<Engagement>(() => engage(session));
  const [elevation, setElevation] = useState(() => startingElevation(engagement));
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState<{ shot: Shot; late: boolean } | null>(null);
  const [drawer, setDrawer] = useState<"map" | "table" | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ engagement: Engagement; unlocked: string[] } | null>(null);
  const director = useRef<Director | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sound = useMemo(() => battleSound(), []);
  const assisted = settings.hint && session.style === "campaign";
  const { min, max } = engagement.rules.elevation;
  const precision = settings.precision;

  useEffect(() => () => sound.stop(), [sound]);

  /* ---------- The director ---------- */

  const cue = useCallback(
    (name: Cue, detail?: { shot?: Shot; time?: number }) => {
      if (name === "fire") sound.fire();
      else if (name === "whistle") sound.whistle(detail?.time ?? 3);
      else if (name === "impact") sound.impact(1);
      else if (name === "hit") sound.impact(1.4);
      else if (name === "destroyed") {
        sound.destroyed(detail?.shot ? engagement.targets[detail.shot.target].kind === "dump" : false);
        window.setTimeout(() => sound.cheer(), 1500);
      } else if (name === "report") sound.report();
      else if (name === "incoming") sound.incoming();
      else if (name === "enemy-impact") sound.impact(1.6);
      else if (name === "gun-hit") sound.destroyed(false);
      else if (name === "relocate") sound.limber();
    },
    [sound, engagement.targets],
  );

  const told = engagement.rules.told.maxRange;
  const options = useMemo<DirectorOptions>(
    () => ({
      era,
      follow: settings.camera === "follow",
      calm,
      textbook: assisted && told !== null ? (e: number) => vacuumRange(told, e) : null,
      sound: cue,
    }),
    [era, settings.camera, calm, assisted, told, cue],
  );

  const onDirector = useCallback((d: Director | null) => {
    director.current = d;
  }, []);

  useEffect(() => {
    if (director.current) director.current.aim = elevation;
  }, [elevation]);

  // Birds between barrages, now and then, while nothing is happening.
  useEffect(() => {
    if (busy || paused || result) return;
    const day = document.documentElement.dataset.theme !== "dark";
    const timer = window.setInterval(() => sound.quiet(day), 6000);
    return () => window.clearInterval(timer);
  }, [busy, paused, result, sound]);

  /* ---------- Orders ---------- */

  const finish = useCallback(
    (e: Engagement) => {
      const unlocked = updateProgress((p) => afterEngagement(p, session, e, assisted));
      setResult({ engagement: e, unlocked });
    },
    [session, assisted],
  );

  const order = useCallback(
    (action: Action) => {
      if (busy || result || paused) return;
      const outcome = act(engagement, action);
      if (outcome.events.some((e) => e.kind === "refused")) return;
      const late = outcome.events.some((e) => e.kind === "too-late");
      setBusy(true);
      setSlip(null);
      const done = () => {
        setEngagement(outcome.engagement);
        setBusy(false);
        if (outcome.engagement.outcome) finish(outcome.engagement);
        else input.current?.focus({ preventScroll: true });
      };
      const d = director.current;
      if (!d) return done();
      d.play(outcome.events, outcome.engagement, { onReport: (shot) => setSlip({ shot, late }), onDone: done });
    },
    [busy, result, paused, engagement, finish],
  );

  const fire = useCallback((value?: number) => order({ kind: "fire", elevation: value ?? elevation }), [order, elevation]);
  const skip = useCallback(() => director.current?.skip(), []);
  const nudge = useCallback((by: number) => setElevation((e) => Math.min(max, Math.max(min, Math.round((e + by) / precision) * precision))), [min, max, precision]);

  /* ---------- Keys ---------- */

  useEffect(() => {
    if (result) return;
    const onKey = (event: KeyboardEvent) => {
      if (paused || shell.tab !== "play" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const inField = target === input.current;
      const onButton = target?.tagName === "BUTTON" || target?.tagName === "A" || (target?.tagName === "INPUT" && !inField);
      const key = event.key;
      if (key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        nudge((key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? precision : 1));
      } else if (key === "PageUp" || key === "PageDown") {
        event.preventDefault();
        nudge(key === "PageUp" ? 5 : -5);
      } else if ((key === " " || key === "Enter") && !onButton && !inField) {
        event.preventDefault();
        if (busy) skip();
        else fire();
      } else if ((key === "m" || key === "M" || key === "t" || key === "T") && !inField) {
        event.preventDefault();
        const which = key.toLowerCase() === "m" ? "map" : "table";
        setDrawer((open) => (open === which ? null : which));
      } else if (/^[0-9.,]$/.test(key) && !inField && !busy) {
        // Typing an elevation anywhere starts it in the field.
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, paused, shell.tab, busy, fire, skip, nudge, precision]);

  /* ---------- Laying the gun with the mouse ---------- */

  const dragging = useRef(false);
  const aimFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const pivot = director.current?.gunPivot();
    if (!pivot) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - pivot.x;
    const y = pivot.y - (event.clientY - box.top);
    const degrees = (Math.atan2(Math.max(0, y), Math.max(0.001, x)) * 180) / Math.PI;
    setElevation(Math.min(max, Math.max(min, Math.round(degrees / precision) * precision)));
  };
  const pointer = {
    onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (busy) return skip();
      const pivot = director.current?.gunPivot();
      if (!pivot) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (Math.hypot(event.clientX - box.left - pivot.x, event.clientY - box.top - pivot.y) > pivot.reach) return;
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      aimFrom(event);
    },
    onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragging.current) aimFrom(event);
    },
    onPointerUp: () => {
      dragging.current = false;
    },
    onWheel: (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (!busy) nudge((event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? precision : 1));
    },
  };

  /* ---------- The shell ---------- */

  const roundName = session.style === "classic" ? "this game" : "this mission";
  usePlayScreen({
    screen: result ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [{ label: session.style === "classic" ? "New game" : "Restart the mission", onSelect: onAgain }],
    losesProgress: !result && (engagement.shots.length > 0 || busy),
    roundName,
    onMenu,
  });

  const target = currentTarget(engagement);
  const textbookMiss = assisted && told !== null ? vacuumRange(told, elevation) - (target.distance + target.speed * engagement.time - engagement.gunAt) : null;

  return (
    <div className={styles.screen}>
      <Battlefield engagement={engagement} options={options} onDirector={onDirector} paused={paused || shell.tab !== "play"} onSkip={skip} pointer={pointer} observerLabel={`${era.words.observer} · ${era.words.target(target.kind)}`} />

      <div className={styles.hud} data-busy={busy}>
        <Hud engagement={engagement} era={era} units={settings.units} onRelocate={(direction) => order({ kind: "relocate", direction })} busy={busy} />

        <div className={styles.drawer} data-open={drawer !== null}>
          <div className={styles.tabs} role="tablist" aria-label="Observer's map and firing table">
            <button type="button" role="tab" aria-selected={drawer === "map"} className={styles.tab} onClick={() => setDrawer((d) => (d === "map" ? null : "map"))}>
              Map <span className={ui.key}>M</span>
            </button>
            <button type="button" role="tab" aria-selected={drawer === "table"} className={styles.tab} onClick={() => setDrawer((d) => (d === "table" ? null : "table"))}>
              Table <span className={ui.key}>T</span>
            </button>
          </div>
          {drawer && (
            <div className={styles.sheet} role="tabpanel">
              {drawer === "map" ? (
                <ObserverMap engagement={engagement} units={settings.units} textbookMiss={textbookMiss} />
              ) : (
                <FiringTable engagement={engagement} units={settings.units} precision={precision} kept={engagement.rules.model === "air" ? progress.campaign.table : null} />
              )}
            </div>
          )}
        </div>

        <div className={`${ui.panel} ${styles.aim}`}>
          <ElevationControl elevation={elevation} min={min} max={max} precision={precision} disabled={busy || !!result} onChange={setElevation} onFire={fire} inputRef={input} />
          {busy && (
            <p className={styles.skipHint}>
              <span className={ui.key}>Space</span> or click to skip ahead
            </p>
          )}
        </div>

        {slip && <ReportSlip shot={slip.shot} late={slip.late} engagement={engagement} era={era} units={settings.units} />}
      </div>

      {result && <Outcome session={session} engagement={result.engagement} unlocked={result.unlocked} assisted={assisted} units={settings.units} onAgain={onAgain} onMenu={onMenu} onNextMission={onNextMission} />}
    </div>
  );
}
