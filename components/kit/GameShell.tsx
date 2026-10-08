"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { dismissHint } from "@/lib/kit/keyring";
import { isFreeKey, SHELL_KEYS, whenUnclaimed } from "@/lib/kit/keys";
import { inspiredByLine, type GameManifest } from "@/lib/kit/manifest";
import { BarTools } from "./BarTools";
import { readableOn } from "@/lib/kit/color";
import { Dialog } from "./Dialog";
import { useHydrated, useKeyring } from "./hooks";
import { BackIcon, CloseIcon, PauseIcon } from "./icons";
import { PauseMenu } from "./PauseMenu";
import { SettingsPanel } from "./SettingsPanel";
import { ShellContext, type PlayScreen, type ShellApi } from "./shell-context";
import { Story, type DocTab } from "./Story";
import styles from "./GameShell.module.css";

/*
 * The frame around every game: the top bar, the Play / Story switch, the
 * pause menu, the leave question, and the keys and addresses of the
 * navigation standard (docs/NAVIGATION.md). The game renders its own menu,
 * play screen and results inside, and reports what is on screen with
 * `usePlayScreen`.
 */

type Props = {
  game: GameManifest;
  docs: DocTab[];
  children: React.ReactNode;
  /** The game's own root class: its colour tokens and background. */
  className?: string;
  /** The game's own keys for the shortcuts sheet. */
  shortcuts?: { keys: string; does: string }[];
  /** data-* attributes for the root, for games whose colour tokens hang off one ({ skin: "glow" }). */
  dataset?: Record<string, string>;
  /**
   * False for a game that is all game menu and never starts a round (Bop Box): Esc there only goes back to
   * the Hall, and the round keys (R, H, K) are the game's own.
   */
  rounds?: boolean;
};

type Sheet = "howto" | "settings" | "shortcuts" | null;
type Destination = "menu" | "hall" | "keyring";
type Leave = { to: Destination | "back"; roundName: string } | null;

/* ---------- The address: "" is the game menu, #play a round, #story the docs ---------- */

const HASH_EVENT = "anykey:hash";

function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  window.addEventListener(HASH_EVENT, listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener(HASH_EVENT, listener);
  };
}

const readHash = () => window.location.hash.slice(1);

