/*
 * Turning what the rules decided into beats on screen: the drop, the kid's
 * step or tool, every hop of every rabbit (crouch, leap, land, again), and
 * the three endings (squish, crunch, release). Everything here mutates the
 * one Scene the play screen draws each frame; nothing here decides rules.
 */

import { type Cell, kingDistance, same } from "@/lib/ten-turns/geometry";
import type { Action, Hop, TacticsState } from "@/lib/ten-turns/tactics";
import type { ReleaseMoment } from "../styles/style";
import { type BoardView, type EffectsView, type KidView, type MarksView, noEffects, noMarks, type RabbitView, restingRabbit, type Spot, standingKid } from "../scene/view";
import { type Beat, ease, lerp } from "./director";

export type Scene = {
  board: BoardView;
  kid: KidView | null;
  rabbits: RabbitView[];
  marks: MarksView;
  effects: EffectsView;
  zoom: { factor: number; focus: Spot };
  page: "pit" | "release";
  release: ReleaseMoment;
};

/** What the beats tell the screen around them: the chain pips, and sounds to play. */
export type Cue =
  | { kind: "pip"; rabbit: number; count: number; chance: number; again: boolean }
  | { kind: "sound"; name: SoundName };

export type SoundName = "step" | "thump" | "rustle" | "sting" | "again" | "squish" | "crunch" | "chime" | "bonk" | "toss" | "dig" | "pop" | "munch";

export type Choreo = { scene: Scene; reduced: boolean; cue: (cue: Cue) => void };

const has = (list: Cell[], c: Cell) => list.some((x) => same(x, c));

export function boardOf(state: TacticsState, caved: Cell[] = []): BoardView {
  const plan = state.plan;
  return {
    radius: plan.radius,
    rocks: plan.rocks,
    burrows: state.burrows,
    caved: [...plan.burrows.filter((b) => !has(state.burrows, b)), ...caved.filter((c) => !has(plan.burrows, c))],
    tunnels: plan.tunnels.filter(([a, b]) => has(state.burrows, a) && has(state.burrows, b)),
    patches: state.patches,
    stones: state.stones,
    carrots: state.carrots,
  };
}

export function freshScene(state: TacticsState): Scene {
  return {
    board: boardOf(state),
    kid: null,
    rabbits: [],
    marks: noMarks(),
    effects: noEffects(),
    zoom: { factor: 1, focus: { x: 0, y: 0 } },
    page: "pit",
    release: { time: 0, ladder: 0, climb: 0, cheer: 0, rise: 0, hat: true },
  };
}

const facingTo = (from: Spot, to: Spot, fallback: 1 | -1): 1 | -1 => (to.x > from.x + 0.01 ? 1 : to.x < from.x - 0.01 ? -1 : fallback);

/** The kid turns to keep an eye on the nearest rabbit. */
export function faceRabbits(scene: Scene) {
  const kid = scene.kid;
  if (!kid || !scene.rabbits.length) return;
  const nearest = scene.rabbits.reduce((a, b) => (Math.hypot(b.at.x - kid.at.x, b.at.y - kid.at.y) < Math.hypot(a.at.x - kid.at.x, a.at.y - kid.at.y) ? b : a));
  kid.facing = facingTo(kid.at, nearest.at, kid.facing);
  const close = Math.max(Math.abs(nearest.at.x - kid.at.x), Math.abs(nearest.at.y - kid.at.y)) <= 2;
  if (kid.pose === "stand" || kid.pose === "cower") {
    kid.pose = close ? "cower" : "stand";
    kid.mood = close ? "scared" : "brave";
  }
  kid.look = { x: Math.sign(nearest.at.x - kid.at.x) * 0.6, y: nearest.at.y > kid.at.y ? -0.4 : 0.3 };
}

function puff(scene: Scene, at: Spot, size: number) {
  scene.effects.dust.push({ at: { ...at }, age: 0, size });
}

/* ---------- The drop ---------- */

