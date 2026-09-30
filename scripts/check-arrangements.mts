import { arrange, STYLES } from "../lib/music/arrange";
import { alignShort, placements } from "../lib/music/arrange/original";
import { loadOriginal, ORIGINAL_SCORES } from "../lib/music/original";
import { fullSongs, songById, songs } from "../lib/music/songs";
import { secondsAt } from "../lib/music/tempo";

let problems = 0;
const problem = (...args: unknown[]) => {
  problems++;
  console.log("PROBLEM", ...args);
};

// The Original Score: every printed bar lands where the full version's form puts it,
// and the 1981 excerpt is found inside the full piece.
for (const score of ORIGINAL_SCORES) {
  if (score.kind !== "composer") continue;
  const data = await loadOriginal(score.songId);
  const full = songById(score.songId, "full");
  const { drift } = placements(full, score, data!);
  for (const d of drift) problem("SCORE", score.songId, `entry ${d.entry} (${full.sections[d.entry].name})`, `${d.actual} beats, the form wants ${d.expected}`);
  // The lead sheet was read from the same score: nearly every tune note is sounding in some part at that moment.
  const a = arrange(score.songId, "original", "piano", "full");
  const sounding = a.tracks.flatMap((t) => (t.patch.drums ? [] : t.notes));
  const tune = full.notes.filter((n) => n.pitch !== null);
  const heard = tune.filter((n) => {
    const at = a.fromSongBeat(n.at);
    return sounding.some((x) => x.pitch % 12 === n.pitch! % 12 && Math.abs(x.at - at) < 0.02);
  }).length;
  const share = heard / tune.length;
  console.log(`score ${score.songId.padEnd(7)} ${(share * 100).toFixed(1)}% of the tune's notes start in the orchestra at the same moment`);
  if (share < 0.9) problem("SCORE", score.songId, "the parts and the tune disagree", share);
  const short = songById(score.songId);
  const b = arrange(score.songId, "original", "piano", "short");
  const shortTune = short.notes.filter((n) => n.pitch !== null);
  const shortHeard = shortTune.filter((n) => b.tracks.some((t) => !t.patch.drums && t.notes.some((x) => x.pitch % 12 === n.pitch! % 12 && Math.abs(x.at - b.fromSongBeat(n.at)) < 0.02))).length;
  console.log(`score ${score.songId.padEnd(7)} 1981 excerpt: ${((shortHeard / shortTune.length) * 100).toFixed(1)}% of its notes sound in the orchestra`);
  const align = alignShort(short, full);
  console.log(`score ${score.songId.padEnd(7)} ${Object.keys(data!.parts).length} parts · 1981 excerpt at full beat ${align.offset}, ${align.shift >= 0 ? "+" : ""}${align.shift} semitones, ${align.score}/12 notes match${align.scale !== 1 ? `, 1981 beat = ${align.scale} full beats` : ""}`);
  if (align.score < 8) problem("EXCERPT", score.songId, align);
}

for (const song of [...songs, ...fullSongs.values()]) {
  const row: string[] = [];
  for (const style of STYLES) {
    const a = arrange(song.id, style.id, "piano", song.version);
    const notes = a.tracks.reduce((n, t) => n + t.notes.length, 0);
    const secs = secondsAt(a.tempos, a.length);
    const bad = a.tracks.flatMap((t) => t.notes.filter((n) => !(n.pitch >= 0 && n.pitch <= 127) || !(n.dur > 0) || !(n.at >= 0) || n.at > a.length));
    if (bad.length || a.tracks.length === 0) problem(song.id, song.version, style.id, bad.slice(0, 3));
    // The score ↔ arrangement mapping must round-trip everywhere in the tune.
    // (The last beats of a pass belong to the next pass's pickup when a style repeats the tune.)
    for (let probe = song.pickup + 0.25; probe < song.length - song.pickup; probe += song.version === "full" ? 1.75 : 1.25) {
      const back = a.toSongBeat(a.fromSongBeat(probe));
      if (back === null || Math.abs(back - probe) > 1e-6) {
        problem("MAP", song.id, song.version, style.id, probe, back);
        break;
      }
    }
    // Bars tile the whole arrangement without gaps.
    const end = a.grid.reduce((at, bar) => (Math.abs(bar.at - at) < 1e-6 ? at + bar.len : NaN), 0);
    if (Math.abs(end - a.length) > 1e-6) problem("GRID", song.id, song.version, style.id, end, a.length);
    // The tempo map starts at beat 0; only a piece that opens at another speed may differ from the main tempo.
    if (a.tempos[0].at !== 0 || (song.tempos.length < 2 && Math.abs(a.tempos[0].bpm - a.bpm) > 1e-6)) problem("TEMPO", song.id, song.version, style.id, a.tempos[0], a.bpm);
    row.push(`${style.id}:${a.tracks.length}t/${notes}n/${secs.toFixed(0)}s@${Math.round(a.bpm)}`);
  }
  console.log(`${song.id.padEnd(7)}${song.version === "full" ? "+" : " "}`, row.join("  "));
}
console.log(problems ? `${problems} problems` : "all arrangements OK");
