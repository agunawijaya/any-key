"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { arrange, remixInfo, STYLES, type StyleId } from "@/lib/music/arrange";
import { SOLO_INSTRUMENTS, type SoloInstrumentId } from "@/lib/music/arrange/patches";
import type { Arrangement } from "@/lib/music/arrange/types";
import { BopEngine } from "@/lib/music/engine";
import { songById, songs } from "@/lib/music/songs";
import { keyboardRange } from "@/lib/music/timeline";
import { PrefsSync } from "@/components/hall/PrefsSync";
import { ThemeButton } from "@/components/ui/ThemeButton";
import { Keyboard } from "./Keyboard";
import { Story, type DocTab } from "@/components/kit/Story";
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

export function BopBox({ docs }: { docs: DocTab[] }) {
  const [songId, setSongId] = useState("blue");
  const [styleId, setStyleId] = useState<StyleId>("orchestra");
  const [instrument, setInstrument] = useState<SoloInstrumentId>("piano");
  const [view, setView] = useState<ViewId>("sheet");
  const [tab, setTab] = useState<"studio" | "story">("studio");
  const [loadState, setLoadState] = useState<{ state: "loading" | "ready" | "error"; progress: number }>({ state: "loading", progress: 0 });
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState<Set<string>>(() => new Set());
  const [position, setPosition] = useState(0);

  const song = songById(songId);
  const arrangement = useMemo(() => arrange(songId, styleId, instrument), [songId, styleId, instrument]);
  const range = useMemo<[number, number]>(() => (styleId === "pc81" ? [59, 84] : keyboardRange(arrangement)), [arrangement, styleId]);

  const engineRef = useRef<BopEngine | null>(null);
  const loadedRef = useRef<Arrangement | null>(null);
  const playingRef = useRef(false);
  const arrangementRef = useRef(arrangement);

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
        return songById(a.songId).length;
      },
    }),
    [],
  );

  // The engine lives for the whole visit; the sound bank starts downloading right away.
  useEffect(() => {
    const engine = new BopEngine();
    let disposed = false;
    engineRef.current = engine;
    engine.onEnded = () => setPlaying(false);
    engine
      .init((progress) => !disposed && setLoadState({ state: "loading", progress }))
      .then(() => !disposed && setLoadState({ state: "ready", progress: 1 }))
      .catch(() => !disposed && setLoadState({ state: "error", progress: 0 }));
    return () => {
      disposed = true;
      engine.pause();
      void engine.ctx.close();
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
      if (songBeat !== null) atBeat = Math.max(0, arrangement.fromSongBeat(songBeat) - 0.02);
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
  }, [loop]);

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
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
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
      if (event.ctrlKey || event.metaKey || event.altKey || tab !== "studio") return;
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = event.key.toUpperCase();
      const songMatch = songs.find((s) => s.letter === key);
      if (songMatch) return pickSong(songMatch.id);
      const styleMatch = STYLES.find((s) => s.key === event.key);
      if (styleMatch) return setStyleId(styleMatch.id);
      if (event.key === " " && !/^(BUTTON|A)$/.test(target.tagName)) {
        event.preventDefault();
        void togglePlay();
      } else if (key === "V") {
        setView((v) => VIEWS[(VIEWS.findIndex((x) => x.id === v) + 1) % VIEWS.length].id);
      } else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && target.getAttribute("role") !== "slider") {
        const engine = engineRef.current;
        if (!engine) return;
        const step = arrangementRef.current.barBeats * (event.key === "ArrowRight" ? 1 : -1);
        seek(engine.beat + step);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickSong, seek, tab, togglePlay]);

  const style = STYLES.find((s) => s.id === styleId)!;
  const remix = remixInfo(songId);
  const styleName = styleId === "remix" ? `AI Remix · ${remix.genre}` : styleId === "solo" ? arrangement.label : style.name;

  return (
    <div className={styles.app} data-style={styleId}>
      <PrefsSync />
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to the Any Key hall">
          <span aria-hidden>←</span>
          <span className={styles.backLabel}>any key</span>
        </Link>
        <div className={styles.brand}>
          <span className={styles.logo}>Bop Box</span>
          <span className={styles.origin}>based on MUSIC.BAS · 1981</span>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Sections">
          <button type="button" role="tab" aria-selected={tab === "studio"} onClick={() => setTab("studio")}>
            Studio
          </button>
          <button type="button" role="tab" aria-selected={tab === "story"} onClick={() => setTab("story")}>
            Story
          </button>
        </div>
        <ThemeButton />
      </header>

      {tab === "story" ? (
        <Story docs={docs} />
      ) : (
        <>
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
                      <span aria-hidden>{styleId === "remix" ? "🧪" : style.emoji}</span> {styleName}
                    </span>
                    <span className={styles.meta}>
                      {song.meter.top}/{song.meter.bottom} ·{" "}
                      {styleId === "pc81" ? "timed in 1/18.2 s ticks" : `${Math.round(arrangement.bpm * rate)} BPM`}
                    </span>
                  </p>
                  <h1 className={styles.songTitle}>{song.title}</h1>
                  <p className={styles.songAbout}>
                    <strong>{song.composer}.</strong> {styleId === "remix" ? remix.why : song.about}
                  </p>
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
                Styles <kbd>1</kbd>–<kbd>0</kbd>
              </h2>
              <div className={styles.styleGrid}>
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.styleCard}
                    data-card={s.id}
                    aria-pressed={s.id === styleId}
                    onClick={() => setStyleId(s.id)}
                  >
                    <span className={styles.styleEmoji} aria-hidden>
                      {s.emoji}
                    </span>
                    <span className={styles.styleName}>{s.id === "remix" ? `AI Remix` : s.name}</span>
                    <span className={styles.styleBlurb}>{s.id === "remix" ? `${remix.genre}, arranged by Claude` : s.blurb}</span>
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
                        {i.patch.icon} {i.patch.name}
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
                      <span aria-hidden>{track.patch.icon}</span>
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
            fileName={`${song.title} (${styleName})`}
            onToggle={togglePlay}
            onSeek={seek}
            onRate={setRate}
            onLoop={setLoop}
          />
        </>
      )}
    </div>
  );
}
