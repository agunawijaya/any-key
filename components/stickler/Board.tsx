"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  describeRules,
  isLegal,
  maxTakeFrom,
  minTakeFrom,
  minTakeOf,
  mustSweep,
  newGame,
  play,
  total,
  type Game,
  type Move,
  type Player,
  type Rules,
} from "@/lib/stickler/rules";
import { isWinning, magicNumbers, magicZones, quality, winningMoves, zoneOf, type MoveQuality } from "@/lib/stickler/solver";
import { line, mulberry, sparkyMove, type Level, type LineKind, type Mood } from "@/lib/stickler/sparky";
import { ACHIEVEMENTS, updateProgress, withAchievement, type Skin } from "@/lib/stickler/progress";
import { HANDFULS_PRESETS, type HandfulsSetup, type ModeId } from "@/lib/stickler/modes";
import * as sfx from "@/lib/stickler/sfx";
import { Sparky } from "./Sparky";
import { Stick, type StickState } from "./Stick";
import styles from "./Board.module.css";

export type Session = {
  mode: ModeId;
  title: string;
  rules: Rules;
  /** Sparky's level, or null for two players on one screen. */
  level: Level | null;
  tableId?: number;
  daily?: { key: string; number: number };
  /** The Handfuls setup this table came from (take range preset, surprise pile, who opens). */
  handfuls?: HandfulsSetup;
};

type Item = { id: number; row: number; color: number; tilt: number; nudge: number };
type Bubble = { text: string; mood: Mood; key: number };
type Result = {
  youWon: boolean;
  loser: Player;
  moves: MoveQuality[];
  keyMoment: string;
  stars: number;
  share?: string;
  unlocked: string[];
  /** Handfuls: how many sticks the last take swept up, and whether the rules forced it. */
  sweep?: { count: number; forced: boolean };
};

const PLAYER_NAMES = ["Player 1", "Player 2"];
const QUALITY_EMOJI: Record<MoveQuality, string> = { best: "🟩", blunder: "🟥", lost: "⬜" };

/** How far apart the sticks of a sweep go up: matches flare together, glow sticks snap in a chain, candy pops in a row. */
const SWEEP_STEP_MS: Record<Skin, number> = { matches: 0, glow: 90, candy: 110 };

/** A zone as players read it, "25–27", glued so a line never breaks at the dash. */
const zoneText = (z: { from: number; to: number }) => `${z.from}\u2060–\u2060${z.to}`;

/** Room the Handfuls rule line takes under the pile (its height plus the gap above it). */
const HUD_H = 50;

type Fit = { w: number; perRow: number; need: number };

/**
 * How big the sticks of one row can be so the whole pile fits the table: at most 12 to a line
 * (or half the pile, for big ones), as wide as the old 2vw clamp allows, and no taller than the
 * room there is. On a phone the page scrolls, so the table grows instead, within reason.
 */
function fitSticks(n: number, width: number, height: number, narrow: boolean, viewport: number): Fit {
  const inner = width - 28; // the row's side padding
  const layout = (w: number): Fit => {
    const fits = Math.max(1, Math.floor((inner + 4) / (w + 8))); // a stick button is w + 4 wide, 4 apart
    const rows = Math.ceil(n / Math.min(fits, Math.max(12, Math.ceil(n / 2))));
    return { w, perRow: Math.ceil(n / rows), need: rows * ((w * 194) / 24) + (rows - 1) * 6 + 20 };
  };
  const most = Math.min(28, Math.max(16, viewport * 0.02));
  for (let w = most; w >= 11; w -= 0.5) {
    const l = layout(w);
    if (narrow ? l.need <= 400 : l.need <= height) return l;
  }
  return layout(narrow ? 11 : 10);
}

function buildItems(rules: Rules, seed: number): Item[] {
  const rng = mulberry(seed);
  const items: Item[] = [];
  let id = 0;
  rules.rows.forEach((count, row) => {
    for (let i = 0; i < count; i++) {
      items.push({ id: id++, row, color: Math.floor(rng() * 6), tilt: (rng() - 0.5) * 7, nudge: (rng() - 0.5) * 8 });
    }
  });
  return items;
}

type Props = {
  session: Session;
  skin: Skin;
  sound: boolean;
  /** Changes for every new game, so each deal (and Sparky's choices) differ. */
  seed: number;
  rematch: boolean;
  onRematch: () => void;
  onExit: () => void;
  onNext?: () => void;
  onUnlock: (ids: string[]) => void;
};

