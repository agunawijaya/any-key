import type { Song } from "../score";
import { nearestWithPc } from "../theory";
import { DRUM as D, PATCH, SOLO_INSTRUMENTS, type SoloInstrumentId } from "./patches";
import { Studio, type MeterPolicy } from "./studio";
import type { Arrangement, Track } from "./types";

/** The tune's own tempo, expressed in the groove's beats. */
export function naturalBpm(song: Song, policy: MeterPolicy) {
  if (policy === "keep") return song.bpm;
  const { top, bottom } = song.meter;
  if (top === 3 && bottom === 4) return (song.bpm * 4) / 3;
  if (top === 6 && bottom === 8) return song.bpm / 1.5;
  return song.bpm;
}

/**
 * Halve or double a tempo until it sits closest to where a style likes to live.
 * The tune keeps its own speed: the groove just runs half-time or double-time under it.
 */
export function foldBpm(natural: number, target: number) {
  const bpm = [natural / 2, natural, natural * 2].reduce((best, b) =>
    Math.abs(Math.log(b / target)) < Math.abs(Math.log(best / target)) ? b : best,
  );
  return { bpm: Math.round(bpm), timeScale: Math.round((bpm / natural) * 2) / 2 };
}

/** For fixed-tempo styles: play the tune at half or double length so it still feels natural. */
export function scaleFor(styleBpm: number, natural: number) {
  const ratio = styleBpm / natural;
  return ratio > 1.45 ? 2 : ratio < 0.55 ? 0.5 : 1;
}

// ---------- Orchestra ----------

