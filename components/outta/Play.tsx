"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShareButton } from "@/components/kit/ShareButton";
import { ShareText } from "@/components/kit/ShareText";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { StarIcon } from "@/components/kit/icons";
import type { ComputerId } from "@/lib/outta/campaign";
import type { Daily } from "@/lib/outta/daily";
import { Game, LETTERS, type Dir } from "@/lib/outta/engine";
import type { Settings } from "@/lib/outta/levels";
import { useProgress } from "@/lib/outta/progress";
import { hasModifier, isTypingTarget } from "@/lib/kit/keys";
import { prefersReducedMotion } from "@/lib/kit/appearance";
import { DARK, drawRoute, LIGHT, paint, WORLDS, type Boom, type Palette } from "./render";
import { CAUSES, fmt, KEY_DIRS, keyOf, playSound } from "./shared";
import { ArrowIcon } from "@/components/kit/icons";
import { Hearts } from "./Hearts";
import styles from "./Play.module.css";

export type Session = {
  kind: "run" | "screen" | "daily";
  title: string;
  settings: Settings;
  seed: number;
  world?: ComputerId;
  screenId?: string;
  daily?: Daily;
  /** A Daily you have already finished today: this one is practice and isn't recorded. */
  practice?: boolean;
};

export type Finish = { chainBest: number; popped: boolean };

type Props = {
  session: Session;
  sound: boolean;
  /** Back to the game menu. */
  onExit: () => void;
  /** Campaign screens only: back to the map of screens. */
  onScreens?: () => void;
  onNewScreen?: () => void;
  onNext?: () => void;
  onFinish: (g: Game, finish: Finish) => void;
};

type Hud = {
  t: number;
  hearts: number;
  bombs: number;
  chain: number;
  rush: number;
  letters: string[];
  hesitation: number;
  state: Game["state"];
  stuck: boolean;
  waiting: boolean;
  cause: string;
};

const hudOf = (g: Game, waiting: boolean, cause: string): Hud => ({
  t: g.t,
  hearts: g.hearts,
  bombs: Math.max(0, g.s.bombsOnScreen - g.bombs.length),
  chain: g.chainCharges,
  rush: g.rushLeft(),
  letters: [...g.collected],
  hesitation: g.hesitation(),
  state: g.state,
  stuck: g.state === "playing" && g.t - g.lastStepAt > 8,
  waiting,
  cause,
});

const paletteFor = (world?: ComputerId): Palette | null => (world ? WORLDS[world] : null);

