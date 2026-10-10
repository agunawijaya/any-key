# ADR 0008: Over / Short flies every shell through one integrator

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 07a (Over / Short)

## Context

The 1973 game has one physics: range = greatest range × sin 2θ. Over / Short keeps it for Classic and breaks it on
purpose in the Campaign: targets on slopes, wind, air resistance, moving targets, a clock. Prompt 07b will add the
full physics of Field Artillery. Whatever the model, the arc on screen and the observer's report must agree to the
metre, and the engine must stay pure and deterministic.

## Decision

One function, `fly` in `lib/over-short/models.ts`, flies every shell with fourth-order Runge–Kutta at a fixed step
of 0.1 s, and stops where the shell crosses the ground on its way down, solving the crossing inside the last step.
The ground is a straight slope from the gun through the target. Three models differ only in the acceleration:

| Model | Acceleration |
|---|---|
| `vacuum` | gravity |
| `modified` | gravity, plus a push along the line of fire of 0.04 m/s² per m/s of wind |
| `air` | gravity, plus drag: k times the speed through the air times the velocity through the air (the air moves with the wind), k = 4 × 10⁻⁵ per metre |

The flight keeps a path sampled every 0.2 s, which the views draw, so what the player sees is exactly what was judged.

## Why

- **One code path** for every model means one place to be right. With gravity alone, RK4 is exact and the landing
  is solved exactly: the check finds the vacuum model and R · sin 2θ apart by nothing at all, and complementary
  angles landing together.
- **Fixed steps** keep it deterministic on every machine, for the checks now and the daily in 07b.
- **The drag constant is chosen for play**: it costs the gun about a quarter of its vacuum range and brings the best
  angle about three degrees under 45°, and 30° and 60° land 600 to 850 m apart. Real shells lose far more; the lesson
  needs only enough to feel.
- **The modified model's wind** is a simple push, so Chapter 3 can teach "the longer it flies, the more the wind
  takes" before Chapter 4 brings drag in.

## Consequences

- A flight of 80 s is 800 steps: cheap enough for the bots to play thousands of missions in the checks.
- Field Artillery (07b) can use the `air` model as it is; propellant charges change only the muzzle speed, while a
  crosswind would need a second horizontal axis (record that extension in a new ADR).