export function orchestra(song: Song): Arrangement {
  const c = song.character;
  const s = new Studio(song, "orchestra", "Orchestra", { bpm: song.bpm * (c === "lyrical" ? 0.94 : 1), policy: "keep", introBars: 1 });

  const melodyPatch =
    c === "spooky" ? PATCH.bassoon : c === "march" ? PATCH.trumpet : c === "lyrical" ? (song.id === "sakura" ? PATCH.flute : PATCH.violin) : PATCH.stringsFast;
  const melody = s.track("melody", "melody", melodyPatch, { reverb: 70 });
  s.lead(melody, { vel: 100, articulation: c === "spooky" || c === "dance" ? 0.75 : 0.95 });

  if (c === "march") {
    const piccolo = s.track("piccolo", "counter", PATCH.piccolo, { volume: 78, reverb: 70 });
    s.lead(piccolo, { octave: 1, vel: 70, articulation: 0.7 });
    const horns = s.track("horns", "chords", PATCH.horns, { volume: 92, reverb: 70 });
    s.comp(horns, { four: "....x---....x---", two: "..x-..x-", three: "....x---x---", compound: "..x.x...x.x." }, { center: 60, vel: 80 });
    const tuba = s.track("tuba", "bass", PATCH.tuba, { reverb: 50 });
    s.bass(tuba, { four: "R-------5-------", two: "R---5---", three: "R-----------", compound: "R-----5-----" }, { center: 38, vel: 104 });
    const kit = s.track("percussion", "drums", PATCH.kitOrchestra, { volume: 96, reverb: 60 });
    s.drums(
      kit,
      {
        four: { [D.snare]: "X.x.x.x.X.x.xxx.", [D.bassDrum]: "x.......x.......", [D.crash2]: "................" },
        two: { [D.snare]: "X.x.xxx.", [D.bassDrum]: "x...x..." },
      },
      { fill: { four: { [D.snare]: "X.x.x.x.xxxxXXXX", [D.bassDrum]: "x.......x......." }, two: { [D.snare]: "xxxxXXXX" } } },
    );
  } else if (c === "waltz") {
    const flute = s.track("flute", "counter", PATCH.flute, { volume: 80, reverb: 70 });
    s.lead(flute, { octave: 1, vel: 64, articulation: 0.8, passes: [0] });
    const pizz = s.track("pizzicato", "chords", PATCH.pizz, { reverb: 60 });
    s.comp(pizz, { three: "....x...x..." }, { center: 62, vel: 86 });
    const horns = s.track("horns", "pad", PATCH.horns, { volume: 70, reverb: 70 });
    s.pad(horns, { center: 58, size: 3, vel: 52 });
    const bass = s.track("basses", "bass", PATCH.contrabass, { reverb: 60 });
    s.bass(bass, { three: "R-----------" }, { center: 40, vel: 100 });
    const harp = s.track("harp", "arp", PATCH.harp, { volume: 80, reverb: 80 });
    s.arp(harp, { three: "0.1.2.3.4.5." }, { center: 64, vel: 60, when: (bar) => bar.barInPass % 4 === 3 });
    timpani(s, 4);
  } else if (c === "lyrical" || c === "drill") {
    const strings = s.track("strings", "pad", PATCH.stringsSlow, { reverb: 80 });
    s.pad(strings, { center: 60, size: 4, vel: 62 });
    const harp = s.track("harp", "arp", PATCH.harp, { volume: 88, reverb: 80 });
    s.arp(harp, { four: "0.1.2.3.4.3.2.1.", two: "0.1.2.1.", three: "0.1.2.3.2.1." }, { center: 60, vel: 66 });
    const cellos = s.track("cellos", "bass", PATCH.cello, { reverb: 70 });
    s.bass(cellos, { four: "R-------5-------", two: "R-------", three: "R-----------" }, { center: 43, vel: 84 });
    const horn = s.track("horn", "counter", PATCH.horns, { volume: 76, reverb: 80 });
    s.harmony(horn, { vel: 62, sustain: true });
    timpani(s, 4);
  } else if (c === "drama") {
    const violas = s.track("violas", "chords", PATCH.stringsFast, { reverb: 60, volume: 90 });
    s.comp(violas, { four: "x-x-x-x-x-x-x-x-" }, { center: 58, size: 2, vel: 70 });
    const winds = s.track("oboe", "counter", PATCH.oboe, { volume: 80, reverb: 70 });
    s.harmony(winds, { vel: 70 });
    const horns = s.track("horns", "pad", PATCH.horns, { volume: 72, reverb: 70 });
    s.pad(horns, { center: 55, size: 3, vel: 50 });
    const bass = s.track("basses", "bass", PATCH.contrabass, { reverb: 60 });
    s.bass(bass, { four: "R---R---R---R---" }, { center: 40, vel: 100 });
    timpani(s, 2);
  } else {
    // dance, playful, spooky: light and bouncy
    const pizz = s.track("pizzicato", "chords", PATCH.pizz, { reverb: 60 });
    s.comp(pizz, { four: "....x.......x...", two: "..x...x.", three: "....x...x...", compound: "..x.x...x.x." }, { center: 62, vel: 84 });
    const bass = s.track("bassoon", "bass", c === "spooky" ? PATCH.pizz : PATCH.bassoon, { reverb: 60 });
    s.bass(bass, { four: "R-......5-......", two: "R-..5-..", three: "R-..........", compound: "R-....5-...." }, { center: 40, vel: 96 });
    if (c !== "spooky") {
      const flute = s.track("flute", "counter", PATCH.flute, { volume: 76, reverb: 70 });
      s.lead(flute, { octave: 1, vel: 62, articulation: 0.7 });
      const glock = s.track("glockenspiel", "perc", PATCH.glock, { volume: 64, reverb: 80 });
      s.lead(glock, { octave: 1, vel: 60, articulation: 0.5, passes: [0] });
    } else {
      const clarinet = s.track("clarinet", "counter", PATCH.clarinet, { volume: 78, reverb: 70 });
      s.harmony(clarinet, { vel: 64 });
    }
    timpani(s, 2);
  }
  return s.finish();
}

