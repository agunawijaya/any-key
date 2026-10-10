import { Lane, type Hit } from "./cues";

/*
 * Who plays which note. A drummer has four limbs and a pianist two hands,
 * and the arrangement only says which notes sound. These functions share
 * the notes out the way a player would, so each hand gets a lane of its own
 * and can be animated with `strike` from cues.ts.
 */

export type KitPiece =
  | "kick"
  | "snare"
  | "rim"
  | "clap"
  | "hat"
  | "hatOpen"
  | "pedalHat"
  | "ride"
  | "bell"
  | "crash"
  | "splash"
  | "china"
  | "tomHigh"
  | "tomMid"
  | "tomLow"
  | "tambourine"
  | "shaker"
  | "cowbell"
  | "congaOpen"
  | "congaMute"
  | "congaLow"
  | "bongoHigh"
  | "bongoLow"
  | "timbale"
  | "claves"
  | "wood"
  | "triangle"
  | "guiro"
  | "maracas";

/** General MIDI drum notes, by the piece a drummer would reach for. */
const GM_PIECE: Record<number, KitPiece> = {
  35: "kick",
  36: "kick",
  37: "rim",
  38: "snare",
  39: "clap",
  40: "snare",
  41: "tomLow",
  42: "hat",
  43: "tomLow",
  44: "pedalHat",
  45: "tomLow",
  46: "hatOpen",
  47: "tomMid",
  48: "tomMid",
  49: "crash",
  50: "tomHigh",
  51: "ride",
  52: "china",
  53: "bell",
  54: "tambourine",
  55: "splash",
  56: "cowbell",
  57: "crash",
  59: "ride",
  60: "bongoHigh",
  61: "bongoLow",
  62: "congaMute",
  63: "congaOpen",
  64: "congaLow",
  65: "timbale",
  66: "timbale",
  69: "shaker",
  70: "maracas",
  73: "guiro",
  74: "guiro",
  75: "claves",
  76: "wood",
  77: "wood",
  80: "triangle",
  81: "triangle",
  82: "shaker",
};

export const kitPiece = (pitch: number): KitPiece | undefined => GM_PIECE[pitch];

export type KitHit = Hit & { piece: KitPiece };

export type Limb = "rightHand" | "leftHand" | "rightFoot" | "leftFoot";

export type KitLimbs = Record<Limb, Lane> & { pieces: Set<KitPiece> };

const FOOT: Partial<Record<KitPiece, Limb>> = { kick: "rightFoot", pedalHat: "leftFoot" };
/** Pieces the leading (right) hand keeps time on; the left hand owns the backbeat. */
const LEADING: KitPiece[] = ["hat", "hatOpen", "ride", "bell", "crash", "splash", "china", "cowbell", "tambourine", "shaker", "maracas", "triangle", "claves", "wood"];
const BACKBEAT: KitPiece[] = ["snare", "rim", "clap"];

/** Simultaneous within this many seconds. */
const TOGETHER = 0.012;
/** A hand can't strike again sooner than this; a faster stream alternates hands. */
const HAND_REST = 0.1;

/**
 * Shares a drum track's hits among a drummer's limbs: kick and hi-hat pedal
 * to the feet, time-keeping to the right hand, backbeat to the left, toms to
 * whichever hand is free, and fast runs alternated hand to hand.
 */
