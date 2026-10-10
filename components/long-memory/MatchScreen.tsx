"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Results } from "@/components/kit/Results";
import { ShareButton } from "@/components/kit/ShareButton";
import { usePlayScreen } from "@/components/kit/shell-context";
import { localDateKey } from "@/lib/kit/daily";
import { isFreeKey } from "@/lib/kit/keys";
import { afterDaily, afterMatch, storyOf } from "@/lib/long-memory/awards";
import { pitsOf, type Side } from "@/lib/long-memory/board";
import type { DailyPuzzle } from "@/lib/long-memory/daily";
import { learnerMove, lessonsInPlay } from "@/lib/long-memory/learner";
import { isOver, legalPits, play, resultOf, seatToMove, startMatch, undo, undoAllowed, type Match, type MatchConfig } from "@/lib/long-memory/match";
import { currentMind, getProgress, keepMind, updateProgress, useProgress } from "@/lib/long-memory/progress";
import { RULES, type MoveOutcome } from "@/lib/long-memory/rules";
import { dailyShare, goalLine } from "@/lib/long-memory/share";
import { ask, askPit } from "./ai";
import { useCheat } from "./cheat";
import { BoardHud } from "./hud/BoardHud";
import { BookIcon, UndoIcon } from "./icons";
import { MemoryBook, pageEntries } from "./MemoryBook";
import { PitLayer } from "./PitLayer";
import { RulesCard } from "./RulesCard";
import { REMEMBER_TIMING } from "./scene/memory";
import { lift, pageTurn, remember, seedImpact } from "./sound";
import type { BoardState } from "./useBoardScene";
import styles from "./MatchScreen.module.css";

/*
 * A game on the carved board. The match (lib/long-memory/match.ts) says what
 * is legal and what happened; this screen takes the player's pit (a click,
 * a key, or seeds carried by hand), asks the opponent for theirs, and has
 * the board act each move out before the next one starts. The Daily Endgame
 * is the same screen with a set position, a defender that never errs, and a
 * goal to reach.
 */

type Phase = "ready" | "moving" | "thinking" | "over";
type Carry = { pit: number; outcome: MoveOutcome; dropped: number };
type DailyEnd = { solved: boolean; moves: number; share: string; why: string };

