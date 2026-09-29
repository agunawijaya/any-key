import type { Song } from "../score";
import { nearestWithPc } from "../theory";
import { DRUM as D, PATCH } from "./patches";
import { naturalBpm, scaleFor } from "./styles";
import { Studio, type Bar } from "./studio";
import type { Arrangement, Track } from "./types";

/*
 * One remix per tune, each in a genre picked for that tune's personality.
 * These are composed as notes (not audio), so the sheet music, keyboard and
 * falling notes stay in sync with what you hear.
 */

export const REMIX_GENRES: Record<string, { genre: string; why: string }> = {
  march: { genre: "Phonk", why: "A puppet funeral already sounds like a night drive. Cowbell melody, 808s, drift-ready." },
  stars: { genre: "Stadium EDM", why: "The most famous march gets a breakdown, a build and a festival drop." },
  forty: { genre: "Liquid Drum & Bass", why: "Mozart's restless strings at 174 BPM, over rolling breakbeats." },
  hat: { genre: "Reggaeton", why: "A dance from Guadalajara meets the dembow beat." },
  humor: { genre: "Bossa Nova", why: "Dvořák's skipping tune slows down for a beach in Rio." },
  bug: { genre: "Cumbia", why: "The cockroach song with güiro, congas and a singing accordion." },
  pop: { genre: "Chiptune", why: "A nursery rhyme as a boss-level soundtrack, with a key change power-up." },
  dandy: { genre: "Country Hoedown", why: "Fiddle, banjo rolls and a train beat for the most American tune there is." },
  sakura: { genre: "Future Bass", why: "Cherry blossoms, koto and huge wobbling chords, like an anime opening." },
  blue: { genre: "Space Waltz", why: "No drums, just stars: the waltz that once floated past a space station." },
  scales: { genre: "Trance", why: "Practising scales, but make it 138 BPM with a key change at the peak." },
};

const inPass = (pass: number) => (bar: Bar) => bar.section === "intro" ? pass === 0 : bar.pass === pass;

export function remix(song: Song): Arrangement {
  const label = `AI Remix · ${REMIX_GENRES[song.id]?.genre ?? "Remix"}`;
  switch (song.id) {
    case "march":
      return phonk(song, label);
    case "stars":
      return edm(song, label);
    case "forty":
      return dnb(song, label);
    case "hat":
      return reggaeton(song, label);
    case "humor":
      return bossa(song, label);
    case "bug":
      return cumbia(song, label);
    case "pop":
      return chiptune(song, label);
    case "dandy":
      return hoedown(song, label);
    case "sakura":
      return futureBass(song, label);
    case "blue":
      return spaceWaltz(song, label);
    default:
      return trance(song, label);
  }
}

/** 808 bass that slides down into its next note. */
function slide(track: Track) {
  for (const note of track.notes) {
    if (note.dur < 1) continue;
    track.automation.push({ at: note.at, kind: "bend", value: 0 });
    track.automation.push({ at: note.at + note.dur - 0.25, kind: "bend", value: 0 });
    track.automation.push({ at: note.at + note.dur - 0.02, kind: "bend", value: -3000 });
  }
}

function phonk(song: Song, label: string) {
  const bpm = 132;
  const s = new Studio(song, "remix", label, { bpm, policy: "four", introBars: 4, timeScale: scaleFor(bpm, naturalBpm(song, "four")) });
  const cowbell = s.track("cowbell", "melody", PATCH.agogo, { reverb: 40, volume: 110, name: "Phonk cowbell" });
  s.lead(cowbell, { vel: 110, articulation: 0.6 });
  const ghost = s.track("ghost lead", "counter", PATCH.square, { volume: 56, reverb: 70 });
  s.lead(ghost, { octave: 1, vel: 50, articulation: 0.4 });
  const pad = s.track("dark pad", "pad", PATCH.spaceVoice, { volume: 70, reverb: 90 });
  s.pad(pad, { center: 55, size: 3, vel: 50 });
  const bass = s.track("808", "bass", PATCH.synthBass2, { bendRange: 12, volume: 112 });
  s.bass(bass, { four: "R-------R---5---" }, { center: 36, vel: 112, when: (bar) => bar.section === "main" || bar.index >= 2 });
  slide(bass);
  const kit = s.track("808 kit", "drums", PATCH.kit808, { reverb: 20 });
  s.drums(
    kit,
    { four: { [D.kick]: "x.....x...x.....", [D.clap]: "....x.......x...", [D.closedHat]: "x.x.x.x.x.x.xxxx", [D.cowbell]: "..........x....." } },
    { fill: { four: { [D.kick]: "x.....x...x.....", [D.clap]: "....x.......x...", [D.closedHat]: "xxxxxxxxxxxxxxxx" } } },
  );
  return s.finish();
}

