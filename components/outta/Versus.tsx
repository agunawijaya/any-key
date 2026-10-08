"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { Game, type Dir } from "@/lib/outta/engine";
import { LEVELS, type LevelId } from "@/lib/outta/levels";
import { prefersReducedMotion } from "@/lib/kit/appearance";
import { DARK, LIGHT, paint, type Boom } from "./render";
import { CAUSES, fmt, keyOf, playSound } from "./shared";
import { Hearts } from "./Hearts";
import styles from "./Versus.module.css";

/*
 * Versus: two stars on the same screen, one keyboard. Each player gets their
 * own copy of the screen (same seed, same start), so the rain and the chasers
 * only react to what that player does. First one out wins; get caught and the
 * other one wins.
 */

const PLAYERS = [
  { name: "Player 1", keys: "WASD · bomb Space", dirs: { w: "up", s: "down", a: "left", d: "right" } as Record<string, Dir>, bomb: [" ", "f"] },
  { name: "Player 2", keys: "Arrows · bomb Enter", dirs: { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as Record<string, Dir>, bomb: ["Enter", "/", "0"] },
];

type Side = { t: number; hearts: number; bombs: number; chain: number; state: Game["state"]; cause: string };

export function Versus({ level, sound, onExit }: { level: LevelId; sound: boolean; onExit: () => void }) {
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 99999));
  const [round, setRound] = useState(0);
  const [count, setCount] = useState(3);
  const [sides, setSides] = useState<Side[]>([]);
  const [winner, setWinner] = useState<number | null | "draw">(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const shell = useShell();

  const canvasesRef = useRef<(HTMLCanvasElement | null)[]>([null, null]);
  const wrapsRef = useRef<(HTMLDivElement | null)[]>([null, null]);
  const gamesRef = useRef<Game[]>([]);
  const heldRef = useRef<({ dir: Dir; since: number } | null)[]>([null, null]);
  const goRef = useRef(false);
  const soundRef = useRef(sound);

  useEffect(() => {
    soundRef.current = sound;
    pausedRef.current = paused;
  });

  useEffect(() => {
    const games = [new Game(level, seed), new Game(level, seed)];
    gamesRef.current = games;
    goRef.current = false;
    heldRef.current = [null, null];
    const causes = ["", ""];
    const booms: Boom[][] = [[], []];
    const reduced = prefersReducedMotion();
    const started = performance.now();
    // Time spent paused doesn't count, not even in the countdown.
    let pausedTotal = 0;
    let pausedSince: number | null = null;
    let decided = false;
    let last = started;
    let lastHud = 0;
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (pausedRef.current) pausedSince ??= now;
      else if (pausedSince !== null) {
        pausedTotal += now - pausedSince;
        pausedSince = null;
      }
      const left = 3 - Math.floor(((pausedSince ?? now) - started - pausedTotal) / 800);
      if (!goRef.current && left <= 0) goRef.current = true;
      if (goRef.current && !decided && pausedSince === null) {
        games.forEach((g, i) => {
          const held = heldRef.current[i];
          if (held && now - held.since > 180) g.move(held.dir);
          g.update(dt);
          for (const e of g.drainEvents()) {
            if (e.kind === "boom") booms[i].push({ x: e.x, y: e.y, at: now / 1000, cells: e.cells, chain: e.chain });
            if (e.kind === "hit") causes[i] = CAUSES[e.by] ?? "";
            if (soundRef.current) playSound(e);
          }
          while (booms[i].length && now / 1000 - booms[i][0].at > 0.5) booms[i].shift();
        });
        const won = games.findIndex((g) => g.state === "won");
        const lost = games.map((g) => g.state === "lost");
        if (won >= 0 || lost.some(Boolean)) {
          decided = true;
          setWinner(won >= 0 ? won : lost.every(Boolean) ? "draw" : lost[0] ? 1 : 0);
        }
      }
      const pal = document.documentElement.dataset.theme === "dark" ? DARK : LIGHT;
      games.forEach((g, i) => {
        const canvas = canvasesRef.current[i];
        const wrap = wrapsRef.current[i];
        if (canvas && wrap) paint(canvas, wrap, g, pal, booms[i], now / 1000, reduced);
      });
      if (now - lastHud > 90) {
        lastHud = now;
        setCount(Math.max(0, left));
        setSides(games.map((g, i) => ({ t: g.t, hearts: g.hearts, bombs: Math.max(0, g.s.bombsOnScreen - g.bombs.length), chain: g.chainCharges, state: g.state, cause: causes[i] })));
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [level, seed, round]);

  const rematch = useCallback(() => {
    setWinner(null);
    setPaused(false);
    setRound((r) => r + 1);
  }, []);
  const newScreen = useCallback(() => {
    setWinner(null);
    setPaused(false);
    setSeed(1 + Math.floor(Math.random() * 99999));
  }, []);

  usePlayScreen({
    screen: winner !== null ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [
      { label: "Start again", shortcut: "R", onSelect: rematch },
      { label: "New screen", shortcut: "N", onSelect: newScreen },
    ],
    losesProgress: winner === null,
    roundName: "this race",
    onMenu: onExit,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = keyOf(e);
      if (pausedRef.current) {
        if (key === "r") rematch();
        else if (key === "n") newScreen();
        return;
      }
      if (winner !== null) {
        if (key === "r") rematch();
        else if (key === "n") newScreen();
        else if (key === "h") shell.toHall();
        else return;
        e.preventDefault();
        return;
      }
      PLAYERS.forEach((p, i) => {
        const dir = p.dirs[key];
        const g = gamesRef.current[i];
        if (dir) {
          e.preventDefault();
          if (e.repeat || !goRef.current) return;
          g?.move(dir);
          heldRef.current[i] = { dir, since: performance.now() };
        } else if (p.bomb.includes(key)) {
          e.preventDefault();
          if (!e.repeat && goRef.current) g?.bomb();
        }
      });
    };
    const up = (e: KeyboardEvent) => {
      const key = keyOf(e);
      PLAYERS.forEach((p, i) => {
        if (p.dirs[key] && heldRef.current[i]?.dir === p.dirs[key]) heldRef.current[i] = null;
      });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [newScreen, rematch, shell, winner]);

  return (
    <div className={styles.versus}>
      <div className={styles.bar}>
        <button type="button" className={styles.tool} onClick={shell.toMenu}>
          Game menu
        </button>
        <div className={styles.titles}>
          <h2>Versus · {LEVELS[level].name}</h2>
          <p>Same screen, one copy each. First one out wins. The difficulty is the one picked for Run.</p>
        </div>
        <button type="button" className={styles.tool} onClick={newScreen}>
          New screen <kbd>N</kbd>
        </button>
      </div>

      <div className={styles.boards}>
        {PLAYERS.map((p, i) => {
          const side = sides[i];
          return (
            <section key={p.name} className={styles.board} data-player={i + 1} data-won={winner === i}>
              <header className={styles.side}>
                <strong>{p.name}</strong>
                <span className={styles.keys}>{p.keys}</span>
                <span>{fmt(side?.t ?? 0)} s</span>
                <span aria-label={`Hearts: ${Number.isFinite(side?.hearts ?? 0) ? side?.hearts : "unlimited"}`}>
                  <Hearts count={side?.hearts ?? LEVELS[level].hearts} />
                </span>
                <span>Bomb {side?.bombs ?? 1}</span>
                {(side?.chain ?? 0) > 0 && <span>Chain ×{side?.chain}</span>}
              </header>
              <div
                className={styles.stage}
                ref={(el) => {
                  wrapsRef.current[i] = el;
                }}
              >
                <canvas
                  ref={(el) => {
                    canvasesRef.current[i] = el;
                  }}
                  className={styles.canvas}
                  aria-label={`${p.name}'s screen`}
                />
              </div>
            </section>
          );
        })}
        {count > 0 && winner === null && (
          <div className={styles.count} aria-live="assertive">
            {count}
          </div>
        )}
        {winner !== null && (
          <div className={styles.overlay}>
            <div className={styles.card}>
              <h2>{winner === "draw" ? "Both caught!" : `${PLAYERS[winner].name} is outta here!`}</h2>
              <p>
                {winner === "draw"
                  ? "Nobody got out this time."
                  : sides[winner]?.state === "won"
                    ? `Out in ${fmt(sides[winner]?.t ?? 0)} s.`
                    : `${PLAYERS[winner === 0 ? 1 : 0].name} was caught. ${sides[winner === 0 ? 1 : 0]?.cause ?? ""}`}
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.tool} onClick={newScreen}>
                  New screen <kbd>N</kbd>
                </button>
              </div>
              <div className={styles.actions} data-standard>
                <button type="button" className={styles.primary} onClick={rematch}>
                  Rematch <kbd>R</kbd>
                </button>
                <button type="button" className={styles.tool} onClick={onExit}>
                  Game menu <kbd>Esc</kbd>
                </button>
                <button type="button" className={styles.tool} onClick={shell.toHall}>
                  Back to the Hall <kbd>H</kbd>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
