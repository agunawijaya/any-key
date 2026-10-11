"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { Results } from "@/components/kit/Results";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { actDuel, commander, createDuel, duelSeen, DUEL_ROUNDS, enemyOf, HITS_TO_SILENCE, type DuelEngagement, type DuelOrder, type DuelPlayer, type DuelShot, type DuelSide } from "@/lib/over-short/duel";
import { FIELD_GUN, firingTable, type Aim } from "@/lib/over-short/fieldModel";
import { overShortManifest } from "@/lib/over-short/manifest";
import { afterDuel, updateProgress, type Settings } from "@/lib/over-short/progress";
import { correctionWords, distanceLabel, windWords } from "@/lib/over-short/words";
import type { Era } from "../eras/types";
import { useDarkAppearance } from "../hooks";
import { MoveIcon, TelephoneIcon, WindIcon } from "../icons";
import { AimPanel } from "../field/AimPanel";
import { reportedBurst } from "../field/FieldMap";
import { FieldTable } from "../field/FieldTable";
import { paintRatio } from "../scene/detail";
import { battleSound } from "../sound";
import ui from "../ui.module.css";
import play from "../play/FiringScreen.module.css";
import hud from "../play/Hud.module.css";
import { DuelDirector, type DuelCue } from "./duelDirector";
import styles from "./Duel.module.css";

/*
 * The duel's screen. Each turn every human battery lays its gun in turn
 * (on one screen the other player looks away: a handover card hides one
 * battery's orders from the other), the computer's commander decides for
 * its own, then both guns fire together and the director plays it out.
 * Both observers report; the first battery to take two hits is silenced.
 */

type Props = { west: DuelPlayer; east: DuelPlayer; seed: string; era: Era; settings: Settings; onAgain: () => void; onMenu: () => void };

type Phase = { kind: "laying"; side: DuelSide } | { kind: "handover"; side: DuelSide } | { kind: "playing" } | { kind: "over" };

const NAMES: Record<DuelSide, string> = { west: "West battery", east: "East battery" };
const startAim: Aim = { charge: 3, elevation: 25, line: 0 };