type Props = {
  config: MatchConfig;
  board: BoardState;
  onMenu: () => void;
  onAgain: () => void;
  daily?: DailyPuzzle;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const SEAT_NAMES = {
  learner: "The Learner",
  scholar: "The Scholar",
  friend: "Player 2",
} as const;

export function MatchScreen({ config, board, onMenu, onAgain, daily }: Props) {
  const progress = useProgress();
  const settings = progress.settings;
  const handle = board.handle;
  const [match, setMatch] = useState<Match>(() => startMatch(config, daily?.position));
  const [phase, setPhase] = useState<Phase>("ready");
  const [paused, setPaused] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [carrying, setCarrying] = useState(false);
  const [book, setBook] = useState(false);
  const [rulesCard, setRulesCard] = useState(() => !daily && !getProgress().seenRules.includes(config.rules));
  const [notice, setNotice] = useState<{ text: string; tone: "store" | "capture" } | null>(null);
  const [remembering, setRemembering] = useState<{ pit: number; lesson: number; learned: string } | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [dailyEnd, setDailyEnd] = useState<DailyEnd | null>(null);
  const cheat = useCheat();
  const [hint, setHint] = useState<{ match: Match; pit: number } | null>(null);
  const matchRef = useRef(match);
  const carry = useRef<Carry | null>(null);
  const pausedRef = useRef(paused);
  const mounted = useRef(true);
  const remembered = useRef(false);
  /** The position the opponent is already thinking about, so a re-render never starts a second thought. */
  const thinkingFor = useRef<Match | null>(null);

  const names: Record<Side, string> = { south: config.opponent === "friend" ? "Player 1" : "You", north: daily ? "The defence" : SEAT_NAMES[config.opponent] };
  const seat = seatToMove(match);
  const humanTurn = phase === "ready" && !isOver(match) && (seat === "player" || seat === "friend") && !paused && !rulesCard && !book;
  const movable = useMemo(() => (humanTurn ? legalPits(match) : []), [humanTurn, match]);
  const canUndo = !daily && undoAllowed(match);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // A fresh board for a fresh game; the marks and the book go with the screen.
  useEffect(() => {
    mounted.current = true;
    const scene = handle.scene;
    scene?.remember(null);
    scene?.setBoard(matchRef.current.position.board, `match/${config.rules}/${Date.now()}`);
    // The board is only heard during play; the game menu's board plays itself in silence.
    scene?.listen((impact) => seedImpact(impact.speed, impact.withWood, impact.seed.hole));
    return () => {
      mounted.current = false;
      scene?.setMarks({});
      scene?.remember(null);
      scene?.listen(null);
    };
  }, [config.rules, handle]);

  /** Waits out a pause: nothing moves while the pause menu is open. */
  const whilePaused = async () => {
    while (pausedRef.current && mounted.current) await wait(120);
  };

  /* ---------- After a move ---------- */

  const finishGame = (next: Match) => {
    setPhase("over");
    const mind = config.opponent === "learner" ? currentMind(getProgress()) : null;
    const story = storyOf(next, remembered.current);
    let learned = null;
    const ids = updateProgress((p) => {
      const after = afterMatch(p, next, story, mind, localDateKey());
      learned = after.mind;
      return after.progress;
    });
    if (learned) keepMind(learned);
    setUnlocked(ids);
  };

  /** After every daily move: is the goal reached, or out of reach? */
  const judgeDaily = async (next: Match, puzzle: DailyPuzzle) => {
    const yours = next.played.filter((m) => m.side === "south").length;
    const goal = puzzle.goal;
    const finish = (solved: boolean, why: string) => {
      const share = dailyShare(puzzle, { solved, moves: yours, tries: (getProgress().daily[puzzle.key]?.tries ?? 0) + 1 });
      setDailyEnd({ solved, moves: yours, share, why });
      setPhase("over");
      setUnlocked(updateProgress((p) => afterDaily(p, puzzle.key, solved, share)));
    };
    if (next.position.over) {
      const result = resultOf(next);
      const margin = result.you - result.them;
      if (goal.kind === "win") return finish(margin > 0 && yours <= goal.moves, margin > 0 ? `You won with ${yours} of your ${goal.moves} sowings.` : "The game ended without you ahead.");
      return finish(margin >= goal.seeds, `You finished ${margin} ahead; the goal was ${goal.seeds}.`);
    }
    if (next.position.toMove === "south") {
      if (goal.kind === "win" && yours >= goal.moves) return finish(false, `Your ${goal.moves} sowings are used up.`);
      const answer = (await ask({ kind: "reach", rules: puzzle.rules, position: next.position, goal: goal.kind })) as { value: number };
      const lost = goal.kind === "win" ? answer.value > goal.moves - yours : answer.value < goal.seeds;
      if (lost) return finish(false, goal.kind === "win" ? "From here the defence can always hold you off. The first move is the one to find." : `From here the best you can force is ${answer.value}.`);
    }
    setPhase("ready");
  };

  const settle = async (next: Match, outcome: MoveOutcome) => {
    setMatch(next);
    matchRef.current = next;
    if (outcome.captures.length) setNotice({ text: `+${outcome.captures[0].seeds}`, tone: "capture" });
    else if (outcome.extraTurn) setNotice({ text: "Another move", tone: "store" });
    else setNotice(null);
    if (daily) await judgeDaily(next, daily);
    else if (next.position.over) finishGame(next);
    else setPhase("ready");
  };

  const perform = async (pit: number) => {
    const current = matchRef.current;
    if (!legalPits(current).includes(pit)) return;
    const { match: next, outcome } = play(current, pit);
    setPhase("moving");
    setHover(null);
    lift();
    await handle.scene?.animate(outcome, settings.speed, board.reduced);
    if (!mounted.current) return;
    await settle(next, outcome);
  };

  const takeBack = () => {
    const back = undo(matchRef.current);
    setMatch(back);
    matchRef.current = back;
    handle.scene?.setBoard(back.position.board, `undo/${back.played.length}/${Date.now()}`);
    setNotice(null);
  };

  /* ---------- The opponent ---------- */

  const opponentMove = async (m: Match) => {
    setPhase("thinking");
    const started = performance.now();
    const who = seatToMove(m);
    let pit: number;
    if (who === "learner") {
      const mind = currentMind(getProgress());
      const reading = lessonsInPlay(mind, m.game);
      const { choice, mind: after } = learnerMove(m.position.board, m.game, mind);
      keepMind(after);
      pit = choice.pit;
      const warning = choice.avoided?.lessons[0];
      if (choice.avoided && warning !== undefined) {
        remembered.current = true;
        const pages = pageEntries(mind.lessons, warning);
        handle.scene?.setPages(pages.entries, pages.glowing);
        handle.scene?.remember({ avoided: choice.avoided.pit, path: RULES.awari1978.play(m.position, choice.avoided.pit).path });
        setRemembering({ pit: choice.avoided.pit, lesson: warning + 1, learned: mind.lessons[warning].learned });
        pageTurn();
        window.setTimeout(remember, 900);
        await wait(board.reduced ? 1600 : (REMEMBER_TIMING.fadeOut + 0.3) * 1000);
        setRemembering(null);
        handle.scene?.remember(null);
      } else if (reading.length) {
        // It reads its book, but nothing in it tells against any move.
        const pages = pageEntries(mind.lessons, reading[0].i);
        handle.scene?.setPages(pages.entries, null);
        handle.scene?.remember({ avoided: null, path: [] });
        pageTurn();
        await wait(1500);
        handle.scene?.remember(null);
      }
    } else if (daily) {
      pit = await askPit({ kind: "defend", rules: daily.rules, position: m.position, goal: daily.goal.kind });
    } else {
      pit = await askPit({ kind: "scholar", rules: config.rules, position: m.position, level: config.level, seed: `scholar/${m.played.length}/${Date.now()}` });
    }
    const left = (who === "scholar" ? 650 : 500) - (performance.now() - started);
    if (left > 0) await wait(left);
    await whilePaused();
    if (!mounted.current) return;
    await perform(pit);
  };

  const onOpponentTurn = useEffectEvent((m: Match) => {
    void opponentMove(m);
  });

  useEffect(() => {
    if (phase !== "ready" || isOver(match) || paused || rulesCard) return;
    if (seat !== "learner" && seat !== "scholar") return;
    if (thinkingFor.current === match) return;
    thinkingFor.current = match;
    onOpponentTurn(match);
  }, [match, paused, phase, rulesCard, seat]);

  /* ---------- The player's input ---------- */

  const sow = (pit: number) => {
    if (!humanTurn || !movable.includes(pit)) return;
    void perform(pit);
  };

  const dragStart = (pit: number, x: number, y: number) => {
    const s = handle.scene;
    if (!s || !humanTurn || !movable.includes(pit) || board.reduced) return false;
    carry.current = { pit, outcome: RULES[config.rules].play(matchRef.current.position, pit), dropped: 0 };
    s.pickUp(pit);
    s.carryTo(x, y);
    lift();
    setCarrying(true);
    setPhase("moving");
    return true;
  };

  const dragMove = (x: number, y: number) => {
    const held = carry.current;
    const s = handle.scene;
    if (!held || !s) return;
    s.carryTo(x, y);
    const expected = held.outcome.path[held.dropped];
    if (expected !== undefined && s.holeAt(x, y) === expected && s.dropOne(expected)) held.dropped += 1;
  };

  const dragEnd = async (x: number, y: number) => {
    const held = carry.current;
    const s = handle.scene;
    carry.current = null;
    setCarrying(false);
    if (!held || !s) return;
    if (held.dropped === 0 && s.holeAt(x, y) === held.pit) {
      // Put back where they came from: no move made.
      s.putBack(held.pit);
      await wait(400);
      setPhase("ready");
      return;
    }
    const { match: next, outcome } = play(matchRef.current, held.pit);
    await s.sowRest(held.outcome.path.slice(held.dropped), settings.speed);
    await s.finishHandMove(outcome);
    await settle(next, outcome);
  };

  // Keys: 1–6 sow the mover's pits from left to right as seen; arrows choose; Space skips; Z undoes; B opens the book.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (paused || book || rulesCard || event.repeat) return;
    const m = matchRef.current;
    const onScreen = m.position.toMove === "south" ? pitsOf("south") : [...pitsOf("north")].reverse();
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 6 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (humanTurn) sow(onScreen[digit - 1]);
      return;
    }
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && humanTurn) {
      event.preventDefault();
      const choices = onScreen.filter((p) => movable.includes(p));
      if (!choices.length) return;
      const at = focus === null ? -1 : choices.indexOf(focus);
      setFocus(event.key === "ArrowRight" ? choices[(at + 1) % choices.length] : choices[(at - 1 + choices.length) % choices.length]);
      return;
    }
    if (event.key === "Enter" && humanTurn && focus !== null && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      sow(focus);
      return;
    }
    if (event.key === " " && (phase === "moving" || phase === "thinking") && !carrying) {
      event.preventDefault();
      handle.scene?.skip();
      return;
    }
    if (isFreeKey(event, "z") && canUndo && humanTurn) {
      event.preventDefault();
      takeBack();
      return;
    }
    if (isFreeKey(event, "b") && config.opponent === "learner" && !daily) {
      event.preventDefault();
      setBook(true);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  /* ---------- The hidden help (cheat.ts) ---------- */

  useEffect(() => {
    if (!cheat || !humanTurn) return;
    let live = true;
    const request = daily
      ? ({ kind: "hint", rules: daily.rules, position: match.position, goal: daily.goal.kind } as const)
      : ({ kind: "hint", rules: config.rules, position: match.position } as const);
    void askPit(request).then((pit) => {
      if (live) setHint({ match, pit });
    });
    return () => {
      live = false;
    };
  }, [cheat, config.rules, daily, humanTurn, match]);

  const suggested = cheat && humanTurn && hint?.match === match ? hint.pit : null;

  /* ---------- Marks on the board ---------- */

  const pointed = hover ?? focus;
  useEffect(() => {
    const s = handle.scene;
    if (!s) return;
    let preview = null;
    if (humanTurn && settings.preview && pointed !== null && movable.includes(pointed)) {
      const outcome = RULES[config.rules].play(match.position, pointed);
      const landing = outcome.path.at(-1);
      preview = { path: outcome.path, captures: outcome.captures.flatMap((c) => c.from.filter((h) => h !== landing)), extra: outcome.extraTurn };
    }
    s.setMarks({ preview, hover: humanTurn ? hover : null, focus: humanTurn ? focus : null, choosable: humanTurn ? movable : [], hint: suggested });
  }, [config.rules, focus, handle, hover, humanTurn, match.position, movable, pointed, settings.preview, suggested]);

  /* ---------- The shell ---------- */

  const over = phase === "over";
  usePlayScreen({
    screen: over ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [
      { label: daily ? "Start the endgame again" : "Start this game again", onSelect: onAgain },
      ...(canUndo && humanTurn ? [{ label: "Take back your move", onSelect: () => (setPaused(false), takeBack()), shortcut: "Z" }] : []),
      ...(config.opponent === "learner" && !daily ? [{ label: "Open the Memory Book", onSelect: () => (setPaused(false), setBook(true)), shortcut: "B" }] : []),
    ],
    losesProgress: !over && match.played.length > 0,
    roundName: daily ? "this endgame" : "this game",
    onMenu,
  });

  /* ---------- What the HUD says ---------- */

  const result = over ? resultOf(match) : null;
  const moveNumber = match.played.length + (over ? 0 : 1);
  const chip = daily
    ? { rules: `Daily Endgame #${daily.number} · ${RULES[daily.rules].title}`, opponent: daily.goal.kind === "win" ? `Win in ${daily.goal.moves}` : `Win by ${daily.goal.seeds} or more`, move: moveNumber }
    : { rules: RULES[config.rules].title, opponent: config.opponent === "friend" ? "Two players" : `You vs ${SEAT_NAMES[config.opponent].replace("The ", "the ")}`, move: moveNumber };

  return (
    <>
      <BoardHud
        anchors={board.anchors}
        counts={board.counts}
        match={chip}
        names={names}
        turn={turnLine(match, phase, seat, names, carrying, !!remembering, !!daily)}
        showCounts={settings.counts}
        peek={pointed}
        gain={notice?.tone === "capture" ? { hole: match.played.at(-1)?.side === "north" ? 13 : 6, amount: Number(notice.text.slice(1)) } : null}
        callout={
          remembering && board.anchors
            ? { at: board.anchors.counts[remembering.pit], kicker: "It remembers this", text: `This move lost it the game of ${formatDay(remembering.learned)} · lesson No. ${remembering.lesson}` }
            : null
        }
        notice={notice?.tone === "store" ? notice.text : null}
      />
      <PitLayer
        pits={board.pits}
        counts={board.counts}
        movable={movable}
        names={names}
        focus={focus}
        hint={suggested}
        onFocusPit={setFocus}
        onHover={setHover}
        onSow={sow}
        onDragStart={dragStart}
        onDragMove={dragMove}
        onDragEnd={(x, y) => void dragEnd(x, y)}
      />
      <div className={styles.tools}>
        {config.opponent === "learner" && !daily && (
          <button type="button" className={styles.tool} onClick={() => setBook(true)}>
            <BookIcon size={18} /> Memory Book <kbd>B</kbd>
          </button>
        )}
        {canUndo && (
          <button type="button" className={styles.tool} onClick={takeBack} disabled={!humanTurn}>
            <UndoIcon size={18} /> Take back <kbd>Z</kbd>
          </button>
        )}
      </div>
      {rulesCard && (
        <RulesCard
          rules={config.rules}
          onClose={() => {
            setRulesCard(false);
            updateProgress((p) => ({ ...p, seenRules: [...new Set([...p.seenRules, config.rules])] }));
          }}
        />
      )}
      {book && <MemoryBook progress={progress} onClose={() => setBook(false)} />}
      {over && daily && dailyEnd && (
        <Results
          title={dailyEnd.solved ? `Solved in ${dailyEnd.moves} ${dailyEnd.moves === 1 ? "move" : "moves"}` : "It slipped away"}
          tone={dailyEnd.solved ? "win" : "neutral"}
          kicker={`Daily Endgame #${daily.number} · ${RULES[daily.rules].title} · ${goalLine(daily)}`}
          playAgainLabel={dailyEnd.solved ? "Play it again" : "Try again"}
          onPlayAgain={onAgain}
          onMenu={onMenu}
          unlocked={unlocked.length ? { gameId: "long-memory", ids: unlocked } : undefined}
          extras={dailyEnd.solved ? [{ label: "Share", node: <ShareButton text={dailyEnd.share} label="Share" /> }] : []}
        >
          <p className={styles.summary}>{dailyEnd.why}</p>
        </Results>
      )}
      {over && result && !daily && (
        <Results
          title={resultTitle(result, names)}
          tone={result.winner === "south" ? "win" : result.winner === "north" ? (config.opponent === "friend" ? "neutral" : "loss") : "neutral"}
          kicker={`${RULES[config.rules].title} · ${config.opponent === "friend" ? "two players" : config.opponent === "scholar" ? `the Scholar, ${config.level}` : "the Learner"}`}
          onPlayAgain={onAgain}
          onMenu={onMenu}
          unlocked={unlocked.length ? { gameId: "long-memory", ids: unlocked } : undefined}
          extras={config.opponent === "learner" ? [{ label: "Open the Memory Book", onSelect: () => setBook(true) }] : []}
        >
          <p className={styles.summary}>{resultLine(result, match, names)}</p>
        </Results>
      )}
    </>
  );
}