function edm(song: Song, label: string) {
  const s = new Studio(song, "remix", label, { bpm: 128, policy: "four", introBars: 4, passes: 2, timeScale: scaleFor(128, naturalBpm(song, "four")) });
  const piano = s.track("piano", "melody", PATCH.brightPiano, { reverb: 70 });
  s.lead(piano, { vel: 92, passes: [0] });
  const lead = s.track("supersaw", "melody", PATCH.superSaw, { reverb: 60, chorus: 50, volume: 96 });
  s.lead(lead, { vel: 100, passes: [1] });
  const high = s.track("lead octave", "counter", PATCH.saw, { volume: 66, reverb: 60 });
  s.lead(high, { octave: 1, vel: 70, passes: [1], articulation: 0.7 });
  const pad = s.track("pad", "pad", PATCH.sweepPad, { volume: 80, reverb: 90 });
  s.pad(pad, { center: 60, size: 4, vel: 62 });
  s.sidechain(pad, { depth: 90, sections: ["main"] });
  const stabs = s.track("stabs", "chords", PATCH.polysynth, { reverb: 60 });
  s.comp(stabs, { four: "x..x..x...x..x.." }, { center: 67, size: 4, vel: 90, when: inPass(1) });
  const bass = s.track("bass", "bass", PATCH.synthBass, { volume: 108 });
  s.bass(bass, { four: "R---------------" }, { center: 38, when: (bar) => bar.pass === 0 && bar.section === "main" });
  s.bass(bass, { four: "..R...R...R...R." }, { center: 40, when: (bar) => bar.pass === 1 && bar.section === "main" });
  const kit = s.track("drums", "drums", PATCH.kitElectronic, { reverb: 40 });
  s.drums(kit, { four: { [D.kick]: "x...x...x...x...", [D.clap]: "....x.......x...", [D.openHat]: "..x...x...x...x." } }, { sections: ["main"], when: inPass(1) });
  s.drums(kit, { four: { [D.closedHat]: "..x...x...x...x." } }, { sections: ["intro", "main"], when: (bar) => bar.section === "intro" || bar.pass === 0, crash: false, vel: 0.7 });
  // The build: the last two bars before the drop.
  const dropAt = s.passStarts[1];
  s.roll(kit, dropAt - 8, dropAt, D.snare);
  return s.finish();
}

function dnb(song: Song, label: string) {
  const bpm = 174;
  const s = new Studio(song, "remix", label, { bpm, policy: "four", introBars: 4, passes: 2, timeScale: scaleFor(bpm, naturalBpm(song, "four")) });
  const strings = s.track("strings", "melody", PATCH.stringsFast, { reverb: 80 });
  s.lead(strings, { vel: 98, passes: [0] });
  const lead = s.track("lead", "melody", PATCH.superSaw, { reverb: 70, volume: 90 });
  s.lead(lead, { vel: 92, passes: [1] });
  const keys = s.track("keys", "chords", PATCH.rhodes, { volume: 84, reverb: 80 });
  s.comp(keys, { four: "x-----x---x-----" }, { center: 62, size: 4, vel: 70 });
  const pad = s.track("pad", "pad", PATCH.haloPad, { volume: 72, reverb: 90 });
  s.pad(pad, { center: 60, size: 4, vel: 56 });
  const bass = s.track("reese", "bass", PATCH.synthBass2, { volume: 110 });
  s.bass(bass, { four: "R-------5-----R-" }, { center: 36, vel: 110, when: (bar) => bar.section === "main" });
  const kit = s.track("breaks", "drums", PATCH.kitStandard, { reverb: 30, name: "Breakbeat" });
  s.drums(
    kit,
    { four: { [D.kick]: "x.........x.....", [D.snare]: "....X..o....X..o", [D.closedHat]: "x.x.x.x.x.x.x.x.", [D.ride]: "..x...x...x...x." } },
    { fill: { four: { [D.kick]: "x.........x.....", [D.snare]: "....X..o..xxXXXX", [D.closedHat]: "x.x.x.x.x.x....." } }, sections: ["main"] },
  );
  s.drums(kit, { four: { [D.closedHat]: "x.x.x.x.x.x.x.x." } }, { sections: ["intro"], crash: false, vel: 0.6 });
  return s.finish();
}

