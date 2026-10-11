# ADR 0014: Sol y Sombra's procedural rig: planned passes, booked footsteps, a simulated cape

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 11a (Sol y Sombra), motion prototype approved by the owner

## Context

The prompt asks for movement good enough to be the README's selling point: a matador with a full skeleton whose feet stay planted and whose weight shifts, a quadruped bull with gaits, braking and turns on the hindquarters, a cloth cape, secondary motion, and all of it shared by every style. Nothing may be keyframed by hand in a tool; everything is code.

## Decision

**A render-independent rig in `lib/sol-y-sombra/rig/`, stepped at 240 Hz**, built from four ideas.

1. **Plan the pass whole, simulate the rest.** When a pass begins, the bull's run is laid out completely (`planTrack`: a path through waypoints, a speed that builds, eases at the cape and brakes, a turn on the hindquarters to face the matador). Because every tick of the run is known, the matador's choreography is written against it: the cape sweeps a set angle ahead of the horns, the chest turns with them, the steps are booked to land before the horns arrive. The engine's outcome (clean, close, gored, rests) shapes the plan. The bull's legs, the cloth and the dust are then simulated on top, so no two passes look alike.
2. **Feet only move inside booked steps.** `Footwork` holds plants and a timeline of steps; a foot is exactly on its plant until a step begins, then peels, swings and lands with matched speeds at the joins. A planted foot can't slide, by construction; the unit test measures exactly zero slide.
3. **Bodies from intents.** A move is described as an `Intent` (heading, weight, crouch, hips, chest, arch, gaze, hands and elbows), and `solveBody` places the pelvis under the legs' reach and solves limbs with two-bone IK with a soft reach and a fallback pole. Acts (`acts.ts`) produce intents tick by tick; a new act blends in over half a second from the last, so nothing pops.
4. **The bull as a carriage and trailer.** The withers go where the cue says; the hips follow at the body's length, which gives turns on the hindquarters for free. A gait clock times the legs at speed; standing, a leg steps only when the body has moved too far from it.

The cape is a 17 × 12 Verlet cloth with stretch, shear and bend links, air drag on each face, wind, collisions with bodies and horns, and pins with weights for the fists (a hand taking hold gathers the cloth).

## Consequences

- Movement is deterministic for a seed and testable in Node: no foot or hoof slides, no joint jolts past a limit, the horns clear the body, the cloth stays stable (`tests/unit/sol-y-sombra-rig.test.ts`).
- Styles only read the rig's state (skeletons, the bull's pose, the cloth's particles, the dust); the Stylized 3D style can dress the same bones.
- New moves are plans plus intents, not animation data; the cost is that each needs its geometry worked out (where the bull runs, where the cape is, where the feet go).
- The rig and the cloth are candidates for the kit: any later game with people or fabric could use them.

## Alternatives considered

- **Keyframed animation** (hand-made curves per move): no tool chain for it under the zero-raster, all-code rule, and the bull's run would have to be fixed rather than responding to where everyone stands.
- **A physics engine for bodies**: ragdolls fall convincingly but don't perform; a matador must be choreographed.
