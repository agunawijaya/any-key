"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { Results } from "@/components/kit/Results";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { isFreeKey } from "@/lib/kit/keys";
import type { Corrida, PassResult, Verdict } from "@/lib/sol-y-sombra/corrida";
import { useProgress } from "@/lib/sol-y-sombra/progress";
import { MOVE_LIST, type MoveId } from "@/lib/sol-y-sombra/rules";
import { TIERS } from "@/lib/sol-y-sombra/verdict";
import type { StageHandle } from "../scene/useCorridaStage";
import { sound } from "../sound";
import { Afternoon } from "./afternoon";
import { ConfirmTruth, DownTray, FinishTray, MoveTray } from "./Choices";
import { BullCard, MeterCard, PassToast, SkipHint } from "./Hud";
import { VerdictDial } from "./Verdict";
import styles from "./play.module.css";

/*
 * The afternoon on screen: the HUD's cards over the poster, the keys, and
 * the shell's pause and results. The sequence itself (what the engine
 * decides and what the stage plays) is in ./afternoon.ts.
 */

type Props = { seed: string; handle: StageHandle; density: number; onMenu: () => void; onAgain: () => void };

export function CorridaScreen({ seed, handle, density, onMenu, onAgain }: Props) {
  const shell = useShell();
  const settings = useProgress().settings;
  const reduced = useReducedMotion();
  const [, setVersion] = useState(0);
  const [afternoon] = useState(() => new Afternoon(seed, handle, { playStyle: settings.playStyle, reduced }, () => setVersion((v) => v + 1)));
  const [paused, setPaused] = useState(false);
  const { view, toast, corrida, unlocked, bullNumber } = afternoon;

  /* ---------- The stage and the sound follow the settings ---------- */

  useEffect(() => {
    handle.freeze(paused || shell.tab !== "play");
  }, [handle, paused, shell.tab]);

  useEffect(() => {
    afternoon.configure({ playStyle: settings.playStyle, reduced });
    handle.stage?.configure({ slowMotion: settings.slowMotion && !reduced, stillCrowd: reduced });
  }, [afternoon, handle, reduced, settings.playStyle, settings.slowMotion]);

  // The ring's own sounds: hooves, the bull's breath, the stands' olé, the cape.
  useEffect(() => {
    const stage = handle.stage;
    sound.setEnabled(settings.sound);
    stage?.listenWith((event) => {
      if (event.kind === "hoof") sound.hoof(event.level);
      else if (event.kind === "snort") sound.snort();
      else if (event.kind === "ole") sound.ole(event.level);
      else if (event.kind === "swish") sound.swish(event.speed);
      else sound.thud();
    });
    sound.murmur(0.3);
    return () => {
      stage?.listenWith(null);
      sound.stop();
    };
  }, [handle, settings.sound]);

  // The afternoon starts once, when the screen opens, and stops when it closes.
  useEffect(() => {
    void afternoon.start(seed, density);
    return () => afternoon.stop();
    // The stands' fullness is read once: changing it mid-afternoon would empty the seats under people.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afternoon, seed]);

  /* ---------- Keys ---------- */

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (paused || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const digit = Number(event.key);
    if (event.key === " " && ["intro", "passing", "finishing", "after"].includes(view.kind)) {
      event.preventDefault();
      afternoon.skip();
      return;
    }
    if (view.kind === "choose") {
      if (digit >= 1 && digit <= 3) {
        event.preventDefault();
        void afternoon.pass(MOVE_LIST[digit - 1]);
      } else if (isFreeKey(event, "k")) {
        event.preventDefault();
        afternoon.askTruth();
      }
    } else if (view.kind === "truth" && (digit === 1 || digit === 2)) {
      event.preventDefault();
      void afternoon.finish(digit === 1 ? "over-the-horns" : "waiting");
    } else if (view.kind === "down" && !view.serious && (digit === 1 || digit === 2)) {
      event.preventDefault();
      void (digit === 1 ? afternoon.carryOn() : afternoon.retire());
    } else if (view.kind === "confirm" && (isFreeKey(event, "k") || event.key === "Enter")) {
      event.preventDefault();
      afternoon.goToTruth();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  /* ---------- The shell ---------- */

  const over = view.kind === "results";
  usePlayScreen({
    screen: over ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [{ label: "Start a new afternoon", onSelect: onAgain }],
    losesProgress: !over && corrida.history.length > 0,
    roundName: "this afternoon",
    onMenu,
  });

  /* ---------- What is on screen ---------- */

  const showBull = view.kind !== "intro" || view.step !== "paseo";
  const showCrew = view.kind !== "intro" || view.step === "crew";
  const cinematic = view.kind === "intro" || view.kind === "passing" || view.kind === "finishing" || view.kind === "after";

  return (
    <div className={styles.hud} data-afternoon={view.kind}>
      <div className={styles.left}>{showBull && <BullCard corrida={corrida} number={bullNumber} crews={showCrew} />}</div>
      {view.kind !== "intro" && view.kind !== "results" && view.kind !== "verdict" && view.kind !== "after" && (
        <div className={styles.right}>
          <MeterCard corrida={corrida} />
        </div>
      )}
      <div className={styles.toastSlot} aria-live="polite">
        {toast && view.kind !== "results" && view.kind !== "verdict" && <PassToast toast={toast} />}
      </div>
      <div className={styles.bottom}>
        {view.kind === "choose" && <MoveTray corrida={corrida} onMove={(m) => void afternoon.pass(m)} onTruth={() => afternoon.askTruth()} />}
        {view.kind === "truth" && <FinishTray corrida={corrida} onFinish={(f) => void afternoon.finish(f)} />}
        {view.kind === "down" && (
          <DownTray serious={view.serious} corrida={corrida} onCarryOn={() => void afternoon.carryOn()} onRetire={() => void afternoon.retire()} />
        )}
        {cinematic && <SkipHint onSkip={() => afternoon.skip()} />}
      </div>
      {view.kind === "confirm" && <ConfirmTruth corrida={corrida} onConfirm={() => afternoon.goToTruth()} onCancel={() => afternoon.keepWorking()} />}
      {view.kind === "verdict" && <VerdictDial verdict={view.verdict} cap={corrida.cap} reduced={reduced} onLanded={() => void afternoon.crowdHasSpoken()} />}
      {view.kind === "results" && (
        <Results
          title={TIERS[view.verdict.tier].name}
          tone={view.verdict.tier >= 2 ? "win" : view.verdict.tier === 1 ? "neutral" : "loss"}
          kicker={`Classic · Corrida · bull No. ${bullNumber} · ${endingLine(corrida)}`}
          playAgainLabel="Another afternoon"
          onPlayAgain={onAgain}
          onMenu={onMenu}
          unlocked={unlocked.length ? { gameId: "sol-y-sombra", ids: unlocked } : undefined}
        >
          <ResultLines corrida={corrida} verdict={view.verdict} />
        </Results>
      )}
    </div>
  );
}

/* ---------- Words ---------- */

function endingLine(c: Corrida) {
  switch (c.ending) {
    case "rested":
      return `the bull rested after ${c.passes} ${c.passes === 1 ? "pass" : "passes"}`;
    case "retired":
      return "retired after a goring";
    case "infirmary":
      return "helped to the infirmary, and fine";
    case "returned":
      return "the bull went back to the pens";
    default:
      return "";
  }
}

function ResultLines({ corrida, verdict }: { corrida: Corrida; verdict: Verdict }) {
  const passes = corrida.history.filter((h): h is PassResult => h.kind === "pass");
  const count = (m: MoveId) => passes.filter((p) => p.move === m).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const odds = verdict.odds.map((o) => `${Math.round(o * 100)}%`);
  return (
    <div className={styles.results}>
      <p>
        {plural(passes.length, "pass", "passes")}: {plural(count("veronica"), "veronica", "veronicas")}, {count("outside")} outside,{" "}
        {plural(count("swirl"), "swirl", "swirls")} · close calls {passes.filter((p) => p.outcome === "close").length} · gorings {corrida.gorings}
      </p>
      <p>
        The crowd&apos;s mood stood at <strong>{verdict.total.toFixed(1)}</strong>; the needle landed at <strong>{verdict.needle.toFixed(1)}</strong>.
      </p>
      <p className={styles.resultOdds}>
        Before the roll: silence {odds[0]} · applause {odds[1]} · lap {odds[2]} · shoulders {odds[3]}
      </p>
    </div>
  );
}