function timpani(s: Studio, every: number) {
  const timp = s.track("timpani", "perc", PATCH.timpani, { volume: 96, reverb: 70 });
  for (const bar of s.barsIn(["main"])) {
    if (bar.barInPass % every !== 0) continue;
    s.add(timp, bar.start, 1, nearestWithPc(s.chordAt(bar.start).root, 45), 92);
  }
  const outro = s.bars.find((b) => b.section === "outro");
  if (outro) {
    const root = nearestWithPc(s.chordAt(outro.start).root, 45);
    for (let t = 0; t < 2; t += 0.125) s.add(timp, outro.start + t, 0.12, root, 50 + t * 30);
  }
}

// ---------- Pop ----------

export function pop(song: Song): Arrangement {
  const { bpm, timeScale } = foldBpm(naturalBpm(song, "four"), 108);
  const s = new Studio(song, "pop", "Pop", { bpm, policy: "four", introBars: 2, timeScale });
  const melody = s.track("lead", "melody", PATCH.calliope, { reverb: 60, chorus: 30 });
  s.lead(melody, { vel: 100 });
  const sparkle = s.track("piano", "counter", PATCH.brightPiano, { volume: 70, reverb: 50 });
  s.lead(sparkle, { octave: 1, vel: 58, articulation: 0.6 });
  const keys = s.track("keys", "chords", PATCH.brightPiano, { volume: 92, reverb: 50 });
  s.comp(keys, { four: "x--x--x-x--x--x-" }, { center: 62, size: 3, vel: 78 });
  const pad = s.track("pad", "pad", PATCH.warmPad, { volume: 70, reverb: 70 });
  s.pad(pad, { center: 60, size: 4, vel: 50 });
  const bass = s.track("bass", "bass", PATCH.fingerBass);
  s.bass(bass, { four: "R---R-5-R---R-8-" }, { center: 40 });
  const kit = s.track("drums", "drums", PATCH.kitStandard, { reverb: 30 });
  s.drums(
    kit,
    { four: { [D.kick]: "x.......x.x.....", [D.snare]: "....x.......x...", [D.closedHat]: "x.x.x.x.x.x.x.x." } },
    { fill: { four: { [D.kick]: "x.......x.......", [D.snare]: "....x.......xxxx", [D.highTom]: "..........xx....", [D.closedHat]: "x.x.x.x.x......." } } },
  );
  return s.finish();
}

// ---------- Jazz ----------

export function jazz(song: Song): Arrangement {
  const isWaltz = song.meter.top === 3 && song.meter.bottom === 4;
  const isCompound = song.meter.top === 6;
  const policy: MeterPolicy = isWaltz ? "keep" : "four";
  const { bpm, timeScale } = foldBpm(naturalBpm(song, policy), 140);
  const s = new Studio(song, "jazz", "Jazz", { bpm, policy, introBars: 2, swing: isCompound ? 0.5 : 0.64, enrichChords: true, timeScale });
  const sax = s.track("sax", "melody", song.character === "lyrical" ? PATCH.muteTrumpet : PATCH.tenorSax, { reverb: 60 });
  s.lead(sax, { vel: 98, articulation: 0.88, ornament: "grace" });
  const piano = s.track("piano", "chords", PATCH.piano, { volume: 88, reverb: 50 });
  s.comp(piano, { four: "x.....x.........", three: "....x...x..." }, { center: 60, size: 4, vel: 72 });
  const bass = s.track("bass", "bass", PATCH.acousticBass, { reverb: 40 });
  s.walkingBass(bass, { center: 40 });
  const kit = s.track("drums", "drums", PATCH.kitBrush, { reverb: 40, volume: 90 });
  s.drums(
    kit,
    {
      four: isCompound
        ? { [D.ride]: "x...x...x...x...", [D.pedalHat]: "....x.......x...", [D.kick]: "o..............." }
        : { [D.ride]: "x...x.x.x...x.x.", [D.pedalHat]: "....x.......x...", [D.kick]: "o.......o......." },
      three: { [D.ride]: "x...x.x.x...", [D.pedalHat]: "....x...x...", [D.kick]: "o..........." },
    },
    {
      fill: {
        four: { [D.ride]: "x...x.x.x.......", [D.snare]: "..........o.x.x.", [D.pedalHat]: "....x......." },
        three: { [D.ride]: "x...x.x.....", [D.snare]: "........o.x." },
      },
    },
  );
  return s.finish();
}

