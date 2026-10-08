"use client";

import { VT323 } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { newOriginalGame, ORIGINAL_WORLDS, playTurn, verdict, type OriginalGame } from "@/lib/lander/original";
import { updateProgress, withAchievement } from "@/lib/lander/progress";
import { mulberry32 } from "@/lib/kit/rng";
import { basicNumber, COLS, Trs80 } from "./trs80";
import { BackspaceIcon } from "@/components/kit/icons";
import styles from "./Terminal1979.module.css";

const vt = VT323({ weight: "400", subsets: ["latin"] });

/*
 * 1979 mode. The game runs as a little sequential program, the way the
 * original BASIC did: print, wait for a number, work out ten seconds, redraw.
 * The arithmetic is the original's (lib/lander/original.ts), quirks and all;
 * the words, the pictures and the terrain are new.
 */

const LANDER = ["...####...", "..#....#..", "..######..", ".########.", ".#......#.", "##......##"];
const FLAMES = [
  ["....##....", "....##....", ".....#...."],
  ["...####...", "....##....", "....#....."],
  ["....##....", "...#..#...", "....##...."],
];
const ASTRONAUT = [".##.", ".##.", "####", ".##.", ".##.", "#..#"];
const FLAG = [
  ["#######.", "########", "#######."],
  ["######..", "#######.", "########"],
  ["########", "#######.", "######.."],
];
const WRECK = ["..#..##..#..", ".##.####.##.", "############"];

const GROUND_Y = 44;
/** Top of the flat landing area. */
const PAD_TOP = 42;
const LANDER_X = 40;

class Stop extends Error {}

/** Ground heights (pixels above the bottom line) for the six zoom levels, made once per run like the original's. */
function makeTerrain(seed: number) {
  const rng = mulberry32(seed);
  const zones: number[][] = [];
  const specs = [
    { amp: 26, base: 6, cliff: true },
    { amp: 20, base: 8 },
    { amp: 15, base: 6 },
    { amp: 10, base: 4 },
    { amp: 6, base: 2 },
    { amp: 3, base: 1 },
  ];
  for (const spec of specs) {
    const points = Array.from({ length: 12 }, () => rng());
    const h: number[] = [];
    for (let x = 0; x < 128; x++) {
      const p = (x / 127) * 11;
      const i = Math.floor(p);
      const f = p - i;
      const smooth = points[i] + (points[Math.min(11, i + 1)] - points[i]) * f * f * (3 - 2 * f);
      let y = spec.base + smooth * spec.amp + (rng() < 0.3 ? 1 : 0);
      if (spec.cliff && x < 22) y = Math.max(y, 30 - x);
      y = Math.min(spec.cliff && x < 22 ? 28 : 26, y);
      // A flat landing area under the lander.
      if (x >= 32 && x <= 60) y = GROUND_Y - PAD_TOP;
      h.push(Math.round(y));
    }
    zones.push(h);
  }
  return zones;
}

type Pending = { pos: number; prompt: string; max: number; resolve: (s: string) => void };

type Props = { onExit: () => void };

