"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShareButton } from "@/components/kit/ShareButton";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { Stars } from "@/components/kit/Stars";
import { AssistIcon, GradeIcon, GuideIcon, WarpIcon, WorldIcon } from "./icons";
import { holdAnnouncements } from "@/lib/kit/achievements";
import { difficultyLabel, type Difficulty } from "@/lib/lander/difficulty";
import { fmtAlt, fmtSpeed } from "@/lib/lander/format";
import { descentShare } from "@/lib/lander/share";
import { flagSvg, type FlagDesign } from "@/lib/lander/flags";
import { GRADES, gradeFor, type GradeId } from "@/lib/lander/grades";
import type { DailyDrop, Mission } from "@/lib/lander/missions";
import { acceleration, SECONDS_PER_HOUR_1979, startState, type FlightState, type Setup } from "@/lib/lander/physics";
import { approachAdvice, inFinalApproach } from "@/lib/lander/solver";
import { addOnce, updateProgress, withAchievement } from "@/lib/lander/progress";
import * as sfx from "@/lib/lander/sfx";
import { MISSIONS } from "@/lib/lander/missions";
import type { WorldId } from "@/lib/lander/worlds";
import { useNight, useReducedMotion } from "./hooks";
import { Recorder } from "./Recorder";
import { Scene, type Ending } from "./scene";
import { FlightSim, predictTurn, TURN_SECONDS, type Sample, type SimEvent } from "./sim";
import styles from "./Flight.module.css";

export type Session = {
  mode: "live" | "ten" | "mission" | "daily";
  title: string;
  world: WorldId;
  setup: Setup;
  guide: boolean;
  /** Landing assist: the soft and limit lines. */
  assist: boolean;
  mission?: Mission;
  daily?: DailyDrop;
  /** Fuel difficulty (Standard when absent). */
  difficulty?: Difficulty;
};

type Phase = "ready" | "flying" | "paused" | "ended";

type Result = {
  grade: GradeId;
  speed: number;
  fuelPct: number;
  time: number;
  turns?: number;
  stars: number;
  cleared: boolean;
  insight: string;
  share: string;
  samples: Sample[];
  ideal: { t: number; alt: number; throttle: number }[];
};

type Banner = { text: string; tone: "info" | "warn" | "good"; key: number };