/** The kid falls in from the sky; the rabbit, startled, pops out of the grass. */
export function dropBeats(c: Choreo, at: Cell, rabbits: { at: Cell; temperament: RabbitView["temperament"] }[], hat: boolean): Beat[] {
  const { scene } = c;
  const fallFrom = c.reduced ? 0 : 6;
  return [
    {
      duration: c.reduced ? 0.15 : 0.8,
      start: () => {
        scene.kid = { ...standingKid(at), pose: "fall", mood: "shock", lift: fallFrom, hat, look: { x: 0, y: 0.9 } };
        scene.marks = { ...noMarks(), rustle: scene.marks.rustle };
      },
      update: (k) => {
        const kid = scene.kid!;
        kid.lift = fallFrom * (1 - ease.in(k));
        scene.effects.landing = c.reduced ? [] : [{ at, closeness: ease.in(k), size: 1.6 }];
      },
      end: () => {
        scene.effects.landing = [];
        scene.kid = { ...standingKid(at), hat, squash: 0.8 };
        puff(scene, at, 2);
        c.cue({ kind: "sound", name: "thump" });
      },
    },
    {
      duration: c.reduced ? 0.15 : 0.45,
      start: () => {
        scene.marks.rustle = null;
        scene.rabbits = rabbits.map((r) => ({ ...restingRabbit(r.at, r.temperament), menace: 0.15 }));
        rabbits.forEach((r) => puff(scene, r.at, 1.4));
        c.cue({ kind: "sound", name: "rustle" });
      },
      update: (k) => {
        scene.kid!.squash = lerp(0.8, 1, ease.back(k));
        for (const r of scene.rabbits) {
          r.lift = c.reduced ? 0 : 0.9 * Math.sin(Math.PI * k);
          r.squash = lerp(1.15, 1, k);
        }
      },
      end: () => {
        for (const r of scene.rabbits) r.lift = 0;
        faceRabbits(scene);
      },
    },
  ];
}

/* ---------- The kid's turn ---------- */

/** The kid's step or tool, from `before` to `acted` (the state after the action, before the rabbits move). */
export function playerBeats(c: Choreo, before: TacticsState, action: Action, acted: TacticsState): Beat[] {
  const { scene } = c;
  const from = before.player!;
  const boardAfter = boardOf(acted);
  switch (action.kind) {
    case "move": {
      const into = has(before.burrows, action.to);
      const caved = before.hiddenAt ? [before.hiddenAt, from] : [];
      return [
        {
          duration: 0.26,
          start: () => {
            const kid = scene.kid!;
            kid.pose = "step";
            kid.facing = facingTo(from, action.to, kid.facing);
            c.cue({ kind: "sound", name: "step" });
          },
          update: (k) => {
            const kid = scene.kid!;
            const e = ease.inOut(k);
            kid.at = { x: lerp(from.x, action.to.x, e), y: lerp(from.y, action.to.y, e) };
            kid.lift = c.reduced ? 0 : 0.35 * Math.sin(Math.PI * k);
          },
          end: () => {
            const kid = scene.kid!;
            kid.lift = 0;
            if (caved.length) {
              for (const cell of caved) puff(scene, cell, 1.2);
              c.cue({ kind: "sound", name: "dig" });
            }
            if (into) {
              puff(scene, action.to, 1.2);
              kid.pose = "hidden";
              kid.at = { ...acted.player! };
              if (!same(acted.player!, action.to)) puff(scene, acted.player!, 1.2);
              c.cue({ kind: "sound", name: "rustle" });
            } else kid.pose = "stand";
            scene.board = boardAfter;
          },
        },
      ];
    }
    case "carrot":
      return [
        {
          duration: 0.5,
          start: () => {
            scene.kid!.pose = "cheer";
            c.cue({ kind: "sound", name: "toss" });
          },
          update: (k) => {
            const p = { x: lerp(from.x, action.to.x, k), y: lerp(from.y, action.to.y, k) };
            scene.effects.flying = [{ at: p, lift: 1.4 + 2.2 * Math.sin(Math.PI * k) - 1.4 * k, spin: k * 9 }];
          },
          end: () => {
            scene.effects.flying = [];
            scene.board = boardAfter;
            scene.kid!.pose = "stand";
            puff(scene, action.to, 0.8);
          },
        },
      ];
    case "stone":
      return [
        {
          duration: 0.3,
          update: (k) => {
            scene.kid!.squash = 1 - 0.12 * Math.sin(Math.PI * k);
          },
          end: () => {
            scene.board = boardAfter;
            puff(scene, action.to, 1);
            c.cue({ kind: "sound", name: "thump" });
          },
        },
      ];
    case "dig":
      return [
        {
          duration: 0.55,
          start: () => c.cue({ kind: "sound", name: "dig" }),
          update: (k) => {
            if (Math.floor(k * 4) !== Math.floor((k - 0.05) * 4)) puff(scene, from, 0.9);
            scene.kid!.squash = 1 - 0.15 * Math.abs(Math.sin(k * Math.PI * 4));
          },
          end: () => {
            scene.board = boardAfter;
            scene.kid!.pose = "hidden";
            scene.kid!.squash = 1;
          },
        },
      ];
    case "pull": {
      const patch = action.patch;
      return [
        {
          duration: 0.4,
          start: () => {
            scene.board = boardAfter;
            puff(scene, patch, 0.8);
            c.cue({ kind: "sound", name: "pop" });
          },
          update: (k) => {
            const p = { x: lerp(patch.x, from.x, k), y: lerp(patch.y, from.y, k) };
            scene.effects.flying = [{ at: p, lift: 0.6 + 1.2 * Math.sin(Math.PI * k), spin: -k * 6 }];
          },
          end: () => {
            scene.effects.flying = [];
          },
        },
      ];
    }
    default:
      return [{ duration: 0.2 }];
  }
}