function reggaeton(song: Song, label: string) {
  const bpm = 94;
  const s = new Studio(song, "remix", label, { bpm, policy: "four", introBars: 2, passes: 2, timeScale: 1 });
  const pluck = s.track("pluck", "melody", PATCH.kalimba, { reverb: 60, volume: 104 });
  s.lead(pluck, { vel: 104, articulation: 0.7 });
  const synth = s.track("synth", "counter", PATCH.square, { volume: 58, reverb: 70 });
  s.lead(synth, { octave: 1, vel: 56, articulation: 0.5, passes: [1] });
  const pad = s.track("pad", "pad", PATCH.warmPad, { volume: 68, reverb: 80 });
  s.pad(pad, { center: 60, size: 3, vel: 54 });
  const bass = s.track("808", "bass", PATCH.synthBass2, { bendRange: 12, volume: 108 });
  s.bass(bass, { four: "R-----R-R-----5-" }, { center: 36, vel: 108 });
  const kit = s.track("dembow", "drums", PATCH.kit808, { reverb: 25, name: "Dembow beat" });
  s.drums(
    kit,
    { four: { [D.kick]: "x...x...x...x...", [D.rim]: "...x..x....x..x.", [D.closedHat]: "x.x.x.x.x.x.x.x.", [D.shaker]: ".o.o.o.o.o.o.o.o" } },
    { fill: { four: { [D.kick]: "x...x...x...x...", [D.rim]: "...x..x...xxxxxx" } } },
  );
  return s.finish();
}

function bossa(song: Song, label: string) {
  const bpm = 144;
  const s = new Studio(song, "remix", label, { bpm, policy: "four", introBars: 2, enrichChords: true, timeScale: scaleFor(bpm, naturalBpm(song, "four")) });
  const flute = s.track("flute", "melody", PATCH.flute, { reverb: 70 });
  s.lead(flute, { vel: 92, articulation: 0.9 });
  const vibes = s.track("vibes", "counter", PATCH.vibes, { volume: 60, reverb: 80 });
  s.harmony(vibes, { vel: 56 });
  const guitar = s.track("nylon guitar", "chords", PATCH.nylon, { reverb: 50 });
  s.comp(guitar, { four: "x..x..x...x..x.." }, { center: 58, size: 4, vel: 74 });
  const bass = s.track("bass", "bass", PATCH.acousticBass, { reverb: 30 });
  s.bass(bass, { four: "R-----5-R-----5-" }, { center: 40, vel: 90 });
  const kit = s.track("brushes", "drums", PATCH.kitBrush, { reverb: 30, volume: 84 });
  s.drums(kit, { four: { [D.rim]: "x..x..x...x..x..", [D.shaker]: "oooooooooooooooo", [D.kick]: "x.....x.x.....x." } }, { crash: false });
  return s.finish();
}

function cumbia(song: Song, label: string) {
  const s = new Studio(song, "remix", label, { bpm: 96, policy: "four", introBars: 2, passes: 2, timeScale: 1 });
  const accordion = s.track("accordion", "melody", PATCH.accordion, { reverb: 50, volume: 104 });
  s.lead(accordion, { vel: 100, articulation: 0.85 });
  const second = s.track("accordion 2", "counter", PATCH.accordion, { volume: 70, reverb: 50, pan: 90 });
  s.harmony(second, { vel: 70, sustain: true });
  const guitar = s.track("guitar", "chords", PATCH.cleanGuitar, { volume: 80, pan: 40 });
  s.comp(guitar, { four: "..x...x...x...x." }, { center: 64, size: 3, vel: 74 });
  const bass = s.track("bass", "bass", PATCH.fingerBass);
  s.bass(bass, { four: "R---..5-R---..5-" }, { center: 40 });
  const kit = s.track("percussion", "drums", PATCH.kitStandard, { reverb: 30, name: "Güiro & congas" });
  s.drums(kit, {
    four: {
      [D.guiroLong]: "x...x...x...x...",
      [D.guiroShort]: "..x...x...x...x.",
      [D.congaOpen]: "......x.......x.",
      [D.congaMute]: "..x.o.....x.o...",
      [D.kick]: "x.......x.......",
      [D.cowbell]: "x...............",
    },
  });
  return s.finish();
}