// ---------- House ----------

export function house(song: Song): Arrangement {
  const bpm = 124;
  const natural = naturalBpm(song, "four");
  const timeScale = scaleFor(bpm, natural);
  const grooveBeats = song.length * timeScale * (natural / song.bpm);
  const short = grooveBeats < 48;
  const s = new Studio(song, "house", "House", { bpm, policy: "four", introBars: 4, passes: short ? 2 : 1, timeScale, passTranspose: short ? [0, 2] : [] });
  const lead = s.track("lead", "melody", PATCH.superSaw, { reverb: 60, chorus: 40, volume: 92 });
  s.lead(lead, { vel: 96 });
  const piano = s.track("house piano", "chords", PATCH.brightPiano, { reverb: 50 });
  s.comp(piano, { four: "x..x..x...x..x.." }, { center: 67, size: 4, vel: 92, when: (bar) => bar.section === "main" || bar.index >= 2 });
  const pad = s.track("pad", "pad", PATCH.polysynth, { volume: 76, reverb: 80 });
  s.pad(pad, { center: 60, size: 4, vel: 64 });
  s.sidechain(pad, { depth: 90 });
  const bass = s.track("bass", "bass", PATCH.synthBass, { volume: 104 });
  s.bass(bass, { four: "..R...8...R...8." }, { center: 40, vel: 104, when: (bar) => bar.section === "main" || bar.index >= 1 });
  s.sidechain(bass, { depth: 50 });
  const kit = s.track("drums", "drums", PATCH.kitElectronic, { reverb: 30 });
  s.drums(
    kit,
    { four: { [D.kick]: "X...X...X...X...", [D.clap]: "....x.......x...", [D.openHat]: "..x...x...x...x.", [D.closedHat]: "o.o.o.o.o.o.o.o.", [D.shaker]: ".o.o.o.o.o.o.o.o" } },
    { fill: { four: { [D.kick]: "X...X...X...X...", [D.clap]: "....x.......x.xx", [D.openHat]: "..x...x...x...x." } }, fillEvery: 8 },
  );
  const lastIntro = s.bars.filter((b) => b.section === "intro").pop();
  if (lastIntro) s.roll(kit, lastIntro.start + 2, lastIntro.start + 4, D.snare2);
  return s.finish();
}

// ---------- Dangdut and Koplo ----------

/** Kendang "dhut": a low drum whose pitch sags right after the hit. */
function sagDrum(s: Studio, track: Track) {
  for (const note of track.notes) {
    track.automation.push({ at: note.at, kind: "bend", value: 1800 });
    track.automation.push({ at: note.at + 0.06, kind: "bend", value: 0 });
    track.automation.push({ at: note.at + 0.22, kind: "bend", value: -2200 });
  }
  void s;
}

function kendangTrack(s: Studio, pattern: string, note = 50) {
  const low = s.track("kendang", "perc", PATCH.kendang, { bendRange: 12, reverb: 30, volume: 110, name: "Kendang (dhut)" });
  for (const bar of s.barsIn(["intro", "main"])) {
    [...pattern].forEach((ch, step) => {
      if (ch === "." || step >= bar.len * 4) return;
      s.add(low, bar.start + step / 4, 0.4, note, ch === "X" ? 122 : ch === "x" ? 104 : 70);
    });
  }
  sagDrum(s, low);
  return low;
}