/* ---------- The rabbits' turn ---------- */

/**
 * Every hop of the rabbits' turn. `after` is the state the rules ended in; the
 * board and the hat are brought in line with it as the hops play out.
 */
export function rabbitBeats(c: Choreo, hops: Hop[], after: TacticsState): Beat[] {
  const { scene } = c;
  const beats: Beat[] = [];
  const firstOf = new Set<number>();
  for (const hop of hops) {
    const rabbitIndex = hop.rabbit;
    const first = !firstOf.has(rabbitIndex);
    firstOf.add(rabbitIndex);
    const rabbit = () => scene.rabbits[rabbitIndex];
    const distance = Math.max(1, kingDistance(hop.from, hop.to));
    const target = hop.result === "bonk" ? (hop.hit ?? hop.to) : hop.to;
    const gentle = hop.result === "circle";

    // Crouch: the anticipation, longer before the first pounce of the turn.
    if (!c.reduced) {
      beats.push({
        duration: first ? 0.26 : 0.12,
        start: () => {
          if (!gentle) c.cue({ kind: "sound", name: first ? "sting" : "again" });
          const r = rabbit();
          r.pose = "crouch";
          r.facing = facingTo(hop.from, target, r.facing);
          if (scene.kid && !gentle && kingDistance(hop.from, after.player ?? hop.from) <= 3 && scene.kid.pose !== "hidden") {
            scene.kid.pose = "cower";
            scene.kid.mood = "scared";
          }
        },
        update: (k) => {
          const r = rabbit();
          r.squash = lerp(1, 0.78, ease.out(k));
          r.menace = gentle ? 0.25 : Math.max(r.menace, ease.out(k));
          r.earsBack = gentle ? 0 : 0.7 * k;
          r.mouth = gentle ? 0 : 0.3 * k;
        },
      });
    }

    // The leap: to the landing cell, or part-way to whatever it bonks into and back.
    const bonk = hop.result === "bonk";
    const end = bonk && same(hop.to, hop.from) ? { x: lerp(hop.from.x, target.x, 0.45), y: lerp(hop.from.y, target.y, 0.45) } : hop.to;
    const arc = c.reduced ? 0 : gentle ? 0.7 : 1.3 + 0.35 * distance;
    beats.push({
      duration: c.reduced ? 0.16 : gentle ? 0.3 : 0.36 + 0.06 * distance,
      start: () => {
        const r = rabbit();
        r.pose = gentle ? "sit" : "leap";
        r.facing = facingTo(hop.from, target, r.facing);
        if (!gentle) {
          r.mouth = 0.95;
          r.earsBack = 1;
        }
      },
      update: (k) => {
        const r = rabbit();
        const e = c.reduced ? k : ease.inOut(k);
        r.at = { x: lerp(hop.from.x, end.x, e), y: lerp(hop.from.y, end.y, e) };
        r.lift = arc * Math.sin(Math.PI * k);
        r.flight = k;
        r.squash = gentle ? 1 : 1;
        if (!gentle && !c.reduced) scene.effects.landing = [{ at: end, closeness: ease.in(k), size: 2.4 }];
      },
      end: () => {
        scene.effects.landing = [];
        const r = rabbit();
        r.lift = 0;
        r.flight = 0;
        r.at = { ...end };
      },
    });

    // What the landing meets.
    switch (hop.result) {
      case "bonk":
        beats.push({
          duration: c.reduced ? 0.12 : 0.3,
          start: () => {
            const r = rabbit();
            r.pose = "stunned";
            r.mouth = 0;
            c.cue({ kind: "sound", name: "bonk" });
            scene.effects.stars.push({ at: { ...hop.to }, lift: 2.5, size: 0.7 });
          },
          update: (k) => {
            const r = rabbit();
            // Bounce back off whatever it hit.
            r.at = { x: lerp(end.x, hop.to.x, ease.out(k)), y: lerp(end.y, hop.to.y, ease.out(k)) };
            r.squash = lerp(0.7, 1, ease.back(k));
          },
          end: () => {
            rabbit().at = { ...hop.to };
          },
        });
        break;
      case "hat":
        beats.push(
          {
            duration: 0.14,
            start: () => {
              c.cue({ kind: "sound", name: "pop" });
              const r = rabbit();
              r.pose = "sit";
              r.hat = true;
              puff(scene, hop.to, 1.3);
              if (scene.kid) {
                scene.kid.hat = false;
                scene.kid.mood = "shock";
                scene.kid.pose = "cower";
              }
            },
            update: (k) => {
              rabbit().squash = lerp(0.7, 1, k);
            },
          },
          {
            duration: c.reduced ? 0.12 : 0.3,
            update: (k) => {
              const r = rabbit();
              r.at = { x: lerp(hop.to.x, hop.from.x, ease.out(k)), y: lerp(hop.to.y, hop.from.y, ease.out(k)) };
              r.lift = c.reduced ? 0 : 0.8 * Math.sin(Math.PI * k);
            },
            end: () => {
              const r = rabbit();
              r.at = { ...hop.from };
              r.lift = 0;
            },
          },
        );
        break;
      case "carrot":
        beats.push({
          duration: c.reduced ? 0.2 : 0.7,
          start: () => {
            const r = rabbit();
            r.pose = "eat";
            r.menace = 0;
            scene.board = { ...scene.board, carrots: scene.board.carrots.filter((x) => !same(x, hop.to)) };
            c.cue({ kind: "sound", name: "munch" });
          },
          end: () => {
            rabbit().pose = "sit";
          },
        });
        break;
      case "crunch":
        beats.push(...crunchBeats(c, rabbitIndex));
        break;
      default:
        beats.push({
          duration: c.reduced ? 0.06 : 0.14,
          start: () => {
            const r = rabbit();
            r.pose = gentle ? "sit" : "crouch";
            if (!gentle) {
              puff(scene, hop.to, 1.5);
              c.cue({ kind: "sound", name: "thump" });
            }
            if (hop.chance > 0) c.cue({ kind: "pip", rabbit: rabbitIndex, count: countOf(hops, hop), chance: hop.chance, again: hop.again });
          },
          update: (k) => {
            rabbit().squash = gentle ? 1 : lerp(0.72, 1, ease.out(k));
          },
          end: () => {
            const r = rabbit();
            r.pose = "sit";
            r.mouth = 0.2;
            faceRabbits(scene);
          },
        });
        // A beat to let the pips land before another pounce.
        if (hop.again && !c.reduced) beats.push({ duration: 0.22 });
    }
  }

  // Settle: the board as the rules left it, everyone a little calmer.
  beats.push({
    duration: c.reduced ? 0.05 : 0.25,
    start: () => {
      scene.board = boardOf(after, scene.board.caved);
      after.rabbits.forEach((r, i) => {
        const view = scene.rabbits[i];
        if (!view) return;
        view.at = { ...r.at };
        view.pose = r.dazed ? "stunned" : "sit";
      });
      if (scene.kid && after.player) {
        // Classic has no hat rule; the kid keeps it on.
        scene.kid.hat = after.hat || after.plan.rules === "classic";
        if (scene.kid.pose !== "hidden") scene.kid.at = { ...after.player };
      }
    },
    update: (k) => {
      for (const r of scene.rabbits) {
        r.menace = lerp(r.menace, after.plan.rules === "classic" ? 0.35 : 0.55, k);
        r.earsBack = lerp(r.earsBack, 0, k);
        r.mouth = lerp(r.mouth, 0, k);
        r.squash = 1;
      }
    },
    end: () => {
      scene.effects.stars = [];
      after.rabbits.forEach((r, i) => {
        if (r.dazed) scene.effects.stars.push({ at: { ...r.at }, lift: 2.5, size: 0.7 });
        if (scene.rabbits[i]) scene.rabbits[i].hat = !after.hat && scene.rabbits[i].hat;
      });
      faceRabbits(scene);
    },
  });
  return beats;
}

