"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Keycap } from "@/components/kit/Keycap";
import { ShareButton } from "@/components/kit/ShareButton";
import { useReducedMotion } from "@/components/kit/hooks";
import { usePlayScreen, useShell } from "@/components/kit/shell-context";
import { prefersReducedMotion } from "@/lib/kit/appearance";
import { hasModifier, isFreeKey, isTypingTarget, SHELL_KEYS, whenUnclaimed } from "@/lib/kit/keys";
import { Trek as Engine, type Happening, type TrekConfig } from "@/lib/two-humps/engine";
import type { Leg } from "@/lib/two-humps/expedition";
import { twoHumpsManifest } from "@/lib/two-humps/manifest";
import type { Units } from "@/lib/two-humps/progress";
import { HOURS_PER_TURN, MAX_FATIGUE, type CommandId } from "@/lib/two-humps/rules";
import { dailyShare, PURSUER_NAMES } from "@/lib/two-humps/share";
import { CommandCards, EventCard, RollMeter, RouteStrip, Supplies, type CardDetail } from "./Hud";
import { SeedsIcon } from "./icons";
import { SceneCanvas } from "./SceneCanvas";
import { TrekPlayback } from "./playback";
import { endingClock, endingScene } from "./scene/endings";
import { trekScene } from "./scene/trek";
import { trekSound } from "./sound";
import styles from "./Trek.module.css";

/*
 * The trek: the diorama, the gauges, the six commands, and the camel that
 * sometimes runs on by itself. The engine decides; this screen shows each
 * happening in turn, then waits for the next command.
 */

export type Session =
  | { kind: "crossing"; config: TrekConfig }
  | { kind: "daily"; config: TrekConfig; number: number; key: string; practice: boolean }
  | { kind: "expedition"; config: TrekConfig; leg: Leg; legIndex: number; legs: number }
  | { kind: "tutorial"; config: TrekConfig };

type Props = {
  session: Session;
  units: Units;
  sound: boolean;
  onExit: () => void;
  onAgain: () => void;
  onNextLeg?: () => void;
  /** Called once when the trek ends; returns the keycaps it unlocked. */
  onFinish: (trek: Engine) => string[];
  /** Leaves the tutorial for the pursuer pick. */
  onSkipTutorial?: () => void;
};

type Card = { kicker: string; title: string; body: string; tone?: "good" | "bad" };

const COMMAND_KEYS: Record<string, CommandId> = { "1": "drink", "2": "walk", "3": "gallop", "4": "camp", "5": "scan", "6": "signal" };

