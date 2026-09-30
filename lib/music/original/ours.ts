import { DRUM as D, PATCH } from "../arrange/patches";
import { Studio } from "../arrange/studio";
import type { Arrangement, Patch, Track } from "../arrange/types";
import type { Song } from "../score";
import { nearestWithPc } from "../theory";

/*
 * "Original Score" settings for the tunes whose own full score we can't play
 * note for note: folk songs that never had one, a piano piece, a piano
 * exercise, and the Blue Danube, whose only public-domain full score is a
 * scan too worn to read part by part. Each is written for the instruments the
 * tune belongs to: the fife and drum of the 1770s, a mariachi, a koto and
 * shakuhachi, a Victorian dance band. The tunes and harmonies are the ones
 * in songs.ts and full/*.ts; the parts around them are ours.
 */

const SHAKUHACHI: Patch = { name: "Shakuhachi", icon: "🎋", program: 77 };
const VIHUELA: Patch = { name: "Vihuela (guitar)", icon: "🎸", program: 24 };
const GUITARRON: Patch = { name: "Guitarrón (bass)", icon: "🎻", program: 32 };
const FIFE: Patch = { name: "Fifes", icon: "🎵", program: 72 };

type Voice = { track: Track; octave?: number; vel?: number; articulation?: number };

/** The section of the score a groove beat belongs to (the 1981 versions have one). */
function sectionAt(s: Studio, beat: number) {
  const songBeat = s.toSongBeat(beat) ?? 0;
  const list = s.song.sections;
  let pick = list[0];
  for (const sec of list) if (sec.at <= songBeat + 1e-6) pick = sec;
  return { name: pick?.name ?? "", beat: songBeat - (pick?.at ?? 0) };
}

/** Plays the tune on whichever instruments `route` picks for each moment. */
function leadRouted(s: Studio, route: (section: string, beatInSection: number) => Voice[]) {
  for (let pass = 0; pass < s.passStarts.length; pass++) {
    const notes = s.melodyNotes(pass);
    notes.forEach((note, i) => {
      const next = notes[i + 1];
      const room = next ? Math.max(0.05, next.at - note.at) : note.dur;
      const where = sectionAt(s, note.at);
      for (const v of route(where.name, where.beat)) {
        const dur = Math.min(note.dur * (v.articulation ?? 0.92), room);
        s.add(v.track, note.at, dur, note.pitch + 12 * (v.octave ?? 0), (v.vel ?? 96) + (s.rng() - 0.5) * 8);
      }
    });
  }
}

/** `gain` evens out loudness: a violin and a piano need more than a full orchestra. */
const keep = (song: Song, label: string, introBars = 1, gain = 1) =>
  new Studio(song, "original", label, { bpm: song.bpm, policy: "keep", introBars, outroBars: 1, followTempo: true, gain });

// ---------- The Blue Danube: our orchestration after Strauss ----------

