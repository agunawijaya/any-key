"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { buildDaily, dailyMarks } from "@/lib/over-short/daily";
import { actField, fieldDistance, type FieldAction, type FieldEngagement, type FieldShot } from "@/lib/over-short/field";
import { buildFieldMission, fieldMissionById } from "@/lib/over-short/fieldMissions";
import { firingTable, type Aim } from "@/lib/over-short/fieldModel";
import { afterDaily, afterField, updateProgress, type Settings } from "@/lib/over-short/progress";
import type { Era } from "../eras/types";
import { battleSound } from "../sound";
import ui from "../ui.module.css";
import play from "../play/FiringScreen.module.css";
import { AimPanel } from "./AimPanel";
import { FieldBattlefield } from "./FieldBattlefield";
import type { FieldCue, FieldDirector, FieldDirectorOptions } from "./fieldDirector";
import { FieldHud } from "./FieldHud";
import { FieldMap } from "./FieldMap";
import { FieldOutcome, type FieldSession } from "./FieldOutcome";
import { FieldSlip } from "./FieldSlip";
import { FieldTable } from "./FieldTable";

/*
 * Field Artillery's firing screen, for a mission or the Daily Barrage. React
 * keeps the engagement and plays the engine; each order (fire, move the gun,
 * call for a star shell) goes through `actField`, and the director plays
 * what it returns on the battlefield. The panels show the engagement as it
 * was until the sequence is over, so nothing gives a result away early.
 */

type Props = {
  session: FieldSession;
  era: Era;
  settings: Settings;
  onAgain: () => void;
  onMenu: () => void;
  onNextMission?: (id: string) => void;
};

export function engageField(session: FieldSession): FieldEngagement {
  if (session.kind === "daily") return buildDaily(session.daily);
  return buildFieldMission(fieldMissionById(session.mission)!, session.seed, session.difficulty);
}

/** A first lay a gunner might start from: a middling charge at a middling angle, on the target's bearing. */
const firstAim = (e: FieldEngagement): Aim => ({ charge: Math.min(3, e.rules.gun.charges.length), elevation: 25, line: 0 });

