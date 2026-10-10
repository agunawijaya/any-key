"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { Results, type ResultsExtra } from "@/components/kit/Results";
import { usePlayScreen } from "@/components/kit/shell-context";
import { createRng } from "@/lib/kit/rng";
import { shareText } from "@/lib/kit/share";
import type { GameSummary } from "@/lib/ten-turns/awards";
import { rabbitAfterDrop } from "@/lib/ten-turns/classic";
import { classicSurvival } from "@/lib/ten-turns/classicTable";
import { type Cell, DIRECTIONS, type Direction, inCircle, kingDistance, same, step } from "@/lib/ten-turns/geometry";
import type { Settings } from "@/lib/ten-turns/progress";
import { dailyShare, type TurnMark } from "@/lib/ten-turns/share";
import {
  act,
  type Action,
  CARROT_REACH,
  canDrop,
  canStepTo,
  chainChance,
  classicPlan,
  drop,
  dropClassic,
  endTurn,
  intentOf,
  legalActions,
  medalsOf,
  type Medals,
  type PitPlan,
  rabbitsTurn,
  rustleCells,
  startPit,
  type TacticsState,
  tunnelExit,
} from "@/lib/ten-turns/tactics";
import { CarrotIcon, FootprintIcon, HatIcon, SpadeIcon, StayIcon, StepArrow, StoneIcon } from "./icons";
import { type Choreo, type Cue, dropBeats, faceRabbits, freshScene, playerBeats, rabbitBeats, releaseBeats, squishBeats } from "./play/choreography";
import { Director } from "./play/director";
import { ARROWS, directionForKey, directionFromArrows, keyRows } from "./play/keys";
import type { IntentMark, MarksView } from "./scene/view";
import { noMarks } from "./scene/view";
import type { SoundName } from "./play/choreography";
import type { PitStyle } from "./styles/style";
import type { PitCanvasApi } from "./usePitCanvas";
import styles from "./PitScreen.module.css";

export type PitGame = { kind: "classic" } | { kind: "tactics"; plan: PitPlan; last: boolean } | { kind: "daily"; plan: PitPlan; number: number; key: string };

type Props = {
  game: PitGame;
  canvas: PitCanvasApi;
  /** The canvas's size: the pads round the kid are placed again when it changes. */
  canvasSize: { width: number; height: number };
  settings: Settings;
  /** Records the finished game; returns the keycaps it earned. */
  onRecord: (summary: GameSummary) => string[];
  onSound: (name: SoundName) => void;
  onMenu: () => void;
  onAgain: () => void;
  onNext?: () => void;
};

type Phase = "drop" | "player" | "busy" | "over";
type Tool = "carrot" | "stone" | null;
type Ending = { outcome: "squish" | "crunch" | "released"; medals: Medals; turns: number; unlocked: string[]; share?: string };
type Pip = { rabbit: number; count: number; chance: number; again: boolean | null };

const TEMPO: Record<Settings["speed"], number> = { relaxed: 1.35, normal: 1, brisk: 0.62 };

/** Why a step can't be taken, in a line the kid could say. */
function refusalFor(state: TacticsState, cell: Cell): string {
  const p = state.player!;
  if (kingDistance(p, cell) !== 1) return "One step at a time: pick a cell next to you.";
  if (!inCircle(cell, state.plan.radius)) return "That's the pit wall.";
  if (state.plan.rocks.some((r) => same(r, cell))) return "A rock is in the way.";
  if (state.stones.some((r) => same(r, cell))) return "Your stone is in the way.";
  if (state.rabbits.some((r) => same(r.at, cell))) return "That's the rabbit! Anywhere else.";
  if (state.hiddenAt && state.burrows.some((b) => same(b, cell))) return "Out on the grass first: no two burrows in a row.";
  const exit = state.burrows.some((b) => same(b, cell)) ? tunnelExit(state.plan, cell) : null;
  if (exit && state.rabbits.some((r) => same(r.at, exit))) return "Something is sitting on the far end of that tunnel.";
  return "Can't go there.";
}