export function blueDanube(song: Song): Arrangement {
  const s = keep(song, "Original Score (ours)", 0, 1.5);
  const v1 = s.track("violins", "melody", PATCH.violinsFast, { name: "First violins", pan: 34, reverb: 80 });
  const flute = s.track("flute", "counter", PATCH.flute, { name: "Flute", pan: 70, volume: 84, reverb: 80 });
  const cello = s.track("cellos", "melody", PATCH.celliFast, { name: "Cellos", pan: 92, reverb: 80 });
  const horn = s.track("horns", "melody", PATCH.horns, { name: "Horns", pan: 44, volume: 90, reverb: 80 });
  const tremolo = s.track("tremolo", "pad", PATCH.tremolo, { name: "Strings, tremolo", pan: 56, volume: 72, reverb: 80 });
  const violas = s.track("violas", "chords", PATCH.violasFast, { name: "Violas & second violins", pan: 76, volume: 88, reverb: 70 });
  const hornsPa = s.track("horn-chords", "chords", PATCH.horns, { name: "Horns (after-beats)", pan: 40, volume: 70, reverb: 70 });
  const harp = s.track("harp", "arp", PATCH.harp, { name: "Harp", pan: 96, volume: 84, reverb: 85 });
  const basses = s.track("basses", "bass", PATCH.contrabass, { name: "Double basses", pan: 100, reverb: 70 });
  const timp = s.track("timpani", "perc", PATCH.timpani, { name: "Timpani", pan: 64, volume: 90, reverb: 70 });

  const soft = (name: string) => /Introduction|Waltz 2$|Waltz 3$|farewell|lead-in/.test(name);
  leadRouted(s, (name, beat) => {
    if (/Introduction/.test(name)) return [{ track: beat < 36 ? horn : cello, vel: 78 }];
    if (/Tempo di valse/.test(name)) return [{ track: v1, vel: 72 }];
    if (name === "Waltz 1" || name === song.title) {
      // The cellos and horns sing the tune first; the violins take it up, loud, with the flute above.
      return beat < 49 ? [{ track: cello, vel: 70 }, { track: horn, vel: 58 }] : [{ track: v1, vel: 100 }, { track: flute, octave: 1, vel: 76 }];
    }
    if (name === "Waltz 2") return [{ track: flute, octave: 1, vel: 74 }, { track: cello, octave: -1, vel: 64 }];
    if (/farewell/.test(name)) return [{ track: cello, vel: 72 }, { track: flute, octave: 1, vel: 56 }];
    if (/second strain|rush|returns|back to/.test(name)) return [{ track: v1, vel: 102 }, { track: flute, octave: 1, vel: 78 }];
    return [{ track: v1, vel: soft(name) ? 76 : 94 }];
  });

  const inSection = (test: (name: string) => boolean) => (bar: { start: number }) => test(sectionAt(s, bar.start).name);
  const intro = (n: string) => /Introduction/.test(n);
  s.pad(tremolo, { center: 64, size: 4, vel: 44, when: inSection(intro) });
  s.arp(harp, { compound: "0.1.2.3.4.5." }, { center: 60, vel: 58, when: inSection(intro) });
  s.bass(basses, { compound: "R-----------", three: "R-----------" }, { center: 38, vel: 88 });
  s.comp(violas, { three: "....x...x..." }, { center: 62, size: 3, vel: 70, when: inSection((n) => !intro(n)) });
  s.comp(hornsPa, { three: "....x...x..." }, { center: 55, size: 2, vel: 58, when: inSection((n) => !intro(n) && !soft(n)) });
  // A harp sweep into every eighth bar of a waltz, and the timpani on the loud strains' downbeats.
  s.arp(harp, { three: "0.1.2.3.4.5." }, { center: 62, vel: 62, when: (bar) => bar.section === "main" && bar.barInPass % 8 === 7 && !intro(sectionAt(s, bar.start).name) });
  for (const bar of s.barsIn(["main"])) {
    const name = sectionAt(s, bar.start).name;
    if (soft(name) || intro(name) || bar.barInPass % 4 !== 0) continue;
    s.add(timp, bar.start, 0.8, nearestWithPc(s.chordAt(bar.start).root, 45), 84);
  }
  return s.finish();
}

// ---------- Yankee Doodle: a fife and drum corps ----------