export function Play({ session, sound, onExit, onScreens, onNewScreen, onNext, onFinish }: Props) {
  const progress = useProgress();
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [over, setOver] = useState<Game | null>(null);
  const shell = useShell();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const heldRef = useRef<{ dir: Dir; since: number } | null>(null);
  const pausedRef = useRef(false);
  /** The clock waits for the first move, so you can study the screen first. */
  const startedRef = useRef(false);
  const soundRef = useRef(sound);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    pausedRef.current = paused;
    soundRef.current = sound;
    finishRef.current = onFinish;
  });

  // One game per session and restart; the loop draws it and runs its clock.
  useEffect(() => {
    const game = new Game(session.settings, session.seed);
    gameRef.current = game;
    startedRef.current = false;
    let cause = "";
    let reported = false;
    const finish: Finish = { chainBest: 0, popped: false };
    const booms: Boom[] = [];
    const reduced = prefersReducedMotion();
    let last = performance.now();
    let lastHud = 0;
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current && startedRef.current) {
        const held = heldRef.current;
        if (held && now - held.since > 180) game.move(held.dir);
        game.update(dt);
        for (const e of game.drainEvents()) {
          if (e.kind === "boom") {
            booms.push({ x: e.x, y: e.y, at: now / 1000, cells: e.cells, chain: e.chain });
            if (e.chain) finish.chainBest = Math.max(finish.chainBest, e.broken);
          }
          if (e.kind === "pop") finish.popped = true;
          if (e.kind === "hit") cause = CAUSES[e.by] ?? "";
          if (soundRef.current) playSound(e);
        }
        while (booms.length && now / 1000 - booms[0].at > 0.5) booms.shift();
      }
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (canvas && wrap) {
        const pal = paletteFor(session.world) ?? (document.documentElement.dataset.theme === "dark" ? DARK : LIGHT);
        paint(canvas, wrap, game, pal, booms, now / 1000, reduced);
      }
      if (game.state !== "playing" && !reported) {
        reported = true;
        finishRef.current(game, finish);
        setOver(game);
      }
      if (now - lastHud > 90) {
        lastHud = now;
        setHud(hudOf(game, !startedRef.current, cause));
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [session, run]);

  const restart = useCallback(() => {
    setPaused(false);
    setOver(null);
    setRun((r) => r + 1);
  }, []);
  const bomb = useCallback(() => {
    startedRef.current = true;
    gameRef.current?.bomb();
  }, []);
  const press = useCallback((dir: Dir) => {
    startedRef.current = true;
    gameRef.current?.move(dir);
    heldRef.current = { dir, since: performance.now() };
  }, []);
  const release = useCallback((dir?: Dir) => {
    if (!dir || heldRef.current?.dir === dir) heldRef.current = null;
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (hasModifier(e) || isTypingTarget(e.target)) return;
      const key = keyOf(e);
      // While the pause menu is open its own keys apply; P still resumes.
      // While the pause menu is open only its shortcuts work: P resumes, R and N start over.
      if (pausedRef.current) {
        if (key === "p") setPaused(false);
        else if (key === "r") restart();
        else if (key === "n" && onNewScreen) onNewScreen();
        return;
      }
      const dir = KEY_DIRS[key];
      if (dir) {
        e.preventDefault();
        if (!e.repeat) press(dir);
        return;
      }
      if (key === " " || key === "b") {
        e.preventDefault();
        if (!e.repeat) bomb();
      } else if (key === "r") {
        e.preventDefault();
        restart();
      } else if (key === "n" && onNewScreen) {
        e.preventDefault();
        onNewScreen();
      } else if (key === "Enter" && over && onNext && over.state === "won") onNext();
      else if (key === "h" && over) {
        e.preventDefault();
        shell.toHall();
      } else if (key === "p") setPaused(true);
    };
    const up = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[keyOf(e)];
      if (dir) release(dir);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [bomb, onNewScreen, onNext, over, press, release, restart, shell]);

  usePlayScreen({
    screen: over ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: [
      { label: "Try again", shortcut: "R", onSelect: restart },
      ...(onNewScreen ? [{ label: "New screen", shortcut: "N", onSelect: onNewScreen }] : []),
      ...(onScreens ? [{ label: "Screens map", onSelect: onScreens }] : []),
    ],
    losesProgress: !!hud && !hud.waiting && !over,
    roundName: "this escape",
    onMenu: onExit,
  });

  const s = session.settings;
  const crash = s.exitMode === "crash";
  const stars = over?.stars() ?? [false, false, false];
  const today = session.daily ? progress.daily[session.daily.key] : undefined;

  return (
    <div className={styles.play} data-world={session.world}>
      <div className={styles.bar}>
        <button type="button" className={styles.tool} onClick={shell.toMenu}>
          Game menu
        </button>
        <div className={styles.titles}>
          <h2 className={styles.title}>{session.title}</h2>
          <p className={styles.blurb}>{s.blurb}</p>
        </div>
        <div className={styles.runTools}>
          <button type="button" className={styles.tool} onClick={restart}>
            Again <kbd>R</kbd>
          </button>
          {onNewScreen && (
            <button type="button" className={styles.tool} onClick={onNewScreen}>
              New screen <kbd>N</kbd>
            </button>
          )}
        </div>
      </div>

      <div className={styles.hud}>
        <span className={styles.stat}>
          <b>{fmt(hud?.t ?? 0)}</b> s <small>/ par {s.par}</small>
        </span>
        <span className={styles.stat} aria-label={`Hearts: ${Number.isFinite(hud?.hearts ?? s.hearts) ? (hud?.hearts ?? s.hearts) : "unlimited"}`}>
          <Hearts count={hud?.hearts ?? s.hearts} />
        </span>
        <span className={styles.stat}>
          Bomb <b>{hud?.bombs ?? s.bombsOnScreen}</b>
        </span>
        <span className={styles.stat} data-on={(hud?.chain ?? 0) > 0}>
          Chain <b>×{hud?.chain ?? 0}</b>
        </span>
        <span className={styles.stat} data-on={(hud?.rush ?? 0) > 0}>
          Rush <b>{Math.ceil(hud?.rush ?? 0)} s</b>
        </span>
        <span className={styles.letters} aria-label={`Letters: ${(hud?.letters ?? []).join("") || "none yet"}`}>
          {LETTERS.map((letter, i) => {
            const got = (hud?.letters ?? []).filter((l) => l === letter).length > LETTERS.slice(0, i).filter((l) => l === letter).length;
            return (
              <span key={i} data-got={got}>
                {letter}
              </span>
            );
          })}
        </span>
        <span className={styles.meter}>
          <span>Hesitation</span>
          <span className={styles.meterTrack} role="meter" aria-label="Hesitation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((hud?.hesitation ?? 0) * 100)}>
            <span className={styles.meterFill} style={{ width: `${Math.round((hud?.hesitation ?? 0) * 100)}%` }} />
          </span>
        </span>
      </div>

      <div className={styles.stage} ref={wrapRef}>
        <canvas ref={canvasRef} className={styles.canvas} data-playing={!!hud && !hud.waiting && !over} aria-label={`The screen. ${crash ? "Get to the cracked corner, bottom left." : "Get to the + on the bottom row."}`} />
        {hud?.stuck && !over && <p className={styles.hint}>Boxed in? Press R to try again.</p>}
        {hud?.waiting && (
          <p className={styles.hint}>
            {crash ? (
              <>
                No exit here. Get to the <b>cracked corner</b>, bottom left: where the 1980 program crashed the computer.
              </>
            ) : (
              <>
                Find your way to the <b>+</b>.
              </>
            )}{" "}
            The clock, the rain and the chasers start with your first move.
          </p>
        )}
        {over && (
          <div className={styles.overlay}>
            <div className={styles.card} data-won={over.state === "won"}>
              <h2>{over.state === "won" ? (crash ? "Crashed it. Out!" : "Outta here!") : "Out of hearts"}</h2>
              {over.state === "lost" && hud?.cause && <p className={styles.cause}>{hud.cause}</p>}
              <div className={styles.stars}>
                {["Got out", `Under ${s.par} s`, "E-S-C-A-P-E"].map((label, i) => (
                  <span key={label} data-got={stars[i]} style={{ "--i": i } as React.CSSProperties}>
                    <StarIcon size={22} filled={stars[i]} className={styles.starIcon} />{" "}
                    {label}
                  </span>
                ))}
              </div>
              <p className={styles.result}>
                {fmt(over.t)} s · {over.steps} steps · {over.broken} glass broken · score {over.score()}
              </p>
              <Route game={over} world={session.world} />
              {session.daily && today && (
                <div className={styles.share}>
                  <p className={styles.shareNote}>{session.practice || run > 0 ? "Practice run: only your first try today counts. Today's result:" : "Today's result:"}</p>
                  <ShareText className={styles.shareText} text={today.share} />
                  <ShareButton text={today.share} label="Copy to share" className={styles.tool} />
                </div>
              )}
              {(onNext || onNewScreen || onScreens) && (
                <div className={styles.actions}>
                  {onNext && over.state === "won" && (
                    <button type="button" className={styles.primary} onClick={onNext}>
                      Next screen <kbd>Enter</kbd>
                    </button>
                  )}
                  {onNewScreen && (
                    <button type="button" className={styles.tool} onClick={onNewScreen}>
                      New screen <kbd>N</kbd>
                    </button>
                  )}
                  {onScreens && (
                    <button type="button" className={styles.tool} onClick={onScreens}>
                      Screens map
                    </button>
                  )}
                </div>
              )}
              <div className={styles.actions} data-standard>
                <button type="button" className={onNext && over.state === "won" ? styles.tool : styles.primary} onClick={restart}>
                  Play again <kbd>R</kbd>
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

      <div className={styles.touch} aria-label="Touch controls">
        <div className={styles.pad}>
          {(["up", "left", "right", "down"] as Dir[]).map((dir) => (
            <button
              key={dir}
              type="button"
              className={styles.padKey}
              data-dir={dir}
              aria-label={dir}
              onPointerDown={() => press(dir)}
              onPointerUp={() => release(dir)}
              onPointerLeave={() => release(dir)}
              onPointerCancel={() => release(dir)}
            >
              <ArrowIcon dir={dir} size={22} />
            </button>
          ))}
        </div>
        <button type="button" className={styles.bombKey} onPointerDown={bomb}>
          Bomb
        </button>
      </div>

      <Legend fuse={s.fuse} />
    </div>
  );
}

/** The result card's little map of the way you went. */
function Route({ game, world }: { game: Game; world?: ComputerId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round((width / game.cols) * game.rows * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRoute(ctx, game, width, paletteFor(world) ?? (document.documentElement.dataset.theme === "dark" ? DARK : LIGHT));
  }, [game, world]);
  return (
    <figure className={styles.route}>
      <canvas ref={ref} aria-label="A map of the way you went" />
      <figcaption>Your route</figcaption>
    </figure>
  );
}

function Legend({ fuse }: { fuse: number }) {
  return (
    <section className={styles.legend} aria-label="How it works">
      <div>
        <h3>Blocks</h3>
        <p>
          <i data-b="wood" /> <b>Wood</b> slides one cell when you walk into it.
        </p>
        <p>
          <i data-b="glass" /> <b>Glass</b> breaks when a bomb goes off next to it.
        </p>
        <p>
          <i data-b="stone" /> <b>Stone</b> stays put. Go round.
        </p>
        <p>Dashed squares are about to land. Stand still too long and they land right next to you.</p>
      </div>
      <div>
        <h3>Bombs and bonuses</h3>
        <p>
          <kbd>Space</kbd> drops a bomb where you stand. It goes off after {fuse} s and breaks the glass all round it. Get clear: it hurts you too.
        </p>
        <p>
          <i data-b="chain" /> <b>Chain ×3</b>: your next three bombs break every glass block touching the ones they break.
        </p>
        <p>
          <i data-b="rush" /> <b>Chain Rush</b>: every bomb chains for 30 s. Bonuses fade 8 s after they land.
        </p>
      </div>
      <div>
        <h3>Chasers</h3>
        <p>
          <i data-e="bouncer" /> <b>Bouncer</b> patrols its own lane. Time your crossing.
        </p>
        <p>
          <i data-e="eraser" /> <b>Eraser</b> follows your trail and wipes it. Keep moving.
        </p>
        <p>
          <i data-e="glitch" /> <b>Glitch</b> hunts you by the shortest way.
        </p>
        <p>A bomb pops a chaser for a few seconds.</p>
      </div>
      <div>
        <h3>Tricks from 1980</h3>
        <p>Walk off the left or right edge: you come back in on the row above or below.</p>
        <p>Walk off the top row: you hide under the keyboard, where nothing can reach you. Walk along it and drop back in.</p>
        <p>
          Grab the letters <b>E S C A P E</b> for the third star, or just get out.
        </p>
        <p>
          Move: arrows, <kbd>WASD</kbd> or <kbd>,</kbd> <kbd>.</kbd> · Pause <kbd>P</kbd>
        </p>
      </div>
    </section>
  );
}
