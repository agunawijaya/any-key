"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShareButton } from "@/components/kit/ShareButton";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { TargetIcon } from "@/components/kit/icons";
import { Stars } from "@/components/kit/Stars";
import { AssistIcon, DivertIcon, FuelMark, GradeIcon, GuideIcon, JetIcon, ScanIcon, WarpIcon, WorldIcon } from "./icons";
import { holdAnnouncements } from "@/lib/kit/achievements";
import { difficultyLabel, type FuelChoice } from "@/lib/lander/difficulty";
import { flagSvg, type FlagDesign } from "@/lib/lander/flags";
import { freeFlight, onTarget, targetAt, type FreeFlight as Flight2D, type FreeStart } from "@/lib/lander/freeflight";
import { GRADES, type GradeId } from "@/lib/lander/grades";
import { SECONDS_PER_HOUR_1979 } from "@/lib/lander/physics";
import { acceleration2d, JET_PUSH, type Verdict } from "@/lib/lander/physics2d";
import { addOnce, getProgress, updateProgress, withAchievement } from "@/lib/lander/progress";
import { approachAdvice, inFinalApproach } from "@/lib/lander/solver";
import * as sfx from "@/lib/lander/sfx";
import { bargeTarget, flatTarget, autopilot } from "@/lib/lander/solver2d";
import { footSlope, heightAt, SITE_HALF, siteProfile } from "@/lib/lander/terrain";
import type { WorldId } from "@/lib/lander/worlds";
import { fmtAlt, fmtKm, fmtSpeed } from "@/lib/lander/format";
import { freeFlightShare } from "@/lib/lander/share";
import { FreeScene, type FreeEnding } from "./freescene";
import { FreeSim, type FreeEvent, type Sample2D } from "./freesim";
import { useNight, useReducedMotion } from "./hooks";
import { Recorder2D, type Track } from "./Recorder2D";
import styles from "./Flight.module.css";
import free from "./FreeFlight.module.css";

/** What to fly: a world, a start, a seeded or named site, and the fuel choice (a difficulty, or unlimited). */
export type FreeSpec = { world: WorldId; start: FreeStart; pick: { seed: number } | { named: string }; difficulty: FuelChoice };

type Phase = "ready" | "flying" | "paused" | "ended";
type Banner = { text: string; tone: "info" | "warn" | "good"; key: number };

type Result = {
  verdict: Verdict | null;
  /** Standing on the planned target, or how far from it (km) a standing landing was. */
  onTarget: boolean;
  missBy: number;
  grade: GradeId;
  fuelPct: number;
  time: number;
  stars: number;
  narrow: boolean;
  centre: boolean;
  detail: string;
  insight: string;
  share: string;
  /** Unlimited fuel: refills, tanks used, and the best so far on this world and start (before this flight). */
  unlimited: boolean;
  refills: number;
  tanksUsed: number;
  bestTanks: number | null;
  newBest: boolean;
  samples: Sample2D[];
  you: Track;
  ideal: Track;
  scanned: boolean;
};

type Props = {
  spec: FreeSpec;
  flag: FlagDesign;
  sound: boolean;
  guide: boolean;
  assist: boolean;
  scan: boolean;
  onExit: () => void;
  onRetry: () => void;
  onNewSite: () => void;
};