export function fifeAndDrum(song: Song): Arrangement {
  const s = keep(song, "Original Score (ours)", 2);
  const fife1 = s.track("fife-1", "melody", FIFE, { name: "Fifes", pan: 50, reverb: 50 });
  const fife2 = s.track("fife-2", "counter", FIFE, { name: "Second fifes", pan: 78, volume: 84, reverb: 50 });
  const drums = s.track("drums", "drums", PATCH.kitOrchestra, { name: "Snare & bass drum", pan: 64, reverb: 40 });
  s.lead(fife1, { octave: 1, vel: 100, articulation: 0.8 });
  // The second fifes play a third or sixth below, as corps books did.
  const saved = fife2.notes.length;
  s.harmony(fife2, { vel: 84, minGap: 3, maxGap: 9, sustain: true });
  for (const n of fife2.notes.slice(saved)) n.pitch += 12;
  // A drum call before the tune, then the street beat: rolls and flams on the snare, the bass drum on the beat.
  s.drums(
    drums,
    {
      two: { [D.snare]: "X.xxx.x.X.xxx.x.", [D.bassDrum]: "x.......x......." },
      four: { [D.snare]: "X.xxx.x.X.xxx.x.", [D.bassDrum]: "x.......x......." },
    },
    { sections: ["intro", "main"], fill: { two: { [D.snare]: "X.x.xxxxXXXX" }, four: { [D.snare]: "X.x.x.x.xxxxXXXX" } }, fillEvery: 8, crash: false },
  );
  const outro = s.bars.find((b) => b.section === "outro");
  if (outro) s.add(drums, outro.start, 0.5, D.bassDrum, 120);
  return s.finish();
}

// ---------- Mariachi: the Mexican Hat Dance and La Cucaracha ----------

export function mariachi(song: Song, { harp = false, trumpetsLead = false } = {}): Arrangement {
  const s = keep(song, "Original Score (ours)", 1);
  const violins = s.track("violins", "melody", PATCH.violinsFast, { name: "Violins", pan: 40, reverb: 60 });
  const trumpets = s.track("trumpets", "counter", PATCH.trumpet, { name: "Trumpets", pan: 80, volume: 88, reverb: 60 });
  const vihuela = s.track("vihuela", "chords", VIHUELA, { pan: 56, volume: 92, reverb: 40 });
  const guitarron = s.track("guitarron", "bass", GUITARRON, { pan: 64, reverb: 40 });
  if (trumpetsLead) {
    s.lead(trumpets, { vel: 100, articulation: 0.85 });
    s.harmony(violins, { vel: 76, minGap: 3, maxGap: 4, sustain: true });
  } else {
    s.lead(violins, { vel: 98, articulation: 0.9 });
    s.harmony(trumpets, { vel: 78, minGap: 3, maxGap: 4, sustain: true });
  }
  // The vihuela's strum and the guitarrón's root and fifth: the son's bounce in 6/8, a march-like pulse in 4/4.
  s.comp(vihuela, { compound: "x.xx.xx.xx.x", four: "x.xxx.x.x.xxx.x.", two: "x.xxx.x." }, { center: 60, size: 4, vel: 74 });
  s.bass(guitarron, { compound: "R-----5-----", four: "R-------5-------", two: "R---5---" }, { center: 40, vel: 100 });
  if (harp) {
    const arpa = s.track("harp", "arp", PATCH.harp, { name: "Arpa jarocha (harp)", pan: 96, volume: 84, reverb: 60 });
    s.arp(arpa, { compound: "0.1.2.3.2.1.", four: "0.1.2.3.4.3.2.1.", two: "0.1.2.1." }, { center: 60, vel: 64 });
  }
  return s.finish();
}

// ---------- Sakura: koto and shakuhachi ----------

export function kotoShakuhachi(song: Song): Arrangement {
  const s = keep(song, "Original Score (ours)", 1, 1.8);
  const koto = s.track("koto", "melody", PATCH.koto, { name: "Koto", pan: 44, reverb: 80 });
  const second = s.track("koto-2", "arp", PATCH.koto, { name: "Second koto", pan: 84, volume: 80, reverb: 85 });
  const flute = s.track("shakuhachi", "counter", SHAKUHACHI, { pan: 60, volume: 88, reverb: 85 });
  s.lead(koto, { vel: 96, articulation: 0.95, tremolo: 0.25 });
  s.lead(flute, { octave: 0, vel: 78, ornament: "suling", passes: s.passStarts.length > 1 ? [1] : [0] });
  // The second koto plucks the scale's open notes, like the tuning of its strings.
  s.arp(second, { four: "0...2...1...3...", three: "0...2...1..." }, { center: 52, vel: 60 });
  return s.finish();
}