export function Terminal1979({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Pending | null>(null);
  const typedRef = useRef("");
  const [typed, setTyped] = useState("");
  const [waiting, setWaiting] = useState(false);
  // Turn-based: pausing only shows the menu; the program simply waits for its next answer.
  const [paused, setPaused] = useState(false);
  const shell = useShell();

  usePlayScreen({
    screen: "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => {
      setPaused(false);
      inputRef.current?.focus({ preventScroll: true });
    },
    losesProgress: true,
    roundName: "this 1979 flight",
    onMenu: onExit,
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const screen = new Trs80();
    let stopped = false;
    let raf = 0;
    const font = vt.style.fontFamily;

    const paint = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Show what's being typed (and a blinking cursor) on top of the screen.
      const p = pendingRef.current;
      const saved = p ? screen.cells.slice() : null;
      if (p) {
        const cursorOn = Math.floor(now / 400) % 2 === 0;
        screen.print(`${p.prompt}${typedRef.current}${cursorOn ? "_" : " "}`, p.pos);
      }
      screen.draw(ctx, w, h, font, "#e6eeff", "rgba(150,190,255,0.55)");
      if (saved) screen.cells.set(saved);
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);

    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        window.setTimeout(() => (stopped ? reject(new Stop()) : resolve()), ms);
      });

    const input = (pos: number, prompt: string, max = 10) =>
      new Promise<string>((resolve, reject) => {
        if (stopped) return reject(new Stop());
        typedRef.current = "";
        setTyped("");
        setWaiting(true);
        pendingRef.current = {
          pos,
          prompt,
          max,
          resolve: (s) => {
            pendingRef.current = null;
            setWaiting(false);
            screen.print(`${prompt}${s} `, pos);
            if (stopped) reject(new Stop());
            else resolve(s);
          },
        };
        inputRef.current?.focus({ preventScroll: true });
      });

    /** INPUT for a number: text gets BASIC's "?REDO", an empty answer keeps the old value. */
    const inputNumber = async (pos: number, prompt: string, previous: number) => {
      for (;;) {
        const raw = (await input(pos, prompt)).trim();
        if (!raw) return previous;
        if (/^[-+]?(\d+\.?\d*|\.\d+)(E[-+]?\d+)?$/i.test(raw)) return Number(raw);
        screen.clear(pos, COLS - (pos % COLS));
        screen.print("?REDO", pos);
        await sleep(700);
        screen.clear(pos, COLS - (pos % COLS));
      }
    };

    const terrain = makeTerrain(1979 + Math.floor(Math.random() * 1000));

    const drawGround = (zone: number) => {
      // Zones: 1 = under 1 km (closest) … 6 = 100 km and up.
      screen.wipe(0, 18, 128, GROUND_Y - 18 + 1);
      const h = terrain[zone - 1];
      for (let x = 0; x < 128; x++) for (let y = GROUND_Y - h[x]; y <= GROUND_Y; y++) screen.setPixel(x, y);
    };

    const panelBox = () => {
      for (let x = 86; x <= 127; x++) {
        screen.setPixel(x, 0);
        screen.setPixel(x, 17);
      }
      for (let y = 0; y <= 17; y++) {
        screen.setPixel(86, y);
        screen.setPixel(127, y);
      }
    };

    const panel = (g: OriginalGame) => {
      const rows: [string, number][] = [
        ["TIME   ", g.clock],
        ["HEIGHT ", g.alt],
        ["SPEED  ", g.speed],
        ["FUEL   ", g.fuel],
      ];
      rows.forEach(([label, v], i) => {
        const pos = (i + 1) * COLS + 44;
        screen.clear(pos, 19);
        screen.print(`${label}${basicNumber(v)}`.slice(0, 19), pos);
      });
    };

    const zoneFor = (alt: number) => (alt < 1 ? 1 : alt < 10 ? 2 : alt < 25 ? 3 : alt < 50 ? 4 : alt < 100 ? 5 : 6);
    /** In the last kilometre the lander finally moves down the screen, in six steps. */
    const landerTop = (alt: number) => (alt >= 1 ? 3 : alt >= 0.8 ? 9 : alt >= 0.6 ? 18 : alt >= 0.3 ? 24 : alt >= 0.2 ? 30 : alt >= 0.1 ? 33 : 36);

    let landerY = 3;
    const placeLander = (y: number) => {
      screen.wipe(LANDER_X - 4, landerY, 20, 9);
      landerY = y;
      screen.sprite(LANDER, LANDER_X, landerY);
    };

    const flames = async (burn: number, nearGround: boolean) => {
      const times = Math.min(24, Math.round(burn / 5));
      const room = landerY + 9 <= PAD_TOP;
      for (let i = 0; i < times; i++) {
        const f = FLAMES[i % FLAMES.length];
        if (room) screen.sprite(f, LANDER_X, landerY + 6);
        // Close to the ground the exhaust kicks up dust on both sides.
        if (nearGround) for (let k = 0; k < 10; k++) screen.setPixel(LANDER_X - 14 + Math.floor(Math.random() * 38), PAD_TOP - 1 - Math.floor(Math.random() * 3));
        screen.sprite(LANDER, LANDER_X, landerY);
        await sleep(55);
        if (room) screen.sprite(f, LANDER_X, landerY + 6, true);
        if (nearGround) screen.wipe(LANDER_X - 14, PAD_TOP - 3, 38, 3);
        screen.sprite(LANDER, LANDER_X, landerY);
        await sleep(25);
      }
    };

    const endingAnimation = async (speed: number) => {
      const v = verdict(speed);
      screen.wipe(LANDER_X - 4, landerY, 20, 10);
      if (v.animation === "boom") {
        for (let i = 0; i < 8; i++) {
          for (let r = 10; r <= 14; r++) screen.print(String.fromCharCode(149).repeat(18 - (14 - r) * 2), r * COLS + 12 + (14 - r));
          await sleep(90);
          for (let r = 10; r <= 13; r++) screen.clear(r * COLS + 10, 22);
          await sleep(60);
        }
        drawGround(1);
      }
      if (v.animation !== "cheer") {
        screen.sprite(WRECK, LANDER_X - 1, PAD_TOP - 3);
        for (let n = 0; n < 9; n++) {
          for (let k = 0; k < 5; k++) {
            const x = LANDER_X - 6 + Math.floor(Math.random() * 22);
            for (let y = PAD_TOP - 4; y > PAD_TOP - 14; y--) {
              screen.setPixel(x, y);
              await sleep(4);
              screen.setPixel(x, y, false);
            }
          }
        }
        return v;
      }
      screen.print("*** TOUCHDOWN, CAPTAIN! ***", 7 * COLS + 2);
      landerY = PAD_TOP - 6;
      screen.sprite(LANDER, LANDER_X, landerY);
      if (!v.flag) return v;
      await sleep(500);
      screen.sprite(ASTRONAUT, LANDER_X + 11, PAD_TOP - 6);
      for (let y = PAD_TOP - 14; y < PAD_TOP; y++) screen.setPixel(LANDER_X + 18, y);
      for (let i = 0; i < 36; i++) {
        const frame = FLAG[i % FLAG.length];
        screen.wipe(LANDER_X + 19, PAD_TOP - 14, 8, 3);
        screen.sprite(frame, LANDER_X + 19, PAD_TOP - 14);
        await sleep(110);
      }
      return v;
    };

    const program = async () => {
      // Title, in the big 32-column letters.
      screen.cls();
      screen.wide = true;
      screen.print("** DON'T CRATER **", 2 * COLS + 14);
      screen.print("1979 MODE", 4 * COLS + 22);
      // The whole screen stays in big letters until it's cleared, prompt included.
      const wantHelp = await inputNumber(8 * COLS + 8, "INSTRUCTIONS? 1=YES 2=NO ", 0);
      screen.cls();
      screen.wide = true;
      screen.print("WARMING UP THE COMPUTER...", 6 * COLS + 6);
      await sleep(1300);
      if (wantHelp === 1) {
        screen.cls();
        [
          "======= DON'T CRATER : HOW IT WORKS =======",
          "",
          "YOU ARE FLYING A LANDER DOWN TO THE SURFACE. YOUR ONLY",
          "CONTROL IS THE ENGINE. EVERY 10 SECONDS YOU CHOOSE A BURN",
          "RATE FROM 0 TO 100. BIGGER BURNS SLOW YOU DOWN FASTER AND",
          "USE MORE FUEL. NOTHING BELOW ZERO, NOTHING ABOVE 100.",
          "",
          "THERE ARE FOUR WORLDS TO CHOOSE FROM. THE PICTURE CLOSES",
          "IN AS YOU GET LOWER.",
          "",
          "TOUCH DOWN SLOWER THAN 20 KM/H OR THE LANDER WON'T MAKE IT.",
          "A MINUS SPEED MEANS YOU ARE GOING UP. HAPPY LANDINGS.",
        ].forEach((l, i) => screen.print(l, i * COLS));
        await input(13 * COLS, "PRESS ENTER ");
        screen.cls();
        screen.wide = true;
        screen.print("STILL WARMING UP...", 6 * COLS + 12);
        await sleep(1000);
      }

      let clock = 0;
      let lastSpeed = 0;
      for (;;) {
        screen.cls();
        screen.print("*** *** ***  D O N ' T   C R A T E R  *** *** ***", 9);
        screen.print("WHERE TO?  1=EARTH  2=THE MOON  3=MARS  4=AN ASTEROID", 2 * COLS);
        let choice = 0;
        while (choice < 1 || choice > 4) {
          choice = Math.floor(await inputNumber(4 * COLS, "? ", 0));
          if (choice < 1 || choice > 4) screen.clear(4 * COLS, COLS);
        }
        const world = ORIGINAL_WORLDS[choice - 1];
        let game = newOriginalGame(world, clock, lastSpeed);
        screen.cls();
        panelBox();
        screen.print(world.name, 15 * COLS + 44);
        let zone = zoneFor(game.alt);
        drawGround(zone);
        landerY = landerTop(game.alt);
        screen.sprite(LANDER, LANDER_X, landerY);
        let burn = 0;
        let end: { speed: number; clock: number } | null = null;
        while (!end) {
          panel(game);
          const pos = 6 * COLS + 44;
          screen.clear(pos, 20);
          burn = await inputNumber(pos, "BURN? ", burn);
          screen.clear(pos, 20);
          const r = playTurn(game, burn);
          if (r.kind === "illegal") {
            for (let i = 0; i < 6; i++) {
              screen.print("** 0 TO 100 ONLY **", pos);
              await sleep(180);
              screen.clear(pos, 20);
              await sleep(120);
            }
            burn = 0;
            continue;
          }
          await flames(burn, game.alt < 0.1);
          game = r.game;
          if (r.kind === "end") {
            end = r.end;
            break;
          }
          const z = zoneFor(game.alt);
          if (z !== zone) {
            zone = z;
            drawGround(zone);
          }
          const top = landerTop(game.alt);
          if (top !== landerY) placeLander(top);
          else screen.sprite(LANDER, LANDER_X, landerY);
        }

        panel({ ...game, clock: end.clock });
        const speed = end.speed;
        const v = await endingAnimation(speed);
        clock = end.clock;
        lastSpeed = game.lastSpeed;
        if (v.headline.startsWith("YOU'RE DOWN")) {
          updateProgress((p) => {
            let n = withAchievement(p, "time-traveller");
            if (speed > 19 && speed < 20) n = withAchievement(n, "schrodinger");
            return n;
          });
        }
        for (let r = 0; r < 5; r++) screen.clear(r * COLS, 43);
        screen.print(`${v.headline}`.slice(0, 42), 0);
        if (v.detail) screen.print(v.detail.slice(0, 42), COLS);
        screen.print(`IMPACT SPEED =${basicNumber(Math.abs(speed))} KM/H`.slice(0, 42), 2 * COLS);
        screen.print(`TIME =${basicNumber(clock)} SECONDS`.slice(0, 42), 3 * COLS);
        let again = 0;
        while (again !== 1 && again !== 2) {
          screen.clear(4 * COLS, 42);
          again = await inputNumber(4 * COLS, "AGAIN? 1=YES 2=NO ", 0);
        }
        if (again === 2) {
          screen.cls();
          screen.print("READY", 0);
          for (let row = 1; ; row = Math.min(row + 2, 13)) {
            const cmd = (await input(row * COLS, ">", 20)).trim().toUpperCase();
            if (cmd === "RUN") return program();
            screen.print(cmd ? "?SN ERROR" : "", (row + 1) * COLS);
          }
        }
      }
    };

    program().catch((e) => {
      if (!(e instanceof Stop)) throw e;
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      pendingRef.current = null;
    };
  }, []);

  const submit = () => {
    const p = pendingRef.current;
    if (p) p.resolve(typedRef.current);
  };

  const type = (s: string) => {
    const p = pendingRef.current;
    if (!p) return;
    const next = s === "⌫" ? typedRef.current.slice(0, -1) : (typedRef.current + s).slice(0, p.max);
    typedRef.current = next.toUpperCase();
    setTyped(typedRef.current);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={shell.toMenu}>
          Game menu
        </button>
        <p className={styles.note}>
          The original, turn for turn: the same numbers, the same ten-second steps and the same quirks (watch the clock after a second go).
          The pictures and words are new. Type a burn and press Enter; Enter on its own repeats your last burn.
        </p>
      </div>
      <div className={`${styles.crt} ${vt.className}`} onClick={() => inputRef.current?.focus({ preventScroll: true })}>
        <canvas ref={canvasRef} className={styles.screen} role="img" aria-label="A 1979 home computer screen running the lander game" />
        <input
          ref={inputRef}
          className={styles.hidden}
          value={typed}
          inputMode="decimal"
          autoComplete="off"
          aria-label={waiting ? "Type your answer and press Enter" : "Waiting for the computer"}
          onChange={(e) => {
            const p = pendingRef.current;
            if (!p) return;
            typedRef.current = e.target.value.toUpperCase().slice(0, p.max);
            setTyped(typedRef.current);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              // Esc in the typing line still pauses, like everywhere else.
              e.preventDefault();
              setPaused(true);
            }
          }}
        />
      </div>
      <div className={styles.pad} role="group" aria-label="Keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "⌫"].map((k) => (
          <button key={k} type="button" onClick={() => type(k)} disabled={!waiting} aria-label={k === "⌫" ? "Delete" : undefined}>
            {k === "⌫" ? <BackspaceIcon size={20} /> : k}
          </button>
        ))}
        <button type="button" className={styles.enter} onClick={submit} disabled={!waiting}>
          ENTER
        </button>
      </div>
    </div>
  );
}
