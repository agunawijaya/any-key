"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { arrange, remixInfo, STYLES, type StyleId } from "@/lib/music/arrange";
import { SOLO_INSTRUMENTS, type SoloInstrumentId } from "@/lib/music/arrange/patches";
import type { Arrangement } from "@/lib/music/arrange/types";
import { BopEngine } from "@/lib/music/engine";
import { loadOriginal, originalFor, originalReady, subscribeOriginal } from "@/lib/music/original";
import { heardToTheEnd, listened } from "@/lib/music/badges";
import { musicManifest } from "@/lib/music/manifest";
import { bopStore, setBopPrefs, useBopPrefs, type BopPrefs } from "@/lib/music/prefs";
import { measureAt, type SongVersion } from "@/lib/music/score";
import { hasFull, mapVersionBeat, songById, songs } from "@/lib/music/songs";
import { barIndexAt, bpmAt, secondsAt } from "@/lib/music/tempo";
import { keyboardRange } from "@/lib/music/timeline";
import { GameShell } from "@/components/kit/GameShell";
import { Keyboard } from "./Keyboard";
import type { DocTab } from "@/components/kit/Story";
import { unlock } from "@/lib/kit/achievements";
import { hasModifier, isTypingTarget } from "@/lib/kit/keys";
import { recordPlay } from "@/lib/kit/stats";
import { InstrumentIcon, StyleIcon } from "./icons";
import { Transport } from "./Transport";
import { AngkaView } from "./views/AngkaView";
import { FallingView } from "./views/FallingView";
import { SheetView } from "./views/SheetView";
import { StageView } from "./views/StageView";
import styles from "./BopBox.module.css";

type ViewId = "sheet" | "falling" | "angka" | "stage";

const VIEWS: { id: ViewId; label: string; hint: string }[] = [
  { id: "sheet", label: "Sheet music", hint: "Not balok" },
  { id: "falling", label: "Falling notes", hint: "Like a piano tutorial" },
  { id: "angka", label: "Numbers", hint: "Not angka" },
  { id: "stage", label: "Stage", hint: "Who plays what" },
];

export type Clock = {
  /** Arrangement beat now playing. */
  beat: () => number;
  /** Beat in the written tune, or null during intros, gaps and endings. */
  songBeat: () => number | null;
  /** Like songBeat, but never null: negative while an intro counts in, the tune's end once it's over. */
  scoreBeat: () => number;
};

const SHORTCUTS = [
  { keys: "Space", does: "Play and pause" },
  { keys: "A–K", does: "Pick a tune" },
  { keys: "1–0  =  -", does: "Pick a style" },
  { keys: "L", does: "1981 excerpt or the full piece" },
  { keys: "V", does: "Switch the view" },
  { keys: "← →", does: "One bar back or forward" },
];

/** Records a listen (or a piece heard to the end) and unlocks what it earned. */
function earn(change: (record: BopPrefs) => { record: BopPrefs; badges: string[] }) {
  const { record, badges } = change(bopStore.get());
  bopStore.set(record);
  unlock(musicManifest.id, badges);
}

const clockText = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Bop Box is all game menu: the studio. Its style colours the whole page, top bar included. */
export function BopBox({ docs }: { docs: DocTab[] }) {
  const [styleId, setStyleId] = useState<StyleId>("orchestra");
  return (
    <GameShell game={musicManifest} docs={docs} className={styles.app} dataset={{ style: styleId }} shortcuts={SHORTCUTS} rounds={false}>
      <Studio styleId={styleId} setStyleId={setStyleId} />
    </GameShell>
  );
}

