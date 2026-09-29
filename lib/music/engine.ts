"use client";

import { audioBufferToWav, Sequencer, WorkletSynthesizer } from "spessasynth_lib";
import { BasicMIDI } from "spessasynth_core";
import type { Arrangement } from "./arrange/types";
import { toMidi } from "./midi";

const SOUND_BANK_URL = "/soundfont/bopbox.sf3";
const PROCESSOR_URL = "/spessasynth/spessasynth_processor.min.js";
const KEYBOARD_CHANNEL = 15;

export type EngineStatus = "idle" | "loading" | "ready" | "error";

/**
 * Plays arrangements through a SoundFont synth (or the 1981 PC speaker model)
 * and exposes one clock, in arrangement beats, for every visual to follow.
 */
export class BopEngine {
  readonly ctx: AudioContext;
  private master: GainNode;
  private synth?: WorkletSynthesizer;
  private seq?: Sequencer;
  private bank?: ArrayBuffer;
  private arrangement?: Arrangement;
  private channels = new Map<string, number>();
  private muted = new Set<string>();
  private rate = 1;
  private loop = false;
  private speaker = new Pc81Speaker();
  private crackle?: { source: AudioBufferSourceNode; gain: GainNode };
  private ready?: Promise<void>;
  private clockCache = { at: -1, seconds: 0 };
  private anchor: { perf: number; seconds: number } | null = null;
  onEnded?: () => void;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    this.master = this.ctx.createGain();
    this.master.gain.value = 1.4;
    this.master.connect(limiter).connect(this.ctx.destination);
    this.speaker.connect(this.ctx, this.master);
    this.speaker.onEnded = () => this.onEnded?.();
  }

  /** Downloads the sound bank (reporting 0..1) and starts the synth. Safe to call more than once. */
  init(onProgress?: (fraction: number) => void) {
    this.ready ??= (async () => {
      const [bank] = await Promise.all([fetchWithProgress(SOUND_BANK_URL, onProgress), this.ctx.audioWorklet.addModule(PROCESSOR_URL)]);
      this.bank = bank;
      const synth = new WorkletSynthesizer(this.ctx);
      synth.connect(this.master);
      await synth.soundBankManager.addSoundBank(bank.slice(0), "main");
      await synth.isReady;
      this.synth = synth;
      this.seq = new Sequencer(synth, { skipToFirstNoteOn: false });
      this.seq.eventHandler.addEvent("songEnded", "bopbox", () => {
        if (!this.loop) this.onEnded?.();
      });
    })();
    return this.ready;
  }

  get isPc81() {
    return this.arrangement?.styleId === "pc81";
  }

  /** Current position in arrangement beats. */
  get beat() {
    const a = this.arrangement;
    if (!a) return 0;
    if (this.isPc81) return this.speaker.beat;
    if (!this.seq) return 0;
    return (this.songSeconds() * a.bpm) / 60;
  }

  /**
   * Song time in seconds, smooth enough for 60 fps animation. The audio clock
   * (ctx.currentTime) only moves once per audio block, which makes scrolling
   * stutter, so we ask the context when the sample now leaving the speakers
   * was scheduled and extrapolate from there with performance.now().
   */
  private songSeconds() {
    const seq = this.seq!;
    if (seq.paused || seq.isFinished) return seq.currentTime;
    const now = performance.now();
    if (now - this.clockCache.at < 2) return this.clockCache.seconds;
    let seconds: number;
    const stamp = this.ctx.getOutputTimestamp?.();
    if (stamp?.contextTime && stamp.performanceTime) {
      const songStart = this.ctx.currentTime - seq.currentTime / this.rate;
      const heardNow = stamp.contextTime + (now - stamp.performanceTime) / 1000;
      seconds = Math.max(0, (heardNow - songStart) * this.rate);
    } else {
      // No output timestamp (some browsers, headless): run our own clock from
      // performance.now() and nudge it gently toward the block-stepped audio clock.
      const audio = seq.currentTime;
      if (!this.anchor || Math.abs(audio - this.predict(now)) > 0.25) this.anchor = { perf: now, seconds: audio };
      else this.anchor.seconds += (audio - this.predict(now)) * 0.03;
      seconds = this.predict(now);
    }
    // Never step backwards by a hair because of clock jitter; real seeks reset the cache.
    if (seconds < this.clockCache.seconds && this.clockCache.seconds - seconds < 0.05) seconds = this.clockCache.seconds;
    this.clockCache = { at: now, seconds };
    return seconds;
  }

  private predict(now: number) {
    return this.anchor ? this.anchor.seconds + ((now - this.anchor.perf) / 1000) * this.rate : 0;
  }

  private resetClock() {
    this.clockCache = { at: -1, seconds: 0 };
    this.anchor = null;
  }

  get playing() {
    if (this.isPc81) return this.speaker.playing;
    return this.seq ? !this.seq.paused && !this.seq.isFinished : false;
  }

  /** Loads an arrangement, optionally starting at a beat and playing right away. */
  async load(arrangement: Arrangement, { atBeat = 0, play = false }: { atBeat?: number; play?: boolean } = {}) {
    await this.init();
    this.stopAll();
    this.arrangement = arrangement;
    this.resetClock();
    this.master.gain.setTargetAtTime(1.4 * arrangement.gain, this.ctx.currentTime, 0.02);
    this.setCrackle(false);

    if (arrangement.styleId === "pc81") {
      this.speaker.load(arrangement);
      this.speaker.seek(atBeat);
      this.speaker.rate = this.rate;
      if (play) await this.play();
      return;
    }

    const { bytes, channels } = toMidi(arrangement);
    this.channels = channels;
    const seq = this.seq!;
    const loaded = new Promise<void>((resolve) => {
      seq.eventHandler.addEvent("songChange", "bopbox-load", () => resolve());
      setTimeout(resolve, 1500);
    });
    seq.loadNewSongList([{ binary: bytes.buffer as ArrayBuffer, fileName: `${arrangement.songId}-${arrangement.styleId}.mid` }]);
    await loaded;
    seq.loopCount = this.loop ? -1 : 0;
    seq.playbackRate = this.rate;
    seq.pause();
    seq.currentTime = (atBeat * 60) / arrangement.bpm;
    this.applyMutes();
    if (play) await this.play();
  }

  async play() {
    await this.ctx.resume();
    this.resetClock();
    if (this.isPc81) this.speaker.play();
    else if (this.seq) {
      if (this.seq.isFinished) this.seq.currentTime = 0;
      this.seq.play();
    }
    this.setCrackle(!!this.arrangement?.crackle);
  }

  pause() {
    this.resetClock();
    if (this.isPc81) this.speaker.pause();
    else this.seq?.pause();
    this.setCrackle(false);
  }

  seek(beat: number) {
    const a = this.arrangement;
    if (!a) return;
    const clamped = Math.max(0, Math.min(beat, a.length - 0.01));
    this.resetClock();
    if (this.isPc81) this.speaker.seek(clamped);
    else if (this.seq) this.seq.currentTime = (clamped * 60) / a.bpm;
  }

  setRate(rate: number) {
    this.rate = rate;
    this.speaker.rate = rate;
    if (this.seq) this.seq.playbackRate = rate;
  }

  setLoop(loop: boolean) {
    this.loop = loop;
    this.speaker.loop = loop;
    if (this.seq) this.seq.loopCount = loop ? -1 : 0;
  }

  setMuted(trackId: string, muted: boolean) {
    if (muted) this.muted.add(trackId);
    else this.muted.delete(trackId);
    this.applyMutes();
  }

  private applyMutes() {
    if (!this.synth) return;
    const mutedChannels = new Set([...this.muted].map((id) => this.channels.get(id)).filter((c) => c !== undefined));
    for (const channel of new Set(this.channels.values())) {
      this.synth.midiChannels[channel]?.setSystemParameter("isMuted", mutedChannels.has(channel));
    }
  }

  /** Plays a note from the on-screen keyboard. */
  async keyDown(pitch: number) {
    await this.ctx.resume();
    if (this.isPc81 || !this.synth) {
      this.speaker.key(pitch, true);
      return;
    }
    this.synth.programChange(KEYBOARD_CHANNEL, 0);
    this.synth.noteOn(KEYBOARD_CHANNEL, pitch, 96);
  }

  keyUp(pitch: number) {
    this.speaker.key(pitch, false);
    this.synth?.noteOff(KEYBOARD_CHANNEL, pitch);
  }

  private stopAll() {
    this.seq?.pause();
    this.synth?.stopAll(true);
    this.speaker.pause();
  }

  private setCrackle(on: boolean) {
    if (on && !this.crackle) {
      const buffer = vinylCrackle(this.ctx);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.35;
      source.connect(gain).connect(this.master);
      source.start();
      this.crackle = { source, gain };
    } else if (!on && this.crackle) {
      this.crackle.source.stop();
      this.crackle.gain.disconnect();
      this.crackle = undefined;
    }
  }

  /** Renders the current arrangement to a WAV file, faster than real time. */
  async renderWav(arrangement: Arrangement): Promise<Blob> {
    await this.init();
    const seconds = (arrangement.length * 60) / arrangement.bpm + 2;
    const sampleRate = 44100;
    const offline = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(seconds * sampleRate), sampleRate });
    if (arrangement.styleId === "pc81") {
      Pc81Speaker.renderInto(offline, arrangement);
    } else {
      await offline.audioWorklet.addModule(PROCESSOR_URL);
      const synth = new WorkletSynthesizer(offline);
      const gain = offline.createGain();
      gain.gain.value = 1.2 * arrangement.gain;
      const limiter = offline.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      const trim = offline.createGain();
      trim.gain.value = 0.85;
      synth.connect(gain).connect(limiter).connect(trim).connect(offline.destination);
      const { bytes } = toMidi(arrangement);
      await synth.startOfflineRender({
        midiSequence: BasicMIDI.fromArrayBuffer(bytes.buffer as ArrayBuffer),
        soundBankList: [{ bankOffset: 0, soundBankBuffer: this.bank!.slice(0) }],
        loopCount: 0,
      });
    }
    const rendered = await offline.startRendering();
    return audioBufferToWav(rendered);
  }

  midiFile(arrangement: Arrangement) {
    return new Blob([toMidi(arrangement).bytes as BlobPart], { type: "audio/midi" });
  }
}