// ---------- Pop! Goes the Weasel: a Victorian dance band ----------

export function quadrilleBand(song: Song): Arrangement {
  const s = keep(song, "Original Score (ours)", 1, 1.5);
  const violin = s.track("violin", "melody", PATCH.violin, { name: "Violin", pan: 40, reverb: 60 });
  const cornet = s.track("cornet", "counter", PATCH.cornet, { pan: 76, volume: 84, reverb: 60 });
  const clarinet = s.track("clarinet", "counter", PATCH.clarinet, { pan: 58, volume: 80, reverb: 60 });
  const piano = s.track("piano", "chords", PATCH.piano, { name: "Piano", pan: 64, volume: 86, reverb: 50 });
  const bass = s.track("bass", "bass", PATCH.contrabass, { name: "Double bass", pan: 70, reverb: 50 });
  const perc = s.track("triangle", "perc", PATCH.kitOrchestra, { name: "Triangle & woodblock", pan: 90, volume: 80, reverb: 50 });
  s.lead(violin, { vel: 96, articulation: 0.85 });
  s.lead(cornet, { vel: 80, articulation: 0.75, passes: s.passStarts.length > 1 ? [1] : [0] });
  s.harmony(clarinet, { vel: 70 });
  s.comp(piano, { compound: "..x..x..x..x", two: "..x...x.", four: "..x...x...x...x." }, { center: 62, size: 3, vel: 70 });
  s.bass(bass, { compound: "R-....5-....", two: "R...5...", four: "R.......5......." }, { center: 40, vel: 96 });
  s.drums(perc, { compound: { [D.triangle]: "x.....x.....", [D.woodHigh]: "...x.....x.." }, two: { [D.triangle]: "x.......", [D.woodHigh]: "....x..." } }, { crash: false });
  return s.finish();
}

// ---------- Humoresque: violin and piano ----------

export function violinAndPiano(song: Song): Arrangement {
  const s = keep(song, "Original Score (ours)", 1, 2.2);
  const violin = s.track("violin", "melody", PATCH.violin, { name: "Violin", pan: 44, reverb: 75 });
  const piano = s.track("piano", "chords", PATCH.piano, { name: "Piano", pan: 72, volume: 84, reverb: 60 });
  const left = s.track("piano-left", "bass", PATCH.piano, { name: "Piano, left hand", pan: 72, volume: 84, reverb: 60 });
  s.lead(violin, { vel: 92, articulation: 0.96 });
  // Dvořák's left hand skips too: a bass note on the beat, the chord on the half-beat after it.
  s.bass(left, { two: "R...5...", four: "R...5...R...5..." }, { center: 43, vel: 74 });
  s.comp(piano, { two: "..x...x.", four: "..x...x...x...x." }, { center: 60, size: 3, vel: 60 });
  return s.finish();
}

// ---------- Scales: piano and metronome ----------

export function pianoLesson(song: Song): Arrangement {
  const s = keep(song, "Original Score (ours)", 1, 3);
  const right = s.track("right-hand", "melody", PATCH.piano, { name: "Piano, right hand", pan: 70, reverb: 40 });
  const leftHand = s.track("left-hand", "counter", PATCH.piano, { name: "Piano, left hand", pan: 56, volume: 90, reverb: 40 });
  const tick = s.track("metronome", "perc", PATCH.kitStandard, { name: "Metronome", pan: 64, volume: 70, reverb: 10 });
  s.lead(right, { vel: 84, articulation: 0.9 });
  s.lead(leftHand, { octave: -1, vel: 72, articulation: 0.9 });
  s.drums(tick, { four: { [D.woodHigh]: "X...x...x...x...", [D.woodLow]: "" } }, { crash: false, sections: ["intro", "main", "outro"] });
  return s.finish();
}
