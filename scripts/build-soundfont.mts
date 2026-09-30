/*
 * Builds public/soundfont/bopbox.sf3: the MuseScore General sound bank (MIT)
 * trimmed down to the instruments Bop Box actually plays.
 *
 *   npx tsx scripts/build-soundfont.mts path/to/MuseScore_General.sf3
 *
 * Download the source from https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/
 */
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BasicSoundBank, SoundBankLoader } from "spessasynth_core";
import { arrange, STYLES } from "../lib/music/arrange";
import { SOLO_INSTRUMENTS, PATCH } from "../lib/music/arrange/patches";
import type { Patch } from "../lib/music/arrange/types";
import { loadOriginal, ORIGINAL_SCORES } from "../lib/music/original";
import { fullSongs, songs } from "../lib/music/songs";

const source = process.argv[2];
if (!source) throw new Error("Pass the path to MuseScore_General.sf3");

const wanted = new Map<string, Patch>();
const keyOf = (patch: Patch) => `${patch.drums ? "kit" : patch.bank ?? 0}:${patch.program}`;
const want = (patch: Patch) => wanted.set(keyOf(patch), patch);

for (const score of ORIGINAL_SCORES) await loadOriginal(score.songId);
for (const song of [...songs, ...fullSongs.values()]) {
  for (const style of STYLES) {
    if (style.id === "pc81") continue;
    for (const track of arrange(song.id, style.id, "piano", song.version).tracks) {
      want(track.patch);
      for (const a of track.automation) if (a.kind === "program") want(a.patch);
    }
  }
}
for (const instrument of SOLO_INSTRUMENTS) want(instrument.patch);
want(PATCH.piano);

const buffer = readFileSync(source);
await BasicSoundBank.isSF3DecoderReady;
const bank = SoundBankLoader.fromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

const keep = [];
for (const patch of wanted.values()) {
  const match = bank.presets.find((p) =>
    patch.drums ? p.isGMGSDrum && p.program === patch.program : !p.isGMGSDrum && p.program === patch.program && p.bankMSB === (patch.bank ?? 0),
  );
  if (!match) {
    console.warn(`missing preset for ${patch.name} (${keyOf(patch)})`);
    continue;
  }
  keep.push(match);
}

// The piano's loud (FF) layer doubles the download; the mezzo-forte samples cover all velocities.
for (const preset of keep) {
  if (preset.isGMGSDrum || preset.program > 1) continue;
  for (let i = preset.zones.length - 1; i >= 0; i--) {
    if (preset.zones[i].instrument.name.includes(" FF-")) preset.deleteZone(i);
  }
  for (const zone of preset.zones) if (zone.velRange.max >= 107) zone.velRange.max = 127;
}

// Stereo piano samples come in left/right pairs. Keep the left one, centred: half the size, same notes.
const PAN = 17;
const MONO = 1;
const pianoInstruments = new Set(keep.filter((p) => !p.isGMGSDrum && p.program <= 1).flatMap((p) => p.zones.map((z) => z.instrument)));
for (const instrument of pianoInstruments) {
  for (let i = instrument.zones.length - 1; i >= 0; i--) {
    const zone = instrument.zones[i];
    if (zone.sample.name.endsWith("(R)")) instrument.deleteZone(i, true);
    else {
      zone.setGenerator(PAN, 0);
      zone.sample.setSampleType(MONO);
    }
  }
}

const trimmed = new BasicSoundBank();
trimmed.soundBankInfo = { ...bank.soundBankInfo, name: "Bop Box (from MuseScore General)" };
trimmed.addCompletePresets(keep);
const out = trimmed.writeSF2({ software: "Bop Box build script" });

const target = join(import.meta.dirname, "..", "public", "soundfont", "bopbox.sf3");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, new Uint8Array(out));
copyFileSync(join(dirname(source), "MuseScore_General_License.md"), join(dirname(target), "LICENSE-MuseScore_General.md"));

const processor = join(import.meta.dirname, "..", "node_modules", "spessasynth_lib", "dist", "spessasynth_processor.min.js");
mkdirSync(join(import.meta.dirname, "..", "public", "spessasynth"), { recursive: true });
copyFileSync(processor, join(import.meta.dirname, "..", "public", "spessasynth", "spessasynth_processor.min.js"));

console.log(`kept ${keep.length} presets of ${bank.presets.length}; wrote ${(statSync(target).size / 1e6).toFixed(1)} MB`);
