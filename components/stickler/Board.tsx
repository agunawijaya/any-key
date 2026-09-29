"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeRules, isLegal, maxTakeFrom, newGame, play, total, type Game, type Move, type Player, type Rules } from "@/lib/stickler/rules";
import { isWinning, magicNumbers, quality, winningMoves, type MoveQuality } from "@/lib/stickler/solver";
import { line, mulberry, sparkyMove, type Level, type LineKind, type Mood } from "@/lib/stickler/sparky";
import { ACHIEVEMENTS, updateProgress, withAchievement, type Skin } from "@/lib/stickler/progress";
import type { ModeId } from "@/lib/stickler/modes";
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
};

const PLAYER_NAMES = ["Player 1", "Player 2"];
const QUALITY_EMOJI: Record<MoveQuality, string> = { best: "🟩", blunder: "🟥", lost: "⬜" };

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
  const [game, setGame] = useState<Game>(() => newGame(rules));
  const [items, setItems] = useState<Item[]>(() => buildItems(rules, seed));
  const [selected, setSelected] = useState<number[]>([]);
  const [anim, setAnim] = useState<Record<number, StickState>>({});
  const [fly, setFly] = useState<Record<number, React.CSSProperties>>({});
  const [bubble, setBubble] = useState<Bubble | null>(() =>
    versus || sparkyOpens ? null : { ...line(rematch ? "rematch" : "hello", mulberry(seed)), key: 0 },
  );
  const [busy, setBusy] = useState(sparkyOpens);
  const [hint, setHint] = useState<{ level: number; text: string; ids: number[] }>({ level: 0, text: "", ids: [] });
  const [result, setResult] = useState<Result | null>(null);
  const [fx, setFx] = useState<"none" | "fwoosh" | "confetti">("none");
  const [taken, setTaken] = useState<[number, number]>([0, 0]);
  const [focusRow, setFocusRow] = useState(() => rules.rows.findIndex((n) => n > 0));

  const timers = useRef<number[]>([]);
  const rng = useRef(mulberry(seed));
  const arenaRef = useRef<HTMLDivElement>(null);
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
      const l = line(kind, rng.current, n);
      setBubble({ ...l, key: Date.now() });
      if (soundRef.current) sfx.voice(l.text, l.mood);
    },
    [versus],
  );

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
          keyMoment = single
            ? `Key moment: with ${total(t.before)} left you took ${t.move.take}, leaving ${left}. Taking ${best.take} would have left ${total(t.before) - best.take}, and Sparky couldn't have won.`
            : `Key moment: move ${slip + 1}. Taking ${best.take} from row ${best.row + 1} would have kept you winning.`;
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
        return next;
      });
      onUnlock(unlocked);
      setResult({ youWon, loser, moves, keyMoment, stars, share, unlocked });
      if (soundRef.current) (youWon ? sfx.win : () => {})();
      if (!versus) say(youWon ? "iLose" : "iWin");
      if (youWon) setFx("confetti");
    },
    [level, onUnlock, rules, say, session.daily, session.mode, session.tableId, single, versus],
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
      if (soundRef.current) sfx.take(skin, move.take);

      const lastStick = after.loser !== null;
      setAnim((a) => ({ ...a, ...Object.fromEntries(ids.map((id) => [id, lastStick && id === ids[ids.length - 1] ? "doomed" : "burning"])) }));
      setGame(after);

      if (lastStick) {
        if (soundRef.current) later(250, () => sfx.fwoosh(skin));
        later(250, () => setFx("fwoosh"));
        later(1500, () => finish(after));
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
    [finish, later, skin, versus],
  );

  const sparkyTurn = useCallback(
    (current: Game) => {
      if (level === null) return;
      setBusy(true);
      say("think");
      const think = 650 + rng.current() * 700 + (isWinning(current.rows, rules) ? 0 : 500);
      later(think, () => {
        const move = sparkyMove(current, level, rng.current);
        const inRow = itemsRef.current.filter((it) => it.row === move.row && !animRef.current[it.id]);
        const ids = inRow.slice(-move.take).map((it) => it.id);
        setAnim((a) => ({ ...a, ...Object.fromEntries(ids.map((id) => [id, "sparky" as StickState])) }));
        later(420, () => {
          const after = play(current, move);
          if (after.loser === null) {
            say("took", move.take);
            // Sparky can tell when you've got him.
            if (isWinning(after.rows, rules) && rng.current() < 0.35) later(900, () => say("inTrouble"));
          }
          perform(1, move, ids);
        });
      });
    },
    [later, level, perform, rules, say],
  );

  useEffect(() => {
    sparkyTurnRef.current = sparkyTurn;
  });

  // ---------- Player input ----------

  const remainingInRow = useCallback((row: number) => items.filter((it) => it.row === row && !anim[it.id]), [anim, items]);

  const protest = useCallback(
    (text?: string) => {
      if (soundRef.current) sfx.protest();
      if (!versus) {
        if (text) setBubble({ text, mood: "cross", key: Date.now() });
        else say("protest");
      }
      if (!protested.current) {
        protested.current = true;
        onUnlock(updateProgress((p) => withAchievement(p, "stickler")));
      }
    },
    [onUnlock, say, versus],
  );

  const myTurn = !busy && !result && game.loser === null && (versus || game.turn === 0);

  function toggle(item: Item) {
    if (!myTurn || anim[item.id]) return;
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
      const limit = maxTakeFrom(gameRef.current.rows, rules, row);
      if (count > limit) {
        protest();
        return;
      }
      setFocusRow(row);
      setSelected(remainingInRow(row).slice(-count).map((it) => it.id));
    },
    [myTurn, protest, remainingInRow, rules],
  );

  const strike = useCallback(
    (ids = selected) => {
      if (!myTurn || ids.length === 0) return;
      const row = items.find((it) => it.id === ids[0])!.row;
      const who = versus ? game.turn : 0;
      const move = { row, take: ids.length };
      if (!versus) {
        const next = play(game, move);
        if (next.loser === null) {
          const q = quality(next.history[next.history.length - 1], rules);
          if (q === "blunder" && rng.current() < 0.6) later(500, () => say("gotGift"));
        }
      }
      perform(who, move, ids);
    },
    [game, items, later, myTurn, perform, rules, say, selected, versus],
  );

  function takeNow(row: number, count: number) {
    const ids = remainingInRow(row).slice(-count).map((it) => it.id);
    if (ids.length === count) strike(ids);
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
      text = "Honest truth: from here a perfect Sparky wins. Leave him lots of choices and hope he slips.";
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

      <div ref={arenaRef} className={`${styles.arena} ${fx === "fwoosh" ? styles.shake : ""}`}>
        <div className={styles.table}>
          <div className={styles.opponent}>
            {versus ? (
              <div className={styles.turnCard} data-player={game.turn}>
                <span className={styles.turnDot} />
                {game.loser === null ? `${PLAYER_NAMES[game.turn]}, your move` : "Game over"}
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

          <div className={styles.sticks} data-single={single || undefined}>
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
                        <Stick skin={skin} color={item.color} state={state} style={{ "--tilt": `${item.tilt}deg`, ...fly[item.id] } as React.CSSProperties} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div ref={myTray} className={`${styles.tray} ${styles.trayMine}`}>
            <span className={styles.trayLabel}>{versus ? PLAYER_NAMES[0] : "You"} took</span>
            <span className={styles.trayCount}>{taken[0]}</span>
          </div>

          {fx === "fwoosh" && <Fwoosh skin={skin} />}
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
          <span className={styles.turn} data-mine={myTurn || undefined}>
            {game.loser === null ? turnName : ""}
          </span>
          {single ? (
            <div className={styles.quick} role="group" aria-label="Take sticks">
              {Array.from({ length: Math.min(rules.maxTake, 9) }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className={styles.takeButton} onClick={() => takeNow(0, n)} disabled={!myTurn || n > left}>
                  Take {n}
                  <kbd>{n}</kbd>
                </button>
              ))}
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
          <button type="button" className={styles.strike} onClick={() => strike()} disabled={!myTurn || selected.length === 0}>
            <span>{selected.length ? `Strike ${selected.length}` : single ? "Pick sticks" : "Pick from one row"}</span>
            <small>{selected.length ? `${selected.length} of ${limitNow} max` : `click sticks or press 1–${Math.min(9, rules.maxTake === Infinity ? 9 : rules.maxTake)}`}</small>
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
              {versus
                ? `${PLAYER_NAMES[result.loser]} took the last stick.`
                : result.youWon
                  ? "Sparky had to take the last stick."
                  : "You took the last stick."}
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

/** The last stick goes up: flames for matches, a neon blow-out, or a sprinkle explosion. */
function Fwoosh({ skin }: { skin: Skin }) {
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ a: (i / 28) * 360 + (i % 3) * 7, d: 90 + ((i * 37) % 120), s: 0.6 + ((i * 13) % 10) / 10 })), []);
  return (
    <div className={`${styles.fwoosh} ${styles[`fw_${skin}`]}`} aria-hidden>
      <span className={styles.flash} />
      {bits.map((b, i) => (
        <span key={i} className={styles.ember} style={{ "--a": `${b.a}deg`, "--d": `${b.d}px`, "--s": b.s } as React.CSSProperties} />
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