export function splitKit(lane: Lane): KitLimbs {
  const out: Record<Limb, KitHit[]> = { rightHand: [], leftHand: [], rightFoot: [], leftFoot: [] };
  const pieces = new Set<KitPiece>();
  const lastHand = { rightHand: -Infinity, leftHand: -Infinity };
  const hits = lane.hits.flatMap((h) => {
    const piece = kitPiece(h.pitch);
    return piece ? [{ ...h, piece }] : [];
  });
  for (let i = 0; i < hits.length; ) {
    const group: KitHit[] = [];
    const at = hits[i].t;
    while (i < hits.length && hits[i].t - at < TOGETHER) group.push(hits[i++]);
    const used = new Set<Limb>();
    // Cymbals and time first, so a crash takes the right hand from the hi-hat.
    const order = (h: KitHit) => (FOOT[h.piece] ? 0 : h.piece === "crash" || h.piece === "splash" || h.piece === "china" ? 1 : LEADING.includes(h.piece) ? 2 : 3);
    group.sort((a, b) => order(a) - order(b));
    for (const hit of group) {
      pieces.add(hit.piece);
      const foot = FOOT[hit.piece];
      if (foot) {
        if (!used.has(foot)) out[foot].push(hit);
        used.add(foot);
        continue;
      }
      const preferred: Limb = BACKBEAT.includes(hit.piece) ? "leftHand" : LEADING.includes(hit.piece) ? "rightHand" : lastHand.rightHand <= lastHand.leftHand ? "rightHand" : "leftHand";
      const other: Limb = preferred === "rightHand" ? "leftHand" : "rightHand";
      const tired = (limb: "rightHand" | "leftHand") => hit.t - lastHand[limb] < HAND_REST;
      let hand: "rightHand" | "leftHand" | undefined = preferred as "rightHand" | "leftHand";
      if (used.has(hand) || (tired(hand) && !used.has(other) && !tired(other as "rightHand" | "leftHand"))) hand = other as "rightHand" | "leftHand";
      if (used.has(hand)) hand = undefined;
      if (!hand) continue;
      used.add(hand);
      lastHand[hand] = hit.t;
      out[hand].push(hit);
    }
  }
  return {
    rightHand: new Lane(out.rightHand),
    leftHand: new Lane(out.leftHand),
    rightFoot: new Lane(out.rightFoot),
    leftFoot: new Lane(out.leftFoot),
    pieces,
  };
}

/** The piece a lane's hit landed on (lanes from splitKit carry it). */
export const pieceOf = (hit: Hit | undefined) => (hit as KitHit | undefined)?.piece;

export type TwoHands = { left: Lane; right: Lane };

/**
 * Two mallets or two hands on pitched bars (timpani, marimba, steel drum):
 * the lower note of a pair goes left, a single line alternates when it runs
 * fast and otherwise follows the side of the instrument it is on.
 */
export function splitMallets(lane: Lane, lo: number, hi: number): TwoHands {
  const left: Hit[] = [];
  const right: Hit[] = [];
  const middle = (lo + hi) / 2;
  let lastLeft = -Infinity;
  let lastRight = -Infinity;
  for (let i = 0; i < lane.hits.length; ) {
    const group: Hit[] = [];
    const at = lane.hits[i].t;
    while (i < lane.hits.length && lane.hits[i].t - at < TOGETHER) group.push(lane.hits[i++]);
    group.sort((a, b) => a.pitch - b.pitch);
    if (group.length >= 2) {
      left.push(group[0]);
      right.push(group[group.length - 1]);
      lastLeft = lastRight = at;
      continue;
    }
    const hit = group[0];
    let toRight = hit.pitch >= middle;
    if (toRight && at - lastRight < HAND_REST * 1.4 && at - lastLeft >= HAND_REST) toRight = false;
    else if (!toRight && at - lastLeft < HAND_REST * 1.4 && at - lastRight >= HAND_REST) toRight = true;
    if (toRight) {
      right.push(hit);
      lastRight = at;
    } else {
      left.push(hit);
      lastLeft = at;
    }
  }
  return { left: new Lane(left), right: new Lane(right) };
}

/**
 * A keyboard player's two hands. A tune on its own stays in the right hand;
 * chords are split at their middle, the low notes to the left hand.
 */
