import { arrange, STYLES } from "../lib/music/arrange";
import { songs } from "../lib/music/songs";

let problems = 0;
for (const song of songs) {
  const row: string[] = [];
  for (const style of STYLES) {
    const a = arrange(song.id, style.id);
    const notes = a.tracks.reduce((n, t) => n + t.notes.length, 0);
    const secs = (a.length * 60) / a.bpm;
    const bad = a.tracks.flatMap((t) => t.notes.filter((n) => !(n.pitch >= 0 && n.pitch <= 127) || !(n.dur > 0) || !(n.at >= 0) || n.at > a.length));
    if (bad.length || a.tracks.length === 0) {
      problems++;
      console.log("PROBLEM", song.id, style.id, bad.slice(0, 3));
    }
    // toSongBeat must round-trip inside the first pass
    const probe = song.pickup + 1.25;
    const back = a.toSongBeat(a.fromSongBeat(probe));
    if (back === null || Math.abs(back - probe) > 1e-6) {
      problems++;
      console.log("MAP", song.id, style.id, probe, back);
    }
    row.push(`${style.id}:${a.tracks.length}t/${notes}n/${secs.toFixed(0)}s@${Math.round(a.bpm)}`);
  }
  console.log(song.id.padEnd(7), row.join("  "));
}
console.log(problems ? `${problems} problems` : "all arrangements OK");