// ---------- The 1981 PC speaker ----------

const PIT_CLOCK = 1193180;

/** The frequency MUSIC.BAS actually produced for a MIDI note: its rounded table, then the timer's whole-number divider. */
export function pc81Frequency(midi: number) {
  const key = midi - 20; // piano key number, A4 = 49
  const tableHz = Math.round(36.8 * 2 ** ((key - 6) / 12));
  return PIT_CLOCK / Math.floor(PIT_CLOCK / tableHz);
}

class Pc81Speaker {
  private ctx?: BaseAudioContext;
  private out?: AudioNode;
  private arrangement?: Arrangement;
  private voices: OscillatorNode[] = [];
  private keys = new Map<number, OscillatorNode>();
  private startedAt = 0;
  private startBeat = 0;
  private pausedBeat = 0;
  private endTimer = 0;
  playing = false;
  rate = 1;
  loop = false;
  onEnded?: () => void;

  connect(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx;
    const level = ctx.createGain();
    level.gain.value = 0.09; // a square wave at full scale is brutal
    level.connect(out);
    this.out = level;
  }

  load(arrangement: Arrangement) {
    this.pause();
    this.arrangement = arrangement;
    this.pausedBeat = 0;
  }

  get beat() {
    if (!this.playing || !this.ctx || !this.arrangement) return this.pausedBeat;
    const elapsed = (this.ctx.currentTime - this.startedAt) * (this.arrangement.bpm / 60) * this.rate;
    return this.startBeat + elapsed;
  }

