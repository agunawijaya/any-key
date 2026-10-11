# ADR 0016: Over / Short's Field Artillery runs beside the Campaign's engine, not inside it

- **Status:** Accepted
- **Date:** 2026-10-11
- **Decided in:** prompt 07b (Over / Short)

## Context

Prompt 07b adds a full-physics play style (Field Artillery), the Counter-Battery Duel, the Daily Barrage and the
1970s terminals, and says: do not change Classic or Campaign; if an interface needs more, extend it minimally and
record it.

Field Artillery needs things the Campaign's `Engagement` has no place for:

- **a second and third control:** a charge and a line across the line of fire;
- **a lateral axis:** wind carries rounds sideways, and the observer says left and right;
- **real ground:** a crest can stop a round;
- **enemy fire on a clock**, rather than one enemy round after each of ours;
- **star shells and smoke.**

The duel needs two guns firing at once. The terminals are the two 1973-era programs, not engagements at all.

## Decision

Each new way to play has its own engine module and its own screen; what they share is drawn from the same scene
code.

- **Field Artillery** is `lib/over-short/field.ts` (`FieldEngagement`, `actField`), flown by a 3D model in
  `fieldModel.ts` over a `Terrain` (`terrain.ts`). Its missions are `fieldMissions.ts` and its players
  `fieldBots.ts`. The Campaign's `Engagement`, `act`, `fly` and missions are untouched.
- **The duel** is `duel.ts` (`DuelEngagement`, `actDuel`). It flies both guns' rounds with the same model, and its
  computer commanders are Field Artillery's players with their own settings.
- **The Daily Barrage** (`daily.ts`) is a Field Artillery mission chosen and seeded by the day.
- **The terminals** are `terminal.ts`, a pure state machine per program.
- **The play-style layer** grows only its `PlayStyleId`, which the settings use to remember the last way played.
  The Classic and Campaign `Session` and `PlayStyle` are unchanged; the new sessions live with their screens.

The shared interfaces grow by these additions only; nothing existing changes meaning:

| Where | Addition |
|---|---|
| `Era` | `field`: draw a river, a bridge across its valley, a lorry side-on, the team and limber that move the gun |
| `GunPose` | optional `crew: "serving" \| "ducking"` (left out, the crew serve as before) |
| `SideView` | `setRelief` and `heightY` for real ground; a `foreground` hook drawn over the effects; tiles kept per scale; `prepare` and `warmOne` to paint tiles ahead, and `generation` to know when they were dropped |
| `scene/gunline.ts` | a `Facing` for a gun firing the other way; `drawGunAt`; `drawGunInGlare` |
| `Particles` | optional `pale` on smoke and dust: spray the night does not darken |
| `scene/effects.ts` | `earthRain`, `smokePall`, `waterSpout` |
| `BattleSound` | `telephone`, `starShell`, and `wake`, which opens the audio when a screen opens |

## Why

- **Classic and Campaign stay as they were.** Their records, missions and checks cannot move, because no line of
  their engine changed.
- **Each engine stays small and pure.** One engagement type covering both the Campaign and Field Artillery would
  carry charges, lines, terrain and timers through every Campaign mission that has none of them.
- **The look is shared where it matters.** The battlefield, the eras and the effects are one, so Field Artillery
  and the duel look like the same war as the Campaign.

## Consequences

- Each new era in prompt 07c supplies the `field` drawings as well as the rest of `Era`.
- Three scene fixes made for Field Artillery also show in Classic and the Campaign:
  - The muzzle's smoke on the main screen is placed in magnified-effect metres, so it now comes out of the drawn
    muzzle. Since bursts were magnified it had been drawn far above the screen.
  - Tiles are placed on whole device pixels, which removes a hairline seam between them.
  - A resize to the size the side view already has no longer drops its painted tiles.

  None changes a rule or a record.
- A future style that needs the Campaign's and Field Artillery's turns side by side (none is planned) would need a
  shared engagement interface then, recorded in its own ADR.