/** Which pounce of its rabbit's turn a hop is, counting from 1. */
function countOf(hops: Hop[], hop: Hop) {
  let n = 0;
  for (const h of hops) {
    if (h.rabbit !== hop.rabbit) continue;
    n++;
    if (h === hop) return n;
  }
  return n;
}

/* ---------- Endings ---------- */

/** The crunch: a cloud of dust, the dark closing in like the end of a story, and a small word in the dark. */
export function crunchBeats(c: Choreo, rabbitIndex: number): Beat[] {
  const { scene } = c;
  const at = () => scene.rabbits[rabbitIndex].at;
  return [
    {
      duration: c.reduced ? 0.2 : 0.5,
      start: () => {
        scene.kid = null;
        puff(scene, at(), 3);
        c.cue({ kind: "sound", name: "crunch" });
        if (!c.reduced) scene.zoom = { factor: 1, focus: { ...at() } };
        const r = scene.rabbits[rabbitIndex];
        r.pose = "sit";
        r.menace = 1;
        r.mouth = 0.6;
      },
      update: (k) => {
        if (!c.reduced) scene.zoom = { factor: lerp(1, 1.5, ease.out(k)), focus: { ...at() } };
        scene.rabbits[rabbitIndex].squash = lerp(0.7, 1.05, ease.back(k));
      },
    },
    {
      duration: c.reduced ? 0.3 : 0.9,
      start: () => {
        scene.effects.shout = { text: "CRUNCH!", at: { ...at() }, lift: 4.2, age: 0 };
      },
      update: (k) => {
        scene.effects.shout!.age = Math.min(1, k * 1.6);
        scene.effects.blackout = c.reduced ? k * 0.85 : ease.inOut(Math.min(1, k * 1.2)) * 0.88;
      },
    },
    {
      duration: c.reduced ? 0.4 : 1.1,
      start: () => {
        scene.effects.shout = null;
        scene.effects.burp = { at: { ...at() }, age: 0 };
      },
      update: (k) => {
        scene.effects.burp!.age = k;
      },
    },
  ];
}

