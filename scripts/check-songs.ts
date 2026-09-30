import { fullSongs, songs } from "../lib/music/songs";
import { pitchName } from "../lib/music/theory";
import type { Song } from "../lib/music/score";

const seconds = (song: Song) => {
  let total = 0;
  song.tempos.forEach((t, i) => {
    const end = i + 1 < song.tempos.length ? song.tempos[i + 1].at : song.length;
    total += ((end - t.at) * 60) / t.bpm;
  });
  return total;
};

for (const song of [...songs, ...fullSongs.values()]) {
  const pitches = song.notes.filter((n) => n.pitch !== null).map((n) => n.pitch!);
  const meters = [...new Set(song.measures.map((m) => `${m.meter.top}/${m.meter.bottom}`))].join(",");
  const keys = [...new Set(song.measures.map((m) => m.key.doName))].length;
  console.log(
    `${song.letter} ${song.id.padEnd(7)} ${song.version.padEnd(5)} ${meters.padEnd(8)} bars=${String(song.bars).padStart(3)} beats=${String(song.length).padStart(5)} ` +
      `range=${pitchName(Math.min(...pitches))}-${pitchName(Math.max(...pitches))} chords=${song.chords.length} keys=${keys} ` +
      `sections=${song.sections.length} secs=${seconds(song).toFixed(1)}`,
  );
}