function chiptune(song: Song, label: string) {
  const s = new Studio(song, "remix", label, { bpm: 150, policy: "four", introBars: 1, passes: 2, passTranspose: [0, 1], timeScale: 1 });
  const lead = s.track("pulse", "melody", PATCH.square, { reverb: 10, volume: 96 });
  s.lead(lead, { vel: 100, articulation: 0.8 });
  // Old consoles faked an echo by replaying the tune a sixteenth later, quieter.
  const echo = s.track("echo", "counter", PATCH.square, { volume: 60, reverb: 10, pan: 96 });
  for (let pass = 0; pass < 2; pass++) {
    for (const note of s.melodyNotes(pass)) s.add(echo, note.at + 0.25, note.dur * 0.6, note.pitch + 12, 48);
  }
  const arp = s.track("arpeggio", "arp", PATCH.square, { volume: 70, reverb: 10, pan: 30 });
  s.arp(arp, { four: "0123012301230123" }, { center: 72, vel: 60 });
  const bass = s.track("bass", "bass", PATCH.bassLead, { volume: 96, reverb: 5 });
  s.bass(bass, { four: "R-R-R-R-5-5-R-8-" }, { center: 40 });
  const kit = s.track("noise drums", "drums", PATCH.kitElectronic, { reverb: 10 });
  s.drums(kit, { four: { [D.kick]: "x.......x.x.....", [D.snare2]: "....x.......x...", [D.closedHat]: "x.x.x.x.x.x.x.x." } });
  return s.finish();
}

function hoedown(song: Song, label: string) {
  const s = new Studio(song, "remix", label, { bpm: 140, policy: "four", introBars: 2, passes: 2, timeScale: 1 });
  const fiddle = s.track("fiddle", "melody", PATCH.fiddle, { reverb: 40, volume: 104 });
  s.lead(fiddle, { vel: 100, articulation: 0.9, ornament: "grace" });
  const banjo = s.track("banjo", "arp", PATCH.banjo, { reverb: 30, pan: 90 });
  s.arp(banjo, { four: "0240240240240240" }, { center: 62, vel: 70 });
  const guitar = s.track("guitar", "chords", PATCH.steelGuitar, { pan: 40 });
  s.comp(guitar, { four: "....x-......x-.." }, { center: 60, size: 3, vel: 78 });
  const bass = s.track("upright", "bass", PATCH.acousticBass);
  s.bass(bass, { four: "R---5---R---5---" }, { center: 40 });
  const kit = s.track("train beat", "drums", PATCH.kitBrush, { reverb: 20, name: "Train beat" });
  s.drums(kit, { four: { [D.snare]: "o.o.X.o.o.o.X.o.", [D.kick]: "x.......x......." } });
  return s.finish();
}

function futureBass(song: Song, label: string) {
  const bpm = 150;
  const s = new Studio(song, "remix", label, { bpm, policy: "four", introBars: 4, passes: 2, timeScale: scaleFor(bpm, naturalBpm(song, "four")) });
  const koto = s.track("koto", "melody", PATCH.koto, { reverb: 80, volume: 106 });
  s.lead(koto, { vel: 104, passes: [0] });
  const lead = s.track("future lead", "melody", PATCH.superSaw, { reverb: 70, volume: 90, chorus: 50 });
  s.lead(lead, { vel: 96, octave: 1, passes: [1] });
  const kotoEcho = s.track("koto echo", "counter", PATCH.koto, { volume: 64, reverb: 90 });
  s.lead(kotoEcho, { vel: 60, passes: [1] });
  const chords = s.track("wobble chords", "chords", PATCH.polysynth, { reverb: 70, volume: 96 });
  s.comp(chords, { four: "x--x--x-x--x--x-" }, { center: 64, size: 4, vel: 94, when: inPass(1) });
  s.sidechain(chords, { depth: 100, sections: ["main"] });
  const pad = s.track("halo", "pad", PATCH.haloPad, { volume: 76, reverb: 90 });
  s.pad(pad, { center: 62, size: 4, vel: 58, when: (bar) => bar.section === "intro" || bar.pass === 0 });
  const bass = s.track("bass", "bass", PATCH.synthBass, { volume: 104 });
  s.bass(bass, { four: "R-------R---5---" }, { center: 38, when: inPass(1) });
  const kit = s.track("drums", "drums", PATCH.kit808, { reverb: 40 });
  s.drums(kit, { four: { [D.kick]: "x.........x.....", [D.clap]: "........x.......", [D.closedHat]: "x.x.x.x.x.x.x.x." } }, { fill: { four: { [D.kick]: "x.........x.....", [D.clap]: "........x...xxxx", [D.closedHat]: "x.x.x.x.xxxxxxxx" } }, sections: ["main"], when: inPass(1) });
  s.drums(kit, { four: { [D.closedHat]: "x...x...x...x..." } }, { sections: ["main"], when: inPass(0), crash: false, vel: 0.6 });
  s.roll(kit, s.passStarts[1] - 4, s.passStarts[1], D.clap);
  return s.finish();
}

