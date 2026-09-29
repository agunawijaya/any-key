import { songs } from "../lib/music/songs";
import { pitchName } from "../lib/music/theory";

for (const song of songs) {
  const pitches = song.notes.filter((n) => n.pitch !== null).map((n) => n.pitch!);
  console.log(
    `${song.letter} ${song.id.padEnd(7)} ${song.meter.top}/${song.meter.bottom} bars=${song.bars} beats=${song.length} ` +
      `range=${pitchName(Math.min(...pitches))}-${pitchName(Math.max(...pitches))} chords=${song.chords.length} ` +
      `secs=${((song.length * 60) / song.bpm).toFixed(1)}`,
  );
}