type Props = {
  session: Session;
  flag: FlagDesign;
  sound: boolean;
  onExit: () => void;
  onRetry: () => void;
  onNext?: () => void;
};

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function fmtTime(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function worldSeed(id: WorldId, extra = 0) {
  return ["moon", "mars", "psyche", "earth"].indexOf(id) * 1009 + 7 + extra;
}

export function Flight({ session, flag, sound, onExit, onRetry, onNext }: Props) {
  const { setup } = session;
  const world = setup.world;
  const ten = session.mode === "ten";
  const night = useNight();
  const reduced = useReducedMotion();

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<FlightSim | null>(null);
  const endingRef = useRef<Ending | null>(null);
  const flagImgRef = useRef<HTMLImageElement | null>(null);
  const phaseRef = useRef<Phase>("ready");
  const liveRef = useRef({ sound, night, reduced });
  /** Lets the held unlock toasts out; called when the card appears or the flight is left. */
  const releaseRef = useRef<(() => void) | null>(null);
  /** Where Resume goes back to: a flight can be paused before it starts. */
  const pausedFrom = useRef<Phase>("flying");
  const ghostRef = useRef<{ alts: number[]; stop: number | null } | null>(null);
  const timersRef = useRef<number[]>([]);
  const altRef = useRef<HTMLElement>(null);
  const speedRef = useRef<HTMLElement>(null);
  const fuelRef = useRef<HTMLSpanElement>(null);
  const fuelBarRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const warpRef = useRef<HTMLElement>(null);
  const guideRef = useRef<HTMLParagraphElement>(null);
  const speedRowRef = useRef<HTMLDivElement>(null);
  const trendRef = useRef<HTMLSpanElement>(null);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [lever, setLever] = useState(0);
  const [holding, setHolding] = useState(false);
  const [autoWarp, setAutoWarp] = useState(true);
  const [guide, setGuide] = useState(session.guide);
  const [assist, setAssist] = useState(session.assist);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [turnState, setTurnState] = useState<FlightState>(() => startState(setup));
  const [turning, setTurning] = useState(false);
  const [turns, setTurns] = useState(0);
  const [flown, setFlown] = useState(false);
  const shell = useShell();

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const say = useCallback((text: string, tone: Banner["tone"] = "info") => setBanner({ text, tone, key: performance.now() }), []);

  useEffect(() => {
    liveRef.current = { sound, night, reduced };
    if (!sound) sfx.engineStop();
  }, [sound, night, reduced]);

  // The flag, drawn once as an image the canvas can wave.
  useEffect(() => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(flagSvg(flag, "flight"))}`;
    flagImgRef.current = img;
  }, [flag]);

  // Keep the simulation in step with the controls.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.lever = lever;
    sim.hold = holding;
    sim.autoWarp = autoWarp;
    sim.guide = guide;
    sim.assist = assist;
  }, [lever, holding, autoWarp, guide, assist]);

  const prediction = useMemo(() => (ten && !turning && phase !== "ended" ? predictTurn(setup, turnState, lever) : null), [ten, turning, phase, setup, turnState, lever]);
  useEffect(() => {
    ghostRef.current = prediction ? { alts: prediction.alts, stop: prediction.stop ? (prediction.stop.stops ? prediction.stop.alt : null) : null } : null;
  }, [prediction]);

  const finish = useCallback(
    (sim: FlightSim, grade: GradeId, speed: number, fuel: number) => {
      const g = GRADES[grade];
      const idealLeft = sim.ideal.fuelLeft;
      const clearBelow = session.mission?.clearBelow ?? 20;
      const cleared = g.landed && Math.abs(speed) < clearBelow;
      const stars = cleared ? g.stars : 0;
      const hoverslam = g.landed && sim.ideal.possible && fuel >= 0.9 * idealLeft;
      const fuelPct = fuel / setup.fuel;
      const insight = insightFor(sim, grade, fuel);
      const share = descentShare({ title: session.title, dailyNumber: session.daily?.number, world: setup.world, grade, speed, fuelPct, samples: sim.samples, assisted: sim.assistUsed, difficulty: session.difficulty });
      // New keycaps wait for the card, so the toast doesn't land on top of the landing.
      releaseRef.current = holdAnnouncements();
      updateProgress((p) => {
        let n = { ...p, flights: p.flights + 1 };
        if (g.landed) {
          n = { ...n, landings: n.landings + 1, landed: addOnce(n.landed, world.id), best: { ...n.best, [world.id]: Math.min(n.best[world.id] ?? Infinity, Math.abs(speed)) } };
          n = withAchievement(n, "first-touch");
          if (n.landed.length >= 4) n = withAchievement(n, "postcards");
          if (ten) n = withAchievement(n, "ten-seconds");
          if (hoverslam) n = withAchievement(n, "hoverslam");
        }
        if (g.flag) {
          n = { ...n, flagged: addOnce(n.flagged, world.id) };
          if (n.flagged.length >= 4) n = withAchievement(n, "flag-planter");
        }
        if (grade === "butter") n = withAchievement(n, "butter");
        if (grade === "crater" || grade === "oil") n = withAchievement({ ...n, craters: n.craters + 1 }, "crater-maker");
        if (grade === "oil") n = withAchievement(n, "wildcatter");
        if (session.mission && cleared) {
          n = { ...n, missions: { ...n.missions, [session.mission.id]: Math.max(n.missions[session.mission.id] ?? 0, stars) } };
          if (MISSIONS.every((m) => n.missions[m.id])) n = withAchievement(n, "mission-control");
        }
        if (session.daily && !n.daily[session.daily.key]) {
          n = { ...n, daily: { ...n.daily, [session.daily.key]: { speed: Math.abs(speed), grade, share } } };
          if (g.landed) n = { ...n, dailyLandings: n.dailyLandings + 1 };
          if (n.dailyLandings >= 3) n = withAchievement(n, "daily-3");
        }
        return n;
      });
      const r: Result = { grade, speed, fuelPct, time: sim.state.t, turns: ten ? sim.turns : undefined, stars, cleared, insight, share, samples: [...sim.samples], ideal: sim.ideal.path };
      // Let the ending play before the card slides in.
      const delay = liveRef.current.reduced ? 700 : g.flag ? 4300 : grade === "oil" ? 3400 : g.landed ? 1800 : 2400;
      timersRef.current.push(
        window.setTimeout(() => {
          setResult(r);
          releaseRef.current?.();
        }, delay),
      );
      if (liveRef.current.sound && g.flag) timersRef.current.push(window.setTimeout(() => sfx.flagFlap(), liveRef.current.reduced ? 0 : 3100));
    },
    [session, setup, world.id, ten],
  );

  const handleEvents = useCallback(
    (sim: FlightSim, events: SimEvent[]) => {
      const { sound: on } = liveRef.current;
      for (const e of events) {
        if (e.kind === "callout") {
          if (on) sfx.callout(e.high);
          say(e.label, e.high ? "good" : "info");
        } else if (e.kind === "late") {
          if (on) sfx.warning();
          say("Burn now!", "warn");
        } else if (e.kind === "fuel-low") {
          if (on) sfx.warning();
          say("Fuel low", "warn");
        } else if (e.kind === "fuel-out") {
          say(e.hopeless ? "Out of fuel · fast-forwarding" : "Out of fuel", "warn");
        } else if (e.kind === "too-early") {
          if (on) sfx.warning();
          say(`Too early! You'd stop ${fmtAlt(e.stopAlt)} up. Fall first.`, "warn");
        } else if (e.kind === "climbing") {
          say("You're going up! Ease off", "warn");
        } else if (e.kind === "turn-done") {
          setTurnState({ ...sim.state });
          setTurning(false);
          setTurns(sim.turns);
        } else if (e.kind === "touchdown" || e.kind === "lost") {
          const grade = e.kind === "lost" ? "lost" : gradeFor(e.speed);
          const speed = e.kind === "lost" ? sim.state.speed : e.speed;
          endingRef.current = { grade, at: performance.now() / 1000, impact: Math.abs(speed) };
          setPhase("ended");
          setTurning(false);
          sfx.engineStop();
          if (on) {
            const g = GRADES[grade];
            if (g.landed) sfx.touchdown(g.flag);
            else if (grade === "dented") sfx.crash(1);
            else if (grade === "scrap" || grade === "confetti") sfx.crash(2);
            else if (grade !== "lost") sfx.crash(3);
            if (grade === "oil") sfx.gusher();
          }
          say(GRADES[grade].title, GRADES[grade].landed ? "good" : "warn");
          finish(sim, grade, speed, e.kind === "lost" ? sim.state.fuel : e.fuel);
        }
      }
    },
    [finish, say, setPhase],
  );

  // The frame loop: simulation, sound, canvas and the numbers on the HUD.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const sim = new FlightSim(setup, ten ? "ten" : "live", session.guide);
    sim.assist = session.assist;
    simRef.current = sim;
    const scene = new Scene(canvas, worldSeed(world.id, session.daily?.number ?? 0));
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      scene.resize(Math.max(1, r.width), Math.max(1, r.height), Math.min(2, window.devicePixelRatio || 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    const timers = timersRef.current;

    let raf = 0;
    let last = performance.now();
    let reported = false;
    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      try {
        step(nowMs);
      } catch (error) {
        // A drawing hiccup must never freeze the flight.
        if (!reported) console.error(error);
        reported = true;
      }
    };
    const step = (nowMs: number) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      const live = liveRef.current;
      if (phaseRef.current === "flying") {
        handleEvents(sim, sim.update(dt));
        if (live.sound && !sim.done) {
          sfx.engineStart();
          sfx.engineSet(sim.throttle, sim.state.alt < 0.05 ? 1 : 0);
        }
      } else if (phaseRef.current === "paused") sfx.engineSet(0);
      const s = sim.state;
      scene.render({
        world,
        night: live.night,
        startAlt: setup.alt,
        alt: s.alt,
        speed: s.speed,
        throttle: phaseRef.current === "flying" ? sim.throttle : 0,
        now: nowMs / 1000,
        ending: endingRef.current,
        // The assist's lines replace the stop point while they're on.
        stop: sim.guide && !ten && !sim.assist && sim.stop ? { alt: sim.stop.stops ? sim.stop.alt : null } : null,
        assist: sim.assist && !sim.done ? { lines: sim.lines, outcome: sim.outcome } : null,
        rising: risingInfo(sim),
        ghost: ten && phaseRef.current !== "ended" ? ghostRef.current : null,
        flag: flagImgRef.current,
        reduced: live.reduced,
      });
      writeHud(sim);
    };

    const writeHud = (sim: FlightSim) => {
      const s = sim.state;
      if (altRef.current) altRef.current.textContent = fmtAlt(s.alt);
      const dark = session.mission?.speedDarkAbove !== undefined && s.alt > session.mission.speedDarkAbove && !sim.done;
      if (speedRef.current) speedRef.current.textContent = dark ? "— — —" : `${s.speed < -0.05 ? "↑" : "↓"} ${fmtSpeed(s.speed)}`;
      if (speedRowRef.current) speedRowRef.current.dataset.zone = dark || s.alt > 1 ? "" : Math.abs(s.speed) < 20 ? "safe" : Math.abs(s.speed) < 45 ? "risky" : "fast";
      if (trendRef.current) {
        // Which way the speed is changing, and how fast: the engine changes the push at once, the speed follows.
        const a = acceleration(setup, s, sim.throttle);
        const rate = Math.abs(a);
        const growing = s.speed >= 0 ? a > 0 : a < 0;
        const figure = rate < 10 ? rate.toFixed(1) : Math.round(rate).toString();
        const trend = dark || sim.done || phaseRef.current === "ready" ? "" : rate < 0.3 ? "steady" : growing ? "faster" : "slower";
        trendRef.current.textContent = trend === "" ? "" : trend === "steady" ? "steady" : `${trend} · ${growing ? "+" : "−"}${figure}/s`;
        trendRef.current.dataset.trend = trend;
      }
      const pct = (100 * s.fuel) / setup.fuel;
      if (fuelRef.current) fuelRef.current.textContent = `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
      if (fuelBarRef.current) {
        fuelBarRef.current.style.transform = `scaleX(${clamp(pct / 100, 0, 1)})`;
        fuelBarRef.current.dataset.low = pct < 10 ? "true" : "";
      }
      if (timeRef.current) timeRef.current.textContent = `T+${fmtTime(s.t)}`;
      if (warpRef.current) {
        const w = Math.round(sim.warp);
        warpRef.current.textContent = sim.done || ten ? "" : sim.warp < 0.9 ? "×½" : w > 1 ? `×${w}` : "";
      }
      if (guideRef.current) {
        let text = "";
        let tone = "";
        const L = sim.lines;
        if (s.fuel <= 0 && !sim.done) {
          text = "tank empty";
          tone = "warn";
        } else if ((sim.assist || sim.guide) && !ten && !sim.done && inFinalApproach(s)) {
          // The last stretch: a speed to aim for, and a round throttle to brake with.
          const a = approachAdvice(setup, s);
          const aim = a.target < 10 ? a.target.toFixed(0) : Math.round(a.target);
          if (L && L.twenty !== null && s.alt < L.twenty && s.speed > 20) {
            text = "below the amber line · full power!";
            tone = "warn";
          } else if (a.verdict === "fast") {
            text = `aim ${aim} km/h · brake (${a.brake}%)`;
            tone = s.speed > a.target * 1.6 + 5 ? "warn" : "close";
          } else if (a.verdict === "slow") {
            text = `aim ${aim} km/h · ease off (0%)`;
            tone = "ok";
          } else {
            text = `aim ${aim} km/h ✓`;
            tone = "ok";
          }
        } else if (sim.assist && L && !sim.done && s.speed > 0) {
          if (L.twenty === null || s.alt < L.twenty) {
            text = "below the amber line · full power!";
            tone = "warn";
          } else if (L.five === null) {
            text = "too fast for a flag · brake hard";
            tone = "close";
          } else if (s.alt < L.five) {
            text = L.strained ? "under the green line · full power" : "under the green line · brake harder";
            tone = "close";
          } else if (s.alt < L.five * 1.08 + 0.0003) {
            text = "on the green line · brake ~85%";
            tone = "ok";
          } else {
            text = "above the green line ✓ · coast";
            tone = "ok";
          }
        } else if (sim.guide && !sim.done && !ten && s.speed < 0 && sim.throttle > 0) {
          text = "climbing · ease off";
          tone = "warn";
        } else if (sim.guide && !sim.done && !ten && s.speed > 0) {
          if (sim.stop && !sim.stop.stops) {
            text = "BURN NOW";
            tone = "warn";
          } else if (sim.throttle >= 60 && sim.stop?.stops) {
            // Braking: stopping far above the ground wastes fuel.
            const early = sim.stop.alt > Math.max(5, s.alt * 0.3);
            text = `stops at ${fmtAlt(Math.max(0, sim.stop.alt))}${early ? " · too early" : ""}`;
            tone = early ? "close" : sim.stop.alt < 0.3 ? "close" : "ok";
          } else if (isFinite(sim.burnIn)) {
            text = sim.burnIn < 0.5 ? "BURN NOW" : `burn in ${fmtTime(sim.burnIn)}`;
            tone = sim.burnIn < 6 ? "close" : "ok";
          }
        }
        guideRef.current.textContent = text;
        guideRef.current.dataset.tone = tone;
      }
    };

    raf = requestAnimationFrame(frame);
    const onHide = () => {
      if (document.hidden && phaseRef.current === "flying") {
        pausedFrom.current = "flying";
        setPhase("paused");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      timers.forEach((t) => window.clearTimeout(t));
      releaseRef.current?.();
      sfx.engineStop();
    };
    // The flight is created once per mount; a retry remounts the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    if (phaseRef.current !== "ready") return;
    setPhase("flying");
    setFlown(true);
    if (liveRef.current.sound) sfx.engineStart();
  }, [setPhase]);

  const commitTurn = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.done || sim.turn) return;
    if (phaseRef.current === "ready") setPhase("flying");
    if (phaseRef.current !== "flying") return;
    setFlown(true);
    sim.startTurn(lever);
    setTurning(true);
    if (liveRef.current.sound) sfx.turnWhoosh();
  }, [lever, setPhase]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "flying" && phaseRef.current !== "ready") return;
    pausedFrom.current = phaseRef.current;
    setPhase("paused");
  }, [setPhase]);

  const resume = useCallback(() => {
    if (phaseRef.current === "paused") setPhase(pausedFrom.current);
  }, [setPhase]);

  const togglePause = useCallback(() => (phaseRef.current === "paused" ? resume() : pause()), [pause, resume]);

  usePlayScreen({
    screen: result ? "results" : "play",
    paused: phase === "paused",
    onPause: pause,
    onResume: resume,
    items: [{ label: "Restart flight", shortcut: "R", onSelect: onRetry }],
    losesProgress: flown && phase !== "ended",
    roundName: "this flight",
    onMenu: onExit,
  });

  const nudge = useCallback((d: number) => setLever((v) => clamp(Math.round(v + d), 0, 100)), []);

  // Keyboard.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // The range slider handles its own arrows.
      if (e.target instanceof HTMLInputElement && e.key !== "Enter") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      // While the pause menu is open only its shortcuts work: R restarts, P resumes.
      if (phaseRef.current === "paused" && !/^[rRpP]$/.test(k)) return;
      if (k === "r" || k === "R") {
        e.preventDefault();
        onRetry();
        return;
      }
      if ((k === "h" || k === "H") && result) {
        e.preventDefault();
        shell.toHall();
        return;
      }
      if ((k === "n" || k === "N") && result && onNext) {
        onNext();
        return;
      }
      if (phaseRef.current === "ended") return;
      if (k === "p" || k === "P") {
        togglePause();
        return;
      }
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (ten) commitTurn();
        else if (phaseRef.current === "ready") start();
        else if (k === " ") setHolding(true);
        return;
      }
      if (k === "ArrowUp" || k === "w" || k === "W") {
        e.preventDefault();
        nudge(e.shiftKey ? 1 : 5);
      } else if (k === "ArrowDown" || k === "s" || k === "S") {
        e.preventDefault();
        nudge(e.shiftKey ? -1 : -5);
      } else if (k === "PageUp") nudge(20);
      else if (k === "PageDown") nudge(-20);
      else if (/^[0-9]$/.test(k)) setLever(Number(k) * 10);
      else if (k === "x" || k === "X") setLever(0);
      else if (k === "f" || k === "F") setLever(100);
      else if ((k === "t" || k === "T") && !ten) {
        setAutoWarp((v) => !v);
      } else if ((k === "g" || k === "G") && !session.mission?.noGuide) setGuide((v) => !v);
      else if ((k === "a" || k === "A") && !session.mission?.noGuide) setAssist((v) => !v);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") setHolding(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [shell, onRetry, onNext, result, ten, commitTurn, start, togglePause, nudge, session.mission]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), banner.tone === "warn" ? 2600 : 1100);
    return () => window.clearTimeout(t);
  }, [banner]);

  const leverRef = useRef<HTMLDivElement>(null);
  const dragLever = (e: React.PointerEvent) => {
    const el = leverRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setLever(clamp(Math.round(((r.bottom - e.clientY) / r.height) * 100), 0, 100));
  };

  const shown = holding && !ten ? 100 : lever;
  const grade = result ? GRADES[result.grade] : null;
  const noGuide = !!session.mission?.noGuide;

  return (
    <div className={styles.flight} data-board data-phase={phase} data-mode={ten ? "ten" : "live"} data-world={world.id}>
      <div ref={wrapRef} className={styles.stage} onPointerDown={() => (ten ? undefined : start())}>
        <canvas ref={canvasRef} className={styles.canvas} aria-label={`The descent to ${world.name}`} role="img" />
      </div>

      <div className={styles.top}>
        <div className={styles.chip}>
          <WorldIcon world={world.id} size={18} /> {session.title}
        </div>
        <div className={styles.topTools}>
          {!ten && (
            <button type="button" className={styles.small} aria-pressed={autoWarp} onClick={() => setAutoWarp((v) => !v)} title="Time warp (T)" aria-label={`Time warp ${autoWarp ? "auto" : "off"}`}>
              <WarpIcon size={16} />
              <span className={styles.lbl}> Warp {autoWarp ? "auto" : "off"}</span>
            </button>
          )}
          {!noGuide && (
            <button type="button" className={styles.small} aria-pressed={assist} onClick={() => setAssist((v) => !v)} title="Landing assist (A)" aria-label={`Landing assist ${assist ? "on" : "off"}`}>
              <AssistIcon size={16} />
              <span className={styles.lbl}> Assist {assist ? "on" : "off"}</span>
            </button>
          )}
          {!noGuide && (
            <button type="button" className={styles.small} aria-pressed={guide} onClick={() => setGuide((v) => !v)} title="Burn guide (G)" aria-label={`Burn guide ${guide ? "on" : "off"}`}>
              <GuideIcon size={16} />
              <span className={styles.lbl}> Guide {guide ? "on" : "off"}</span>
            </button>
          )}
        </div>
      </div>

      <dl className={styles.hud} aria-label="Instruments">
        <div>
          <dt>Altitude</dt>
          <dd ref={altRef} aria-live="off" />
        </div>
        <div ref={speedRowRef} className={styles.speedRow}>
          <dt>Speed</dt>
          <dd>
            <span ref={speedRef} />
            <span ref={trendRef} className={styles.trend} />
          </dd>
        </div>
        <div>
          <dt>Fuel</dt>
          <dd>
            <span ref={fuelRef} />
            <span className={styles.fuelTrack} aria-hidden>
              <span ref={fuelBarRef} className={styles.fuelBar} />
            </span>
          </dd>
        </div>
        <div className={styles.timeRow}>
          <dt>{ten ? `Turn ${turns + (turning ? 0 : 1)}` : "Clock"}</dt>
          <dd>
            <span ref={timeRef} /> <b ref={warpRef} className={styles.warp} />
          </dd>
        </div>
        {!noGuide && <p ref={guideRef} className={styles.guide} aria-live="polite" />}
      </dl>

      {!ten && (
        <div className={styles.controls}>
          <div
            ref={leverRef}
            className={styles.lever}
            role="slider"
            tabIndex={0}
            aria-label="Throttle"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={shown}
            aria-valuetext={`${shown}%`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              start();
              dragLever(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons) dragLever(e);
            }}
          >
            <span className={styles.leverFill} style={{ transform: `scaleY(${shown / 100})` }} data-hold={holding || undefined} />
            <span className={styles.leverThumb} style={{ bottom: `calc(${shown}% - 14px)` }}>
              {shown}
            </span>
            <span className={styles.leverLabel}>Throttle</span>
          </div>
          <button
            type="button"
            className={styles.burn}
            aria-label="Hold for full burn"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              start();
              setHolding(true);
            }}
            onPointerUp={() => setHolding(false)}
            onPointerCancel={() => setHolding(false)}
            data-on={holding || undefined}
          >
            BURN
          </button>
        </div>
      )}

      {ten && phase !== "ended" && (
        <section className={styles.turnPanel} aria-label="Next ten seconds">
          <p className={styles.turnTitle}>{turning ? "Burning…" : `Turn ${turns + 1} · set the burn for the next ${TURN_SECONDS} seconds`}</p>
          <div className={styles.turnRow}>
            <button type="button" className={styles.step} onClick={() => nudge(-5)} disabled={turning} aria-label="Less burn">
              −
            </button>
            <input
              className={styles.range}
              type="range"
              min={0}
              max={100}
              step={1}
              value={lever}
              disabled={turning}
              onChange={(e) => setLever(Number(e.target.value))}
              aria-label="Burn rate for the next ten seconds"
            />
            <button type="button" className={styles.step} onClick={() => nudge(5)} disabled={turning} aria-label="More burn">
              +
            </button>
            <output className={styles.burnValue}>{lever}</output>
          </div>
          {prediction && (
            <p className={styles.predict}>
              {prediction.touchdown !== null ? (
                <>
                  Touches down this turn at <b>{fmtSpeed(prediction.touchdown)}</b>
                  {Math.abs(prediction.touchdown) < 20 ? " ✓" : " ✗"}
                </>
              ) : (
                <>
                  In 10 s: <b>{fmtAlt(prediction.after.alt)}</b> at <b>{fmtSpeed(prediction.after.speed)}</b>
                  {prediction.after.speed < 0 ? " (climbing)" : ""}.{" "}
                  {prediction.stop && (prediction.stop.stops ? <>Full burn after that stops you {fmtAlt(Math.max(0, prediction.stop.alt))} up ✓</> : <>After that, even a full burn can&rsquo;t stop you ✗</>)}
                </>
              )}
            </p>
          )}
          <button type="button" className={styles.commit} onClick={commitTurn} disabled={turning}>
            Burn {lever} for 10 s <kbd>Enter</kbd>
          </button>
        </section>
      )}

      {banner && (
        <p key={banner.key} className={styles.banner} data-tone={banner.tone} aria-live="assertive">
          {banner.text}
        </p>
      )}

      {phase === "ready" && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <p className={styles.kicker}>
              <WorldIcon world={world.id} size={16} /> {world.name} · {fmtAlt(setup.alt)} up · {fmtSpeed(setup.speed)} down
              {session.difficulty && session.difficulty !== "standard" && ` · ${difficultyLabel(session.difficulty)}`}
            </p>
            <h2 className={styles.cardTitle}>{session.title}</h2>
            <p className={styles.cardText}>{session.mission?.blurb ?? (ten ? "The 1979 way: choose a burn, watch ten seconds play out, choose again. The dotted path shows where each burn takes you." : "Fall freely to save fuel, then burn hard so you stop right at the ground. Touch down under 20 km/h to walk away; under 5 to plant your flag.")}</p>
            {ten ? (
              <ul className={styles.keys}>
                <li>
                  <kbd>↑</kbd> <kbd>↓</kbd> or the slider: burn rate
                </li>
                <li>
                  <kbd>Enter</kbd> play the next 10 seconds
                </li>
              </ul>
            ) : (
              <ul className={styles.keys}>
                <li>
                  hold <kbd>Space</kbd> or BURN: full power
                </li>
                <li>
                  <kbd>↑</kbd> <kbd>↓</kbd> (<kbd>Shift</kbd> for fine) or drag the lever: throttle
                </li>
                <li>
                  <kbd>0</kbd>–<kbd>9</kbd> set 0–90 · <kbd>X</kbd> cut · <kbd>P</kbd> pause · <kbd>R</kbd> restart
                </li>
                {!noGuide && !assist && <li>Keep the green STOP POINT above the ground. When it touches, burn.</li>}
                {!noGuide && assist && (
                  <li>
                    Landing assist: keep the lander above the <b className={styles.softText}>green line</b> for a flag landing, never below the{" "}
                    <b className={styles.limitText}>amber line</b>. <kbd>A</kbd> turns it off.
                  </li>
                )}
              </ul>
            )}
            <button type="button" className={styles.go} onClick={ten ? commitTurn : start}>
              {ten ? "Start with this burn" : "Start the descent"} <kbd>{ten ? "Enter" : "Space"}</kbd>
            </button>
          </div>
        </div>
      )}

      {result && grade && (
        <section className={styles.result} data-grade={result.grade} aria-live="polite">
          <p className={styles.kicker}>{session.title}</p>
          <h2 className={styles.gradeTitle}>
            <GradeIcon grade={result.grade} size={32} className={styles.gradeIcon} /> {grade.title}
          </h2>
          <p className={styles.gradeLine}>{grade.line(world.name)}</p>
          <dl className={styles.stats}>
            <div>
              <dt>{result.grade === "lost" ? "Speed" : "Impact"}</dt>
              <dd>{fmtSpeed(result.speed)}</dd>
            </div>
            <div>
              <dt>Fuel left</dt>
              <dd>{Math.round(result.fuelPct * 100)}%</dd>
            </div>
            <div>
              <dt>{result.turns !== undefined ? "Turns" : "Flight"}</dt>
              <dd>{result.turns !== undefined ? result.turns : fmtTime(result.time)}</dd>
            </div>
          </dl>
          {session.mission && (
            <p className={styles.stars}>
              <Stars value={result.stars} size={22} />{" "}
              {result.cleared ? "Mission cleared" : `Not yet: touch down under ${session.mission.clearBelow ?? 20} km/h`}
            </p>
          )}
          <Recorder samples={result.samples} ideal={result.ideal} startAlt={setup.alt} />
          <p className={styles.insight}>{result.insight}</p>
          <div className={styles.actions}>
            {onNext && result.cleared && (
              <button type="button" className={styles.go} onClick={onNext}>
                Next mission <kbd>N</kbd>
              </button>
            )}
            <ShareButton text={result.share} className={styles.secondary} />
          </div>
          <div className={styles.actions} data-standard>
            <button type="button" className={onNext && result.cleared ? styles.secondary : styles.go} onClick={onRetry}>
              Fly again <kbd>R</kbd>
            </button>
            <button type="button" className={styles.secondary} onClick={onExit}>
              Game menu <kbd>Esc</kbd>
            </button>
            <button type="button" className={styles.secondary} onClick={shell.toHall}>
              Back to the Hall <kbd>H</kbd>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function insightFor(sim: FlightSim, grade: GradeId, fuel: number) {
  const ideal = sim.ideal;
  const firstBurn = sim.samples.find((s) => s.throttle >= 50);
  const idealAlt = ideal.burnStartAlt;
  const tank = sim.setup.fuel;
  if (grade === "lost") return "You were climbing when it mattered. Let gravity pull you down and brake on the way in.";
  if (!firstBurn) return `You never really fired the engine. A perfect run waits until ${fmtAlt(idealAlt)} up, then burns flat out.`;
  if (GRADES[grade].landed) {
    if (ideal.possible && fuel >= 0.9 * ideal.fuelLeft) return `Hoverslam! You kept ${Math.round((100 * fuel) / Math.max(1, ideal.fuelLeft))}% of the fuel a perfect run would keep.`;
    const waste = Math.max(0, Math.round((100 * (ideal.fuelLeft - fuel)) / tank));
    if (firstBurn.alt > idealAlt * 1.25) return `You started braking at ${fmtAlt(firstBurn.alt)}. Waiting until ${fmtAlt(idealAlt)} and then burning flat out would have saved ${waste}% of the tank.`;
    return `Clean flying. Most of the extra fuel (${waste}% of the tank) went on the slow part near the ground: come down a bit faster there.`;
  }
  if (fuel <= 1) {
    const dry = sim.samples.find((s, i) => i > 0 && s.throttle === 0 && sim.samples[i - 1].throttle > 0 && s.alt < firstBurn.alt);
    const where = dry ? ` about ${fmtAlt(dry.alt)} up` : "";
    return firstBurn.alt > idealAlt * 1.2
      ? `You ran dry${where}. Braking from ${fmtAlt(firstBurn.alt)} spent fuel too early: a perfect run waits until ${fmtAlt(idealAlt)}.`
      : `You ran dry${where}. Short, hard burns waste less fuel than long gentle ones.`;
  }
  if (firstBurn.alt < idealAlt * 0.97) return `The last safe moment to start braking was ${fmtAlt(idealAlt)}. You started at ${fmtAlt(firstBurn.alt)}. Watch the stop point: burn before it reaches the ground.`;
  return `You still had ${Math.round((100 * fuel) / tank)}% of the fuel, but came in too fast at the end. In the last hundred metres, keep the speed under 20 km/h.`;
}

/** Climbing: when the rise tops out, if gravity is winning; or still climbing under power. */
function risingInfo(sim: FlightSim) {
  const s = sim.state;
  if (sim.done || s.speed > -1) return null;
  const a = acceleration(sim.setup, s, sim.throttle);
  if (a <= 0.05) return { powered: true as const };
  return { peakIn: -s.speed / a, peakAlt: s.alt + (s.speed * s.speed) / (2 * a) / SECONDS_PER_HOUR_1979 };
}