export function PitScreen({ game, canvas, canvasSize, settings, onRecord, onSound, onMenu, onAgain, onNext }: Props) {
  const reduced = useReducedMotion();
  const plan = useMemo(() => (game.kind === "classic" ? classicPlan() : game.plan), [game]);
  const isClassic = game.kind === "classic";
  const [rng] = useState(() => createRng(`ten-turns/${plan.id}/${Date.now().toString(36)}/${Math.random().toString(36).slice(2)}`));

  // The rules' state lives in a ref (the keys and the painter need it at once); `snapshot` is its copy for drawing the page.
  const stateRef = useRef<TacticsState | null>(null);
  const [snapshot, setSnapshot] = useState<TacticsState>(() => startPit(plan));
  const [scene] = useState(() => freshScene(startPit(plan)));
  const [director] = useState(() => new Director());
  const [phase, setPhase] = useState<Phase>("drop");
  const [paused, setPaused] = useState(false);
  const [tool, setTool] = useState<Tool>(null);
  const [cursor, setCursor] = useState<Cell>(() => ({ x: 0, y: -Math.floor(plan.radius * 0.6) }));
  const [hover, setHover] = useState<Cell | null>(null);
  const [planShown, setPlanShown] = useState(false);
  const [refusal, setRefusal] = useState<{ text: string; cell: Cell | null; at: number } | null>(null);
  const [pips, setPips] = useState<Pip[]>([]);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [shared, setShared] = useState<string | null>(null);

  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const commit = useCallback((next: TacticsState) => {
    stateRef.current = next;
    setSnapshot(next);
  }, []);
  const current = useCallback(() => stateRef.current ?? snapshotRef.current, []);

  // What the painter and the keys read, kept in a ref so they never wait for React.
  const live = useRef({ phase, paused, tool, cursor, hover, planShown, refusal, settings, reduced });
  useEffect(() => {
    live.current = { phase, paused, tool, cursor, hover, planShown, refusal, settings, reduced };
  });

  // A refused move's message fades after a moment.
  useEffect(() => {
    if (!refusal) return;
    const timer = window.setTimeout(() => setRefusal(null), 2600);
    return () => window.clearTimeout(timer);
  }, [refusal]);

  // The bookkeeping behind records, keycaps and the Daily's squares.
  const tally = useRef({ longestChain: 0, carrotsEaten: 0, tunnels: 0, stoneBonks: 0, marks: [] as TurnMark[] });

  const cue = useCallback(
    (c: Cue) => {
      if (c.kind === "sound") onSound(c.name);
      else setPips((list) => [...list.filter((p) => !(p.rabbit === c.rabbit && p.count === c.count)), { rabbit: c.rabbit, count: c.count, chance: c.chance, again: c.again }]);
    },
    [onSound],
  );
  const choreo = useMemo<Choreo>(() => ({ scene, reduced, cue }), [scene, reduced, cue]);


  /* ---------- The painter ---------- */

  useEffect(() => {
    canvas.setPainter((time, dt) => {
      const l = live.current;
      if (!l.paused) director.advance(dt / TEMPO[l.settings.speed]);
      for (const d of scene.effects.dust) d.age += dt / 0.9;
      scene.effects.dust = scene.effects.dust.filter((d) => d.age < 1);
      scene.release.time = time;
      if (scene.page === "release") return { kind: "release", moment: scene.release };
      return {
        kind: "pit",
        frame: { time, board: scene.board, kid: scene.kid, rabbits: scene.rabbits, marks: marksFor(current(), l), effects: scene.effects, zoom: scene.zoom },
      };
    });
    return () => canvas.setPainter(null);
  }, [canvas, current, director, scene]);

  /* ---------- Turns ---------- */

  const finish = useCallback(
    (outcome: Ending["outcome"]) => {
      const state = current();
      const medals = outcome === "squish" ? { survived: true, toolsToSpare: true, untouched: true } : medalsOf(state);
      const turns = outcome === "crunch" ? state.turn : plan.turns;
      const t = tally.current;
      const share =
        game.kind === "daily"
          ? dailyShare(game.number, outcome, turns, plan.turns, state.toolsUsed, state.hat, outcome === "squish" ? [] : t.marks)
          : undefined;
      const unlocked = onRecord({
        mode: game.kind,
        pitId: game.kind === "tactics" ? plan.id : undefined,
        outcome,
        rabbits: plan.rabbits.length,
        medals,
        hat: state.hat,
        longestChain: t.longestChain,
        carrotsEaten: t.carrotsEaten,
        tunnels: t.tunnels,
        stoneBonks: t.stoneBonks,
        toolsUsed: state.toolsUsed,
        turns,
        daily: game.kind === "daily" ? { key: game.key, number: game.number, share: share! } : undefined,
      });
      setEnding({ outcome, medals, turns, unlocked, share });
      setPhase("over");
    },
    [current, game, onRecord, plan],
  );

  const startTurn = useCallback(() => {
    const state = current();
    faceRabbits(scene);
    setPips([]);
    setPhase("player");
    const r = state.rabbits[0];
    const p = state.player!;
    const gap = Math.max(Math.abs(r.at.x - p.x), Math.abs(r.at.y - p.y));
    setAnnouncement(`Turn ${state.turn} of ${plan.turns}. ${state.rabbits.length > 1 ? "The nearest rabbit" : "The rabbit"} is ${gap} ${gap === 1 ? "step" : "steps"} away${state.hiddenAt ? ". You are hiding in a burrow" : ""}.`);
  }, [current, plan.turns, scene]);

  const busy = useCallback(
    (beats: Parameters<Director["add"]>) => {
      director.add(...beats);
      setPhase("busy");
    },
    [director],
  );

  const dropAt = useCallback(
    (cell: Cell) => {
      const state = current();
      if (!canDrop(state, cell)) {
        setRefusal({ text: inCircle(cell, plan.radius) ? "Somewhere clear of rocks, burrows and patches." : "Inside the pit, please.", cell, at: performance.now() });
        return;
      }
      const dropped = isClassic ? dropClassic(state, cell, rabbitAfterDrop(cell, rng.float, classicSurvival)) : drop(state, cell);
      commit(dropped);
      setRefusal(null);
      if (dropped.outcome === "squish") {
        setAnnouncement("You landed right on the rabbit. Squish!");
        busy([...squishBeats(choreo, cell, dropped.rabbits[0].temperament), { duration: 0.3, end: () => finish("squish") }]);
      } else {
        // Classic has no hat rule, but the kid still wears the hat.
        busy([...dropBeats(choreo, cell, dropped.rabbits.map((r) => ({ at: r.at, temperament: r.temperament })), dropped.hat || isClassic), { duration: 0, end: startTurn }]);
      }
    },
    [busy, choreo, commit, current, finish, isClassic, plan.radius, rng, startTurn],
  );

  const perform = useCallback(
    (action: Action) => {
      const before = current();
      const acted = act(before, action);
      const answer = rabbitsTurn(acted, (chance) => rng.float() < chance);
      const after = endTurn(answer.state);
      commit(after);

      // Bookkeeping for keycaps and the share card.
      const t = tally.current;
      const perRabbit = new Map<number, number>();
      for (const hop of answer.hops) perRabbit.set(hop.rabbit, (perRabbit.get(hop.rabbit) ?? 0) + 1);
      t.longestChain = Math.max(t.longestChain, ...perRabbit.values());
      t.carrotsEaten += answer.hops.filter((h) => h.result === "carrot").length;
      t.stoneBonks += answer.hops.filter((h) => h.result === "bonk" && h.hit && acted.stones.some((s) => same(s, h.hit!))).length;
      if (action.kind === "move" && before.burrows.some((b) => same(b, action.to)) && tunnelExit(plan, action.to)) t.tunnels++;
      const lostHat = answer.hops.some((h) => h.result === "hat");
      const close = after.player && after.rabbits.some((r) => kingDistance(r.at, after.player!) <= 1);
      t.marks.push(after.outcome === "crunch" ? "crunch" : lostHat ? "hat" : close ? "close" : "clear");

      setTool(null);
      setHover(null);
      setRefusal(null);
      const beats = [...playerBeats(choreo, before, action, acted), ...rabbitBeats(choreo, answer.hops, after)];
      if (after.outcome === "crunch") busy([...beats, { duration: 0.3, end: () => finish("crunch") }]);
      else if (after.outcome === "released") busy([...beats, ...releaseBeats(choreo, after.hat || isClassic), { duration: 0.6, end: () => finish("released") }]);
      else busy([...beats, { duration: 0, end: startTurn }]);
      setAnnouncement(describeTurn(answer.hops, after));
    },
    [busy, choreo, commit, current, finish, isClassic, plan, rng, startTurn],
  );

  /** A click or key on a cell next to the kid: a step, a pull, or a polite refusal. */
  const tryCell = useCallback(
    (cell: Cell) => {
      const state = current();
      if (state.patches.some((p) => same(p, cell)) && kingDistance(state.player!, cell) === 1 && !state.hiddenAt) {
        perform({ kind: "pull", patch: cell });
        return;
      }
      if (canStepTo(state, cell)) perform({ kind: "move", to: cell });
      else {
        setRefusal({ text: refusalFor(state, cell), cell, at: performance.now() });
        onSound("bonk");
      }
    },
    [current, onSound, perform],
  );

  const placeTool = useCallback(
    (cell: Cell) => {
      const state = current();
      const action = legalActions(state).find((a) => (a.kind === "carrot" || a.kind === "stone") && a.kind === tool && same(a.to, cell));
      if (action) perform(action);
      else setRefusal({ text: tool === "carrot" ? `A carrot goes on clear ground, up to ${CARROT_REACH} steps away.` : "A stone goes on clear ground right next to you.", cell, at: performance.now() });
    },
    [current, perform, tool],
  );

  const pickTool = useCallback(
    (which: "carrot" | "stone" | "dig") => {
      const state = current();
      if (live.current.phase !== "player" || isClassic) return;
      if (state.tools[which] <= 0) {
        setRefusal({ text: `No ${which === "dig" ? "spade" : which}s left.`, cell: null, at: performance.now() });
        return;
      }
      if (state.hiddenAt) {
        setRefusal({ text: "Climb out first.", cell: null, at: performance.now() });
        return;
      }
      if (which === "dig") {
        if (!legalActions(state).some((a) => a.kind === "dig")) setRefusal({ text: "You can't dig here.", cell: null, at: performance.now() });
        else perform({ kind: "dig" });
        return;
      }
      setTool((current) => (current === which ? null : which));
      setCursor(state.player!);
    },
    [current, isClassic, perform],
  );

  /* ---------- Keys ---------- */

  const arrows = useRef({ held: new Set<string>(), timer: 0 });
  useEffect(() => {
    const onDirection = (d: Direction) => {
      const l = live.current;
      if (l.phase === "drop" || l.tool) {
        setCursor((c) => {
          const next = step(c, d);
          return inCircle(next, plan.radius) ? next : c;
        });
        return;
      }
      if (l.phase === "player") tryCell(step(current().player!, d));
    };
    function onKey(event: KeyboardEvent) {
      const l = live.current;
      if (l.paused || l.phase === "over" || event.repeat) return;
      if (event.key === " ") {
        if (director.busy) {
          director.skip();
          event.preventDefault();
        }
        return;
      }
      if (l.phase === "busy") return;
      if (event.key === "Escape" && l.tool) {
        event.preventDefault();
        setTool(null);
        return;
      }
      if (!isClassic && l.phase === "player") {
        const tools: Record<string, "carrot" | "stone" | "dig"> = { "1": "carrot", "2": "stone", "3": "dig" };
        if (tools[event.key]) {
          event.preventDefault();
          pickTool(tools[event.key]);
          return;
        }
        if (event.key.toLowerCase() === "i" && l.settings.intent === "request") {
          event.preventDefault();
          setPlanShown(true);
          return;
        }
      }
      if (event.key === "Enter") {
        if (l.phase === "drop") {
          event.preventDefault();
          dropAt(l.cursor);
        } else if (l.tool) {
          event.preventDefault();
          placeTool(l.cursor);
        } else if (l.phase === "player" && legalActions(current()).some((a) => a.kind === "wait")) {
          event.preventDefault();
          perform({ kind: "wait" });
        }
        return;
      }
      const direction = directionForKey(event, l.settings.keys);
      if (direction) {
        event.preventDefault();
        onDirection(direction);
        return;
      }
      if (ARROWS[event.key]) {
        // Arrows held together within a moment make a diagonal.
        event.preventDefault();
        const a = arrows.current;
        a.held.add(event.key);
        if (!a.timer) {
          a.timer = window.setTimeout(() => {
            a.timer = 0;
            const d = directionFromArrows(a.held);
            if (d) onDirection(d);
          }, 70);
        }
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (ARROWS[event.key]) arrows.current.held.delete(event.key);
      if (event.key.toLowerCase() === "i") setPlanShown(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [current, director, dropAt, isClassic, perform, pickTool, placeTool, plan.radius, tryCell]);

  /* ---------- Pointer ---------- */

  const surface = useRef<HTMLDivElement>(null);
  const cellUnder = (event: React.PointerEvent) => {
    const box = surface.current!.getBoundingClientRect();
    return canvas.style()?.cellAt(event.clientX - box.left, event.clientY - box.top) ?? null;
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (phase === "drop" || phase === "player") setHover(cellUnder(event));
  };
  const onClick = (event: React.PointerEvent) => {
    // While the rabbits move, a click anywhere hurries them along.
    if (phase !== "drop" && phase !== "player") {
      if (director.busy) director.skip();
      return;
    }
    const cell = cellUnder(event);
    if (!cell) return;
    if (phase === "drop") dropAt(cell);
    else if (tool) placeTool(cell);
    else tryCell(cell);
  };

  /* ---------- The shell ---------- */

  usePlayScreen({
    screen: phase === "over" ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [{ label: isClassic ? "New game" : "Start this pit again", onSelect: onAgain, shortcut: undefined }],
    losesProgress: phase !== "drop" && phase !== "over",
    roundName: isClassic ? "this game" : "this pit",
    onMenu,
  });

  /* ---------- Drawing aids ---------- */

  // The pads follow the kid, placed for each turn and for the canvas's size.
  const pitStyle = canvas.style();
  const pads = phase === "player" && !tool && snapshot.player && pitStyle && canvasSize.width > 0 ? padsFor(snapshot, pitStyle) : [];

  const state = snapshot;
  const toolsLeft = state.tools;
  const turnShown = phase === "drop" ? 0 : Math.min(state.turn, plan.turns);
  const odds = useMemo(() => [1, 2, 3].map((k) => chainChance(plan.rabbits[0].temperament, k)), [plan]);

  return (
    <div className={styles.screen}>
      <div
        ref={surface}
        className={styles.surface}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        onPointerUp={onClick}
        data-phase={phase}
        aria-label={phase === "drop" ? "The pit. Choose where to be dropped in." : "The pit"}
        role="application"
      >
        {pads.map((pad) => (
          <button
            key={pad.angle}
            type="button"
            className={styles.pad}
            style={{ left: pad.x, top: pad.y }}
            aria-label={pad.label}
            data-kind={pad.kind}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => (pad.kind === "stay" ? perform({ kind: "wait" }) : tryCell(pad.cell))}
            onPointerEnter={() => setHover(pad.cell)}
            onPointerLeave={() => setHover(null)}
          >
            {pad.kind === "pull" ? <CarrotIcon size={18} /> : pad.kind === "stay" ? <StayIcon /> : <StepArrow angle={pad.angle} />}
          </button>
        ))}
      </div>

      <div className={styles.page} data-dim={phase === "drop" ? "true" : undefined}>
        <span className={styles.pageLabel}>{phase === "drop" ? "The drop" : `Turn`}</span>
        {phase === "drop" ? (
          <span className={styles.pageHint}>{isClassic ? "Pick a spot to be dropped in. The rabbit is in here somewhere." : "The grass is rustling. Drop in on it for a squish, or well away."}</span>
        ) : (
          <>
            <span className={styles.turnNumber}>{turnShown}</span>
            <span className={styles.turnOf}>of {plan.turns}</span>
          </>
        )}
        <span className={styles.steps} aria-hidden="true">
          {Array.from({ length: plan.turns }, (_, i) => (
            <FootprintIcon key={i} filled={i < turnShown - (phase === "player" ? 1 : 0)} />
          ))}
        </span>
      </div>

      {phase !== "drop" && (
        <div className={styles.odds} aria-live="off">
          <span className={styles.oddsLabel}>{plan.rabbits.length > 1 ? "Pounces again? (each rabbit)" : "Pounces again?"}</span>
          <span className={styles.pipRow}>
            {odds.map((chance, i) => {
              const rolled = pips.find((p) => p.count === i + 1);
              return (
                <span key={i} className={styles.pipGroup} data-state={rolled ? (rolled.again ? "again" : "stop") : chance > 0 ? "waiting" : "never"}>
                  {chance > 0 ? `1 in ${Math.round(1 / chance)}` : "never"}
                </span>
              );
            })}
          </span>
        </div>
      )}

      {!isClassic && phase !== "drop" && phase !== "over" && (
        <div className={styles.tray} role="toolbar" aria-label="Your pockets">
          <ToolButton label="Carrot" keyHint="1" count={toolsLeft.carrot} active={tool === "carrot"} onClick={() => pickTool("carrot")} icon={<CarrotIcon />} />
          <ToolButton label="Stone" keyHint="2" count={toolsLeft.stone} active={tool === "stone"} onClick={() => pickTool("stone")} icon={<StoneIcon />} />
          <ToolButton label="Spade" keyHint="3" count={toolsLeft.dig} active={false} onClick={() => pickTool("dig")} icon={<SpadeIcon />} />
          <span className={styles.hat} title={state.hat ? "Your hat: it saves you once" : "The rabbit has your hat"}>
            <HatIcon gone={!state.hat} />
            <small>{state.hat ? "Hat on" : "Hat gone"}</small>
          </span>
          {settings.intent === "request" && (
            <button type="button" className={styles.planButton} aria-pressed={planShown} onPointerDown={() => setPlanShown(true)} onPointerUp={() => setPlanShown(false)} onPointerLeave={() => setPlanShown(false)}>
              Hold to see its plan <kbd>I</kbd>
            </button>
          )}
        </div>
      )}

      <p className={styles.status} role="status">
        {refusal ? (
          <span className={styles.refusal} key={refusal.at}>
            {refusal.text}
          </span>
        ) : phase === "busy" ? (
          <span>
            <kbd>Space</kbd> skip
          </span>
        ) : phase === "drop" ? (
          <span>
            Click in the pit, or move with <kbd>{keyRows(settings.keys)}</kbd> and press <kbd>Enter</kbd>
          </span>
        ) : tool ? (
          <span>
            {tool === "carrot" ? `Toss the carrot: pick a spot up to ${CARROT_REACH} steps away.` : "Set the stone: pick a cell next to you."} <kbd>Esc</kbd> cancels
          </span>
        ) : phase === "player" ? (
          <span>
            Step with <kbd>{keyRows(settings.keys)}</kbd>, the number pad or the arrows{isClassic ? "" : <>; tools <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></>}
          </span>
        ) : null}
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>

      {ending && (
        <div className={styles.ending}>
          <ResultsCard
            ending={ending}
            game={game}
            plan={plan}
            onAgain={onAgain}
            onMenu={onMenu}
            onNext={onNext}
            onShare={async () => {
              if (!ending.share) return;
              const outcome = await shareText(ending.share, { title: "Ten Turns in the Pit" });
              setShared(outcome === "shared" ? "Shared" : outcome === "copied" ? "Copied to the clipboard" : "Couldn't share");
            }}
            shared={shared}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Pieces ---------- */

function ToolButton({ label, keyHint, count, active, onClick, icon }: { label: string; keyHint: string; count: number; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button type="button" className={styles.tool} aria-pressed={active} disabled={count <= 0} onClick={onClick} aria-label={`${label}, ${count} left, key ${keyHint}`}>
      {icon}
      <span className={styles.toolCount}>×{count}</span>
      <kbd>{keyHint}</kbd>
    </button>
  );
}

type Pad = { cell: Cell; angle: number; x: number; y: number; label: string; kind: "step" | "pull" | "stay" };

/** The eight pads round the kid: a compass centred on their middle, so none covers them. */
function padsFor(state: TacticsState, style: PitStyle): Pad[] {
  const p = state.player!;
  const feet = style.project(p, 0);
  const u = feet.scale;
  const middle = { x: feet.x, y: feet.y - u * 1.25 };
  const pads: Pad[] = [];
  for (const d of DIRECTIONS) {
    const cell = step(p, d);
    const pull = !state.hiddenAt && state.patches.some((c) => same(c, cell));
    if (!pull && !canStepTo(state, cell)) continue;
    const a = (d.angle * Math.PI) / 180;
    pads.push({
      cell,
      angle: d.angle,
      x: middle.x + Math.cos(a) * u * 1.7,
      y: middle.y - Math.sin(a) * u * 1.55,
      label: pull ? `Pull the carrot to the ${d.name}` : `Step ${d.name}`,
      kind: pull ? "pull" : "step",
    });
  }
  // Boxed in on every side: the turn can still be spent standing still.
  if (!pads.some((pad) => pad.kind === "step")) pads.push({ cell: p, angle: -1, x: feet.x, y: feet.y + u * 0.6, label: "Stay put: there is nowhere to step", kind: "stay" });
  return pads;
}

/** Marks on the floor for the moment: where you can go, what a tool can reach, where the rabbits mean to land. */
function marksFor(state: TacticsState, l: { phase: Phase; tool: Tool; cursor: Cell; hover: Cell | null; planShown: boolean; refusal: { cell: Cell | null; at: number } | null; settings: Settings; reduced: boolean }): MarksView {
  const marks = noMarks();
  if (l.refusal?.cell) {
    const age = (performance.now() - l.refusal.at) / 1000;
    if (age < 0.8) marks.refused = { cell: l.refusal.cell, age, shake: !l.reduced };
  }
  if (l.phase === "drop") {
    marks.rustle = state.plan.rules === "classic" ? null : state.plan.rabbits.flatMap((_, i) => rustleCells(state.plan, i));
    marks.hover = l.hover ?? l.cursor;
    return marks;
  }
  if (l.phase !== "player" || !state.player) return marks;
  if (l.tool) {
    marks.targets = legalActions(state).flatMap((a) => (a.kind === l.tool ? [a.to] : []));
    marks.hover = l.hover ?? l.cursor;
  } else {
    marks.reachable = legalActions(state).flatMap((a) => (a.kind === "move" ? [a.to] : []));
    marks.hover = l.hover && marks.reachable.some((c) => same(c, l.hover!)) ? l.hover : null;
  }
  const showPlan = state.plan.rules !== "classic" && (l.settings.intent === "on" || (l.settings.intent === "request" && l.planShown));
  if (showPlan) marks.intents = state.rabbits.map((r, i): IntentMark => ({ from: r.at, to: intentOf(state, i, true), first: true })).filter((m) => !same(m.to, m.from as Cell));
  return marks;
}

/** What the rabbits just did, for screen readers. */
function describeTurn(hops: ReturnType<typeof rabbitsTurn>["hops"], after: TacticsState): string {
  if (after.outcome === "crunch") return "Crunch. The rabbit caught you.";
  const parts: string[] = [];
  const count = hops.length;
  if (hops.some((h) => h.result === "hat")) parts.push("It snatched your hat! It won't save you twice.");
  if (hops.some((h) => h.result === "bonk")) parts.push("Bonk: it hit something and sat down, dazed.");
  if (hops.some((h) => h.result === "carrot")) parts.push("It stopped to eat the carrot.");
  if (hops.some((h) => h.result === "circle")) parts.push("It sniffed round your burrow.");
  parts.unshift(`The rabbit pounced ${count === 1 ? "once" : `${count} times`}.`);
  if (after.outcome === "released") parts.push("Ten turns! A ladder comes down.");
  return parts.join(" ");
}

function ResultsCard({
  ending,
  game,
  plan,
  onAgain,
  onMenu,
  onNext,
  onShare,
  shared,
}: {
  ending: Ending;
  game: PitGame;
  plan: PitPlan;
  onAgain: () => void;
  onMenu: () => void;
  onNext?: () => void;
  onShare: () => void;
  shared: string | null;
}) {
  const won = ending.outcome !== "crunch";
  const title = ending.outcome === "squish" ? "Squish!" : ending.outcome === "released" ? "You are free!" : "Crunch.";
  const kicker = game.kind === "classic" ? "Classic" : game.kind === "daily" ? `Daily Pit #${game.number}` : `Tactics · ${plan.title}`;
  const extras: ResultsExtra[] = [];
  if (game.kind === "tactics" && won && onNext && !game.last) extras.push({ label: "Next pit", onSelect: onNext, primary: true });
  if (game.kind === "daily" && ending.share) extras.push({ label: shared ?? "Share", onSelect: onShare, primary: true });
  return (
    <Results
      title={title}
      tone={won ? "win" : "loss"}
      kicker={kicker}
      playAgainLabel={game.kind === "daily" ? "Play it again" : game.kind === "tactics" ? "Try this pit again" : "Play again"}
      onPlayAgain={onAgain}
      onMenu={onMenu}
      unlocked={ending.unlocked.length ? { gameId: "ten-turns", ids: ending.unlocked } : undefined}
      extras={extras}
    >
      <p className={styles.resultLine}>
        {ending.outcome === "squish"
          ? "Dropped right on top of it. The pit is yours."
          : ending.outcome === "released"
            ? `${plan.turns} turns, and a ladder came down.`
            : `Caught on turn ${ending.turns} of ${plan.turns}.`}
      </p>
      {game.kind !== "classic" && (
        <ul className={styles.medals} aria-label="Medals">
          <Medal won={ending.medals.survived} label="Survived" />
          <Medal won={ending.medals.toolsToSpare} label="Tools to spare" />
          <Medal won={ending.medals.untouched} label="Untouched" />
        </ul>
      )}
    </Results>
  );
}

function Medal({ won, label }: { won: boolean; label: string }) {
  return (
    <li className={styles.medal} data-won={won}>
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <path d="M8 2h8l-2.5 6h-3z" fill="#c4572e" />
        <circle cx="12" cy="15" r="6.5" fill={won ? "#e9b949" : "none"} stroke="currentColor" strokeWidth="1.5" />
        {won && <path d="M9.4 15.2l1.9 1.9 3.6-3.8" fill="none" stroke="#3a271d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <span>{label}</span>
      <span className={styles.srOnly}>{won ? "earned" : "not earned"}</span>
    </li>
  );
}