const DEG = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function fmtTime(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Butter · 14 m ledge · dead centre": the landing in words. */
function landingDetail(flight: Flight2D, v: Verdict | null) {
  if (!v || !v.stands || !v.flat) return { detail: "", narrow: false, centre: false };
  const width = Math.round(v.flat.width);
  const narrow = v.flat.width < 20;
  const centre = v.flat.offset <= Math.max(1.5, v.flat.width * 0.08);
  const noun = flight.site.kind === "sea" ? "barge" : narrow ? "ledge" : v.flat.width < 35 ? "flat" : "clearing";
  const where = centre ? "dead centre" : `${v.flat.offset.toFixed(1)} m off centre`;
  return { detail: `${GRADES[v.grade].title.replace(".", "")} · ${width} m ${noun} · ${where}`, narrow, centre };
}

/** "34 m clearing 1.2 km to your right" */
function targetWords(flight: Flight2D) {
  const g = targetAt(flight, 0);
  const width = (g.x1 - g.x0) * 1000;
  const noun = flight.site.kind === "sea" ? "barge" : width < 20 ? "ledge" : width < 35 ? "flat" : "clearing";
  const d = (g.x0 + g.x1) / 2 - flight.state.x;
  return `${Math.round(width)} m ${noun} ${fmtKm(d)} to your ${d < 0 ? "left" : "right"}`;
}

/** "62% of a tank", "2.4 tanks". */
function fmtTanks(tanks: number) {
  return tanks < 1 ? `${Math.round(tanks * 100)}% of a tank` : `${tanks.toFixed(1)} tanks`;
}

/** Unlimited fuel on the result card: what this flight used, against your best on this world and start. */
function tanksLine(r: Result, where: string) {
  const used = fmtTanks(r.tanksUsed);
  if (r.newBest) return r.bestTanks === null ? `${used}: your first record ${where}. Need less next time.` : `New best ${where}: ${used}, down from ${fmtTanks(r.bestTanks)}.`;
  return r.bestTanks === null ? `${used} used.` : `${used} used · your best ${where}: ${fmtTanks(r.bestTanks)}.`;
}

function siteLabel(flight: Flight2D) {
  return flight.named ? flight.named.name : `${flight.world.name} · site ${flight.seed}`;
}

type JetKeys = { jetLeft: boolean; jetRight: boolean; touchJetLeft: boolean; touchJetRight: boolean };

/** Which way the side jets push, from the keys and buttons held: both sides at once cancel out. */
function jetSide(k: JetKeys): "left" | "right" | null {
  const left = k.jetLeft || k.touchJetLeft;
  const right = k.jetRight || k.touchJetRight;
  return left === right ? null : left ? "left" : "right";
}

function jetsFrom(k: JetKeys) {
  const side = jetSide(k);
  return side === "left" ? -1 : side === "right" ? 1 : 0;
}

export function FreeFlight({ spec, flag, sound, guide: guideOn, assist: assistOn, scan: scanOn, onExit, onRetry, onNewSite }: Props) {
  const flight = useMemo(() => freeFlight(spec.world, spec.start, spec.pick, spec.difficulty), [spec]);
  const world = flight.world;
  const night = useNight();
  const reduced = useReducedMotion();
  const forcedNight = flight.named?.hour === "night";

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<FreeSim | null>(null);
  const endingRef = useRef<FreeEnding | null>(null);
  const flagImgRef = useRef<HTMLImageElement | null>(null);
  const phaseRef = useRef<Phase>("ready");
  const liveRef = useRef({ sound, night: night || forcedNight, reduced });
  /** Lets the held unlock toasts out; called when the card appears or the flight is left. */
  const releaseRef = useRef<(() => void) | null>(null);
  /** Where Resume goes back to: a flight can be paused before it starts. */
  const pausedFrom = useRef<Phase>("flying");
  const timersRef = useRef<number[]>([]);
  const keysRef = useRef({ left: false, right: false, touchLeft: false, touchRight: false, level: false, fine: false, jetLeft: false, jetRight: false, touchJetLeft: false, touchJetRight: false });
  const altRef = useRef<HTMLElement>(null);
  const speedRef = useRef<HTMLElement>(null);
  const trendRef = useRef<HTMLSpanElement>(null);
  const driftRef = useRef<HTMLElement>(null);
  const driftSubRef = useRef<HTMLSpanElement>(null);
  const tiltRef = useRef<HTMLElement>(null);
  const fuelRef = useRef<HTMLSpanElement>(null);
  const refillRef = useRef<HTMLSpanElement>(null);
  const fuelBarRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const warpRef = useRef<HTMLElement>(null);
  const guideRef = useRef<HTMLParagraphElement>(null);
  const sideRef = useRef<HTMLParagraphElement>(null);
  const speedRowRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLElement>(null);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [lever, setLever] = useState(0);
  const [holding, setHolding] = useState(false);
  const [autoWarp, setAutoWarp] = useState(true);
  const [guide, setGuide] = useState(guideOn);
  const [assist, setAssist] = useState(assistOn);
  const [scan, setScan] = useState(scanOn);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [turning, setTurning] = useState<"left" | "right" | "level" | null>(null);
  const [jetting, setJetting] = useState<"left" | "right" | null>(null);
  const [flown, setFlown] = useState(false);
  const shell = useShell();

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const say = useCallback((text: string, tone: Banner["tone"] = "info") => setBanner({ text, tone, key: performance.now() }), []);

  useEffect(() => {
    liveRef.current = { sound, night: night || forcedNight, reduced };
    if (!sound) sfx.engineStop();
  }, [sound, night, forcedNight, reduced]);

  useEffect(() => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(flagSvg(flag, "flight"))}`;
    flagImgRef.current = img;
  }, [flag]);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.lever = lever;
    sim.hold = holding;
    sim.autoWarp = autoWarp;
    sim.guide = guide;
    sim.assist = assist;
    sim.scan = scan;
  }, [lever, holding, autoWarp, guide, assist, scan]);

  // The terrain strip's fixed part: the whole site's profile (percent coordinates, so markers can sit on it).
  const strip = useMemo(() => {
    const from = -SITE_HALF - 0.6;
    const to = SITE_HALF + 0.6;
    const pts = siteProfile(flight.site, from, to, 500, 0);
    const lo = Math.min(...pts.map((p) => p[1]));
    const hi = Math.max(...pts.map((p) => p[1]));
    const range = Math.max(40, hi - lo);
    const xOf = (x: number) => ((x - from) / (to - from)) * 100;
    const yOf = (h: number) => 30 + (1 - (h - lo) / range) * 66;
    const d = "M0 100 " + pts.map(([x, h]) => `L${xOf(x).toFixed(2)} ${yOf(h).toFixed(2)}`).join(" ") + " L100 100 Z";
    return { d, xOf, yOf, from, to };
  }, [flight]);

  const finish = useCallback(
    (sim: FreeSim, grade: GradeId, verdict: Verdict | null, fuel: number) => {
      const g = GRADES[grade];
      const stands = !!verdict?.stands;
      const { detail, narrow, centre } = landingDetail(flight, verdict);
      const hit = stands && onTarget(flight, sim.state.x, sim.state.t);
      const goal = targetAt(flight, sim.state.t);
      const missBy = Math.abs(sim.state.x - (goal.x0 + goal.x1) / 2);
      // Standing on the target earns the grade's stars; a safe landing elsewhere (a diversion), one.
      const stars = stands ? (hit ? g.stars : Math.min(1, g.stars)) : 0;
      const fuelPct = fuel / flight.setup.fuel;
      const tanksUsed = sim.refills + 1 - fuelPct;
      const bestKey = `${world.id}-${flight.start}`;
      const bestTanks = flight.unlimited ? (getProgress().freeTanks[bestKey] ?? null) : null;
      // A record needs a standing landing; a hundredth of a tank is the smallest step the card shows.
      const newBest = flight.unlimited && stands && (bestTanks === null || tanksUsed < bestTanks - 0.005);
      const insight = insightFor(sim, flight, grade, verdict);
      const share = freeFlightShare({
        site: flight.named ? flight.named.name : `site ${flight.seed}`,
        world: flight.world,
        grade,
        speed: verdict ? verdict.speed : null,
        stands: !!verdict?.stands,
        detail,
        onTarget: hit,
        missBy,
        fuelPct,
        samples: sim.samples,
        scanned: sim.scanUsed,
        assisted: sim.assistUsed,
        difficulty: flight.difficulty,
        refills: flight.unlimited ? sim.refills : undefined,
      });
      // New keycaps wait for the card, so the toast doesn't land on top of the landing.
      releaseRef.current = holdAnnouncements();
      updateProgress((p) => {
        let n = { ...p, flights: p.flights + 1, freeSeed: flight.named ? p.freeSeed : flight.seed };
        if (newBest) n = { ...n, freeTanks: { ...n.freeTanks, [bestKey]: tanksUsed } };
        if (stands) {
          const speed = Math.abs(verdict!.speed);
          n = { ...n, landings: n.landings + 1, landed: addOnce(n.landed, world.id), best: { ...n.best, [world.id]: Math.min(n.best[world.id] ?? Infinity, speed) } };
          n = withAchievement(n, "first-touch");
          if (n.landed.length >= 4) n = withAchievement(n, "postcards");
          if (verdict!.flat && verdict!.flat.width < 15) n = withAchievement(n, "pinpoint");
          if (sim.driftKilled > 500) n = withAchievement(n, "sidewinder");
          if (flight.named) {
            const old = n.sites[flight.named.id];
            n = { ...n, sites: { ...n.sites, [flight.named.id]: { stars: Math.max(old?.stars ?? 0, stars), speed: Math.min(old?.speed ?? Infinity, speed), narrow: !!old?.narrow || narrow, centre: !!old?.centre || centre } } };
          }
        }
        if (g.flag) {
          n = { ...n, flagged: addOnce(n.flagged, world.id) };
          if (n.flagged.length >= 4) n = withAchievement(n, "flag-planter");
        }
        if (grade === "butter") n = withAchievement(n, "butter");
        if (grade === "tipped" || grade === "splash") n = withAchievement(n, "oops");
        if (grade === "crater" || grade === "oil") n = withAchievement({ ...n, craters: n.craters + 1 }, "crater-maker");
        if (grade === "oil") n = withAchievement(n, "wildcatter");
        return n;
      });
      const mid = (t: number) => {
        const g = targetAt(flight, t);
        return (g.x0 + g.x1) / 2;
      };
      const you: Track = sim.samples.map((p) => ({ t: p.t, alt: p.alt, off: mid(p.t) - p.x, throttle: p.throttle, tilt: p.tilt }));
      const ideal: Track = sim.ideal.path.map((p) => ({ t: p.t, alt: Math.max(0, p.alt - heightAt(flight.site, p.x, p.t) / 1000), off: mid(p.t) - p.x, throttle: p.throttle, tilt: p.tilt }));
      const r: Result = { verdict, onTarget: hit, missBy, grade, fuelPct, time: sim.state.t, stars, narrow, centre, detail, insight, share, unlimited: flight.unlimited, refills: sim.refills, tanksUsed, bestTanks, newBest, samples: [...sim.samples], you, ideal, scanned: sim.scanUsed };
      const delay = liveRef.current.reduced ? 700 : g.flag ? 4300 : grade === "tipped" ? 3800 : grade === "splash" ? 3000 : grade === "oil" ? 3400 : g.landed ? 1800 : 2400;
      timersRef.current.push(
        window.setTimeout(() => {
          setResult(r);
          releaseRef.current?.();
        }, delay),
      );
      if (liveRef.current.sound && g.flag) timersRef.current.push(window.setTimeout(() => sfx.flagFlap(), liveRef.current.reduced ? 0 : 3100));
    },
    [flight, world.id],
  );

  const handleEvents = useCallback(
    (sim: FreeSim, events: FreeEvent[]) => {
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
          say(flight.unlimited ? "Fuel low · a refill is coming" : "Fuel low", "warn");
        } else if (e.kind === "refill") {
          if (on) sfx.refill();
          say(`Tank refilled · refill ${e.count}`, "info");
        } else if (e.kind === "fuel-out") {
          say(e.hopeless ? "Out of fuel · fast-forwarding" : "Out of fuel", "warn");
        } else if (e.kind === "climbing") {
          say("You're going up! Ease off", "warn");
        } else if (e.kind === "lean") {
          if (on) sfx.warning();
          say("Too much lean to brake: level up (U)", "warn");
        } else if (e.kind === "slope-ahead") {
          if (on) sfx.warning();
          say("Rough ground ahead!", "warn");
        } else if (e.kind === "touchdown" || e.kind === "lost") {
          const verdict = e.kind === "touchdown" ? e.verdict : null;
          const grade: GradeId = verdict ? verdict.grade : "lost";
          const s = sim.state;
          endingRef.current = { grade, at: performance.now() / 1000, impact: verdict ? verdict.total : Math.abs(s.speed), x: s.x, alt: s.alt, ground: sim.groundHere, tilt: s.tilt, vx: s.vx, verdict };
          setPhase("ended");
          sfx.engineStop();
          if (on) {
            const g = GRADES[grade];
            if (g.landed) sfx.touchdown(g.flag);
            else if (grade === "tipped") sfx.tipOver();
            else if (grade === "splash") sfx.splash();
            else if (grade === "dented") sfx.crash(1);
            else if (grade === "scrap" || grade === "confetti") sfx.crash(2);
            else if (grade !== "lost") sfx.crash(3);
            if (grade === "oil") sfx.gusher();
          }
          say(GRADES[grade].title, GRADES[grade].landed ? "good" : "warn");
          finish(sim, grade, verdict, e.kind === "touchdown" ? e.fuel : s.fuel);
        }
      }
    },
    [finish, say, setPhase, flight.unlimited],
  );

  // The frame loop.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const sim = new FreeSim(flight, guideOn);
    sim.assist = assistOn;
    sim.scan = scanOn;
    simRef.current = sim;
    const scene = new FreeScene(canvas, flight.seed * 7 + 3);
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      scene.resize(Math.max(1, r.width), Math.max(1, r.height), Math.min(2, window.devicePixelRatio || 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    const timers = timersRef.current;
    const startAgl = flight.state.alt - heightAt(flight.site, flight.state.x) / 1000;
    // Development only: lets headless-browser tests fly whole flights through this screen.
    let auto: ((s: typeof sim.state) => { throttle: number; tilt: number }) | null = null;
    if (process.env.NODE_ENV === "development") {
      const autoFly = (where: "target" | "slope" | "water") => {
        const g = targetAt(flight, 0);
        let aim = (g.x0 + g.x1) / 2;
        if (where === "slope") {
          // The nearest rough ground past the target, steep under both feet.
          for (let d = 0.03; d < 2; d += 0.002) {
            const x = aim + d;
            if (footSlope(flight.site, x - 0.004) > 12 && footSlope(flight.site, x + 0.004) > 12) {
              aim = x;
              break;
            }
          }
        } else if (where === "water") aim = (g.x0 + g.x1) / 2 + 0.25;
        const target = where === "target" && flight.site.kind === "sea" ? bargeTarget(flight.site, flight.plan.index) : flatTarget({ x0: aim - 0.02, x1: aim + 0.02, slope: 0 });
        auto = autopilot(flight.setup, flight.site, target);
        setPhase("flying");
      };
      (window as unknown as { __freeFlight?: unknown }).__freeFlight = { sim, flight, setPhase, phase: () => phaseRef.current, autoFly };
    }

    let raf = 0;
    let last = performance.now();
    let reported = false;
    let rcsAt = 0;
    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      try {
        step(nowMs);
      } catch (error) {
        if (!reported) console.error(error);
        reported = true;
      }
    };
    const step = (nowMs: number) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      const live = liveRef.current;
      const k = keysRef.current;
      const left = k.left || k.touchLeft;
      const right = k.right || k.touchRight;
      sim.level = k.level || (k.touchLeft && k.touchRight);
      sim.turn = sim.level ? 0 : left === right ? 0 : left ? -1 : 1;
      sim.fine = k.fine;
      sim.jets = jetsFrom(k);
      if (auto && !sim.done) {
        const c = auto(sim.state);
        const diff = c.tilt - sim.state.tilt;
        sim.lever = Math.round(c.throttle);
        sim.turn = Math.abs(diff) > 0.8 ? Math.sign(diff) : 0;
        sim.fine = Math.abs(diff) < 6;
      }
      if (phaseRef.current === "flying") {
        handleEvents(sim, sim.update(dt));
        if (live.sound && !sim.done) {
          sfx.engineStart();
          sfx.engineSet(sim.throttle, sim.above < 0.05 ? 1 : 0);
          const jetsOn = sim.jets !== 0 && sim.state.fuel > 0;
          if ((sim.turn !== 0 || jetsOn || (sim.level && sim.state.tilt !== 0)) && nowMs - rcsAt > (jetsOn ? 150 : 230)) {
            rcsAt = nowMs;
            sfx.rcs(jetsOn ? 1.4 : sim.fine ? 0.6 : 1);
          }
        }
      } else if (phaseRef.current === "paused") sfx.engineSet(0);
      const s = sim.state;
      scene.renderFree({
        world,
        night: live.night,
        startAgl,
        site: flight.site,
        t: s.t,
        x: s.x,
        alt: s.alt,
        vx: s.vx,
        speed: s.speed,
        tilt: s.tilt,
        ground: sim.groundHere,
        throttle: phaseRef.current === "flying" ? sim.throttle : 0,
        jets: phaseRef.current === "flying" && s.fuel > 0 ? sim.jets : 0,
        now: nowMs / 1000,
        ending: endingRef.current,
        stop: sim.guide && !sim.assist && sim.stop ? { alt: sim.stop.stops ? sim.stop.alt : null } : null,
        assist: sim.assist && !sim.done ? { lines: sim.lines, outcome: sim.outcome } : null,
        rising: risingInfo(sim),
        impact: sim.impact && !sim.done ? { x: sim.impact.x, t: sim.impact.t, path: sim.impact.path } : null,
        target: sim.done ? null : targetAt(flight, s.t),
        scan: sim.scan,
        flag: flagImgRef.current,
        reduced: live.reduced,
      });
      writeHud(sim);
    };

    const writeHud = (sim: FreeSim) => {
      const s = sim.state;
      const agl = sim.above;
      if (altRef.current) altRef.current.textContent = fmtAlt(Math.max(0, agl));
      if (speedRef.current) speedRef.current.textContent = `${s.speed < -0.05 ? "↑" : "↓"} ${fmtSpeed(s.speed)}`;
      if (speedRowRef.current) speedRowRef.current.dataset.zone = agl > 1 ? "" : Math.abs(s.speed) < 20 ? "safe" : Math.abs(s.speed) < 45 ? "risky" : "fast";
      const acc = acceleration2d(flight.setup, s, sim.throttle);
      if (trendRef.current) {
        const rate = Math.abs(acc.a);
        const growing = s.speed >= 0 ? acc.a > 0 : acc.a < 0;
        const figure = rate < 10 ? rate.toFixed(1) : Math.round(rate).toString();
        const trend = sim.done || phaseRef.current === "ready" ? "" : rate < 0.3 ? "steady" : growing ? "faster" : "slower";
        trendRef.current.textContent = trend === "" ? "" : trend === "steady" ? "steady" : `${trend} · ${growing ? "+" : "−"}${figure}/s`;
        trendRef.current.dataset.trend = trend;
      }
      if (driftRef.current) {
        const v = Math.abs(s.vx);
        driftRef.current.textContent = v < 0.05 ? "0 km/h" : `${s.vx < 0 ? "◀ " : ""}${fmtSpeed(s.vx)}${s.vx > 0 ? " ▶" : ""}`;
        driftRef.current.dataset.zone = agl > 0.3 ? "" : v <= 6 ? "safe" : v <= 20 ? "risky" : "fast";
      }
      if (driftSubRef.current) {
        driftSubRef.current.textContent = sim.driftStop !== null && !sim.done && Math.abs(s.vx) > 1 ? `stops in ${fmtKm(sim.driftStop)}` : "";
      }
      if (tiltRef.current) {
        const t = Math.round(s.tilt);
        tiltRef.current.textContent = t === 0 ? "upright" : t < 0 ? `◀ ${-t}°` : `${t}° ▶`;
      }
      const pct = (100 * s.fuel) / flight.setup.fuel;
      if (fuelRef.current) fuelRef.current.textContent = `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
      if (fuelBarRef.current) {
        fuelBarRef.current.style.transform = `scaleX(${clamp(pct / 100, 0, 1)})`;
        fuelBarRef.current.dataset.low = pct < 10 ? "true" : "";
      }
      if (refillRef.current) refillRef.current.textContent = !flight.unlimited ? "" : sim.refills === 0 ? "unlimited · no refill yet" : `unlimited · ${sim.refills} refill${sim.refills === 1 ? "" : "s"}`;
      if (timeRef.current) timeRef.current.textContent = `T+${fmtTime(s.t)}`;
      if (warpRef.current) {
        const w = Math.round(sim.warp);
        warpRef.current.textContent = sim.done ? "" : sim.warp < 0.9 ? "×½" : w > 1 ? `×${w}` : "";
      }
      // Advice: the vertical line as in Live, then the sideways one close to the ground.
      const flat = { t: s.t, alt: agl, speed: s.speed, fuel: s.fuel };
      if (guideRef.current) {
        let text = "";
        let tone = "";
        const L = sim.lines;
        if (s.fuel <= 0 && !sim.done) {
          text = "tank empty";
          tone = "warn";
        } else if ((sim.assist || sim.guide) && !sim.done && inFinalApproach(flat)) {
          const upright = { ...flight.setup, world: { ...flight.setup.world, thrust: flight.setup.world.thrust * Math.max(0.05, Math.cos(s.tilt * DEG)) } };
          const a = approachAdvice(upright, flat);
          const aim = a.target < 10 ? a.target.toFixed(0) : Math.round(a.target);
          if (L && L.twenty !== null && agl < L.twenty && s.speed > 20) {
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
          if (L.twenty === null || agl < L.twenty) {
            text = "below the amber line · full power!";
            tone = "warn";
          } else if (L.five === null) {
            text = "too fast for a flag · brake hard";
            tone = "close";
          } else if (agl < L.five) {
            text = L.strained ? "under the green line · full power" : "under the green line · brake harder";
            tone = "close";
          } else if (agl < L.five * 1.08 + 0.0003) {
            text = "on the green line · brake ~85%";
            tone = "ok";
          } else {
            text = "above the green line ✓ · coast";
            tone = "ok";
          }
        } else if (sim.guide && !sim.done && s.speed < 0 && sim.throttle > 0) {
          text = "climbing · ease off";
          tone = "warn";
        } else if (sim.guide && !sim.done && s.speed > 0) {
          if (sim.stop && !sim.stop.stops) {
            text = sim.leanBlocks ? "level up to brake (U)" : "BURN NOW";
            tone = "warn";
          } else if (sim.throttle >= 60 && sim.stop?.stops) {
            text = `stops at ${fmtAlt(Math.max(0, sim.stop.alt))}`;
            tone = sim.stop.alt < 0.3 ? "close" : "ok";
          } else if (isFinite(sim.burnIn)) {
            text = sim.burnIn < 0.5 ? "BURN NOW" : `burn in ${fmtTime(sim.burnIn)}`;
            tone = sim.burnIn < 6 ? "close" : "ok";
          }
        }
        guideRef.current.textContent = text;
        guideRef.current.dataset.tone = tone;
      }
      if (sideRef.current) {
        let text = "";
        let tone = "ok";
        if ((sim.guide || sim.assist) && !sim.done && agl < 0.06 && phaseRef.current !== "ready") {
          const g = Math.max(0.3, flight.setup.world.g2);
          if (Math.abs(s.vx) <= 3) {
            text = Math.abs(s.tilt) > 3 ? "sideways ✓ · stand up (U)" : "sideways ✓";
          } else if (s.fuel > 0 && Math.abs(s.vx) <= JET_PUSH * 4) {
            // The jets kill this much drift within about four seconds, with no lean to undo afterwards.
            text = `aim 0 sideways · jets ${s.vx > 0 ? "◀ Q" : "E ▶"}`;
            tone = Math.abs(s.vx) > 6 ? "close" : "ok";
          } else {
            // The lean that kills the drift in about four seconds, gentler in the last few metres.
            const limit = agl < 0.012 ? 8 : 20;
            const want = clamp(Math.atan(-s.vx / 4 / g) / DEG, -limit, limit);
            const deg = Math.max(1, Math.round(Math.abs(want)));
            text = `aim 0 sideways · tilt ${deg}° ${want < 0 ? "left" : "right"}`;
            tone = Math.abs(s.vx) > 6 ? "close" : "ok";
          }
        }
        sideRef.current.textContent = text;
        sideRef.current.dataset.tone = tone;
      }
      writeStrip(sim);
    };

    const writeStrip = (sim: FreeSim) => {
      const el = stripRef.current;
      if (!el) return;
      const s = sim.state;
      const { xOf, yOf, from, to } = strip;
      const place = (x: number) => clamp(xOf(x), 0.8, 99.2);
      const out = (x: number) => (x < from ? -1 : x > to ? 1 : 0);
      const me = el.querySelector<HTMLElement>("[data-me]");
      if (me) me.style.left = `${place(s.x)}%`;
      const arrow = el.querySelector<HTMLElement>("[data-drift]");
      if (arrow) {
        const len = clamp(Math.abs(s.vx) / 2.5, 0, 90);
        arrow.style.width = `${len}px`;
        arrow.dataset.dir = s.vx < 0 ? "left" : "right";
        arrow.style.opacity = len < 4 || sim.done ? "0" : "1";
      }
      const off = el.querySelector<HTMLElement>("[data-off]");
      if (off) {
        const o = out(s.x);
        const km = o < 0 ? (from + to) / 2 - s.x : s.x - (from + to) / 2;
        off.textContent = o ? `${o < 0 ? "site " : "◀ site "}${fmtKm(km)}${o < 0 ? " ▶" : ""}` : "";
        off.dataset.side = o < 0 ? "left" : "right";
      }
      const hit = el.querySelector<HTMLElement>("[data-hit]");
      if (hit) {
        const imp = sim.impact;
        if (imp && !sim.done && out(imp.x) === 0) {
          hit.style.left = `${xOf(imp.x)}%`;
          hit.style.top = `${yOf(heightAt(flight.site, imp.x, imp.t))}%`;
          hit.style.opacity = "1";
        } else hit.style.opacity = "0";
      }
      const flag = el.querySelector<HTMLElement>("[data-target]");
      if (flag) {
        const g = targetAt(flight, s.t);
        const mid = (g.x0 + g.x1) / 2;
        flag.style.left = `${xOf(mid)}%`;
        flag.style.top = `${yOf(heightAt(flight.site, mid, s.t))}%`;
        flag.style.opacity = sim.done ? "0" : "1";
      }
      const stop = el.querySelector<HTMLElement>("[data-stop]");
      if (stop) {
        if (sim.driftStop !== null && !sim.done && Math.abs(s.vx) > 1) {
          stop.style.left = `${place(s.x + sim.driftStop)}%`;
          stop.style.opacity = "1";
        } else stop.style.opacity = "0";
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

  const toggleScan = useCallback(() => {
    setScan((v) => {
      updateProgress((p) => ({ ...p, scan: !v }));
      return !v;
    });
  }, []);

  // Keyboard.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key;
      keysRef.current.fine = e.shiftKey;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // While the pause menu is open only its shortcuts work: R restarts, P resumes.
      if (phaseRef.current === "paused" && !/^[rRpP]$/.test(k)) return;
      if (k === "r" || k === "R") {
        e.preventDefault();
        onRetry();
        return;
      }
      if ((k === "n" || k === "N") && result) {
        e.preventDefault();
        onNewSite();
        return;
      }
      if ((k === "h" || k === "H") && result) {
        e.preventDefault();
        shell.toHall();
        return;
      }
      if (phaseRef.current === "ended") return;
      if (k === "p" || k === "P") {
        togglePause();
        return;
      }
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (phaseRef.current === "ready") start();
        else if (k === " ") setHolding(true);
        return;
      }
      if (k === "ArrowLeft" || k === "ArrowRight") {
        e.preventDefault();
        keysRef.current[k === "ArrowLeft" ? "left" : "right"] = true;
        setTurning(k === "ArrowLeft" ? "left" : "right");
        if (phaseRef.current === "ready") start();
        return;
      }
      if (k === "u" || k === "U") {
        keysRef.current.level = true;
        setTurning("level");
        return;
      }
      if (k === "q" || k === "Q" || k === "e" || k === "E") {
        e.preventDefault();
        keysRef.current[k === "q" || k === "Q" ? "jetLeft" : "jetRight"] = true;
        setJetting(jetSide(keysRef.current));
        if (phaseRef.current === "ready") start();
        return;
      }
      if (k === "ArrowUp") {
        e.preventDefault();
        nudge(e.shiftKey ? 1 : 5);
      } else if (k === "ArrowDown") {
        e.preventDefault();
        nudge(e.shiftKey ? -1 : -5);
      } else if (k === "PageUp") nudge(20);
      else if (k === "PageDown") nudge(-20);
      else if (/^[0-9]$/.test(k)) setLever(Number(k) * 10);
      else if (k === "x" || k === "X") setLever(0);
      else if (k === "f" || k === "F") setLever(100);
      else if (k === "t" || k === "T") setAutoWarp((v) => !v);
      else if (k === "g" || k === "G") setGuide((v) => !v);
      else if (k === "a" || k === "A") setAssist((v) => !v);
      else if (k === "s" || k === "S") toggleScan();
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.fine = e.shiftKey;
      if (e.key === " ") setHolding(false);
      if (e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "ArrowRight") keysRef.current.right = false;
      if (e.key === "u" || e.key === "U") keysRef.current.level = false;
      if (["ArrowLeft", "ArrowRight", "u", "U"].includes(e.key)) setTurning(null);
      if (e.key === "q" || e.key === "Q") keysRef.current.jetLeft = false;
      if (e.key === "e" || e.key === "E") keysRef.current.jetRight = false;
      if (["q", "Q", "e", "E"].includes(e.key)) setJetting(jetSide(keysRef.current));
    };
    const blur = () => {
      Object.assign(keysRef.current, { left: false, right: false, level: false, touchLeft: false, touchRight: false, jetLeft: false, jetRight: false, touchJetLeft: false, touchJetRight: false });
      setHolding(false);
      setTurning(null);
      setJetting(null);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [shell, onRetry, onNewSite, result, start, togglePause, nudge, toggleScan]);

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

  const pressRotate = useCallback(
    (side: "left" | "right", down: boolean) => {
      const keys = keysRef.current;
      keys[side === "left" ? "touchLeft" : "touchRight"] = down;
      setTurning(!down ? null : keys.touchLeft && keys.touchRight ? "level" : side);
      if (down) start();
    },
    [start],
  );

  const pressJet = useCallback(
    (side: "left" | "right", down: boolean) => {
      const keys = keysRef.current;
      keys[side === "left" ? "touchJetLeft" : "touchJetRight"] = down;
      setJetting(jetSide(keys));
      if (down) start();
    },
    [start],
  );

  const shown = holding ? 100 : lever;
  const grade = result ? GRADES[result.grade] : null;
  const named = flight.named;
  const title = `Free Flight · ${named ? named.name : world.name}`;

  return (
    <div className={`${styles.flight} ${free.free}`} data-board data-phase={phase} data-mode="free" data-world={world.id}>
      <div ref={wrapRef} className={styles.stage} onPointerDown={() => start()}>
        <canvas ref={canvasRef} className={styles.canvas} aria-label={`Free Flight to ${siteLabel(flight)}`} role="img" />
      </div>

      <div className={styles.top}>
        <div className={styles.chip}>
          <WorldIcon world={world.id} size={18} />
          <span>
            <span className={free.chipMode}>Free Flight · </span>
            {named ? named.name : world.name}
          </span>
        </div>
        <div className={`${styles.topTools} ${free.tools}`}>
          <button type="button" className={styles.small} aria-pressed={autoWarp} onClick={() => setAutoWarp((v) => !v)} title="Time warp (T)" aria-label={`Time warp ${autoWarp ? "auto" : "off"}`}>
            <WarpIcon size={16} />
            <span className={styles.lbl}> Warp {autoWarp ? "auto" : "off"}</span>
          </button>
          <button type="button" className={styles.small} aria-pressed={scan} onClick={toggleScan} title="Scan assist (S)" aria-label={`Scan assist ${scan ? "on" : "off"}`}>
            <ScanIcon size={16} />
            <span className={styles.lbl}> Scan {scan ? "on" : "off"}</span>
          </button>
          <button type="button" className={styles.small} aria-pressed={assist} onClick={() => setAssist((v) => !v)} title="Landing assist (A)" aria-label={`Landing assist ${assist ? "on" : "off"}`}>
            <AssistIcon size={16} />
            <span className={styles.lbl}> Assist {assist ? "on" : "off"}</span>
          </button>
          <button type="button" className={styles.small} aria-pressed={guide} onClick={() => setGuide((v) => !v)} title="Burn guide (G)" aria-label={`Burn guide ${guide ? "on" : "off"}`}>
            <GuideIcon size={16} />
            <span className={styles.lbl}> Guide {guide ? "on" : "off"}</span>
          </button>
        </div>
      </div>

      {!result && (
        <figure ref={stripRef} className={free.strip} aria-label="The whole site: your position, your drift and where you would come down">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d={strip.d} className={free.stripGround} />
          </svg>
          <span data-stop className={free.stripStop} style={{ opacity: 0 }} />
          <span data-target className={free.stripTarget} />
          <span data-hit className={free.stripHit} style={{ opacity: 0 }} />
          <span data-me className={free.stripMe}>
            <span data-drift className={free.stripDrift} />
          </span>
          <span data-off className={free.stripOff} />
        </figure>
      )}

      <dl className={`${styles.hud} ${free.hud}`} aria-label="Instruments">
        <div>
          <dt>Altitude</dt>
          <dd ref={altRef} />
        </div>
        <div ref={speedRowRef} className={styles.speedRow}>
          <dt>Speed</dt>
          <dd>
            <span ref={speedRef} />
            <span ref={trendRef} className={styles.trend} />
          </dd>
        </div>
        <div className={free.driftRow}>
          <dt>Drift</dt>
          <dd>
            <span ref={driftRef} className={free.drift} />
            <span ref={driftSubRef} className={styles.trend} data-trend="slower" />
          </dd>
        </div>
        <div>
          <dt>Tilt</dt>
          <dd ref={tiltRef} />
        </div>
        <div>
          <dt>Fuel</dt>
          <dd>
            <span ref={fuelRef} />
            <span className={styles.fuelTrack} aria-hidden>
              <span ref={fuelBarRef} className={styles.fuelBar} />
            </span>
            <span ref={refillRef} className={styles.trend} />
          </dd>
        </div>
        <div className={styles.timeRow}>
          <dt>Clock</dt>
          <dd>
            <span ref={timeRef} /> <b ref={warpRef} className={styles.warp} />
          </dd>
        </div>
        <p ref={guideRef} className={styles.guide} aria-live="polite" />
        <p ref={sideRef} className={`${styles.guide} ${free.side}`} aria-live="polite" />
      </dl>

      <div className={free.rotate} hidden={phase === "ended"}>
        <button type="button" className={free.jet} aria-label="Side jets, push left (hold, Q)" title="Side jets, push left (Q)" data-on={jetting === "left" || undefined} onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pressJet("left", true);
          }}
          onPointerUp={() => pressJet("left", false)}
          onPointerCancel={() => pressJet("left", false)}>
          <JetIcon size={20} dir="left" />
          <kbd>Q</kbd>
        </button>
        <button type="button" className={free.jet} aria-label="Side jets, push right (hold, E)" title="Side jets, push right (E)" data-on={jetting === "right" || undefined} onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pressJet("right", true);
          }}
          onPointerUp={() => pressJet("right", false)}
          onPointerCancel={() => pressJet("right", false)}>
          <kbd>E</kbd>
          <JetIcon size={20} dir="right" />
        </button>
        <button type="button" className={free.turn} aria-label="Rotate left (hold)" data-on={turning === "left" || turning === "level" || undefined} onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pressRotate("left", true);
          }}
          onPointerUp={() => pressRotate("left", false)}
          onPointerCancel={() => pressRotate("left", false)}>
          ⟲
        </button>
        <button type="button" className={free.turn} aria-label="Rotate right (hold)" data-on={turning === "right" || turning === "level" || undefined} onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pressRotate("right", true);
          }}
          onPointerUp={() => pressRotate("right", false)}
          onPointerCancel={() => pressRotate("right", false)}>
          ⟳
        </button>
        <span className={free.turnHint}>both = level</span>
      </div>

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

      {banner && (
        <p key={banner.key} className={`${styles.banner} ${free.banner}`} data-tone={banner.tone} aria-live="assertive">
          {banner.text}
        </p>
      )}

      {phase === "ready" && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <p className={styles.kicker}>
              <WorldIcon world={world.id} size={16} /> {siteLabel(flight)} · {spec.start === "full" ? "full descent" : "final approach"}
              {flight.unlimited ? " · unlimited fuel" : flight.difficulty !== "standard" && ` · ${difficultyLabel(flight.difficulty)}`}
            </p>
            <h2 className={styles.cardTitle}>Free Flight</h2>
            <p className={styles.cardText}>
              {named?.blurb ?? "Tilt, drift, and find flat ground."} Your target is marked <b className={free.gold}>LAND HERE</b>: a {targetWords(flight)}. Kill
              your drift on the way down and come down upright on it. Any other flat ground will save you, but only the target earns all three stars.
            </p>
            <ul className={styles.keys}>
              <li>
                <kbd>←</kbd> <kbd>→</kbd> rotate (<kbd>Shift</kbd> for fine) · <kbd>U</kbd> level up
              </li>
              <li>
                hold <kbd>Q</kbd> <kbd>E</kbd> side jets: push left or right at once, no lean needed
              </li>
              <li>
                hold <kbd>Space</kbd> or BURN: full power · <kbd>↑</kbd> <kbd>↓</kbd> <kbd>0</kbd>–<kbd>9</kbd> throttle
              </li>
              <li>
                <kbd>S</kbd> scan assist · <kbd>A</kbd> landing assist · <kbd>G</kbd> guide · <kbd>P</kbd> pause
              </li>
              <li>Stand on ground under 8°, leaning no more than 10° off it, sliding under 6 km/h.</li>
            </ul>
            <button type="button" className={styles.go} onClick={start}>
              Start <kbd>Space</kbd>
            </button>
          </div>
        </div>
      )}

      {result && grade && (
        <section className={styles.result} data-grade={result.grade} aria-live="polite">
          <p className={styles.kicker}>
            {title}
            {!named && ` · site ${flight.seed}`}
          </p>
          <h2 className={styles.gradeTitle}>
            <GradeIcon grade={result.grade} size={32} className={styles.gradeIcon} /> {grade.title}
          </h2>
          <p className={styles.gradeLine}>{result.detail || grade.line(world.name)}</p>
          {result.verdict?.stands && (
            <p className={free.target} data-hit={result.onTarget || undefined}>
              {result.onTarget ? (
                <>
                  <TargetIcon size={16} /> On target
                </>
              ) : (
                <>
                  <DivertIcon size={16} /> Diverted: {fmtKm(result.missBy)} from the target. Safe, but only one star.
                </>
              )}
            </p>
          )}
          {result.verdict && !result.verdict.stands && result.verdict.reasons.length > 0 && result.grade === "tipped" && <p className={free.reasons}>{result.verdict.reasons.join(" · ")}</p>}
          <dl className={styles.stats}>
            <div>
              <dt>Impact</dt>
              <dd>{result.verdict ? fmtSpeed(result.verdict.speed) : "—"}</dd>
            </div>
            <div>
              <dt>Sideways</dt>
              <dd>{result.verdict ? fmtSpeed(result.verdict.drift) : "—"}</dd>
            </div>
            <div>
              <dt>{result.unlimited ? "Refills" : "Fuel left"}</dt>
              <dd>{result.unlimited ? result.refills : `${Math.round(result.fuelPct * 100)}%`}</dd>
            </div>
          </dl>
          {result.unlimited && (
            <p className={free.tanks} data-best={result.newBest || undefined}>
              <FuelMark difficulty="unlimited" size={16} /> {tanksLine(result, `on ${world.id === "moon" ? "the Moon" : world.name}, ${flight.start === "full" ? "full descent" : "final approach"}`)}
            </p>
          )}
          {(named || result.stars > 0) && (
            <p className={styles.stars}>
              <Stars value={result.stars} size={22} />{" "}
              {result.narrow && <span className={free.bonus}>narrow ledge</span>} {result.centre && <span className={free.bonus}>dead centre</span>}
            </p>
          )}
          <Recorder2D you={result.you} ideal={result.ideal} scanned={result.scanned} />
          <p className={styles.insight}>{result.insight}</p>
          <div className={styles.actions}>
            {!named && (
              <button type="button" className={styles.secondary} onClick={onNewSite}>
                New site <kbd>N</kbd>
              </button>
            )}
            <ShareButton text={result.share} className={styles.secondary} />
          </div>
          <div className={styles.actions} data-standard>
            <button type="button" className={styles.go} onClick={onRetry}>
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

function insightFor(sim: FreeSim, flight: Flight2D, grade: GradeId, v: Verdict | null) {
  if (grade === "lost") return "You were climbing when it mattered. Let gravity pull you down and brake on the way in.";
  if (v?.stands && flight.unlimited) {
    const used = sim.tanksUsed;
    const perfect = 1 - sim.ideal.fuelLeft / flight.setup.fuel;
    if (sim.refills === 0 && used <= 1 - 0.9 * (1 - perfect)) return `Textbook, and no refill. You used ${Math.round(used * 100)}% of the tank; the autopilot, knowing every rock, used ${Math.round(perfect * 100)}%.`;
    if (sim.refills === 0) return `Down and standing without a refill. The autopilot, knowing every rock, would have used ${Math.round(perfect * 100)}% of the tank to your ${Math.round(used * 100)}%: kill the drift during the main burn, not after it.`;
    return `Down and standing on ${fmtTanks(used)}. The autopilot, knowing every rock, needs ${Math.round(perfect * 100)}% of one: brake later, kill the drift during the main burn, and the refills will go.`;
  }
  if (v?.stands) {
    const left = sim.state.fuel / flight.setup.fuel;
    const perfect = sim.ideal.fuelLeft / flight.setup.fuel;
    if (left >= perfect * 0.9) return `Textbook. You kept ${Math.round(left * 100)}% of the tank; the autopilot, knowing every rock, kept ${Math.round(perfect * 100)}%.`;
    return `Down and standing. The autopilot, knowing every rock, would have kept ${Math.round(perfect * 100)}% of the tank to your ${Math.round(left * 100)}%: kill the drift during the main burn, not after it.`;
  }
  if (grade === "tipped") {
    if (!v) return "";
    if (Math.max(...v.feet) > 8) return "Soft enough, but the ground was too steep. Look for ground that stays level for at least 8 m: the lander's feet are that far apart.";
    if (v.tiltOff > 10) return "Soft enough, but you were leaning. Level up with U in the last few metres.";
    return "Soft enough, but still sliding sideways. Kill the drift before the feet touch: hold the side jets against it (Q or E), or tilt against it and stand up.";
  }
  if (grade === "splash") return "That was the sea. The barges are the only flat ground out there: steer onto one before you come down.";
  if (!flight.unlimited && sim.state.fuel <= 1) return "You ran dry. Kill the drift during the main burn, when the engine is running anyway: it costs far less than fixing it later.";
  return "Too fast at the end. Brake harder in the last few hundred metres, and keep the speed under 20 km/h.";
}

/** Climbing: when the rise tops out, if gravity is winning; or still climbing under power. */
function risingInfo(sim: FreeSim) {
  const s = sim.state;
  if (sim.done || s.speed > -1) return null;
  const a = acceleration2d(sim.setup, s, sim.throttle).a;
  if (a <= 0.05) return { powered: true as const };
  return { peakIn: -s.speed / a, peakAlt: sim.above + (s.speed * s.speed) / (2 * a) / SECONDS_PER_HOUR_1979 };
}