/** One game. A rematch remounts the board with a new seed, so all state starts fresh. */
export function Board({ session, skin, sound, seed, rematch, onRematch, onExit, onNext, onUnlock }: Props) {
  const { rules, level } = session;
  const versus = level === null;
  const single = rules.rows.length === 1;
  const sparkyOpens = !versus && rules.first === 1;
  // Handfuls: every take is minTake..maxTake, and fewer than minTake left means sweeping them all.
  const min = minTakeOf(rules);
  const handfuls = min > 1;
  const range = useMemo(() => ({ min, max: rules.maxTake }), [min, rules.maxTake]);
  const [game, setGame] = useState<Game>(() => newGame(rules));
  const [items, setItems] = useState<Item[]>(() => buildItems(rules, seed));
  const [selected, setSelected] = useState<number[]>([]);
  const [anim, setAnim] = useState<Record<number, StickState>>({});
  const [fly, setFly] = useState<Record<number, React.CSSProperties>>({});
  const [bubble, setBubble] = useState<Bubble | null>(() =>
    versus || sparkyOpens ? null : { ...line(rematch ? "rematch" : handfuls ? "helloHandfuls" : "hello", mulberry(seed), undefined, range), key: 0 },
  );
  const [busy, setBusy] = useState(sparkyOpens);
  const [hint, setHint] = useState<{ level: number; text: string; ids: number[] }>({ level: 0, text: "", ids: [] });
  const [result, setResult] = useState<Result | null>(null);
  const [fx, setFx] = useState<"none" | "fwoosh" | "confetti">("none");
  const [taken, setTaken] = useState<[number, number]>([0, 0]);
  const [focusRow, setFocusRow] = useState(() => rules.rows.findIndex((n) => n > 0));
  /** The sticks of a Handfuls sweep, in order along the row. */
  const [swept, setSwept] = useState<number[]>([]);
  /** Bumped on every refused pick, to replay the Strike button's little shake. */
  const [nudge, setNudge] = useState(0);
  /** Versus has no Sparky to object, so rule reminders show on the turn card instead. */
  const [notice, setNotice] = useState("");
  /** Stick size for a one-row pile, measured against the table (see fitSticks). */
  const [fit, setFit] = useState<(Fit & { tableMin?: number }) | null>(null);

  const timers = useRef<number[]>([]);
  const rng = useRef(mulberry(seed));
  const arenaRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const sticksRef = useRef<HTMLDivElement>(null);
  const myTray = useRef<HTMLDivElement>(null);
  const theirTray = useRef<HTMLDivElement>(null);
  const gameRef = useRef(game);
  const soundRef = useRef(sound);
  const protested = useRef(false);
  const hintLevelRef = useRef(0);

  const itemsRef = useRef(items);
  const animRef = useRef(anim);
  const sparkyTurnRef = useRef<(g: Game) => void>(() => {});

  useEffect(() => {
    gameRef.current = game;
    soundRef.current = sound;
    itemsRef.current = items;
    animRef.current = anim;
    hintLevelRef.current = hint.level;
  });

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const say = useCallback(
    (kind: LineKind, n?: number) => {
      if (versus) return;
      const l = line(kind, rng.current, n, range);
      setBubble({ ...l, key: Date.now() });
      if (soundRef.current) sfx.voice(l.text, l.mood);
    },
    [range, versus],
  );

  // ---------- Fitting the pile to the table ----------

  const pile = rules.rows[0];
  useEffect(() => {
    const el = sticksRef.current;
    const table = tableRef.current;
    if (!single || !el || !table) return;
    const observer = new ResizeObserver(() => {
      const narrow = window.matchMedia("(max-width: 760px)").matches;
      const hud = handfuls ? HUD_H : 0;
      const next = fitSticks(pile, el.clientWidth, el.clientHeight - hud, narrow, window.innerWidth);
      // On a phone the table grows to hold the pile: its insets (Sparky above, the trays below) stay as they are.
      const tableMin = narrow ? Math.max(520, Math.ceil(next.need + hud + table.clientHeight - el.clientHeight)) : undefined;
      setFit((prev) => (prev && prev.w === next.w && prev.perRow === next.perRow && prev.tableMin === tableMin ? prev : { ...next, tableMin }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handfuls, pile, single]);

  // ---------- Opening ----------

  useEffect(() => {
    const pending = timers.current;
    if (sparkyOpens) pending.push(window.setTimeout(() => sparkyTurnRef.current(gameRef.current), 700));
    else if (bubble && soundRef.current) sfx.voice(bubble.text, bubble.mood);
    return () => pending.forEach(clearTimeout);
    // Runs once per board: a rematch mounts a new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Moves ----------

  const finish = useCallback(
    (final: Game) => {
      const loser = final.loser!;
      const youWon = versus ? loser === 1 : loser === 1;
      const mine = final.history.filter((t) => t.player === 0);
      const moves = versus ? [] : mine.map((t) => quality(t, rules));
      const last = final.history[final.history.length - 1];
      const sweep = handfuls ? { count: last.move.take, forced: total(last.before) <= min } : undefined;
      let keyMoment = "";
      if (!versus) {
        const slip = mine.findIndex((t) => quality(t, rules) === "blunder");
        if (youWon && slip === -1) keyMoment = "Every move you made was a winning one.";
        else if (youWon) keyMoment = "You slipped once, but Sparky slipped back. Lucky!";
        else if (slip === -1) keyMoment = "You never had a winning position here: Sparky started ahead and didn't let go.";
        else {
          const t = mine[slip];
          const best = winningMoves(t.before, rules)[0];
          const left = total(t.before) - t.move.take;
          if (handfuls) {
            const land = total(t.before) - best.take;
            const zone = zoneOf(land, min, rules.maxTake)!;
            const what = left === 0 ? `swept all ${t.move.take}` : `took ${t.move.take}, leaving ${left}`;
            keyMoment = `Key moment: with ${total(t.before)} left you ${what}. Taking ${best.take} would have left ${land}, inside the ${zoneText(zone)} zone, and Sparky couldn't have won.`;
          } else {
            keyMoment = single
              ? `Key moment: with ${total(t.before)} left you took ${t.move.take}, leaving ${left}. Taking ${best.take} would have left ${total(t.before) - best.take}, and Sparky couldn't have won.`
              : `Key moment: move ${slip + 1}. Taking ${best.take} from row ${best.row + 1} would have kept you winning.`;
          }
        }
      }
      const hints = hintLevelRef.current;
      const stars = youWon && session.mode === "ladder" ? (hints === 0 ? 3 : hints < 3 ? 2 : 1) : 0;
      let share: string | undefined;
      if (session.daily && !versus) {
        share = [
          `Stickler Daily #${session.daily.number}`,
          describeRules(rules),
          `${moves.map((q) => QUALITY_EMOJI[q]).join("")} ${youWon ? "won" : "burnt"}${hints ? ` · ${hints} hint${hints > 1 ? "s" : ""}` : " · no hints"}`,
        ].join("\n");
      }

      const unlocked = updateProgress((p) => {
        let next = { ...p };
        if (versus) return withAchievement(next, "rivals");
        next.wins += youWon ? 1 : 0;
        next.losses += youWon ? 0 : 1;
        next.streak = youWon ? next.streak + 1 : 0;
        next.bestStreak = Math.max(next.bestStreak, next.streak);
        if (youWon) next = withAchievement(next, "first-light");
        if (youWon && !moves.includes("blunder")) next = withAchievement(next, "flawless");
        if (next.streak >= 3) next = withAchievement(next, "hot-streak");
        if (youWon && session.mode === "classic" && level === "master" && hints === 0) next = withAchievement(next, "secret-four");
        if (session.mode === "ladder" && session.tableId && stars) {
          next.ladder = { ...next.ladder, [session.tableId]: Math.max(next.ladder[session.tableId] ?? 0, stars) };
          const cleared = Object.keys(next.ladder).length;
          if (cleared >= 5) next = withAchievement(next, "climber");
          if (cleared >= 10) next = withAchievement(next, "summit");
          if (session.tableId === 10) next = withAchievement(next, "marienbad");
        }
        if (session.daily && !next.daily[session.daily.key]) {
          next.daily = { ...next.daily, [session.daily.key]: { won: youWon, share: share ?? "" } };
          if (Object.values(next.daily).filter((d) => d.won).length >= 3) next = withAchievement(next, "daily-3");
        }
        if (session.mode === "handfuls" && session.handfuls && youWon) {
          const id = session.handfuls.preset;
          const record = next.handfuls[id] ?? { wins: 0, masterWins: 0 };
          next.handfuls = { ...next.handfuls, [id]: { wins: record.wins + 1, masterWins: record.masterWins + (level === "master" ? 1 : 0) } };
          if (HANDFULS_PRESETS.every((p) => (next.handfuls[p.id]?.masterWins ?? 0) > 0)) next = withAchievement(next, "handful-master");
        }
        if (youWon && sweep && sweep.count >= 3) next = withAchievement(next, "clean-sweep");
        return next;
      });
      onUnlock(unlocked);
      setResult({ youWon, loser, moves, keyMoment, stars, share, unlocked, sweep });
      if (soundRef.current) (youWon ? sfx.win : () => {})();
      const bigSweep = sweep && sweep.count >= 2;
      if (!versus) say(youWon ? (bigSweep ? "iLoseSweep" : "iLose") : bigSweep ? "iWinSweep" : "iWin", sweep?.count);
      if (youWon) setFx("confetti");
    },
    [handfuls, level, min, onUnlock, rules, say, session.daily, session.handfuls, session.mode, session.tableId, single, versus],
  );

  const perform = useCallback(
    (who: Player, move: Move, ids: number[]) => {
      const before = gameRef.current;
      if (!isLegal(before, move)) return;
      const after = play(before, move);
      gameRef.current = after;
      setBusy(true);
      setSelected([]);
      setHint((h) => ({ ...h, ids: [] }));
      const lastStick = after.loser !== null;
      const sweep = lastStick && handfuls;
      const chain = sweep ? SWEEP_STEP_MS[skin] * (ids.length - 1) : 0;
      if (soundRef.current) {
        if (sweep) sfx.sweep(skin, move.take, SWEEP_STEP_MS[skin] / 1000);
        else sfx.take(skin, move.take);
      }

      if (sweep) {
        // The Handfuls ending: every stick left goes up at once (item ids run along the row).
        const order = [...ids].sort((a, b) => a - b);
        setSwept(order);
        setAnim((a) => ({ ...a, ...Object.fromEntries(order.map((id) => [id, "swept" as StickState])) }));
      } else {
        setAnim((a) => ({ ...a, ...Object.fromEntries(ids.map((id) => [id, lastStick && id === ids[ids.length - 1] ? "doomed" : "burning"])) }));
      }
      setGame(after);

      if (lastStick) {
        if (soundRef.current) later(250 + chain, () => sfx.fwoosh(skin, sweep ? move.take : 1));
        later(250 + chain, () => setFx("fwoosh"));
        later(1500 + chain, () => finish(after));
        return;
      }

      later(480, () => {
        const tray = (who === 0 ? myTray : theirTray).current?.getBoundingClientRect();
        const targets: Record<number, React.CSSProperties> = {};
        for (const id of ids) {
          const el = document.getElementById(`stick-${id}`)?.getBoundingClientRect();
          if (tray && el) {
            targets[id] = {
              "--fly-x": `${tray.left + tray.width / 2 - (el.left + el.width / 2)}px`,
              "--fly-y": `${tray.top + tray.height / 2 - (el.top + el.height / 2)}px`,
              "--fly-r": `${who === 0 ? -80 : 80}deg`,
            } as React.CSSProperties;
          }
        }
        setFly((f) => ({ ...f, ...targets }));
        setAnim((a) => ({ ...a, ...Object.fromEntries(ids.map((id) => [id, "flying"])) }));
      });
      later(1150, () => {
        setItems((list) => list.filter((it) => !ids.includes(it.id)));
        setTaken((t) => (who === 0 ? [t[0] + move.take, t[1]] : [t[0], t[1] + move.take]));
        setBusy(false);
        if (!versus && after.turn === 1) sparkyTurnRef.current(after);
      });
    },
    [finish, handfuls, later, skin, versus],
  );

  const sparkyTurn = useCallback(
    (current: Game) => {
      if (level === null) return;
      setBusy(true);
      // Left with a sweep, Sparky knows it before he moves.
      if (handfuls && mustSweep(current.rows, rules, 0) && total(current.rows) > 1) say("dread", total(current.rows));
      else say("think");
      const think = 650 + rng.current() * 700 + (isWinning(current.rows, rules) ? 0 : 500);
      later(think, () => {
        const move = sparkyMove(current, level, rng.current);
        const inRow = itemsRef.current.filter((it) => it.row === move.row && !animRef.current[it.id]);
        const ids = inRow.slice(-move.take).map((it) => it.id);
        setAnim((a) => ({ ...a, ...Object.fromEntries(ids.map((id) => [id, "sparky" as StickState])) }));
        later(420, () => {
          const after = play(current, move);
          if (after.loser === null) {
            // In Handfuls, leaving you a sweep is the moment he has waited for.
            if (handfuls && mustSweep(after.rows, rules, 0) && total(after.rows) > 1) say("sweepYou", total(after.rows));
            else say("took", move.take);
            // Sparky can tell when you've got him.
            if (isWinning(after.rows, rules) && rng.current() < 0.35) later(900, () => say("inTrouble"));
          }
          perform(1, move, ids);
        });
      });
    },
    [handfuls, later, level, perform, rules, say],
  );

  useEffect(() => {
    sparkyTurnRef.current = sparkyTurn;
  });

  // ---------- Player input ----------

  const remainingInRow = useCallback((row: number) => items.filter((it) => it.row === row && !anim[it.id]), [anim, items]);

  /**
   * Sparky objects to a pick the rules don't allow: `said` is his exact words or one of his line sets.
   * Versus has no Sparky, so `plain` (or the exact words) goes on the turn card instead.
   */
  const protest = useCallback(
    (said?: string | { kind: LineKind; n?: number }, plain?: string) => {
      if (soundRef.current) sfx.protest();
      if (!versus) {
        if (typeof said === "string") setBubble({ text: said, mood: "cross", key: Date.now() });
        else if (said) say(said.kind, said.n);
        else say("protest");
      } else {
        const text = plain ?? (typeof said === "string" ? said : "");
        if (text) {
          setNotice(text);
          later(2400, () => setNotice((n) => (n === text ? "" : n)));
        }
      }
      if (!protested.current) {
        protested.current = true;
        onUnlock(updateProgress((p) => withAchievement(p, "stickler")));
      }
    },
    [later, onUnlock, say, versus],
  );

  /** Handfuls: why a take of `count` from a row breaks the rules (Sparky's words, plain words), or null when it's legal. */
  const handfulsObjection = useCallback(
    (rows: number[], row: number, count: number): [string | { kind: LineKind; n?: number }, string] | null => {
      if (count >= minTakeFrom(rows, rules, row) && count <= maxTakeFrom(rows, rules, row)) return null;
      const left = rows[row];
      if (mustSweep(rows, rules, row)) return [{ kind: "protestSweep", n: left }, `Only ${left} left: sweep them all.`];
      if (count < min) return [{ kind: "protestMin" }, `Handfuls means at least ${min}.`];
      if (count > rules.maxTake) return [`${rules.maxTake} max. I'm a stickler.`, `${rules.maxTake} max.`];
      return [`There are only ${left} left.`, `Only ${left} left.`];
    },
    [min, rules],
  );

  const myTurn = !busy && !result && game.loser === null && (versus || game.turn === 0);

  function toggle(item: Item) {
    if (!myTurn || anim[item.id]) return;
    if (handfuls && mustSweep(game.rows, rules, item.row)) {
      // Only one move is left, the whole pile, so any stick picks them all.
      const all = remainingInRow(item.row).map((it) => it.id);
      if (selected.length === all.length) setSelected([]);
      else {
        if (soundRef.current) sfx.select();
        setSelected(all);
      }
      return;
    }
    if (selected.includes(item.id)) {
      setSelected(selected.filter((id) => id !== item.id));
      return;
    }
    const rowOfSelection = items.find((it) => it.id === selected[0])?.row;
    if (selected.length && rowOfSelection !== item.row) {
      protest("One row at a time!");
      setSelected([item.id]);
      setFocusRow(item.row);
      return;
    }
    const limit = maxTakeFrom(game.rows, rules, item.row);
    if (selected.length >= limit) {
      protest(Number.isFinite(rules.maxTake) && limit === rules.maxTake ? `${limit} max. I'm a stickler.` : undefined);
      return;
    }
    if (soundRef.current) sfx.select();
    setSelected([...selected, item.id]);
    setFocusRow(item.row);
  }

  const selectCount = useCallback(
    (row: number, count: number) => {
      if (!myTurn) return;
      if (handfuls) {
        const objection = handfulsObjection(gameRef.current.rows, row, count);
        if (objection) {
          protest(...objection);
          setNudge((n) => n + 1);
          return;
        }
      }
      const limit = maxTakeFrom(gameRef.current.rows, rules, row);
      if (count > limit) {
        protest();
        return;
      }
      setFocusRow(row);
      setSelected(remainingInRow(row).slice(-count).map((it) => it.id));
    },
    [handfuls, handfulsObjection, myTurn, protest, remainingInRow, rules],
  );

  const strike = useCallback(
    (ids = selected) => {
      if (!myTurn || ids.length === 0) return;
      const row = items.find((it) => it.id === ids[0])!.row;
      const who = versus ? game.turn : 0;
      const move = { row, take: ids.length };
      if (handfuls) {
        const objection = handfulsObjection(game.rows, row, move.take);
        if (objection) {
          protest(...objection);
          setNudge((n) => n + 1);
          return;
        }
      }
      if (!versus) {
        const next = play(game, move);
        if (next.loser === null) {
          const q = quality(next.history[next.history.length - 1], rules);
          if (q === "blunder" && rng.current() < 0.6) later(500, () => say("gotGift"));
        }
      }
      perform(who, move, ids);
    },
    [game, handfuls, handfulsObjection, items, later, myTurn, perform, protest, rules, say, selected, versus],
  );

  function takeNow(row: number, count: number) {
    const ids = remainingInRow(row).slice(-count).map((it) => it.id);
    if (ids.length === count) strike(ids);
  }

  /** The Take and Sweep buttons (one row only) carry their count in data-take. */
  function onTakeButton(event: React.MouseEvent<HTMLButtonElement>) {
    takeNow(0, Number(event.currentTarget.dataset.take));
  }

  // ---------- Coach ----------

  function nextHint() {
    if (versus || !myTurn) return;
    const levelNow = Math.min(3, hint.level + 1);
    const rows = game.rows;
    const winning = isWinning(rows, rules);
    const best = winningMoves(rows, rules)[0];
    let text: string;
    let ids: number[] = [];
    if (!winning) {
      text = handfuls
        ? "Honest truth: from here a perfect Sparky wins. Take small handfuls, keep the pile big and hope he slips."
        : "Honest truth: from here a perfect Sparky wins. Leave him lots of choices and hope he slips.";
    } else if (handfuls) {
      const period = min + rules.maxTake;
      const zones = magicZones(min, rules.maxTake, total(rows)).map(zoneText);
      if (levelNow === 1) text = "Watch the gaps: Sparky keeps leaving you inside the same bands.";
      else if (levelNow === 2) {
        text = `Those bands are the magic zones: ${zones.join(", ")}. They repeat every ${period} sticks (${min} + ${rules.maxTake}). Leave Sparky inside one and he can't get out.`;
      } else {
        const land = total(rows) - best.take;
        const zone = zoneOf(land, min, rules.maxTake)!;
        const end = land - zone.from + 1;
        text = `Take ${best.take}: that leaves ${land}, inside the ${zoneText(zone)} zone. Then answer each of Sparky's takes with ${period} minus it, and he ends up ${end > 1 ? `sweeping ${end}` : "taking the last stick"}.`;
        ids = remainingInRow(best.row).slice(-best.take).map((it) => it.id);
      }
    } else if (single) {
      const k = rules.maxTake;
      const magic = magicNumbers(k, total(rules.rows));
      if (levelNow === 1) text = "Watch how many sticks are left right after Sparky's turns. See a pattern?";
      else if (levelNow === 2) text = `Sparky loves leaving you ${magic.slice(-4).reverse().join(", ")}… Each is 1 more than a multiple of ${k + 1}.`;
      else {
        text = `Take ${best.take}: that leaves ${total(rows) - best.take}, a magic number. Then always take ${k + 1} minus Sparky's take.`;
        ids = remainingInRow(best.row).slice(-best.take).map((it) => it.id);
      }
    } else if (levelNow === 1) {
      text = "Think of every row as a sum of 4, 2 and 1 (5 = 4 + 1, 7 = 4 + 2 + 1).";
    } else if (levelNow === 2) {
      text = "Leave rows where each of 4, 2 and 1 shows up an even number of times. At the very end, leave an odd number of single sticks.";
    } else {
      text = `Take ${best.take} from row ${best.row + 1}.`;
      ids = remainingInRow(best.row).slice(-best.take).map((it) => it.id);
    }
    setHint({ level: Math.max(hint.level, levelNow), text, ids });
    updateProgress((p) => ({ ...p, hintsSeen: p.hintsSeen + 1 }));
  }

  // ---------- Keyboard ----------

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "Escape") return onExit();
      if (result) {
        if (event.key.toLowerCase() === "r") onRematch();
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        selectCount(single ? 0 : focusRow, Number(event.key));
      } else if (event.key === "Enter" || (event.key === " " && !/^(BUTTON|A)$/.test(target.tagName))) {
        event.preventDefault();
        strike();
      } else if (event.key.toLowerCase() === "h") {
        nextHint();
      } else if (!single && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const live = game.rows.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
        const pos = live.indexOf(focusRow);
        setFocusRow(live[(pos + (event.key === "ArrowDown" ? 1 : live.length - 1)) % live.length] ?? 0);
        setSelected([]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- Render ----------

  const left = total(game.rows);
  const turnName = versus ? PLAYER_NAMES[game.turn] : game.turn === 0 ? "Your turn" : "Sparky's turn";
  const rowsOfItems = useMemo(() => rules.rows.map((_, row) => items.filter((it) => it.row === row)), [items, rules.rows]);
  const limitNow = selected.length ? maxTakeFrom(game.rows, rules, items.find((it) => it.id === selected[0])?.row ?? 0) : single ? Math.min(rules.maxTake, left) : 0;
  // Handfuls: fewer than minTake left (or exactly minTake) leaves one move, the sweep.
  const sweepNow = handfuls && game.loser === null && mustSweep(game.rows, rules, 0);
  const floorNow = handfuls ? minTakeFrom(game.rows, rules, 0) : 1;
  // A bigger sweep shakes the table harder (the CSS turns the shake off for reduced motion).
  const shakeStyle = swept.length > 1 ? ({ "--shake-k": 1 + 0.3 * (swept.length - 1), "--shake-t": 1 + 0.12 * (swept.length - 1) } as React.CSSProperties) : undefined;

  return (
    <div className={styles.board} data-board data-over={result ? "" : undefined}>
      <div className={styles.topbar}>
        <button type="button" className={styles.back} onClick={onExit}>
          ← Lobby
        </button>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{session.title}</h1>
          <span className={styles.rulesChip}>{describeRules(rules)}</span>
        </div>
        <div className={styles.counter} aria-live="polite" data-count={left}>
          <span className={styles.count}>{left}</span>
          <span className={styles.countLabel}>{left === 1 ? "stick left" : "sticks left"}</span>
        </div>
      </div>

      <div ref={arenaRef} className={`${styles.arena} ${fx === "fwoosh" ? styles.shake : ""}`} style={shakeStyle}>
        <div ref={tableRef} className={styles.table} style={fit?.tableMin ? { minHeight: fit.tableMin } : undefined}>
          <div className={styles.opponent}>
            {versus ? (
              <div className={styles.turnCard} data-player={game.turn} data-notice={notice ? "" : undefined} role="status">
                <span className={styles.turnDot} />
                {notice || (game.loser === null ? `${PLAYER_NAMES[game.turn]}, your move` : "Game over")}
              </div>
            ) : (
              <>
                <Sparky mood={bubble?.mood ?? "idle"} skin={skin} size={104} talking={busy && game.turn === 1} />
                {bubble && (
                  <p key={bubble.key} className={styles.bubble} role="status">
                    {bubble.text}
                  </p>
                )}
              </>
            )}
          </div>

          <div ref={theirTray} className={`${styles.tray} ${styles.trayTheirs}`}>
            <span className={styles.trayLabel}>{versus ? PLAYER_NAMES[1] : "Sparky"} took</span>
            <span className={styles.trayCount}>{taken[1]}</span>
          </div>

          <div
            ref={sticksRef}
            className={styles.sticks}
            data-single={single || undefined}
            style={fit ? ({ "--fit-w": `${fit.w}px`, "--row-max": `${fit.perRow * (fit.w + 8) - 2}px` } as React.CSSProperties) : undefined}
          >
            {rowsOfItems.map((row, r) => (
              <div
                key={r}
                className={`${styles.row} ${!single && focusRow === r && myTurn ? styles.rowFocus : ""}`}
                style={{ "--count": row.length } as React.CSSProperties}
              >
                {!single && <span className={styles.rowLabel}>Row {r + 1}</span>}
                <div className={styles.rowSticks}>
                  {row.map((item) => {
                    const state: StickState =
                      anim[item.id] ?? (selected.includes(item.id) ? "selected" : hint.ids.includes(item.id) ? "hinted" : "idle");
                    return (
                      <button
                        key={item.id}
                        id={`stick-${item.id}`}
                        type="button"
                        tabIndex={-1}
                        aria-hidden
                        className={styles.stickButton}
                        onClick={() => toggle(item)}
                        disabled={!myTurn}
                        style={{ "--tilt": `${item.tilt}deg`, marginTop: `${item.nudge}px` } as React.CSSProperties}
                      >
                        <Stick
                          skin={skin}
                          color={item.color}
                          state={state}
                          style={
                            {
                              "--tilt": `${item.tilt}deg`,
                              ...fly[item.id],
                              ...(state === "swept" ? { "--sweep-delay": `${swept.indexOf(item.id) * SWEEP_STEP_MS[skin]}ms` } : {}),
                            } as React.CSSProperties
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {handfuls && game.loser === null && (
              <p className={styles.hud} data-sweep={sweepNow || undefined}>
                {sweepNow ? (left < min ? `Fewer than ${min} left · sweep them all` : `Exactly ${min} left · one handful takes them all`) : `Take ${min}–${rules.maxTake} · last stick loses`}
              </p>
            )}
          </div>

          <div ref={myTray} className={`${styles.tray} ${styles.trayMine}`}>
            <span className={styles.trayLabel}>{versus ? PLAYER_NAMES[0] : "You"} took</span>
            <span className={styles.trayCount}>{taken[0]}</span>
          </div>

          {fx === "fwoosh" && <Fwoosh skin={skin} count={Math.max(1, swept.length)} />}
          {fx === "confetti" && <Confetti />}
        </div>
      </div>

      {hint.text && !result && (
        <p className={styles.coach} role="status">
          <span aria-hidden>💡</span> <strong>Coach:</strong> {hint.text}
        </p>
      )}

      {!result && (
        <div className={styles.controls}>
          <span className={styles.turn} data-mine={myTurn || undefined} data-notice={notice ? "" : undefined}>
            {notice || (game.loser === null ? turnName : "")}
          </span>
          {single ? (
            <div className={styles.quick} role="group" aria-label="Take sticks">
              {sweepNow ? (
                <button type="button" className={`${styles.takeButton} ${styles.sweepButton}`} data-take={left} onClick={onTakeButton} disabled={!myTurn}>
                  Sweep {left}
                  <kbd>{left}</kbd>
                </button>
              ) : (
                // Only the legal range: 1–3 in Classic, 3 4 5 in Handfuls 3–5.
                Array.from({ length: Math.min(rules.maxTake, 9) - min + 1 }, (_, i) => i + min).map((n) => (
                  <button key={n} type="button" className={styles.takeButton} data-take={n} onClick={onTakeButton} disabled={!myTurn || n > left}>
                    Take {n}
                    <kbd>{n}</kbd>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className={styles.quick} role="group" aria-label="Choose a row">
              {game.rows.map((n, r) =>
                n > 0 ? (
                  <button
                    key={r}
                    type="button"
                    className={styles.rowButton}
                    aria-pressed={focusRow === r}
                    onClick={() => {
                      setFocusRow(r);
                      setSelected([]);
                    }}
                    disabled={!myTurn}
                  >
                    Row {r + 1} · {n}
                  </button>
                ) : null,
              )}
            </div>
          )}
          <button
            type="button"
            className={styles.strike}
            onClick={() => strike()}
            disabled={!myTurn || selected.length === 0}
            data-nudge={nudge ? nudge % 2 : undefined}
          >
            {handfuls ? (
              <>
                <span>{selected.length ? `${sweepNow ? "Sweep" : "Strike"} ${selected.length}` : sweepNow ? "Sweep time" : "Pick a handful"}</span>
                <small>
                  {sweepNow
                    ? `all ${left} go at once · press ${left}`
                    : selected.length === 0
                      ? `click sticks or press ${min}–${Math.min(9, rules.maxTake)}`
                      : selected.length < floorNow
                        ? `${floorNow - selected.length} more to make a handful`
                        : `${selected.length} of ${min}–${limitNow}`}
                </small>
              </>
            ) : (
              <>
                <span>{selected.length ? `Strike ${selected.length}` : single ? "Pick sticks" : "Pick from one row"}</span>
                <small>{selected.length ? `${selected.length} of ${limitNow} max` : `click sticks or press 1–${Math.min(9, rules.maxTake === Infinity ? 9 : rules.maxTake)}`}</small>
              </>
            )}
          </button>
          {!versus && (
            <button type="button" className={styles.hint} onClick={nextHint} disabled={!myTurn}>
              💡 Hint <kbd>H</kbd>
            </button>
          )}
        </div>
      )}

      {result && (
        <div className={styles.result} role="dialog" aria-label="Game over">
          <div className={styles.resultCard} data-won={result.youWon || undefined}>
            {!versus && <Sparky mood={result.youWon ? "sad" : "happy"} skin={skin} size={96} />}
            <h2 className={styles.resultTitle}>
              {versus ? `${PLAYER_NAMES[1 - result.loser]} wins!` : result.youWon ? "You win!" : "Burnt!"}
            </h2>
            <p className={styles.resultSub}>
              {result.sweep && result.sweep.count > 1 ? (
                <SweepLine who={versus ? PLAYER_NAMES[result.loser] : result.youWon ? "Sparky" : "You"} sweep={result.sweep} />
              ) : versus ? (
                `${PLAYER_NAMES[result.loser]} took the last stick.`
              ) : result.youWon ? (
                "Sparky had to take the last stick."
              ) : (
                "You took the last stick."
              )}
            </p>
            {result.stars > 0 && (
              <p className={styles.stars} aria-label={`${result.stars} of 3 stars`}>
                {"★".repeat(result.stars)}
                <span>{"★".repeat(3 - result.stars)}</span>
              </p>
            )}
            {result.moves.length > 0 && (
              <p className={styles.moveRow} aria-label="Your moves: green is perfect, red gave the win away, grey had no winning option">
                {result.moves.map((q) => QUALITY_EMOJI[q]).join("")}
              </p>
            )}
            {result.keyMoment && <p className={styles.keyMoment}>{result.keyMoment}</p>}
            {result.unlocked.length > 0 && (
              <ul className={styles.unlocked}>
                {result.unlocked.map((id) => {
                  const a = ACHIEVEMENTS.find((x) => x.id === id);
                  return a ? (
                    <li key={id}>
                      <span aria-hidden>{a.icon}</span> Unlocked: <strong>{a.name}</strong>
                    </li>
                  ) : null;
                })}
              </ul>
            )}
            <div className={styles.resultActions}>
              <button type="button" className={styles.primary} onClick={onRematch}>
                {session.daily ? "Play again (practice)" : "Rematch"} <kbd>R</kbd>
              </button>
              {onNext && result.youWon && (
                <button type="button" className={styles.primary} onClick={onNext}>
                  Next table →
                </button>
              )}
              {result.share && <ShareButton text={result.share} />}
              <button type="button" className={styles.secondary} onClick={onExit}>
                Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.secondary}
      onClick={async () => {
        const full = `${text}\n${window.location.origin}/stickler`;
        try {
          if (navigator.share) await navigator.share({ text: full });
          else await navigator.clipboard.writeText(full);
          setCopied(true);
        } catch {
          // The share sheet was dismissed; nothing to do.
        }
      }}
    >
      {copied ? "Copied!" : "Share result"}
    </button>
  );
}

/** "Sparky had to sweep 3." The count is the headline of a Handfuls ending. */
function SweepLine({ who, sweep }: { who: string; sweep: { count: number; forced: boolean } }) {
  return (
    <>
      <span className={styles.sweepTag} aria-hidden>
        🧹
      </span>{" "}
      {sweep.forced ? `${who} had to sweep ` : `${who} swept the last `}
      <strong>{sweep.count}</strong>.
    </>
  );
}

/**
 * The last stick goes up: flames for matches, a neon blow-out, or a sprinkle explosion.
 * A Handfuls sweep of `count` sticks scales the flare, the embers and their reach.
 */
function Fwoosh({ skin, count = 1 }: { skin: Skin; count?: number }) {
  const n = Math.min(70, 28 + 10 * (count - 1));
  const bits = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ a: (i / n) * 360 + (i % 3) * 7, d: 90 + ((i * 37) % 120), s: 0.6 + ((i * 13) % 10) / 10 })),
    [n],
  );
  const scale = count > 1 ? ({ "--flare": 1.6 + 0.22 * (count - 1), "--reach": 1 + 0.12 * (count - 1) } as React.CSSProperties) : undefined;
  return (
    <div className={`${styles.fwoosh} ${styles[`fw_${skin}`]}`} style={scale} aria-hidden>
      <span className={styles.flash} />
      {bits.map((b, i) => (
        <span key={i} className={styles.ember} data-extra={i >= 28 || undefined} style={{ "--a": `${b.a}deg`, "--d": `${b.d}px`, "--s": b.s } as React.CSSProperties} />
      ))}
      <span className={styles.soot} />
    </div>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ x: (i * 53) % 100, delay: (i % 9) * 60, hue: (i * 47) % 360, r: (i * 71) % 360 })), []);
  return (
    <div className={styles.confetti} aria-hidden>
      {bits.map((b, i) => (
        <span key={i} style={{ left: `${b.x}%`, animationDelay: `${b.delay}ms`, background: `hsl(${b.hue} 90% 60%)`, "--r": `${b.r}deg` } as React.CSSProperties} />
      ))}
    </div>
  );
}
