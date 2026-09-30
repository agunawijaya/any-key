/*
 * The 1981 versions must not change: every arrangement of every short tune
 * (all styles, every Solo instrument) is fingerprinted, and this compares
 * against the stored fingerprints. Rewrite them only for a deliberate change:
 *
 *   npx tsx scripts/check-1981.mts          compare
 *   npx tsx scripts/check-1981.mts --write  store new fingerprints
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { arrange, STYLES } from "../lib/music/arrange";
import { SOLO_INSTRUMENTS } from "../lib/music/arrange/patches";
import { songs } from "../lib/music/songs";

const file = join(import.meta.dirname, "bopbox-1981.fingerprints.json");
const round = (v: number | null) => (v === null ? null : Math.round(v * 1e9) / 1e9);
const fingerprints: Record<string, string> = {};
for (const song of songs) {
  const combos: [string, string][] = STYLES.map((s) => [s.id, "piano"]);
  for (const i of SOLO_INSTRUMENTS) combos.push(["solo", i.id]);
  for (const [style, instrument] of combos) {
    const a = arrange(song.id, style as never, instrument as never);
    const probes: (number | null)[] = [];
    for (let b = -2; b < a.length + 2; b += 0.37) probes.push(round(a.toSongBeat(b)));
    for (let s = 0; s <= song.length; s += 0.41) probes.push(round(a.fromSongBeat(s)));
    // Fields added for the full versions (grid, tempo map, version) are not part of the 1981 sound.
    const { toSongBeat: _t, fromSongBeat: _f, grid: _g, tempos: _tp, version: _v, ...rest } = a;
    void [_t, _f, _g, _tp, _v];
    const data = JSON.stringify({ ...rest, probes });
    fingerprints[`${song.id}/${style}/${style === "solo" ? instrument : ""}`] = createHash("sha256").update(data).digest("hex").slice(0, 16);
  }
}

if (process.argv.includes("--write")) {
  writeFileSync(file, JSON.stringify(fingerprints, null, 1));
  console.log(`stored ${Object.keys(fingerprints).length} fingerprints`);
} else {
  const stored: Record<string, string> = JSON.parse(readFileSync(file, "utf8"));
  const changed = Object.keys(stored).filter((k) => fingerprints[k] !== stored[k]);
  changed.slice(0, 20).forEach((k) => console.log("CHANGED", k));
  console.log(changed.length ? `${changed.length} of ${Object.keys(stored).length} 1981 arrangements changed` : `all ${Object.keys(stored).length} 1981 arrangements unchanged`);
  if (changed.length) process.exit(1);
}