/** Dropped right on the rabbit: a slow fall, a flattening, stars, and the page turns to the happy ending. */
export function squishBeats(c: Choreo, at: Cell, temperament: RabbitView["temperament"]): Beat[] {
  const { scene } = c;
  const height = c.reduced ? 0 : 9;
  return [
    {
      duration: c.reduced ? 0.2 : 1.6,
      start: () => {
        scene.marks = noMarks();
        scene.rabbits = [{ ...restingRabbit(at, temperament) }];
        scene.kid = { ...standingKid(at), pose: "fall", mood: "shock", lift: height, look: { x: 0, y: 0.9 } };
      },
      update: (k) => {
        // Slow at first, quick at the end: the storybook's slow motion.
        const fall = k ** 2.6;
        scene.kid!.lift = height * (1 - fall);
        if (!c.reduced) {
          scene.effects.landing = [{ at, closeness: fall, size: 2.4 }];
          scene.zoom = { factor: lerp(1, 1.7, ease.inOut(k)), focus: { x: at.x, y: at.y + 0.6 } };
        }
        const r = scene.rabbits[0];
        r.look = { x: 0.1, y: k > 0.65 ? -1 : 0.2 };
        r.mouth = k > 0.75 ? 0.25 : 0;
      },
      end: () => {
        scene.effects.landing = [];
        c.cue({ kind: "sound", name: "squish" });
      },
    },
    {
      duration: c.reduced ? 0.2 : 0.9,
      start: () => {
        const r = scene.rabbits[0];
        r.pose = "flat";
        r.flat = 0;
        scene.kid = { ...scene.kid!, pose: "sit", lift: 0.2, mood: "shock", squash: 0.72 };
        puff(scene, at, 4);
        scene.effects.stars = [{ at: { x: at.x + 1.55, y: at.y }, lift: 1.2, size: 0.8 }];
        scene.effects.shout = { text: "SQUISH!", at: { x: at.x + 0.3, y: at.y }, lift: 5.6, age: 0 };
      },
      update: (k) => {
        scene.rabbits[0].flat = ease.out(Math.min(1, k * 6));
        scene.kid!.squash = lerp(0.72, 1, ease.back(Math.min(1, k * 2)));
        scene.kid!.mood = k > 0.5 ? "joy" : "shock";
        scene.effects.shout!.age = Math.min(1, k * 1.3);
      },
    },
    {
      duration: c.reduced ? 0.1 : 2.2,
      start: () => c.cue({ kind: "sound", name: "chime" }),
      update: (k) => {
        scene.effects.pageTurn = { amount: c.reduced ? 1 : k ** 1.6 * 0.9, title: "You are free!", line: "Squashed it flat before it could blink.", picture: "squish" };
      },
    },
  ];
}

