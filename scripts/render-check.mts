/*
 * Renders arrangements offline with the real sound bank and reports levels,
 * so a broken style (silence, clipping, missing instruments) shows up without
 * opening a browser.
 *
 *   npx tsx scripts/render-check.mts [seconds] [outDir] [styles] [versions]
 *
 * styles and versions are comma lists ("hiphop,lofi", "short,full"); all by default.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audioToWav, BasicMIDI, BasicSoundBank, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer } from "spessasynth_core";
import { arrange, STYLES } from "../lib/music/arrange";
import { toMidi } from "../lib/music/midi";
import { loadOriginal, ORIGINAL_SCORES } from "../lib/music/original";
import { fullSongs, songs } from "../lib/music/songs";
import { secondsAt } from "../lib/music/tempo";

const seconds = Number(process.argv[2] ?? 10);
const outDir = process.argv[3] || undefined;
const onlyStyles = process.argv[4]?.split(",");
const versions = process.argv[5]?.split(",") ?? ["short", "full"];
const RATE = 22050;
const BLOCK = 128;

const file = readFileSync(join(import.meta.dirname, "..", "public", "soundfont", "bopbox.sf3"));
await BasicSoundBank.isSF3DecoderReady;
const bank = SoundBankLoader.fromArrayBuffer(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));

for (const score of ORIGINAL_SCORES) await loadOriginal(score.songId);

const missing = new Set<string>();
let failures = 0;

const tunes = [...(versions.includes("short") ? songs : []), ...(versions.includes("full") ? fullSongs.values() : [])];
for (const song of tunes) {
  for (const style of STYLES) {
    if (style.id === "pc81" || (onlyStyles && !onlyStyles.includes(style.id))) continue;
    const arrangement = arrange(song.id, style.id, "piano", song.version);
    const { bytes } = toMidi(arrangement);
    const midi = BasicMIDI.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

    const synth = new SpessaSynthProcessor(RATE, { effectsEnabled: true });
    synth.onMissingPreset = (patch) => {
      missing.add(`${style.id}: bank ${patch.bankMSB} program ${patch.program}${patch.isGMGSDrum ? " (drums)" : ""}`);
      return undefined;
    };
    synth.soundBankManager.addSoundBank(bank, "main");
    await synth.processorInitialized;
    const seq = new SpessaSynthSequencer(synth);
    seq.loadNewSongList([midi]);
    seq.play();

    const total = Math.round(Math.min(seconds, secondsAt(arrangement.tempos, arrangement.length) + 1) * RATE);
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    for (let i = 0; i < total; i += BLOCK) {
      seq.processTick();
      synth.process(left, right, i, Math.min(BLOCK, total - i));
    }

    let peak = 0;
    let sum = 0;
    for (let i = 0; i < total; i++) {
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      sum += left[i] * left[i] + right[i] * right[i];
    }
    const rms = Math.sqrt(sum / (2 * total));
    const flag = peak < 0.02 ? "SILENT" : peak > 0.99 ? "CLIPS" : "";
    if (flag) failures++;
    console.log(`${song.id.padEnd(7)} ${song.version.padEnd(5)} ${style.id.padEnd(9)} peak ${peak.toFixed(2)} rms ${(20 * Math.log10(rms + 1e-9)).toFixed(1)} dB ${flag}`);

    if (outDir && (onlyStyles || song.id === "sakura" || style.id === "dangdut" || style.id === "remix")) {
      mkdirSync(outDir, { recursive: true });
      const wav = audioToWav([left, right], RATE);
      writeFileSync(join(outDir, `${song.id}-${song.version}-${style.id}.wav`), new Uint8Array(wav));
    }
  }
}

if (missing.size) console.log("missing presets:\n" + [...missing].join("\n"));
console.log(failures ? `${failures} renders need attention` : "all renders OK");
process.exitCode = failures ? 1 : 0;