  seek(beat: number) {
    const wasPlaying = this.playing;
    this.pause();
    this.pausedBeat = beat;
    if (wasPlaying) this.play();
  }

  play() {
    const ctx = this.ctx;
    const a = this.arrangement;
    if (!ctx || !a || !this.out) return;
    this.stopVoices();
    if (this.pausedBeat >= a.length - 0.01) this.pausedBeat = 0;
    this.startBeat = this.pausedBeat;
    this.startedAt = ctx.currentTime + 0.05;
    this.playing = true;
    const secondsPerBeat = 60 / a.bpm / this.rate;
    for (const note of a.tracks[0].notes) {
      if (note.at + note.dur <= this.startBeat) continue;
      const from = Math.max(note.at, this.startBeat);
      const start = this.startedAt + (from - this.startBeat) * secondsPerBeat;
      const stop = this.startedAt + (note.at + note.dur - this.startBeat) * secondsPerBeat;
      this.voices.push(squareVoice(ctx, this.out, pc81Frequency(note.pitch), start, stop));
    }
    const remaining = (a.length - this.startBeat) * secondsPerBeat;
    window.clearTimeout(this.endTimer);
    this.endTimer = window.setTimeout(() => {
      if (this.loop) {
        this.pausedBeat = 0;
        this.play();
      } else {
        this.playing = false;
        this.pausedBeat = a.length;
        this.onEnded?.();
      }
    }, remaining * 1000 + 60);
  }