function Studio({ styleId, setStyleId }: { styleId: StyleId; setStyleId: (id: StyleId) => void }) {
  const [songId, setSongId] = useState("blue");
  const [instrument, setInstrument] = useState<SoloInstrumentId>("piano");
  const [view, setView] = useState<ViewId>("sheet");
  const [loadState, setLoadState] = useState<{ state: "loading" | "ready" | "error"; progress: number }>({ state: "loading", progress: 0 });
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState<Set<string>>(() => new Set());
  const [position, setPosition] = useState(0);

  const prefs = useBopPrefs();
  const version: SongVersion = hasFull(songId) ? prefs.version : "short";
  const song = songById(songId, version);
  // The Original Score's notes load on demand; until they arrive the Orchestra style stands in.
  const score = originalFor(songId);
  const scoreReady = useSyncExternalStore(subscribeOriginal, () => originalReady(songId), () => false);
  const scoreLoading = styleId === "original" && !!score && !scoreReady;
  // A tune without a score (or one still loading) plays the Orchestra style meanwhile.
  const standIn = styleId === "original" && (!score || scoreLoading);
  const playedStyle: StyleId = standIn ? "orchestra" : styleId;
  useEffect(() => {
    if (styleId === "original") void loadOriginal(songId);
  }, [styleId, songId]);
  const arrangement = useMemo(() => arrange(songId, playedStyle, instrument, version), [songId, playedStyle, instrument, version]);
  // How long each version runs in this style, for the switch's labels.
  const lengths = useMemo(() => {
    const seconds = (v: SongVersion) => {
      const a = arrange(songId, playedStyle, instrument, v);
      return secondsAt(a.tempos, a.length);
    };
    return { short: seconds("short"), full: hasFull(songId) ? seconds("full") : null };
  }, [songId, playedStyle, instrument]);
  const range = useMemo<[number, number]>(() => (styleId === "pc81" ? [59, 84] : keyboardRange(arrangement)), [arrangement, styleId]);

  const engineRef = useRef<BopEngine | null>(null);
  const loadedRef = useRef<Arrangement | null>(null);
  const playingRef = useRef(false);
  const arrangementRef = useRef(arrangement);
  const loopRef = useRef(false);

  useEffect(() => {
    arrangementRef.current = arrangement;
    playingRef.current = playing;
  });

  const clock = useMemo<Clock>(
    () => ({
      beat: () => engineRef.current?.beat ?? 0,
      songBeat: () => arrangementRef.current.toSongBeat(engineRef.current?.beat ?? 0),
      scoreBeat: () => {
        const a = arrangementRef.current;
        const beat = engineRef.current?.beat ?? 0;
        const inTune = a.toSongBeat(beat);
        if (inTune !== null) return inTune;
        const start = a.fromSongBeat(0);
        if (beat < start) {
          const groovePerScoreBeat = a.fromSongBeat(1) - start || 1;
          // Wait three beats ahead of the playhead, then glide in so the first note lands on time.
          return Math.max(-3, (beat - start) / groovePerScoreBeat);
        }
        return songById(a.songId, a.version).length;
      },
    }),
    [],
  );

  // The engine lives for the whole visit; the sound bank starts downloading right away.
  useEffect(() => {
    const engine = new BopEngine();
    let disposed = false;
    engineRef.current = engine;
    engine.onEnded = () => {
      setPlaying(false);
      const a = arrangementRef.current;
      recordPlay(musicManifest.id, {});
      if (a.version === "full" && !loopRef.current) earn((record) => heardToTheEnd(record, a.songId));
    };
    engine
      .init((progress) => !disposed && setLoadState({ state: "loading", progress }))
      .then(() => !disposed && setLoadState({ state: "ready", progress: 1 }))
      .catch(() => !disposed && setLoadState({ state: "error", progress: 0 }));
    return () => {
      disposed = true;
      engine.pause();
      void engine.close();
    };
  }, []);

  // Load every new arrangement. Switching style mid-song keeps your place in the tune.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const previous = loadedRef.current;
    let atBeat = 0;
    if (previous && previous.songId === arrangement.songId) {
      const songBeat = previous.toSongBeat(engine.beat);
      if (songBeat !== null) {
        const mapped = mapVersionBeat(arrangement.songId, songBeat, previous.version, arrangement.version);
        atBeat = Math.max(0, arrangement.fromSongBeat(mapped) - 0.02);
      }
    }
    loadedRef.current = arrangement;
    engine.load(arrangement, { atBeat, play: playingRef.current }).catch(() => {
      // A closed engine (the page is going away) has nothing left to load.
    });
  }, [arrangement]);

  useEffect(() => {
    engineRef.current?.setRate(rate);
  }, [rate]);

  useEffect(() => {
    engineRef.current?.setLoop(loop);
    loopRef.current = loop;
  }, [loop]);

  // Whatever plays counts: a new tune or a new style while the music runs is another listen.
  useEffect(() => {
    if (playing) earn((record) => listened(record, arrangement.songId, arrangement.styleId as StyleId));
  }, [playing, arrangement.songId, arrangement.styleId]);

  // A slow clock for text and the scrubber; the visuals run their own animation frames.
  useEffect(() => {
    const id = window.setInterval(() => setPosition(engineRef.current?.beat ?? 0), 120);
    return () => window.clearInterval(id);
  }, []);

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (playingRef.current) {
      engine.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
      await engine.play();
    }
  }, []);

  const seek = useCallback((beat: number) => {
    engineRef.current?.seek(beat);
    setPosition(beat);
  }, []);

  const toggleMute = useCallback((trackId: string) => {
    setMuted((current) => {
      const next = new Set(current);
      if (next.has(trackId)) {
        next.delete(trackId);
        // Muted, then brought back: the band leader's move.
        unlock(musicManifest.id, "band-leader");
      } else next.add(trackId);
      engineRef.current?.setMuted(trackId, next.has(trackId));
      return next;
    });
  }, []);

  const pickSong = useCallback((id: string) => {
    setSongId(id);
    setMuted((current) => {
      current.forEach((trackId) => engineRef.current?.setMuted(trackId, false));
      return new Set();
    });
  }, []);

  // Keyboard: letters pick tunes (like the 1981 menu), digits pick styles, space plays.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (hasModifier(event)) return;
      const target = event.target as HTMLElement;
      if (isTypingTarget(target)) return;
      const key = event.key.toUpperCase();
      // Every key the studio uses is claimed, so the shell's own letters (K for the Keyring) leave it alone.
      const songMatch = songs.find((s) => s.letter === key);
      if (songMatch) {
        event.preventDefault();
        return pickSong(songMatch.id);
      }
      const styleMatch = STYLES.find((s) => s.key === event.key);
      if (styleMatch && !(styleMatch.id === "original" && !originalFor(arrangementRef.current.songId))) {
        event.preventDefault();
        return setStyleId(styleMatch.id);
      }
      if (key === "L") {
        event.preventDefault();
        return setBopPrefs({ version: prefs.version === "full" ? "short" : "full" });
      }
      if (event.key === " " && !/^(BUTTON|A)$/.test(target.tagName)) {
        event.preventDefault();
        void togglePlay();
      } else if (key === "V") {
        event.preventDefault();
        setView((v) => VIEWS[(VIEWS.findIndex((x) => x.id === v) + 1) % VIEWS.length].id);
      } else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && target.getAttribute("role") !== "slider") {
        const engine = engineRef.current;
        if (!engine) return;
        const { grid } = arrangementRef.current;
        const bar = barIndexAt(grid, engine.beat);
        const step = event.key === "ArrowRight" ? grid[bar].len : -grid[Math.max(0, bar - 1)].len;
        seek(engine.beat + step);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickSong, prefs.version, seek, setStyleId, togglePlay]);

  const style = STYLES.find((s) => s.id === styleId)!;
  const remix = remixInfo(songId);
  const styleName =
    styleId === "remix" ? `AI Remix · ${remix.genre}` : styleId === "solo" ? arrangement.label : styleId === "original" && scoreLoading
          ? "Original Score · opening the score…"
          : standIn
            ? "Orchestra · no original score for this tune yet"
            : styleId === "original" && score?.kind === "ours"
              ? "Original Score · our setting"
              : style.name;
  const about = styleId === "remix" ? remix.why : styleId === "original" && score ? `${song.about} ${score.credit}.` : song.about;
  // Where we are in the written music: a long piece changes section, meter and tempo along the way.
  const here = measureAt(song, arrangement.toSongBeat(position) ?? (position < arrangement.fromSongBeat(0) ? 0 : song.length));
  const hereBeat = arrangement.toSongBeat(position) ?? 0;
  const sectionName = version === "full" ? [...song.sections].reverse().find((s) => s.at <= hereBeat + 1e-6)?.name : undefined;

  return (
    <div className={styles.workspace}>
          <div className={styles.studio}>
            <aside className={styles.tracks} aria-label="Tunes">
              <h2 className={styles.panelTitle}>
                Tunes <kbd>A</kbd>–<kbd>K</kbd>
              </h2>
              <ol className={styles.trackList}>
                {songs.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={styles.track}
                      aria-pressed={s.id === songId}
                      style={{ "--tune": s.color } as React.CSSProperties}
                      onClick={() => pickSong(s.id)}
                    >
                      <span className={styles.letter}>{s.letter}</span>
                      <span className={styles.trackText}>
                        <span className={styles.trackTitle}>{s.title}</span>
                        <span className={styles.trackComposer}>{s.composer}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </aside>

            <section className={styles.stage} aria-label="Now playing">
              <div className={styles.nowPlaying}>
                <div>
                  <p className={styles.kicker}>
                    <span className={styles.styleChip}>
                      <StyleIcon style={standIn ? "orchestra" : styleId} size={16} /> {styleName}
                    </span>
                    <span className={styles.meta}>
                      {sectionName && `${sectionName} · `}
                      {here.meter.top}/{here.meter.bottom} ·{" "}
                      {styleId === "pc81" ? "timed in 1/18.2 s ticks" : `${Math.round(bpmAt(arrangement.tempos, position) * rate)} BPM`}
                    </span>
                  </p>
                  <h1 className={styles.songTitle}>{song.title}</h1>
                  <p className={styles.songAbout}>
                    <strong>{song.composer}.</strong> {about}
                  </p>
                </div>
                <div className={styles.versions} role="radiogroup" aria-label="Length">
                  {(["short", "full"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={version === v}
                      disabled={v === "full" && lengths.full === null}
                      title={v === "short" ? "The excerpt the 1981 program played" : lengths.full === null ? "No full version of this tune yet" : "The whole piece"}
                      onClick={() => setBopPrefs({ version: v })}
                    >
                      <span className={styles.versionName}>{v === "short" ? "1981" : "Full"}</span>
                      <span className={styles.versionTime}>{v === "short" ? clockText(lengths.short) : lengths.full === null ? "soon" : clockText(lengths.full)}</span>
                    </button>
                  ))}
                  <kbd className={styles.versionKey}>L</kbd>
                </div>
              </div>

              <div className={styles.viewTabs} role="tablist" aria-label="View">
                {VIEWS.map((v) => (
                  <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} title={v.hint}>
                    {v.label}
                  </button>
                ))}
                <span className={styles.viewHint}>
                  <kbd>V</kbd> switches
                </span>
              </div>

              <div className={styles.viewport}>
                {view === "sheet" && <SheetView song={song} clock={clock} />}
                {view === "falling" && <FallingView arrangement={arrangement} clock={clock} range={range} muted={muted} />}
                {view === "angka" && <AngkaView song={song} clock={clock} />}
                {view === "stage" && <StageView arrangement={arrangement} clock={clock} muted={muted} onToggle={toggleMute} />}
              </div>

              <Keyboard arrangement={arrangement} clock={clock} range={range} muted={muted} engine={engineRef} vintage={styleId === "pc81"} />
            </section>

            <aside className={styles.controls} aria-label="Styles">
              <h2 className={styles.panelTitle}>
                Styles <kbd>1</kbd>–<kbd>0</kbd> <kbd>=</kbd> <kbd>-</kbd>
              </h2>
              <div className={styles.styleGrid}>
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.styleCard}
                    data-card={s.id}
                    aria-pressed={s.id === styleId}
                    disabled={s.id === "original" && !score}
                    title={s.id === "original" && !score ? "No score for this tune yet" : undefined}
                    onClick={() => setStyleId(s.id)}
                  >
                    <StyleIcon style={s.id} size={24} className={styles.styleIcon} />
                    <span className={styles.styleName}>{s.id === "remix" ? `AI Remix` : s.name}</span>
                    <span className={styles.styleBlurb}>
                      {s.id === "remix" ? `${remix.genre}, arranged by Claude` : s.id === "original" ? (score?.label ?? "No score for this tune yet") : s.blurb}
                    </span>
                    <kbd className={styles.styleKey}>{s.key}</kbd>
                  </button>
                ))}
              </div>

              {styleId === "solo" && (
                <label className={styles.instrument}>
                  <span>Instrument</span>
                  <select value={instrument} onChange={(e) => setInstrument(e.target.value as SoloInstrumentId)}>
                    {SOLO_INSTRUMENTS.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.patch.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <h2 className={styles.panelTitle}>Band</h2>
              <ul className={styles.mixer}>
                {arrangement.tracks.map((track) => (
                  <li key={track.id}>
                    <button
                      type="button"
                      className={styles.mixerTrack}
                      aria-pressed={!muted.has(track.id)}
                      style={{ "--track": track.color } as React.CSSProperties}
                      onClick={() => toggleMute(track.id)}
                      title={muted.has(track.id) ? `Unmute ${track.name}` : `Mute ${track.name}`}
                    >
                      <InstrumentIcon family={track.patch.family} size={16} />
                      <span className={styles.mixerName}>{track.name}</span>
                      <span className={styles.mixerState}>{muted.has(track.id) ? "muted" : "on"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <Transport
            playing={playing}
            loadState={loadState}
            position={position}
            arrangement={arrangement}
            rate={rate}
            loop={loop}
            engine={engineRef}
            fileName={`${song.title}${version === "full" ? " (full)" : ""} (${styleName})`}
            onToggle={togglePlay}
            onSeek={seek}
            onRate={setRate}
            onLoop={setLoop}
            onMidiSaved={() => unlock(musicManifest.id, "take-it-home")}
          />
    </div>
  );
}