export function dangdut(song: Song): Arrangement {
  const bpm = 128;
  const timeScale = scaleFor(bpm, naturalBpm(song, "four"));
  const s = new Studio(song, "dangdut", "Dangdut", { bpm, policy: "four", introBars: 2, timeScale });
  const suling = s.track("suling", "melody", PATCH.suling, { reverb: 60, volume: 104 });
  s.lead(suling, { vel: 104, ornament: "suling", articulation: 0.95 });
  const mandolin = s.track("mandolin", "counter", PATCH.mandolin, { volume: 76, reverb: 50, pan: 88 });
  s.lead(mandolin, { vel: 70, tremolo: 0.125 });
  kendangTrack(s, "X......x..x.....");
  const hand = s.track("ketipung", "drums", PATCH.kitStandard, { reverb: 30, name: "Ketipung & tambourine" });
  s.drums(
    hand,
    { four: { [D.congaOpen]: "....x.x.......x.", [D.congaMute]: "..x......x...x.x", [D.bongoHigh]: "...........x....", [D.tambourine]: "o.x.o.x.o.x.o.x." } },
    { crash: false },
  );
  const bass = s.track("bass", "bass", PATCH.fingerBass);
  s.bass(bass, { four: "R-..R.R.R-..5-R." }, { center: 40 });
  const guitar = s.track("guitar", "chords", PATCH.cleanGuitar, { volume: 80, pan: 40 });
  s.comp(guitar, { four: "..x...x...x...x." }, { center: 64, size: 3, vel: 72 });
  const strings = s.track("keyboard strings", "pad", PATCH.synthStrings, { volume: 66, reverb: 70, name: "Keyboard strings" });
  s.pad(strings, { center: 62, size: 4, vel: 54 });
  return s.finish();
}

export function koplo(song: Song): Arrangement {
  const bpm = 152;
  const timeScale = scaleFor(bpm, naturalBpm(song, "four"));
  const s = new Studio(song, "koplo", "Koplo", { bpm, policy: "four", introBars: 2, timeScale });
  const suling = s.track("suling", "melody", PATCH.suling, { reverb: 50, volume: 104 });
  s.lead(suling, { vel: 106, ornament: "suling" });
  const keys = s.track("keyboard", "counter", PATCH.polysynth, { volume: 70, reverb: 50 });
  s.lead(keys, { vel: 64, articulation: 0.6, octave: -1 });
  kendangTrack(s, "X.....x...x...x.", 50);
  const hand = s.track("kendang koplo", "drums", PATCH.kitStandard, { reverb: 25, name: "Kendang koplo" });
  s.drums(
    hand,
    {
      four: {
        [D.congaLow]: "...x.......x....",
        [D.congaOpen]: "..x...x.x...x..x",
        [D.congaMute]: ".x...x...x...x..",
        [D.tambourine]: "x.x.x.x.x.x.x.x.",
        [D.splash]: "x...............",
      },
    },
    { fill: { four: { [D.congaOpen]: "x.x.x.xxx.x.xxxx", [D.congaLow]: "...x.......x....", [D.tambourine]: "x.x.x.x.x.x.x.x." } }, fillEvery: 4 },
  );
  const bass = s.track("bass", "bass", PATCH.fingerBass, { volume: 108 });
  s.bass(bass, { four: "R.R.R.R.5.5.R.8." }, { center: 40 });
  const guitar = s.track("guitar", "chords", PATCH.muteGuitar, { volume: 78 });
  s.comp(guitar, { four: "..x...x...x...x." }, { center: 64, size: 3, vel: 80 });
  return s.finish();
}

// ---------- Lo-fi ----------