export function splitKeys(lane: Lane, { melodyOnly = false } = {}): TwoHands {
  const left: Hit[] = [];
  const right: Hit[] = [];
  for (let i = 0; i < lane.hits.length; ) {
    const group: Hit[] = [];
    const at = lane.hits[i].t;
    while (i < lane.hits.length && lane.hits[i].t - at < TOGETHER) group.push(lane.hits[i++]);
    if (melodyOnly || group.length === 1) {
      right.push(...group);
      continue;
    }
    group.sort((a, b) => a.pitch - b.pitch);
    const cut = Math.ceil(group.length / 2);
    left.push(...group.slice(0, cut));
    right.push(...group.slice(cut));
  }
  return { left: new Lane(left), right: new Lane(right) };
}

/** Every note of the chord a hand is holding or about to play, lowest first. */
export function chordAround(lane: Lane, t: number) {
  const { prev, next } = lane.around(t);
  const anchor = prev && (!next || t < prev.end || next.t - t > 0.12) ? prev : next;
  if (!anchor) return [];
  return lane.hits.filter((h) => Math.abs(h.t - anchor.t) < TOGETHER).sort((a, b) => a.pitch - b.pitch);
}

// ---------- Bowing ----------

export type BowState = {
  /** Where the bow touches the string: 0 at the frog, 1 at the tip. */
  pos: number;
  /** +1 a down-bow (frog towards tip), -1 an up-bow. */
  dir: number;
  /** 0 on the string, 1 lifted off between phrases. */
  lift: number;
  /** The note being bowed, if any. */
  hit?: Hit;
};

type Stroke = { hit: Hit; from: number; to: number; dir: number };

/**
 * Bow strokes for a bowed line. Phrases start on a down-bow and the bow
 * changes direction with every new note, travelling further on long notes
 * (a whole bow for a held note, a few centimetres for quick ones). Where a
 * stroke would run off the end of the bow, it starts from the other end.
 */
export function bowStrokes(lane: Lane): (t: number) => BowState {
  const strokes: Stroke[] = [];
  let pos = 0.15;
  let dir = 1;
  let prevEnd = -Infinity;
  const onsets = lane.hits.filter((h, i, all) => i === 0 || h.t - all[i - 1].t > TOGETHER);
  for (const hit of onsets) {
    const phraseStart = hit.t - prevEnd > 0.35;
    dir = phraseStart ? 1 : -dir;
    if (phraseStart) pos = Math.min(pos, 0.3);
    const travel = Math.min(0.85, 0.12 + (hit.end - hit.t) * 0.42);
    let to = pos + dir * travel;
    if (to > 1 || to < 0) {
      // Not enough bow left this way: a player would have saved bow, so turn it round.
      dir = -dir;
      to = Math.min(1, Math.max(0, pos + dir * travel));
    }
    strokes.push({ hit, from: pos, to, dir });
    pos = to;
    prevEnd = hit.end;
  }
  const strokeLane = new Lane(strokes.map((s) => s.hit));
  return (t: number) => {
    const index = strokeLane.lastIndex(t);
    if (index < 0) return { pos: strokes[0]?.from ?? 0.2, dir: 1, lift: 1 };
    const stroke = strokes[index];
    const { hit } = stroke;
    const length = Math.max(0.05, hit.end - hit.t);
    const u = Math.min(1, (t - hit.t) / length);
    // The bow moves fastest in the middle of a stroke and eases at both ends.
    const eased = u < 1 ? 0.5 - Math.cos(u * Math.PI) / 2 : 1;
    const at = stroke.from + (stroke.to - stroke.from) * eased;
    const next = strokes[index + 1];
    const silence = next ? next.hit.t - hit.end : Infinity;
    const after = t - hit.end;
    // Between phrases the bow lifts, then settles back for the next down-bow.
    const lift = after > 0 && silence > 0.3 ? Math.min(1, after / 0.25) * (next ? Math.min(1, (next.hit.t - t) / 0.2) : 1) : 0;
    const resetTo = next && next.from !== stroke.to ? next.from : at;
    const settled = lift > 0 ? at + (resetTo - at) * Math.min(1, after / Math.max(0.2, silence)) : at;
    return { pos: settled, dir: stroke.dir, lift, hit: t < hit.end ? hit : undefined };
  };
}