function spaceWaltz(song: Song, label: string) {
  const s = new Studio(song, "remix", label, { bpm: 120, policy: "keep", introBars: 2, outroBars: 2 });
  const choir = s.track("choir", "melody", PATCH.choir, { reverb: 110, volume: 100 });
  s.lead(choir, { vel: 96, articulation: 1 });
  const stars = s.track("glockenspiel", "counter", PATCH.glock, { reverb: 110, volume: 62 });
  s.lead(stars, { octave: 1, vel: 52, articulation: 0.4 });
  const pad = s.track("halo pad", "pad", PATCH.haloPad, { reverb: 120, volume: 84 });
  s.pad(pad, { center: 58, size: 4, vel: 60 });
  const drops = s.track("echo drops", "arp", PATCH.echoDrops, { reverb: 120, volume: 70 });
  s.arp(drops, { three: "0...2...4..." }, { center: 72, vel: 58 });
  const bass = s.track("bass", "bass", PATCH.contrabass, { reverb: 90, volume: 80 });
  s.bass(bass, { three: "R-----------" }, { center: 40, vel: 70 });
  const timp = s.track("timpani", "perc", PATCH.timpani, { reverb: 110, volume: 100 });
  for (const bar of s.barsIn(["main"])) {
    if (bar.barInPass % 8 !== 0) continue;
    const root = nearestWithPc(s.chordAt(bar.start).root, 45);
    // The famous boom-boom from a certain space film.
    s.add(timp, bar.start, 0.5, root, 110);
    s.add(timp, bar.start + 1, 0.5, root - 5, 100);
  }
  return s.finish();
}

function trance(song: Song, label: string) {
  const s = new Studio(song, "remix", label, { bpm: 138, policy: "four", introBars: 4, passes: 2, passTranspose: [0, 2], timeScale: 1 });
  const lead = s.track("lead", "melody", PATCH.superSaw, { reverb: 80, volume: 96, chorus: 60 });
  s.lead(lead, { vel: 98 });
  const gate = s.track("trance gate", "arp", PATCH.saw, { volume: 70, reverb: 60 });
  s.arp(gate, { four: "0.2.1.2.0.2.1.2." }, { center: 69, vel: 70 });
  const pad = s.track("pad", "pad", PATCH.sweepPad, { volume: 76, reverb: 100 });
  s.pad(pad, { center: 60, size: 4, vel: 60 });
  s.sidechain(pad, { depth: 90 });
  const bass = s.track("rolling bass", "bass", PATCH.synthBass, { volume: 104 });
  s.bass(bass, { four: ".RRR.RRR.RRR.RRR" }, { center: 38, vel: 96, when: (bar) => bar.section === "main" || bar.index >= 2 });
  s.sidechain(bass, { depth: 60 });
  const kit = s.track("drums", "drums", PATCH.kitElectronic, { reverb: 40 });
  s.drums(kit, { four: { [D.kick]: "X...X...X...X...", [D.clap]: "....x.......x...", [D.openHat]: "..x...x...x...x.", [D.closedHat]: "oooooooooooooooo" } }, { fillEvery: 8, fill: { four: { [D.kick]: "X...X...X...X...", [D.clap]: "....x.......xxxx", [D.openHat]: "..x...x...x...x." } } });
  const lastIntro = s.bars.filter((b) => b.section === "intro").pop();
  if (lastIntro) s.roll(kit, lastIntro.start, lastIntro.start + 4, D.snare2);
  s.roll(kit, s.passStarts[1] - 4, s.passStarts[1], D.snare2);
  return s.finish();
}