function writeHash(hash: string, mode: "push" | "replace") {
  const { pathname, search } = window.location;
  const url = hash ? `${pathname}${search}#${hash}` : `${pathname}${search}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(HASH_EVENT));
}

/** What the shell renders from a reported screen; the callbacks stay in a ref and are read when used. */
type ScreenView = { screen: PlayScreen["screen"]; paused: boolean; losesProgress: boolean; items: { label: string; shortcut?: string }[] } | null;

const viewOf = (s: PlayScreen | null): ScreenView =>
  s ? { screen: s.screen, paused: !!s.paused, losesProgress: !!s.losesProgress, items: (s.items ?? []).map(({ label, shortcut }) => ({ label, shortcut })) } : null;

const sameView = (a: ScreenView, b: ScreenView) => JSON.stringify(a) === JSON.stringify(b);

export function GameShell({ game, docs, children, className = "", shortcuts = [], dataset = {}, rounds = true }: Props) {
  const router = useRouter();
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const tab = hash === "story" ? "story" : "play";
  const keyring = useKeyring();
  const hydrated = useHydrated();

  const screenRef = useRef<PlayScreen | null>(null);
  const [view, setView] = useState<ScreenView>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [leave, setLeave] = useState<Leave>(null);
  /** The chapter the Story opens on, when a link elsewhere asked for one. */
  const [storyChapter, setStoryChapter] = useState<string>();
  /** Entries this shell pushed, so leaving can step back instead of piling up history. */
  const pushed = useRef({ play: false, story: false });
  const leaving = useRef(false);

  const phase: "menu" | "play" | "paused" | "results" = !view ? "menu" : view.screen === "results" ? "results" : view.paused ? "paused" : "play";

  const report = useCallback((next: PlayScreen | null) => {
    screenRef.current = next;
    const nextView = viewOf(next);
    setView((old) => (sameView(old, nextView) ? old : nextView));
  }, []);

  /* ---------- Leaving ---------- */

  const goHall = useCallback(() => router.push("/"), [router]);

  const finishLeave = useCallback(
    (to: Destination) => {
      leaving.current = true;
      setLeave(null);
      setSheet(null);
      const current = screenRef.current;
      if (to === "hall") goHall();
      else if (to === "keyring") router.push("/keyring");
      else current?.onMenu();
    },
    [goHall, router],
  );

  const requestLeave = useCallback(
    (to: Destination) => {
      const current = screenRef.current;
      if (current?.losesProgress) {
        current.onPause?.();
        setLeave({ to, roundName: current.roundName ?? "this round" });
      } else finishLeave(to);
    },
    [finishLeave],
  );

  const api = useMemo<ShellApi>(() => ({ tab, report, toHall: () => requestLeave("hall"), toMenu: () => requestLeave("menu") }), [tab, report, requestLeave]);

  /* ---------- Keeping the address in step with the game ---------- */

  const inRound = !!view;
  useEffect(() => {
    if (!hydrated) return;
    const current = readHash();
    if (inRound && current === "") {
      // A round started from the menu: give it its own history entry.
      writeHash("play", "push");
      pushed.current.play = true;
      leaving.current = false;
    } else if (!inRound && current === "play") {
      // The round ended back in the menu: step back over the entry it had.
      if (pushed.current.play) {
        pushed.current.play = false;
        window.history.back();
      } else writeHash("", "replace");
    }
  }, [inRound, hydrated]);

  // Browser Back and Forward.
  useEffect(() => {
    if (!hydrated) return;
    const inRound = !!screenRef.current;
    if (hash === "" && inRound && !leaving.current) {
      const current = screenRef.current!;
      if (current.losesProgress) {
        // Put the round's entry back and ask; the round is still there behind the question.
        writeHash("play", "push");
        pushed.current.play = true;
        current.onPause?.();
        setLeave({ to: "back", roundName: current.roundName ?? "this round" });
      } else {
        pushed.current.play = false;
        leaving.current = true;
        current.onMenu();
      }
    } else if (hash === "play" && !inRound) {
      writeHash("", "replace");
    } else if (hash === "story" && screenRef.current && !screenRef.current.paused && screenRef.current.screen === "play") {
      screenRef.current.onPause?.();
    }
    if (hash !== "story") pushed.current.story = false;
  }, [hash, hydrated]);

  const showTab = useCallback(
    (next: "play" | "story") => {
      if (next === tab) return;
      if (next === "story") {
        writeHash("story", "push");
        pushed.current.story = true;
      } else if (pushed.current.story) {
        pushed.current.story = false;
        window.history.back();
      } else writeHash(screenRef.current ? "play" : "", "replace");
      window.scrollTo({ top: 0 });
    },
    [tab],
  );

  /* ---------- Keys ---------- */

  const hintShown = hydrated && !keyring.hintsDismissed.includes(game.id);

  /*
   * The game stays mounted behind the Story and behind the shell's sheets, so
   * it must not hear the keys meant for them. This listener runs before any
   * other (capture phase, on window) and stops those keys there; Tab still
   * moves focus, and Esc closes whatever is on top.
   */
  useEffect(() => {
    function guard(event: KeyboardEvent) {
      if (event.key === "Tab") return;
      if (leave || sheet) {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          if (leave) setLeave(null);
          else setSheet(null);
        }
      } else if (tab === "story") {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          showTab("play");
        }
      }
    }
    window.addEventListener("keydown", guard, true);
    return () => window.removeEventListener("keydown", guard, true);
  }, [leave, sheet, showTab, tab]);

  useEffect(() => {
    function onEscape() {
      if (hintShown) dismissHint(game.id);
      if (leave) return setLeave(null);
      if (sheet) return setSheet(null);
      if (tab === "story") return showTab("play");
      const current = screenRef.current;
      if (!current) return goHall();
      if (current.screen === "results") return current.onMenu();
      if (current.paused) return current.onResume?.();
      current.onPause?.();
    }

    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      if (isFreeKey(event, "Escape")) whenUnclaimed(event, onEscape);
      else if (leave || sheet) return;
      else if (isFreeKey(event, SHELL_KEYS.shortcuts)) whenUnclaimed(event, () => setSheet("shortcuts"));
      else if (isFreeKey(event, SHELL_KEYS.keyring) && phase !== "play" && !screenRef.current?.losesProgress) whenUnclaimed(event, () => router.push("/keyring"));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game.id, goHall, hintShown, leave, phase, router, sheet, showTab, tab]);

  /* ---------- Render ---------- */

  const accent = game.palette[0];
  // The player's manual (HOW-TO-PLAY.md); until a game has one, the sheet shows its keys.
  const howTo = docs.find((d) => d.id === "howtoplay");

  // The manual links to the other chapters; those open in the Story tab rather than changing the address.
  function followChapterLink(event: React.MouseEvent) {
    const match = (event.target as HTMLElement).closest("a")?.getAttribute("href")?.match(/^#chapter-([a-z]+)/);
    if (!match) return;
    event.preventDefault();
    setSheet(null);
    setStoryChapter(match[1]);
    showTab("story");
  }
  const showPause = tab === "play" && phase === "paused" && !sheet && !leave;

  return (
    <ShellContext.Provider value={api}>
      <div
        className={`${styles.shell} ${className}`}
        {...Object.fromEntries(Object.entries(dataset).map(([key, value]) => [`data-${key}`, value]))}
        data-phase={phase}
        data-tab={tab}
        style={{ "--shell-accent": accent, "--shell-on-accent": readableOn(accent) } as React.CSSProperties}
      >
        <header className={styles.bar}>
          <button type="button" className={styles.back} onClick={() => requestLeave("hall")}>
            <BackIcon size={18} />
            <span className={styles.backLabel}>Back to the Hall</span>
          </button>

          <div className={styles.brand}>
            <span className={styles.title}>{game.title}</span>
            <span className={styles.inspired}>{inspiredByLine(game)}</span>
          </div>

          {hintShown && tab === "play" ? (
            <p className={styles.hint} role="note">
              <kbd>Esc</kbd> {rounds ? "pause and menu" : "back to the Hall"}
              <button type="button" onClick={() => dismissHint(game.id)} aria-label="Dismiss the hint">
                <CloseIcon size={14} />
              </button>
            </p>
          ) : (
            <span aria-hidden />
          )}

          <div className={styles.tabs} role="tablist" aria-label="Sections">
            <button type="button" role="tab" aria-selected={tab === "play"} onClick={() => showTab("play")}>
              Play
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "story"}
              onClick={() => {
                setStoryChapter(undefined);
                showTab("story");
              }}
            >
              Story
            </button>
          </div>

          {(phase === "play" || phase === "paused") && tab === "play" && (
            <button
              type="button"
              className={styles.pause}
              onClick={() => (phase === "paused" ? screenRef.current?.onResume?.() : screenRef.current?.onPause?.())}
              aria-label={phase === "paused" ? "Resume" : "Pause"}
            >
              <PauseIcon size={18} />
              <span>{phase === "paused" ? "Paused" : "Pause"}</span>
              <kbd>Esc</kbd>
            </button>
          )}

          <BarTools
            className={styles.tools}
            onKeyring={(event) => {
              // The Keyring is another page: mid-round it asks first, like every other way out.
              if (!screenRef.current?.losesProgress) return;
              event.preventDefault();
              requestLeave("keyring");
            }}
          />
        </header>

        <div className={styles.play} hidden={tab === "story"}>
          {children}
        </div>
        {tab === "story" && (
          <div className={styles.story}>
            <Story docs={docs} chapter={storyChapter} />
          </div>
        )}

        {showPause && view && (
          <PauseMenu
            gameTitle={game.title}
            items={view.items.map((item, i) => ({ ...item, onSelect: () => screenRef.current?.items?.[i]?.onSelect() }))}
            onResume={() => screenRef.current?.onResume?.()}
            onHowToPlay={() => setSheet("howto")}
            onSettings={() => setSheet("settings")}
            onMenu={() => requestLeave("menu")}
            onHall={() => requestLeave("hall")}
          />
        )}

        {sheet === "howto" && (
          <Dialog title="How to play" kicker={game.title} size="sheet" onClose={() => setSheet(null)}>
            {howTo ? (
              <div className={styles.doc} onClick={followChapterLink} dangerouslySetInnerHTML={{ __html: howTo.html }} />
            ) : (
              <Shortcuts extra={shortcuts} rounds={rounds} />
            )}
          </Dialog>
        )}
        {sheet === "settings" && (
          <Dialog title="Settings" kicker={game.title} size="menu" onClose={() => setSheet(null)}>
            <SettingsPanel />
          </Dialog>
        )}
        {sheet === "shortcuts" && (
          <Dialog title="Shortcuts" kicker={game.title} size="menu" onClose={() => setSheet(null)}>
            <Shortcuts extra={shortcuts} rounds={rounds} />
          </Dialog>
        )}

        {leave && (
          <Dialog title={`Leave ${leave.roundName}?`} size="confirm" role="alertdialog">
            <p className={styles.confirmText}>It hasn&rsquo;t finished, so it won&rsquo;t be saved.</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.stay}
                data-autofocus
                onClick={() => {
                  setLeave(null);
                }}
              >
                Keep playing <kbd>Esc</kbd>
              </button>
              <button type="button" className={styles.leave} onClick={() => finishLeave(leave.to === "back" ? "menu" : leave.to)}>
                Leave
              </button>
            </div>
          </Dialog>
        )}
      </div>
    </ShellContext.Provider>
  );
}

function Shortcuts({ extra, rounds }: { extra: { keys: string; does: string }[]; rounds: boolean }) {
  const shell = rounds
    ? [
        { keys: "Esc", does: "Pause and resume; on the game menu, back to the Hall" },
        { keys: "R", does: "Play again, on the results" },
        { keys: "H", does: "Back to the Hall, on the results" },
        { keys: "K", does: "Open the Keyring from the game menu or the results" },
      ]
    : [{ keys: "Esc", does: "Back to the Hall" }];
  const rows = [...shell, { keys: "?", does: "This list" }, ...extra];
  return (
    <dl className={styles.shortcuts}>
      {rows.map((row) => (
        <div key={row.keys + row.does}>
          <dt>
            <kbd>{row.keys}</kbd>
          </dt>
          <dd>{row.does}</dd>
        </div>
      ))}
    </dl>
  );
}