  pause() {
    if (this.playing) this.pausedBeat = this.beat;
    this.playing = false;
    window.clearTimeout(this.endTimer);
    this.stopVoices();
  }

  key(pitch: number, down: boolean) {
    if (!this.ctx || !this.out) return;
    this.keys.get(pitch)?.stop();
    this.keys.delete(pitch);
    if (down) this.keys.set(pitch, squareVoice(this.ctx, this.out, pc81Frequency(pitch), this.ctx.currentTime, this.ctx.currentTime + 4));
  }

  private stopVoices() {
    const now = this.ctx?.currentTime ?? 0;
    for (const voice of this.voices) {
      try {
        voice.stop(now);
      } catch {
        // already stopped
      }
    }
    this.voices = [];
  }

  static renderInto(ctx: OfflineAudioContext, arrangement: Arrangement) {
    const level = ctx.createGain();
    level.gain.value = 0.12;
    level.connect(ctx.destination);
    const secondsPerBeat = 60 / arrangement.bpm;
    for (const note of arrangement.tracks[0].notes) {
      squareVoice(ctx, level, pc81Frequency(note.pitch), note.at * secondsPerBeat, (note.at + note.dur) * secondsPerBeat);
    }
  }
}

function squareVoice(ctx: BaseAudioContext, out: AudioNode, hz: number, start: number, stop: number) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = hz;
  const gate = ctx.createGain();
  gate.gain.setValueAtTime(0, start);
  gate.gain.linearRampToValueAtTime(1, start + 0.002);
  gate.gain.setValueAtTime(1, Math.max(start + 0.002, stop - 0.002));
  gate.gain.linearRampToValueAtTime(0, stop);
  osc.connect(gate).connect(out);
  osc.start(start);
  osc.stop(stop + 0.01);
  return osc;
}

/** Four seconds of dust and pops for the lo-fi style. */
function vinylCrackle(ctx: BaseAudioContext) {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let hiss = 0;
    for (let i = 0; i < length; i++) {
      hiss = hiss * 0.97 + (Math.random() * 2 - 1) * 0.03;
      const pop = Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.5 : 0;
      data[i] = hiss * 0.05 + pop;
    }
  }
  return buffer;
}

async function fetchWithProgress(url: string, onProgress?: (fraction: number) => void): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not load ${url}`);
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress?.(received / total);
  }
  onProgress?.(1);
  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out.buffer;
}
