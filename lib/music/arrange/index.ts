import { originalData, originalFor, originalReady } from "../original";
import type { SongVersion } from "../score";
import { songById } from "../songs";
import { originalScore } from "./original";
import type { SoloInstrumentId } from "./patches";
import { REMIX_GENRES, remix } from "./remixes";
import { hiphop } from "./hiphop";
import { dangdut, house, jazz, koplo, lofi, orchestra, pc81, pop, solo } from "./styles";
import type { Arrangement } from "./types";

export type StyleId = "orchestra" | "original" | "pop" | "jazz" | "house" | "dangdut" | "koplo" | "lofi" | "hiphop" | "solo" | "pc81" | "remix";

export type StyleInfo = {
  id: StyleId;
  name: string;
  blurb: string;
  key: string;
};

export const STYLES: StyleInfo[] = [
  { id: "orchestra", name: "Orchestra", blurb: "Strings, winds, brass and timpani", key: "1" },
  { id: "pop", name: "Pop", blurb: "Piano, synths and a punchy kit", key: "2" },
  { id: "jazz", name: "Jazz", blurb: "Swing, walking bass, sax on top", key: "3" },
  { id: "house", name: "House", blurb: "124 BPM, four on the floor", key: "4" },
  { id: "dangdut", name: "Dangdut", blurb: "Kendang, suling and mandolin", key: "5" },
  { id: "koplo", name: "Koplo", blurb: "Dangdut, but faster and wilder", key: "6" },
  { id: "lofi", name: "Lo-fi", blurb: "Dusty beats to study to", key: "7" },
  { id: "hiphop", name: "Hip-hop", blurb: "Trap: 808 slides, hat rolls, flute on top", key: "=" },
  { id: "solo", name: "Solo", blurb: "Just the tune, on your instrument", key: "8" },
  { id: "pc81", name: "PC Speaker ’81", blurb: "How it beeped in 1981, square wave and all", key: "9" },
  { id: "remix", name: "AI Remix", blurb: "A different genre for every tune", key: "0" },
  { id: "original", name: "Original Score", blurb: "The orchestration written for the tune", key: "-" },
];

export function remixInfo(songId: string) {
  return REMIX_GENRES[songId];
}

const cache = new Map<string, Arrangement>();

export function arrange(songId: string, styleId: StyleId, instrument: SoloInstrumentId = "piano", version: SongVersion = "short"): Arrangement {
  const song = songById(songId, version);
  // A composer's score arrives on demand; until then (or for a tune without one) the Orchestra style stands in.
  const score = styleId === "original" ? originalFor(songId) : undefined;
  if (styleId === "original" && !originalReady(songId)) return arrange(songId, "orchestra", instrument, version);
  const key = `${songId}/${song.version}/${styleId}/${styleId === "solo" ? instrument : ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const build = {
    orchestra,
    pop,
    jazz,
    house,
    dangdut,
    koplo,
    lofi,
    hiphop,
    pc81,
    remix,
    solo: () => solo(song, instrument),
    original: () => (score!.kind === "ours" ? score!.build(song) : originalScore(song, songById(songId, "full"), score!, originalData(songId)!)),
  }[styleId];
  const arrangement = build(song);
  cache.set(key, arrangement);
  return arrangement;
}

export type { Arrangement, Track, ArrNote } from "./types";