const FOSSILS = ["a Protoceratops skull", "a Velociraptor claw", "a clutch of dinosaur eggs"];

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function Trek({ session, units, sound, onExit, onAgain, onNextLeg, onFinish, onSkipTutorial }: Props) {
  const shell = useShell();
  const reduced = useReducedMotion();
  const engine = useMemo(() => new Engine(session.config), [session.config]);
  const s = engine.state;
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [said, setSaid] = useState("");
  const [shake, setShake] = useState<{ command: CommandId; reason: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const [unlocked, setUnlocked] = useState<string[] | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [coachAway, setCoachAway] = useState(false);
  const skipRef = useRef<(() => void) | null>(null);
  const unmounted = useRef(false);
  const soundRef = useRef(trekSound());

  // What the canvas draws, eased towards the engine's numbers every frame.
  const playback = useMemo(() => new TrekPlayback(engine.state), [engine]);
  const hooks = useMemo(() => trekScene(() => playback.view), [playback]);

  useEffect(() => {
    unmounted.current = false;
    const sfx = soundRef.current;
    return () => {
      unmounted.current = true;
      sfx.stop();
    };
  }, []);

  useEffect(() => {
    soundRef.current.setEnabled(sound);
  }, [sound]);

  // The wind drops while the game is paused or over.
  const quiet = paused || s.ending !== null;
  useEffect(() => {
    if (quiet) soundRef.current.wind(0);
  }, [quiet]);

  /** Waits a while, unless the player skips ahead. */
  const pause = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(done, prefersReducedMotion() ? ms * 0.35 : ms);
        function done() {
          window.clearTimeout(timer);
          skipRef.current = null;
          resolve();
        }
        skipRef.current = done;
      }),
    [],
  );

  /* ---------- Showing what happened ---------- */

  const describe = useCallback(
    (h: Happening): { card?: Card; line?: string; ms?: number } => {
      const pursuer = PURSUER_NAMES[s.config.pursuer];
      const unit = (m: number) => distance(m, units);
      switch (h.kind) {
        case "stride":
          return { line: h.onTheRun ? `The camel ran on another ${unit(h.miles)}.` : `You ${h.command === "gallop" ? "galloped" : "walked"} ${unit(h.miles)}.` };
        case "oasis":
          return h.dry
            ? { card: { kicker: "Oasis", title: "Dry", body: "The rival got here first and drank the pool dry. Not a drop left.", tone: "bad" }, ms: 2200 }
            : { card: { kicker: "Oasis", title: "Cold water", body: "A pool under a desert poplar. The canteen is full again, and the camel has eaten and rested a little.", tone: "good" }, ms: 2200 };
        case "gust":
          return h.shift > 0
            ? { card: { kicker: "Wind", title: "A tailwind", body: `A gust carried you ${unit(h.shift)} further on.`, tone: "good" }, ms: 1800 }
            : { card: { kicker: "Wind", title: "A headwind", body: `A gust pushed you ${unit(-h.shift)} back.`, tone: "bad" }, ms: 1800 };
        case "sore":
          return { card: { kicker: "The camel", title: "A sore hump", body: "Your camel is tender today. The next stride will cover half the ground.", tone: "bad" }, ms: 1800 };
        case "singing":
          return { card: { kicker: "Listen", title: "The dunes are singing", body: "A low hum rolls off the slope behind you. Your camel perks up: two extra miles on the next stride.", tone: "good" }, ms: 2400 };
        case "fossil":
          return { card: { kicker: "Field journal", title: "A fossil!", body: `Something pale sticks out of the red sandstone: ${FOSSILS[h.index] ?? "a fossil"}. Into the journal it goes.`, tone: "good" }, ms: 2600 };
        case "caravan":
          return { line: "A dust devil has scattered the packs." };
        case "caravan-chased":
          return { card: h.lucky ? { kicker: "Dust devil", title: "Every pack", body: "You ran them all down and nobody is tired.", tone: "good" } : { kicker: "Dust devil", title: "Found, but worn out", body: "You got everything back, but the chase took two humps of strength from the camel.", tone: "bad" }, ms: 1800 };
        case "caravan-waited":
          return { card: { kicker: "Dust devil", title: "Waited it out", body: `The whirlwind passed and you gathered the packs. ${pursuer} gained a turn.` }, ms: 1800 };
        case "reins":
          return { line: "You pulled the reins." };
        case "drink":
          return { line: `A sip of water. ${h.sips} left.` };
        case "scan": {
          const found = h.revealed.length ? `You spot ${h.revealed.length === 1 ? "an oasis" : "oases"} at mile ${h.revealed.join(" and ")}.` : "No new oasis within 15 miles.";
          const odds = engine.eventOdds();
          const pct = (x: number) => `${Math.round(x * 100)}%`;
          return { card: { kicker: "From a dune top", title: "The way ahead", body: `${found} On this stretch: dunes sing ${pct(odds.singing)}, gusts ${pct(odds.gust)}, sore hump ${pct(odds.sore)}, dust devils ${pct(odds.caravan)} per stride.` }, ms: 3200 };
        }
        case "camp":
          return h.slept
            ? { card: { kicker: "Make camp", title: "Night falls", body: `You light a fire and sleep for ${h.hours} hours. The camel wakes up fresh.` }, ms: 3400 }
            : { card: { kicker: "Make camp", title: "A rest in the shade", body: "Two hours in the shadow of your camel, and it's fresh again." }, ms: 1300 };
        case "signal":
          return h.answered
            ? { card: { kicker: "Signal", title: "Help is here!", body: "Herders saw your signal and rode out with water: three sips, and a rest for the camel.", tone: "good" }, ms: 2200 }
            : { card: { kicker: "Signal", title: "No answer", body: "Nobody saw it. The desert is very big.", tone: "bad" }, ms: 1700 };
        case "seeds":
          return { line: `You toss a handful of seeds. The gang stops to eat. ${h.left} left.` };
        case "thirsty":
          return { line: "You're thirsty. Drink soon." };
        case "rival-drank":
          return { line: `The rival drank the oasis at mile ${h.at} dry.` };
        case "dawn":
          return { line: "Dawn." };
        case "dusk":
          return { line: "Dusk." };
        default:
          return {};
      }
    },
    [engine, s.config.pursuer, units],
  );

  const show = useCallback(
    async (happenings: Happening[]) => {
      const sfx = soundRef.current;
      // A night's sleep plays as a time-lapse: each two hours of it takes a moment.
      let sleeping = false;
      for (const h of happenings) {
        if (unmounted.current) return;
        const { card: next, line, ms } = describe(h);
        if (line) setSaid(line);
        switch (h.kind) {
          case "stride":
            playback.stride(h.command, h.to);
            sfx.footfalls(h.command, Math.max(0.6, h.miles * 0.12));
            await pause(Math.min(1400, 450 + h.miles * 60));
            break;
          case "pursuer":
            playback.pursuerMoved(h.to, h.stopped);
            await pause(sleeping ? 700 : 220);
            break;
          case "camp":
            playback.camp(h.slept ? "night" : "day");
            sleeping = h.slept;
            if (h.slept) sfx.campfire();
            break;
          case "singing":
            playback.singing();
            sfx.singing();
            break;
          case "gust":
            playback.shove(h.shift);
            sfx.gust();
            break;
          case "fossil":
            playback.fossil();
            break;
          case "oasis":
            sfx.water();
            break;
          case "seeds":
            playback.feedGang();
            sfx.squeak();
            break;
          case "caravan":
            sfx.gust();
            break;
        }
        if (next) {
          setCard(next);
          await pause(ms ?? 1600);
          setCard(null);
        }
      }
      playback.settle(s);
      sfx.wind(windLevel(s));
      if (stormClose(s)) sfx.stormHum();
      if (s.ending !== null && unlocked === null) {
        await wait(prefersReducedMotion() ? 300 : 900);
        playback.end(endingClock(s.ending, s.config.pursuer, playback.clock));
        setUnlocked(onFinish(engine));
      }
    },
    [describe, engine, onFinish, pause, playback, s, unlocked],
  );

  const run = useCallback(
    async (action: () => Happening[]) => {
      if (busy || paused || s.phase === "over") return;
      setBusy(true);
      soundRef.current.wind(windLevel(s));
      const happenings = action();
      refresh();
      await show(happenings);
      if (unmounted.current) return;
      setBusy(false);
      refresh();
    },
    [busy, paused, refresh, s, show],
  );

  const lesson = session.kind === "tutorial" ? lessonAt(tutorialStep, s.phase) : null;

  const command = useCallback(
    (id: CommandId) => {
      if (lesson !== null && !lessonAllows(lesson, id)) return;
      const preview = engine.preview(id);
      if (!preview.legal) {
        setShake({ command: id, reason: preview.reason ?? "Not now" });
        window.setTimeout(() => setShake(null), 1400);
        return;
      }
      if (lesson !== null) setTutorialStep(lesson + 1);
      run(() => engine.act(id));
    },
    [engine, lesson, run],
  );

  const letRun = useCallback(() => run(() => engine.letRun()), [engine, run]);
  const reins = useCallback(() => {
    if (lesson === RUN_ON_LESSON) setTutorialStep((step) => Math.max(step, RUN_ON_LESSON + 1));
    run(() => engine.pullReins());
  }, [engine, lesson, run]);
  const caravan = useCallback((choice: "chase" | "wait") => run(() => engine.chooseCaravan(choice)), [engine, run]);
  const seeds = useCallback(() => run(() => engine.tossSeeds()), [engine, run]);

  /* ---------- Dragging the seed sack onto the gang ---------- */

  const stageRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const [seedDrag, setSeedDrag] = useState<{ x: number; y: number; onGang: boolean } | null>(null);
  const startSeedDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const stage = stageRef.current;
    if (!stage || event.button !== 0) return;
    const from = { x: event.clientX, y: event.clientY };
    dragged.current = false;
    // The gang is always behind the camel: anywhere left of it, low on the sand.
    const overGang = (x: number, y: number) => {
      const box = stage.getBoundingClientRect();
      return x - box.left < box.width * 0.5 && y - box.top > box.height * 0.45;
    };
    const move = (e: PointerEvent) => {
      if (!dragged.current && Math.hypot(e.clientX - from.x, e.clientY - from.y) < 8) return;
      dragged.current = true;
      const box = stage.getBoundingClientRect();
      setSeedDrag({ x: e.clientX - box.left, y: e.clientY - box.top, onGang: overGang(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setSeedDrag(null);
      if (dragged.current && overGang(e.clientX, e.clientY)) seeds();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---------- Keys ---------- */

  const over = s.phase === "over" && unlocked !== null;
  // A layout effect, so the listener sees the screen it is on: a key pressed the moment
  // the cards come back must not reach a listener that still thinks the turn is playing.
  useLayoutEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (hasModifier(event) || isTypingTarget(event.target) || event.repeat) return;
      if (over) {
        if (isFreeKey(event, SHELL_KEYS.playAgain)) whenUnclaimed(event, onAgain);
        else if (isFreeKey(event, SHELL_KEYS.hall)) whenUnclaimed(event, shell.toHall);
        return;
      }
      if (paused) return;
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        return setPaused(true);
      }
      if (skipRef.current && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        return skipRef.current();
      }
      if (busy) return;
      if (s.phase === "run-on") {
        if (event.key === " ") {
          event.preventDefault();
          return reins();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          return letRun();
        }
        return;
      }
      if (s.phase === "caravan") {
        if (event.key === "c" || event.key === "C") {
          event.preventDefault();
          return caravan("chase");
        }
        if (event.key === "w" || event.key === "W") {
          event.preventDefault();
          return caravan("wait");
        }
        return;
      }
      if (COMMAND_KEYS[event.key]) {
        event.preventDefault();
        return command(COMMAND_KEYS[event.key]);
      }
      if ((event.key === "s" || event.key === "S") && s.config.pursuer === "gang") {
        event.preventDefault();
        seeds();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, caravan, command, letRun, onAgain, over, paused, reins, s.config.pursuer, s.phase, seeds, shell]);

  const started = s.turn > 0 || s.miles > 0;
  usePlayScreen({
    screen: over ? "results" : "play",
    paused,
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    items: session.kind === "tutorial" ? [] : [{ label: "Start this crossing again", onSelect: onAgain }],
    losesProgress: started && !over && session.kind !== "tutorial",
    roundName: session.kind === "expedition" ? "this leg" : "this crossing",
    onMenu: onExit,
  });

  /* ---------- Drawing the screen ---------- */

  const previews = Object.fromEntries((Object.values(COMMAND_KEYS) as CommandId[]).map((id) => [id, engine.preview(id)]));
  const pursuerName = PURSUER_NAMES[s.config.pursuer];
  const details: Record<string, CardDetail> = {};
  const disabled: Record<string, string | undefined> = {};
  for (const [key, id] of Object.entries(COMMAND_KEYS)) {
    const p = previews[id];
    disabled[key] = s.phase === "choose" && !busy ? (p.legal ? undefined : p.reason) : "Wait";
    // Previews only carry their numbers while a command can be chosen.
    if (s.phase === "choose") details[key] = cardDetail(p, s, units, pursuerName);
  }
  const ending = s.phase === "over" ? s.ending : null;
  const scene = useMemo(() => (ending ? endingScene(ending, s.config.pursuer) : null), [ending, s.config.pursuer]);
  // Only the day's first try is shared; replays are practice.
  const share = session.kind === "daily" && !session.practice && over ? dailyShare(engine, session.number) : null;

  return (
    <div className={styles.trek} data-phase={s.phase} data-paused={paused || undefined} data-storm={(stormClose(s) && !over) || undefined}>
      <div className={styles.stage} ref={stageRef}>
        <SceneCanvas className={styles.canvas} hooks={scene ?? hooks} frame={playback.frame} seed={hashSeed(String(s.config.seed))} label={sceneLabel(s, pursuerName, units)} />
        {/* With reduced motion the world jumps from turn to turn, so each jump is softened by a fade. */}
        {reduced && <div key={`${s.turn}-${s.ending}`} className={styles.fade} aria-hidden />}
        {!over && (
          <button type="button" className={styles.camelHit} onClick={() => s.phase === "run-on" && !busy && reins()} aria-hidden tabIndex={-1} disabled={s.phase !== "run-on"} />
        )}

        <div className={styles.hudTop} hidden={over}>
          <RouteStrip miles={Math.round(s.miles)} pursuer={s.config.pursuer} pursuerAt={Math.round(s.pursuer.at * 10) / 10} oases={s.oases.filter((o) => o.known).map((o) => o.at)} goal={s.goal} units={units} dry={s.oases.filter((o) => o.dry).map((o) => o.at)} />
          <Supplies sips={s.sips} canteen={s.canteen} thirst={Math.max(0, s.thirst)} stamina={MAX_FATIGUE - s.fatigue} clock={(s.config.startClock + s.turn * HOURS_PER_TURN) % 24} noThirst={!!s.config.twist?.noThirst}>
            {s.config.pursuer === "gang" && (
              <button
                type="button"
                className={styles.seeds}
                onPointerDown={startSeedDrag}
                onClick={(event) => {
                  // A drag that ended on the gang has already thrown them.
                  if (event.detail === 0 || !dragged.current) seeds();
                  dragged.current = false;
                }}
                disabled={busy || s.seeds === 0 || s.pursuer.fed || s.phase === "over"}
                aria-keyshortcuts="S"
                title="Click, press S, or drag the sack onto the gang"
              >
                <SeedsIcon size={18} />
                <span>
                  Seeds <strong>{s.seeds}</strong>
                </span>
                <kbd>S</kbd>
              </button>
            )}
          </Supplies>
        </div>

        {seedDrag && (
          <span className={styles.seedGhost} style={{ left: seedDrag.x, top: seedDrag.y }} data-over={seedDrag.onGang || undefined} aria-hidden>
            <SeedsIcon size={28} />
          </span>
        )}

        {session.kind === "expedition" && !over && (
          <p className={styles.legLine}>
            <strong>
              Leg {session.legIndex + 1} of {session.legs} · {session.leg.place}
            </strong>{" "}
            {session.leg.twistLine}
          </p>
        )}

        {card && (
          <div className={styles.cardSpot} data-tone={card.tone}>
            <EventCard kicker={card.kicker} title={card.title}>
              <p>{card.body}</p>
              <p className={styles.skip}>
                <kbd>Enter</kbd> to go on
              </p>
            </EventCard>
          </div>
        )}

        {!busy && s.phase === "run-on" && s.runOn && (
          <div className={styles.rollSpot}>
            <RollMeter chance={engine.runOnChance()} stride={rangeText(engine.strideRange(s.runOn.command), units)} tired={s.runOn.command === "gallop" ? 3 : 1} strides={s.runOn.strides + 1} fatigue={s.fatigue} max={MAX_FATIGUE} onLetRun={letRun} onReins={reins} />
          </div>
        )}

        {!busy && s.phase === "caravan" && (
          <div className={styles.cardSpot}>
            <EventCard
              kicker="Dust devil"
              title="The packs are scattered"
              actions={
                <>
                  <button type="button" className={styles.action} onClick={() => caravan("chase")}>
                    Chase them <kbd>C</kbd>
                  </button>
                  <button type="button" className={`${styles.action} ${styles.primary}`} onClick={() => caravan("wait")}>
                    Wait it out <kbd>W</kbd>
                  </button>
                </>
              }
            >
              <p>A whirlwind tore through the camp and blew your packs across the sand. Chase them: half the time you catch them all, half the time the camel is worn out (two humps). Or wait: always safe, but {pursuerName} gains a turn.</p>
            </EventCard>
          </div>
        )}

        {lesson !== null && !over && !coachAway && !busy && <TutorialCoach lesson={lesson} onSkip={onSkipTutorial} onKeepGoing={() => setCoachAway(true)} />}

        {!over && (
          <div className={styles.hudBottom}>
            <CommandCards details={details} disabled={disabled} shake={shake ?? undefined} onCommand={(key) => command(COMMAND_KEYS[key])} only={lesson !== null ? TUTORIAL[lesson].only : undefined} />
          </div>
        )}

        {over && (
          <Journal
            session={session}
            engine={engine}
            units={units}
            unlocked={unlocked ?? []}
            share={share}
            onAgain={onAgain}
            onMenu={onExit}
            onHall={shell.toHall}
            onNextLeg={onNextLeg}
          />
        )}
      </div>
      <p className={styles.said} aria-live="polite">
        {said}
      </p>
    </div>
  );
}

/* ---------- The journal page that ends a trek ---------- */

type JournalProps = {
  session: Session;
  engine: Engine;
  units: Units;
  unlocked: string[];
  share: string | null;
  onAgain: () => void;
  onMenu: () => void;
  onHall: () => void;
  onNextLeg?: () => void;
};

const ENDINGS: Record<string, (pursuer: string) => { title: string; italic: string; body: string }> = {
  arrived: () => ({ title: "Forty miles", italic: ", and a party.", body: "" }),
  caught: (p) =>
    p === "The Haboob"
      ? { title: "The storm", italic: " caught up.", body: "You sheltered behind your camel while the wall of dust roared past. The trek is over, but you're both fine, if very sandy." }
      : { title: "The gang", italic: " caught up!", body: "They're far too small to lift a camel, so they made porridge instead and asked you to stay for supper. The trek is over." },
  beaten: () => ({ title: "The rival", italic: " got there first.", body: "Captain Bluster threw the party for himself. He did save you some cake." }),
  thirst: () => ({ title: "Too thirsty", italic: " to go on.", body: "Five turns without a sip, and you had to stop in the shade. Herders found you and took you home for tea. Drink when the thirst bar turns red." }),
  collapse: () => ({ title: "The camel", italic: " lay down.", body: "It ran on until it couldn't any more, and it won't get up until it has slept. A herder gave you both a lift home." }),
};

const GUESTS: Record<string, string> = {
  haboob: "The Haboob blew in as a gentle breeze, just in time to blow out the candles.",
  rival: "Captain Bluster arrived an hour later, carrying a gift and a very long story.",
  gang: "The Ladle Gang hopped in a little later, bibs on, ladle in hand, and asked for cake instead of camel.",
};

function Journal({ session, engine, units, unlocked, share, onAgain, onMenu, onHall, onNextLeg }: JournalProps) {
  const s = engine.state;
  const won = s.ending === "arrived";
  const pursuer = PURSUER_NAMES[s.config.pursuer];
  const words = ENDINGS[s.ending ?? "collapse"](pursuer);
  const body = won ? GUESTS[s.config.pursuer] : words.body;
  const level = `${s.config.difficulty[0].toUpperCase()}${s.config.difficulty.slice(1)}`;
  const kicker =
    session.kind === "daily"
      ? `Daily Crossing #${session.number}${session.practice ? " · practice" : ""} · ${pursuer}`
      : session.kind === "expedition"
        ? `Leg ${session.legIndex + 1} of ${session.legs} · ${session.leg.place}`
        : session.kind === "tutorial"
          ? `Tutorial · ${pursuer}`
          : `Crossing · ${pursuer} · ${level}`;
  const lead = s.config.pursuer === "rival" ? `${distance(Math.max(0, s.goal - s.pursuer.at), units, true)}` : distance(Math.max(0, s.miles - s.pursuer.at), units, true);
  const caps = twoHumpsManifest.achievements.filter((a) => unlocked.includes(a.id));
  const lastLeg = session.kind === "expedition" && session.legIndex === session.legs - 1;
  const title = won && session.kind === "expedition" ? (lastLeg ? { title: "Across the Gobi", italic: ", every leg." } : { title: session.leg.place, italic: ", done." }) : words;
  return (
    <div className={styles.journalSpot}>
      <section className={styles.journal} role="dialog" aria-modal="false" aria-label="Results" data-tone={won ? "win" : "loss"}>
        <p className={styles.journalKicker}>{kicker}</p>
        <h2 className={styles.journalTitle}>
          {title.title}
          <em>{title.italic}</em>
        </h2>
        <p className={styles.journalText}>{body}</p>
        {won && session.kind === "expedition" && (
          <div className={styles.journalPage}>
            {session.leg.journal.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
        <dl className={styles.journalStats}>
          <div>
            <dt>Turns</dt>
            <dd>{s.turn}</dd>
          </div>
          <div>
            <dt>{won ? "Distance" : "Got to"}</dt>
            <dd>{distance(s.miles, units, true)}</dd>
          </div>
          <div>
            <dt>Sips left</dt>
            <dd>{s.sips}</dd>
          </div>
          <div>
            <dt>{s.config.pursuer === "rival" ? "Rival to go" : "Lead"}</dt>
            <dd>{lead}</dd>
          </div>
        </dl>
        {caps.length > 0 && (
          <ul className={styles.caps} aria-label="New keycaps">
            {caps.map((a) => (
              <li key={a.id}>
                <Keycap id={`th-${a.id}`} accent={twoHumpsManifest.accent} emblem={twoHumpsManifest.emblem} tier={a.tier} size={44} />
                <span>
                  <strong>{a.title}</strong>
                  <small>{a.hint}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
        {(share || (won && onNextLeg)) && (
          <div className={styles.journalExtras}>
            {won && onNextLeg && (
              <button type="button" className={`${styles.action} ${styles.primary}`} onClick={onNextLeg}>
                Next leg
              </button>
            )}
            {share && <ShareButton text={share} className={styles.action} label="Share" />}
          </div>
        )}
        <div className={styles.journalActions}>
          <button type="button" className={`${styles.action} ${won && onNextLeg ? "" : styles.primary}`} onClick={onAgain} data-autofocus>
            {session.kind === "expedition" ? "Try this leg again" : "Play again"} <kbd>R</kbd>
          </button>
          <button type="button" className={styles.action} onClick={onMenu}>
            Game menu <kbd>Esc</kbd>
          </button>
          <button type="button" className={styles.action} onClick={onHall}>
            Back to the Hall <kbd>H</kbd>
          </button>
        </div>
      </section>
    </div>
  );
}

/* ---------- The tutorial ---------- */

const ALL_COMMANDS = Object.keys(COMMAND_KEYS);

const TUTORIAL: { only: string[]; text: string }[] = [
  { only: ["2"], text: "Forty miles to the ger camp, with a sandstorm somewhere behind you. Walk first: press 2, or click Walk. A walk covers 0 to 9 miles and tires the camel a little." },
  { only: ["1"], text: "Things happen on the way, like that. Now drink: press 1. You can go four turns without a sip, and drinking takes no time at all." },
  { only: ["3"], text: "Gallop: press 3. Up to 18 miles, but it costs three humps of strength. Watch the humps at the top." },
  { only: [], text: "The camel is running on by itself! Every extra stride is free of time and water, but it tires the camel. Press Space, or click the camel, to pull the reins." },
  { only: ["4"], text: "When the camel is tired, make camp: press 4. It rests until it's fresh, and the storm comes a little closer." },
  { only: ALL_COMMANDS, text: "That's the whole game. Carry on to the ger camp if you like, or pick a pursuer for a real crossing." },
];

const RUN_ON_LESSON = 3;

/** Which lesson is showing: the reins lesson lasts as long as the camel runs on; the last one, for good. */
function lessonAt(step: number, phase: string) {
  const last = TUTORIAL.length - 1;
  if (step >= last) return last;
  if (step < RUN_ON_LESSON) return step;
  if (phase === "run-on") return RUN_ON_LESSON;
  return Math.max(step, RUN_ON_LESSON + 1);
}

const lessonAllows = (lesson: number, id: CommandId) => TUTORIAL[lesson].only.some((key) => COMMAND_KEYS[key] === id);

function TutorialCoach({ lesson, onSkip, onKeepGoing }: { lesson: number; onSkip?: () => void; onKeepGoing: () => void }) {
  const last = lesson === TUTORIAL.length - 1;
  return (
    <div className={styles.coach} role="note" aria-live="polite">
      <p className={styles.coachStep}>
        Tutorial · {lesson + 1} of {TUTORIAL.length}
      </p>
      <p>{TUTORIAL[lesson].text}</p>
      <div className={styles.coachActions}>
        {last ? (
          <>
            <button type="button" className={`${styles.action} ${styles.primary}`} onClick={onSkip}>
              Pick a pursuer
            </button>
            <button type="button" className={styles.coachLink} onClick={onKeepGoing}>
              Keep going
            </button>
          </>
        ) : (
          <button type="button" className={styles.coachLink} onClick={onSkip}>
            Skip the tutorial
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Words and numbers ---------- */

const KM_PER_MILE = 1.609344;

export function distance(miles: number, units: Units, short = false) {
  const value = units === "km" ? miles * KM_PER_MILE : miles;
  const rounded = Math.round(value);
  return `${rounded} ${units === "km" ? "km" : short ? "mi" : rounded === 1 ? "mile" : "miles"}`;
}

function rangeText([lo, hi]: [number, number], units: Units) {
  const f = (m: number) => Math.round(units === "km" ? m * KM_PER_MILE : m);
  return `${f(lo)}–${f(hi)} ${units === "km" ? "km" : "mi"}`;
}

function cardDetail(p: ReturnType<Engine["preview"]>, s: Engine["state"], units: Units, pursuer: string): CardDetail {
  const short = s.config.pursuer === "rival" ? "Rival" : pursuer.replace(/^The /, "");
  const gain = p.pursuerGain && p.pursuerGain[1] > 0 ? `${short} +${rangeText(p.pursuerGain, units)}` : undefined;
  switch (p.command) {
    case "drink":
      return { main: `One sip, ${s.sips} left · takes no time` };
    case "walk":
    case "gallop":
      return { main: `${rangeText(p.miles!, units)} · tired ${s.fatigue}→${p.fatigueAfter}`, gain };
    case "camp":
      return { main: p.sleepHours! > HOURS_PER_TURN ? `Sleep ${p.sleepHours} h, till dawn` : "Rest 2 h · camel fresh", gain };
    case "scan":
      return { main: `Costs a sip · oases within ${distance(15, units, true)}` };
    case "signal":
      return { main: `${Math.round((p.help ?? 0) * 100)}% that help comes`, gain };
  }
}

function sceneLabel(s: Engine["state"], pursuer: string, units: Units) {
  return `Mile ${Math.round(s.miles)} of ${s.goal}. ${pursuer} is ${s.config.pursuer === "rival" ? `at mile ${Math.round(s.pursuer.at)}` : `${distance(Math.max(0, s.miles - s.pursuer.at), units)} behind`}.`;
}

function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** How hard the wind blows: a breeze, rising to a gale as the Haboob closes in. */
function windLevel(s: Engine["state"]) {
  if (s.config.pursuer !== "haboob") return 0.12;
  return Math.max(0.12, Math.min(1, 1 - (s.miles - s.pursuer.at) / 16));
}

/** The Haboob within five miles: the sky goes dark, the dunes roar, the gauges shake. */
const stormClose = (s: Engine["state"]) => s.config.pursuer === "haboob" && s.miles - s.pursuer.at < 5;