export function DuelScreen({ west, east, seed, era, settings, onAgain, onMenu }: Props) {
  const shell = useShell();
  const calm = useReducedMotion();
  const dark = useDarkAppearance();
  const [engagement, setEngagement] = useState<DuelEngagement>(() => createDuel(seed, settings.difficulty, west, east));
  const humans = useMemo(() => (["west", "east"] as const).filter((side) => engagement[side].player === "player"), [engagement]);
  const hotSeat = humans.length === 2;
  const [phase, setPhase] = useState<Phase>({ kind: "laying", side: humans[0] ?? "west" });
  const [aims, setAims] = useState<Record<DuelSide, Aim>>({ west: startAim, east: startAim });
  const [orders, setOrders] = useState<Partial<Record<DuelSide, DuelOrder>>>({});
  const [reports, setReports] = useState<DuelShot[]>([]);
  const [drawer, setDrawer] = useState<"table" | "map" | null>(null);
  const [paused, setPaused] = useState(false);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const director = useRef<DuelDirector | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sound = useMemo(() => battleSound(), []);
  const lastFired = useRef<Record<DuelSide, number>>({ west: 25, east: 25 });

  useEffect(() => {
    // The screen opens on a key press, so the browser lets the audio start now rather than on the first round.
    sound.wake();
    return () => sound.stop();
  }, [sound]);

  const cue = useCallback(
    (name: DuelCue, detail?: { time?: number }) => {
      if (name === "fire") sound.fire();
      else if (name === "whistle") sound.whistle(detail?.time ?? 3);
      else if (name === "impact") sound.impact(1);
      else if (name === "hit") sound.impact(1.5);
      else if (name === "destroyed") sound.destroyed(false);
      else if (name === "relocate") sound.limber();
    },
    [sound],
  );

  /* ---------- The director ---------- */

  const first = useRef({ engagement, era, calm, cue });
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const d = new DuelDirector(element, first.current.engagement, { era: first.current.era, calm: first.current.calm, sound: first.current.cue });
    director.current = d;
    d.setTheme(document.documentElement.dataset.theme === "dark");
    const measure = () => {
      const box = element.getBoundingClientRect();
      d.resize(Math.max(1, box.width), Math.max(1, box.height), paintRatio());
    };
    measure();
    const sizing = new ResizeObserver(measure);
    sizing.observe(element);
    let raf = 0;
    const loop = (now: number) => {
      d.frame(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      director.current = null;
    };
  }, []);

  useEffect(() => director.current?.setTheme(dark), [dark]);
  useEffect(() => director.current?.setOptions({ era, calm, sound: cue }), [era, calm, cue]);
  useEffect(() => {
    if (director.current) director.current.paused = paused || shell.tab !== "play";
  }, [paused, shell.tab]);

  // The barrels: the battery laying shows its aim; the other shows where it was laid last, so nothing sealed is given away.
  useEffect(() => {
    const d = director.current;
    if (!d) return;
    const laying = phase.kind === "laying" ? phase.side : null;
    d.aims = { west: laying === "west" ? aims.west.elevation : lastFired.current.west, east: laying === "east" ? aims.east.elevation : lastFired.current.east };
  }, [phase, aims]);

  /* ---------- Orders ---------- */

  const resolve = useCallback(
    (all: Record<DuelSide, DuelOrder>) => {
      const outcome = actDuel(engagement, all);
      setPhase({ kind: "playing" });
      setReports([]);
      setOrders({});
      const done = () => {
        setEngagement(outcome.engagement);
        if (outcome.engagement.winner) {
          setUnlocked(updateProgress((p) => afterDuel(p, outcome.engagement)));
          setPhase({ kind: "over" });
        } else setPhase(hotSeat ? { kind: "handover", side: humans[0] } : { kind: "laying", side: humans[0] });
      };
      for (const side of ["west", "east"] as const) if (all[side].kind === "fire") lastFired.current[side] = (all[side] as { aim: Aim }).aim.elevation;
      const d = director.current;
      if (!d) return done();
      d.play(outcome.events, outcome.engagement, { onReports: setReports, onDone: done });
    },
    [engagement, hotSeat, humans],
  );

  const give = useCallback(
    (side: DuelSide, order: DuelOrder) => {
      const next = { ...orders, [side]: order };
      const waiting = humans.filter((s) => !next[s]);
      if (waiting.length) {
        setOrders(next);
        setPhase({ kind: "handover", side: waiting[0] });
        return;
      }
      // Every human has given orders: the computer decides for its own battery, from what its observer has seen.
      const all = { ...next } as Record<DuelSide, DuelOrder>;
      for (const s of ["west", "east"] as const) {
        const player = engagement[s].player;
        if (player !== "player") all[s] = commander(player)(duelSeen(engagement, s));
      }
      resolve(all);
    },
    [orders, humans, engagement, resolve],
  );

  const laying = phase.kind === "laying" ? phase.side : null;
  const fire = useCallback(
    (elevation?: number) => {
      if (!laying) return;
      give(laying, { kind: "fire", aim: { ...aims[laying], elevation: elevation ?? aims[laying].elevation } });
    },
    [laying, aims, give],
  );
  const relocate = useCallback(() => laying && engagement[laying].relocationsLeft > 0 && give(laying, { kind: "relocate" }), [laying, engagement, give]);
  const setAim = useCallback((aim: Aim) => laying && setAims((a) => ({ ...a, [laying]: aim })), [laying]);
  const precision = settings.precision;

  /* ---------- Keys ---------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paused || shell.tab !== "play" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const inField = target === input.current;
      const onControl = target?.tagName === "BUTTON" || (target?.tagName === "INPUT" && !inField);
      const key = event.key;
      if (phase.kind === "playing" && (key === " " || key === "Enter")) {
        event.preventDefault();
        director.current?.skip();
        return;
      }
      if (phase.kind === "handover" && key === "Enter" && !onControl) {
        event.preventDefault();
        setPhase({ kind: "laying", side: phase.side });
        return;
      }
      if (!laying) return;
      const aim = aims[laying];
      const update = (next: Partial<Aim>) => setAims((a) => ({ ...a, [laying]: { ...aim, ...next } }));
      if (key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        update({ elevation: Math.min(70, Math.max(0, Math.round((aim.elevation + (key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? precision : 1)) / precision) * precision)) });
      } else if ((key === "ArrowLeft" || key === "ArrowRight") && !inField) {
        event.preventDefault();
        update({ line: Math.max(-300, Math.min(300, aim.line + (key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 10 : 1))) });
      } else if ((key === " " || key === "Enter") && !onControl && !inField) {
        event.preventDefault();
        fire();
      } else if (inField) return;
      else if (key === "c" || key === "C") {
        event.preventDefault();
        update({ charge: ((aim.charge - 1 + (event.shiftKey ? 3 : 1)) % 4) + 1 });
      } else if (key === "t" || key === "T" || key === "m" || key === "M") {
        event.preventDefault();
        const which = key.toLowerCase() === "t" ? "table" : "map";
        setDrawer((open) => (open === which ? null : which));
      } else if (key === "r" || key === "R") {
        event.preventDefault();
        relocate();
      } else if (/^[0-9.,]$/.test(key)) {
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, shell.tab, phase, laying, aims, precision, fire, relocate]);

  usePlayScreen({
    screen: phase.kind === "over" ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [{ label: "A new duel", onSelect: onAgain }],
    losesProgress: phase.kind !== "over" && engagement.turn > 0,
    roundName: "this duel",
    onMenu,
  });

  /* ---------- What each battery sees ---------- */

  const seen = laying ? duelSeen(engagement, laying) : null;
  const reaches = useMemo(() => FIELD_GUN.charges.map((_, i) => Math.max(...firingTable(FIELD_GUN, i + 1).map((r) => r.range))), []);
  const units = settings.units;

  return (
    <div className={play.screen}>
      <canvas ref={canvas} className={styles.canvas} aria-label="The ridge side on: the west battery on the left, the east battery on the right, the crest between" />

      <div className={play.hud} data-busy={phase.kind === "playing"}>
        <p className={styles.banner}>
          Turn {engagement.turn + 1} · West {engagement.east.hitsTaken} {engagement.east.hitsTaken === 1 ? "hit" : "hits"}, East {engagement.west.hitsTaken} · two to silence
        </p>

        {laying && seen && (
          <>
            <section className={`${ui.panel} ${hud.target}`} aria-label="The enemy battery">
              <p className={ui.kicker}>
                {NAMES[laying]} · {hotSeat ? `player ${laying === "west" ? 1 : 2}` : "you"}
              </p>
              <p className={hud.distance}>{distanceLabel(seen.target.distance, units)}</p>
              <p className={hud.line}>
                to the {NAMES[enemyOf(laying)].toLowerCase()} by the map{seen.target.height !== 0 && ` · ${distanceLabel(Math.abs(seen.target.height), units)} ${seen.target.height > 0 ? "above" : "below"} you`}
              </p>
              {seen.crest && (
                <p className={hud.line}>
                  The ridge: {distanceLabel(Math.round(seen.crest.height / 5) * 5, units)} up, {distanceLabel(Math.round(seen.crest.at / 10) * 10, units)} out
                </p>
              )}
              <p className={hud.line}>
                <WindIcon size={14} /> Forecast: {windWords({ along: seen.wind.along * (laying === "west" ? 1 : -1), across: seen.wind.across * (laying === "west" ? 1 : -1) })}
              </p>
            </section>

            <section className={`${ui.panel} ${hud.status}`} aria-label="Rounds and the enemy">
              <span className={hud.label}>
                Rounds · {engagement[laying].rounds} of {DUEL_ROUNDS} left · hits taken {engagement[laying].hitsTaken} of {HITS_TO_SILENCE}
              </span>
              {seen.enemy?.lastMiss !== null && seen.enemy?.lastMiss !== undefined && (
                <p className={hud.chip} data-urgent={seen.enemy.lastMiss < 200}>
                  Their last round: {distanceLabel(seen.enemy.lastMiss, units)} from you
                </p>
              )}
              <button type="button" className={ui.secondary} disabled={engagement[laying].relocationsLeft <= 0} onClick={relocate}>
                <MoveIcon size={16} /> Move the gun back instead · {engagement[laying].relocationsLeft} left <span className={ui.key}>R</span>
              </button>
            </section>

            <div className={play.drawer} data-open={drawer !== null}>
              <div className={play.tabs} role="tablist" aria-label="Firing table and map">
                <button type="button" role="tab" aria-selected={drawer === "map"} className={play.tab} onClick={() => setDrawer((d) => (d === "map" ? null : "map"))}>
                  Map <span className={ui.key}>M</span>
                </button>
                <button type="button" role="tab" aria-selected={drawer === "table"} className={play.tab} onClick={() => setDrawer((d) => (d === "table" ? null : "table"))}>
                  Table <span className={ui.key}>T</span>
                </button>
              </div>
              {drawer && (
                <div className={play.sheet} role="tabpanel">
                  {drawer === "table" ? (
                    <FieldTable gun={FIELD_GUN} charge={aims[laying].charge} elevation={aims[laying].elevation} units={units} />
                  ) : (
                    <ul className={styles.log}>
                      {engagement[laying].shots.length === 0 && <li>No rounds at their present position yet.</li>}
                      {engagement[laying].shots.map((s, i) => {
                        const at = reportedBurst(s.report);
                        return (
                          <li key={i}>
                            Round {i + 1}: charge {s.aim.charge}, {s.aim.elevation.toFixed(1)}°, line {s.aim.line} · {at ? correctionWords(s.report, units) : "not seen"}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className={`${ui.panel} ${play.aim}`}>
              <AimPanel
                aim={aims[laying]}
                reaches={reaches}
                limits={seen.limits}
                precision={precision}
                distance={seen.target.distance}
                units={units}
                disabled={false}
                onChange={setAim}
                onFire={fire}
                inputRef={input}
              />
              {hotSeat && <p className={play.skipHint}>Fire seals your orders: both guns fire together once the other battery has given theirs.</p>}
            </div>
          </>
        )}

        {reports.length > 0 && (
          <div className={styles.reports}>
            {[...reports].sort((a, b) => (a.side === "west" ? -1 : 1) - (b.side === "west" ? -1 : 1)).map((shot) => (
              <div key={shot.side} className={`${ui.slip} ${styles.slip}`} role="status" data-side={shot.side}>
                <p className={ui.kicker}>
                  <TelephoneIcon /> {NAMES[shot.side]}&rsquo;s observer
                </p>
                <p className={play.message}>{correctionWords(shot.report, units)}</p>
                {shot.decisive && <p className={ui.stamp}>Silenced</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {phase.kind === "handover" && (
        <div className={styles.handover} role="dialog" aria-modal="true" aria-labelledby="os-handover">
          <div className={`${ui.panel} ${styles.handoverCard}`}>
            <p className={ui.kicker}>Hand over</p>
            <h2 id="os-handover" className={ui.heading}>
              {NAMES[phase.side]}, your orders
            </h2>
            <p className={ui.lede}>{hotSeat ? `${NAMES[enemyOf(phase.side)]}: look away. Your orders are sealed.` : "Lay the gun for the next round."}</p>
            <button type="button" className={ui.primary} onClick={() => setPhase({ kind: "laying", side: phase.side })} data-autofocus>
              <span className={ui.label}>
                I am the {NAMES[phase.side].toLowerCase()}
                <small>Enter</small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {phase.kind === "over" && (
        <Results
          title={
            engagement.winner === "draw"
              ? "Both batteries silenced"
              : hotSeat
                ? `The ${NAMES[engagement.winner ?? "west"].toLowerCase()} wins`
                : engagement.winner === humans[0]
                  ? "You silenced their battery"
                  : "Your battery was silenced"
          }
          tone={engagement.winner === "draw" ? "neutral" : hotSeat || engagement.winner === humans[0] ? "win" : "loss"}
          kicker={`Counter-Battery Duel · ${hotSeat ? "two players" : `against the ${engagement[enemyOf(humans[0] ?? "west")].player} commander`}`}
          playAgainLabel="A new duel"
          onPlayAgain={onAgain}
          onMenu={onMenu}
          unlocked={{ gameId: overShortManifest.id, ids: unlocked }}
        >
          <p className={play.verdict}>
            {engagement.turn} {engagement.turn === 1 ? "turn" : "turns"}. West fired {DUEL_ROUNDS - engagement.west.rounds} rounds and took {engagement.west.hitsTaken} {engagement.west.hitsTaken === 1 ? "hit" : "hits"}; East fired{" "}
            {DUEL_ROUNDS - engagement.east.rounds} and took {engagement.east.hitsTaken}.
          </p>
        </Results>
      )}
    </div>
  );
}