/** Ten turns survived: a rope ladder unrolls, the kid climbs out, and the sun or moon comes up. */
export function releaseBeats(c: Choreo, hat: boolean): Beat[] {
  const { scene } = c;
  const set = (patch: Partial<ReleaseMoment>) => {
    scene.release = { ...scene.release, ...patch };
  };
  return [
    {
      duration: c.reduced ? 0.1 : 0.3,
      start: () => {
        scene.page = "release";
        set({ time: 0, ladder: 0, climb: 0, cheer: 0, rise: 0, hat });
        c.cue({ kind: "sound", name: "chime" });
      },
    },
    {
      duration: c.reduced ? 0.2 : 1.1,
      // The ladder drops with a bounce: it overshoots its length a little, then settles.
      update: (k) => set({ ladder: c.reduced ? 1 : Math.min(1, 1 - Math.cos(k * Math.PI * 2.5) * (1 - k) ** 2 * 0.1 - (1 - k) ** 3) }),
    },
    {
      duration: c.reduced ? 0.3 : 2.6,
      update: (k) => set({ climb: c.reduced ? 1 : ease.inOut(k), rise: k * 0.5 }),
    },
    {
      duration: c.reduced ? 0.2 : 1.2,
      update: (k) => set({ cheer: ease.out(k), rise: 0.5 + k * 0.5 }),
    },
  ];
}
