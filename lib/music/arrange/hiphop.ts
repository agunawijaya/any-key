import type { Song } from "../score";
import { DRUM as D, PATCH } from "./patches";
import { naturalBpm, scaleFor } from "./styles";
import { Studio, type Bar } from "./studio";
import type { Arrangement, Track } from "./types";

/*
 * Hip-hop, the way it sounds now: a trap beat. 140 BPM with the clap on
 * beat three (so it feels half-time), an 808 that slides into its next
 * note, hi-hats that stutter into rolls, and the tune on a breathy flute
 * over dark voices. Lo-fi already covers the dusty, laid-back side of
 * hip-hop, so this one is the hard-hitting side.
 *
 * Waltzes and 6/8 tunes keep their lilt: their bars fold into triplets,
 * and the hi-hats ride in triplets with them.
 */

const BPM = 140;

export function hiphop(song: Song): Arrangement {
  const triplets = song.meter.top === 3 || song.meter.top === 6;
  // A waltz bar becomes two triplet beats; a 6/8 bar already is two dotted beats.
  const natural = song.meter.top === 3 && song.meter.bottom === 4 ? (song.bpm * 2) / 3 : naturalBpm(song, "four");
  const s = new Studio(song, "hiphop", "Hip-hop", { bpm: BPM, policy: "four", introBars: 2, timeScale: scaleFor(BPM, natural), tripletWaltz: true });
  const inMain = (bar: Bar) => bar.section === "main";

  const flute = s.track("flute", "melody", PATCH.flute, { reverb: 70, volume: 108, name: "Trap flute" });
  s.lead(flute, { vel: 100, articulation: 0.88 });
  for (const note of flute.notes) if (note.dur >= 1) s.vibrato(flute, note.at + note.dur * 0.4, note.at + note.dur);

  const bells = s.track("bells", "counter", PATCH.musicBox, { volume: 58, reverb: 90, pan: 88, name: "Bells" });
  s.harmony(bells, { vel: 58, minGap: 3, maxGap: 9 });
  for (const note of bells.notes) note.pitch += 12;

  const voices = s.track("dark voices", "pad", PATCH.choir, { volume: 64, reverb: 100 });
  s.pad(voices, { center: 55, size: 3, vel: 52 });

  const keys = s.track("piano chops", "chords", PATCH.piano, { volume: 74, reverb: 70, pan: 44, name: "Piano chops" });
  s.comp(keys, { four: "x.....x...x....." }, { center: 62, size: 3, vel: 62, when: inMain });

  const bass = s.track("808", "bass", PATCH.synthBass2, { bendRange: 12, volume: 116, name: "808" });
  s.bass(bass, { four: "R-----R---R-----" }, { center: 34, vel: 112, when: inMain });
  glide(s, bass);

  const kit = s.track("drums", "drums", PATCH.kit808, { reverb: 18, name: "Trap kit" });
  s.drums(
    kit,
    { four: { [D.kick]: "x.....x...x.....", [D.clap]: "........X......." } },
    { fill: { four: { [D.kick]: "x.....x...x...x.", [D.clap]: "........X....o.o" } }, fillEvery: 8, crash: false, sections: ["main"] },
  );
  hats(s, kit, triplets);
  // The drop: everything lands together on the first bar of the tune.
  const drop = s.bars.find(inMain);
  if (drop) s.add(kit, drop.start, 1, D.crash, 104);
  return s.finish();
}

/** 808 slides: a long note bends into the next one when the pitch changes. */
function glide(s: Studio, bass: Track) {
  const notes = [...bass.notes].sort((a, b) => a.at - b.at);
  const range = 12;
  notes.forEach((note, i) => {
    const next = notes[i + 1];
    if (!next || next.pitch === note.pitch || note.dur < 0.75 || Math.abs(next.pitch - note.pitch) > range || s.rng() > 0.55) return;
    const from = Math.max(note.at + 0.1, next.at - 0.2);
    const target = ((next.pitch - note.pitch) / range) * 8191;
    for (let k = 0; k <= 6; k++) bass.automation.push({ at: from + ((next.at - from) * k) / 6, kind: "bend", value: (target * k) / 6 });
    bass.automation.push({ at: next.at, kind: "bend", value: 0 });
    // Hold the sliding note until the next one takes over.
    note.dur = Math.max(note.dur, next.at - note.at);
  });
}

/** Eighth-note hi-hats (or triplets) that stutter into rolls at the ends of phrases. */
function hats(s: Studio, kit: Track, triplets: boolean) {
  const step = triplets ? 1 / 3 : 0.5;
  for (const bar of s.bars) {
    if (bar.section === "outro") continue;
    const lastIntro = bar.section !== "main" && bar.index === s.bars.filter((b) => b.section !== "main" && b.section !== "outro").length - 1;
    const position = bar.section === "main" ? bar.barInPass : bar.index;
    const roll = lastIntro || position % 2 === 1;
    const rollFrom = bar.start + bar.len - (lastIntro ? 2 : 1);
    for (let t = bar.start; t < bar.start + bar.len - 1e-6; t += step) {
      if (roll && t >= rollFrom - 1e-6) break;
      const onBeat = Math.abs(t - Math.round(t)) < 1e-6;
      s.add(kit, t, 0.1, D.closedHat, (onBeat ? 92 : 70) + (s.rng() - 0.5) * 10);
    }
    if (roll) {
      // Thirty-second notes, or sixteenth triplets, getting louder into the next bar.
      const kind = lastIntro ? 8 : s.rng() < 0.5 ? 8 : 6;
      const span = bar.start + bar.len - rollFrom;
      const hits = Math.round(span * kind);
      for (let i = 0; i < hits; i++) s.add(kit, rollFrom + i / kind, 0.06, i % 4 === 3 ? D.pedalHat : D.closedHat, 58 + (i / hits) * 50);
    }
    if (bar.section === "main" && position % 4 === 3) s.add(kit, bar.start + bar.len - 0.5, 0.4, D.openHat, 80);
  }
}