export function lofi(song: Song): Arrangement {
  const bpm = 80;
  const timeScale = scaleFor(bpm, naturalBpm(song, "four"));
  const s = new Studio(song, "lofi", "Lo-fi", { bpm, policy: "four", introBars: 2, swing: 0.6, enrichChords: true, crackle: true, timeScale });
  const vibes = s.track("vibes", "melody", PATCH.vibes, { reverb: 80, volume: 96 });
  s.lead(vibes, { vel: 84, articulation: 0.9 });
  const rhodes = s.track("rhodes", "chords", PATCH.rhodes, { volume: 90, reverb: 70, chorus: 50 });
  s.comp(rhodes, { four: "x-------..x-----" }, { center: 62, size: 4, vel: 70 });
  const bass = s.track("bass", "bass", PATCH.acousticBass, { reverb: 30 });
  s.bass(bass, { four: "R-------..R---5-" }, { center: 40, vel: 92 });
  const kit = s.track("drums", "drums", PATCH.kitStandard, { reverb: 60, volume: 84 });
  s.drums(kit, { four: { [D.kick]: "x......x..x.....", [D.snare]: "....x.......x...", [D.closedHat]: "o.o.o.o.o.o.o.o." } }, { crash: false, vel: 0.85 });
  return s.finish();
}

// ---------- Solo ----------

export function solo(song: Song, instrument: SoloInstrumentId = "piano"): Arrangement {
  const choice = SOLO_INSTRUMENTS.find((i) => i.id === instrument) ?? SOLO_INSTRUMENTS[0];
  const s = new Studio(song, `solo:${choice.id}`, `Solo · ${choice.patch.name}`, { bpm: song.bpm, policy: "keep", introBars: 0, outroBars: 0, gain: 2.6 });
  const track = s.track("solo", "melody", choice.patch, { reverb: 70, volume: 120 });
  s.lead(track, { vel: 100, articulation: 0.96, ornament: choice.id === "suling" ? "suling" : undefined });
  return s.finish();
}

// ---------- The 1981 PC speaker ----------

/** The IBM PC's timer ticked 18.2 times a second; every note was followed by a one-tick gap. */
export const TICK_SECONDS = 1 / 18.2;

export function pc81(song: Song): Arrangement {
  const tpb = song.ticksPerBeat;
  const notes: { at: number; dur: number; pitch: number; vel: number }[] = [];
  const bounds: { songAt: number; arrAt: number }[] = [];
  let ticks = 0;
  for (const note of song.notes) {
    const sound = Math.max(1, Math.round(note.dur * tpb));
    bounds.push({ songAt: note.at, arrAt: ticks / tpb });
    if (note.pitch !== null) notes.push({ at: ticks / tpb, dur: sound / tpb, pitch: note.pitch, vel: 100 });
    ticks += sound + 1;
  }
  bounds.push({ songAt: song.length, arrAt: ticks / tpb });
  const length = ticks / tpb;

  const toSongBeat = (beat: number) => {
    if (beat < 0 || beat > length) return null;
    for (let i = 0; i < bounds.length - 1; i++) {
      const a = bounds[i];
      const b = bounds[i + 1];
      if (beat >= a.arrAt && beat <= b.arrAt) return a.songAt + ((beat - a.arrAt) / (b.arrAt - a.arrAt)) * (b.songAt - a.songAt);
    }
    return null;
  };
  const fromSongBeat = (songBeat: number) => {
    for (let i = 0; i < bounds.length - 1; i++) {
      const a = bounds[i];
      const b = bounds[i + 1];
      if (songBeat >= a.songAt && songBeat <= b.songAt) return a.arrAt + ((songBeat - a.songAt) / (b.songAt - a.songAt || 1)) * (b.arrAt - a.arrAt);
    }
    return 0;
  };

  return {
    songId: song.id,
    styleId: "pc81",
    label: "PC Speaker ’81",
    bpm: 60 * 18.2 / tpb,
    meter: song.meter,
    barBeats: song.barBeats,
    feel: "four",
    length,
    swing: 0.5,
    tracks: [
      {
        id: "speaker",
        name: "PC speaker",
        role: "melody",
        patch: PATCH.pcSpeaker,
        color: "#c9f73a",
        notes,
        automation: [],
        volume: 100,
        pan: 64,
        reverb: 0,
        chorus: 0,
      },
    ],
    passes: [{ at: 0, length }],
    toSongBeat,
    fromSongBeat,
    gain: 1,
  };
}