/* ---------- Words ---------- */

const formatDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
};

function turnLine(match: Match, phase: Phase, seat: ReturnType<typeof seatToMove>, names: Record<Side, string>, carrying: boolean, remembering: boolean, daily: boolean) {
  if (phase === "over") return { who: "player" as const, title: "Game over", detail: "Every seed is where it will stay" };
  if (carrying) return { who: "player" as const, title: "Drop them one by one", detail: "Pass over each next pit in turn · let go to sow the rest" };
  if (seat === "learner") {
    if (remembering) return { who: "learner" as const, title: "The Learner checks its book", detail: "A game it lost began exactly like this one" };
    return { who: "learner" as const, title: phase === "moving" ? "The Learner sows" : "The Learner is thinking", detail: "One move deep, as in 1978" };
  }
  if (seat === "scholar") {
    if (daily) return { who: "learner" as const, title: phase === "moving" ? "The defence sows" : "The defence is thinking", detail: "It never makes a mistake" };
    return { who: "learner" as const, title: phase === "moving" ? "The Scholar sows" : "The Scholar is thinking", detail: "Looking a few moves ahead" };
  }
  const name = seat === "friend" ? names.north : names.south;
  const last = match.played.at(-1);
  const extra = last?.outcome.extraTurn && last.side === match.position.toMove;
  const title = phase === "moving" ? (name === "You" ? "Your seeds are on their way" : `${name}'s seeds are on their way`) : extra ? "Another move" : name === "You" ? "Your move" : `${name}'s move`;
  return { who: "player" as const, title, detail: "Click a pit, press 1–6, or drag the seeds by hand", keys: phase === "ready" };
}

function resultTitle(result: ReturnType<typeof resultOf>, names: Record<Side, string>) {
  const by = Math.abs(result.you - result.them);
  if (result.winner === "draw") return "A draw";
  const winner = result.winner === "south" ? names.south : names.north;
  return winner === "You" ? `You win by ${by}` : `${winner} wins by ${by}`;
}

function resultLine(result: ReturnType<typeof resultOf>, match: Match, names: Record<Side, string>) {
  const stores = `${names.south} ${result.you}, ${names.north.replace("The ", "the ")} ${result.them}.`;
  if (match.config.opponent !== "learner") return stores;
  if (result.winner === "north") return `${stores} A win teaches it nothing: it keeps no record of games it wins.`;
  return `${stores} It has written this game's opening into its book. Try the same trick again and see how long it lasts.`;
}