export function FieldScreen({ session, era, settings, onAgain, onMenu, onNextMission }: Props) {
  const shell = useShell();
  const calm = useReducedMotion();
  const [engagement, setEngagement] = useState<FieldEngagement>(() => engageField(session));
  const [aim, setAim] = useState<Aim>(() => firstAim(engagement));
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState<{ shot: FieldShot; late: boolean } | null>(null);
  const [drawer, setDrawer] = useState<"map" | "table" | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ engagement: FieldEngagement; unlocked: string[] } | null>(null);
  const director = useRef<FieldDirector | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sound = useMemo(() => battleSound(), []);
  const precision = settings.precision;
  const limits = engagement.rules.limits;
  const reaches = useMemo(() => engagement.rules.gun.charges.map((_, i) => Math.max(...firingTable(engagement.rules.gun, i + 1).map((r) => r.range))), [engagement.rules.gun]);

  useEffect(() => {
    // The screen opens on a key press, so the browser lets the audio start now rather than on the first round.
    sound.wake();
    return () => sound.stop();
  }, [sound]);

  const cue = useCallback(
    (name: FieldCue, detail?: { shot?: FieldShot; time?: number }) => {
      if (name === "fire") sound.fire();
      else if (name === "whistle") sound.whistle(detail?.time ?? 3);
      else if (name === "impact") sound.impact(1);
      else if (name === "hit") sound.impact(1.4);
      else if (name === "destroyed") {
        sound.destroyed(detail?.shot ? engagement.targets[detail.shot.target].kind === "dump" : false);
        window.setTimeout(() => sound.cheer(), 1500);
      } else if (name === "telephone") sound.telephone();
      else if (name === "report") sound.report();
      else if (name === "incoming") sound.incoming();
      else if (name === "enemy-impact") sound.impact(1.7);
      else if (name === "gun-hit") sound.destroyed(false);
      else if (name === "relocate") sound.limber();
      else if (name === "star-shell") sound.starShell();
    },
    [sound, engagement.targets],
  );

  const options = useMemo<FieldDirectorOptions>(() => ({ era, follow: settings.camera === "follow", calm, sound: cue }), [era, settings.camera, calm, cue]);
  const onDirector = useCallback((d: FieldDirector | null) => {
    director.current = d;
  }, []);

  useEffect(() => {
    if (director.current) director.current.aim = aim.elevation;
  }, [aim.elevation]);

  useEffect(() => {
    if (busy || paused || result) return;
    const day = document.documentElement.dataset.theme !== "dark" && !engagement.rules.night;
    const timer = window.setInterval(() => sound.quiet(day), 6000);
    return () => window.clearInterval(timer);
  }, [busy, paused, result, sound, engagement.rules.night]);

  /* ---------- Orders ---------- */

  const finish = useCallback(
    (e: FieldEngagement) => {
      const unlocked = updateProgress((p) => (session.kind === "daily" ? afterDaily(p, session.daily.key, session.daily.number, e, dailyMarks(e)) : afterField(p, session.mission, session.difficulty, e)));
      setResult({ engagement: e, unlocked });
    },
    [session],
  );

  const order = useCallback(
    (action: FieldAction) => {
      if (busy || result || paused) return;
      const outcome = actField(engagement, action);
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

  const fire = useCallback((elevation?: number) => order({ kind: "fire", aim: { ...aim, elevation: elevation ?? aim.elevation } }), [order, aim]);
  const skip = useCallback(() => director.current?.skip(), []);
  const nudge = useCallback((by: number) => setAim((a) => ({ ...a, elevation: Math.min(limits.elevation.max, Math.max(limits.elevation.min, Math.round((a.elevation + by) / precision) * precision)) })), [limits, precision]);
  const traverse = useCallback((by: number) => setAim((a) => ({ ...a, line: Math.max(-limits.line, Math.min(limits.line, a.line + by)) })), [limits]);
  const illuminate = useCallback(() => order({ kind: "illuminate" }), [order]);
  const relocate = useCallback(() => order({ kind: "relocate", direction: -1 }), [order]);

  /* ---------- Keys ---------- */

  useEffect(() => {
    if (result) return;
    const onKey = (event: KeyboardEvent) => {
      if (paused || shell.tab !== "play" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const inField = target === input.current;
      const onControl = target?.tagName === "BUTTON" || target?.tagName === "A" || (target?.tagName === "INPUT" && !inField);
      const key = event.key;
      if (key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        nudge((key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? precision : 1));
      } else if ((key === "ArrowLeft" || key === "ArrowRight") && !inField) {
        event.preventDefault();
        traverse((key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 10 : 1));
      } else if (key === "PageUp" || key === "PageDown") {
        event.preventDefault();
        nudge(key === "PageUp" ? 5 : -5);
      } else if ((key === " " || key === "Enter") && !onControl && !inField) {
        event.preventDefault();
        if (busy) skip();
        else fire();
      } else if (inField || busy) {
        return;
      } else if (key === "c" || key === "C") {
        event.preventDefault();
        const count = engagement.rules.gun.charges.length;
        setAim((a) => ({ ...a, charge: ((a.charge - 1 + (event.shiftKey ? count - 1 : 1)) % count) + 1 }));
      } else if (key === "m" || key === "M" || key === "t" || key === "T") {
        event.preventDefault();
        const which = key.toLowerCase() === "m" ? "map" : "table";
        setDrawer((open) => (open === which ? null : which));
      } else if ((key === "l" || key === "L") && engagement.rules.night) {
        event.preventDefault();
        illuminate();
      } else if ((key === "r" || key === "R") && engagement.rules.enemy) {
        event.preventDefault();
        relocate();
      } else if (/^[0-9.,]$/.test(key)) {
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, paused, shell.tab, busy, fire, skip, nudge, traverse, precision, illuminate, relocate, engagement.rules]);

  /* ---------- Laying the gun with the mouse ---------- */

  const dragging = useRef(false);
  const aimFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const pivot = director.current?.gunPivot();
    if (!pivot) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - pivot.x;
    const y = pivot.y - (event.clientY - box.top);
    const degrees = (Math.atan2(Math.max(0, y), Math.max(0.001, x)) * 180) / Math.PI;
    setAim((a) => ({ ...a, elevation: Math.min(limits.elevation.max, Math.max(limits.elevation.min, Math.round(degrees / precision) * precision)) }));
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

  usePlayScreen({
    screen: result ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [{ label: session.kind === "daily" ? "Restart the Daily Barrage" : "Restart the mission", onSelect: onAgain }],
    losesProgress: !result && (engagement.shots.length > 0 || busy),
    roundName: session.kind === "daily" ? "this Daily Barrage" : "this mission",
    onMenu,
  });

  const target = engagement.targets[engagement.index];
  const distance = Math.max(1, fieldDistance(engagement) + engagement.rules.told.mapError.along);

  return (
    <div className={play.screen}>
      <FieldBattlefield
        engagement={engagement}
        options={options}
        onDirector={onDirector}
        paused={paused || shell.tab !== "play"}
        onSkip={skip}
        pointer={pointer}
        observerLabel={`${era.words.observer} · ${era.words.target(target.kind)}`}
      />

      <div className={play.hud} data-busy={busy}>
        <FieldHud engagement={engagement} era={era} units={settings.units} busy={busy} onIlluminate={illuminate} onRelocate={relocate} />

        <div className={play.drawer} data-open={drawer !== null}>
          <div className={play.tabs} role="tablist" aria-label="Observer's map and firing table">
            <button type="button" role="tab" aria-selected={drawer === "map"} className={play.tab} onClick={() => setDrawer((d) => (d === "map" ? null : "map"))}>
              Map <span className={ui.key}>M</span>
            </button>
            <button type="button" role="tab" aria-selected={drawer === "table"} className={play.tab} onClick={() => setDrawer((d) => (d === "table" ? null : "table"))}>
              Table <span className={ui.key}>T</span>
            </button>
          </div>
          {drawer && (
            <div className={play.sheet} role="tabpanel">
              {drawer === "map" ? <FieldMap engagement={engagement} units={settings.units} /> : <FieldTable gun={engagement.rules.gun} charge={aim.charge} elevation={aim.elevation} units={settings.units} />}
            </div>
          )}
        </div>

        <div className={`${ui.panel} ${play.aim}`}>
          <AimPanel aim={aim} reaches={reaches} limits={limits} precision={precision} distance={distance} units={settings.units} disabled={busy || !!result} onChange={setAim} onFire={fire} inputRef={input} />
          {busy && (
            <p className={play.skipHint}>
              <span className={ui.key}>Space</span> or click to skip ahead
            </p>
          )}
        </div>

        {slip && <FieldSlip shot={slip.shot} late={slip.late} era={era} units={settings.units} milsHint={engagement.rules.observer.milsHint} hitsLeft={target.hits - engagement.hitsOnTarget} />}
      </div>

      {result && <FieldOutcome session={session} engagement={result.engagement} unlocked={result.unlocked} onAgain={onAgain} onMenu={onMenu} onNextMission={onNextMission} />}
    </div>
  );
}
