# ADR 0015: Sol y Sombra's style, play-style and tradition layers

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 11a (Sol y Sombra); prompts 11b and 11c add to each layer

## Context

Prompt 11a builds one of each: the Vintage Poster style, the Classic play style, the Corrida tradition. 11b adds the Stylized 3D style and the Arena play style; 11c the Career play style, the Course Camarguaise and Recortes traditions, and a daily. They must plug in without changing the engine.

## Decision

Three registries, each with one job, and one frame between the rig and the styles.

- **Styles** draw. `components/sol-y-sombra/styles/style.ts` defines `RingFrame` (the people's skeletons, costumes and grips, the bull's pose, the capes' cloth, dust, the crowd and what it has thrown, the sun and its patch on the sand, the lettering, the big-moment flags) and `RingStyle` (`resize`, `paint`). `createStyle(id, canvas)` returns the style the player chose; the poster is a `PosterPainter` on a 2D context, the 3D style will own a WebGL context on the same canvas. The stage (`scene/stage.ts`) composes the frame; the director aims the camera; neither knows which style paints.
- **Play styles** decide how the player acts (`lib/sol-y-sombra/playStyles.ts`). The engine's `moveOdds(move, timing)` and `makePass(move, timing)` take a timing quality (1 in Classic) that the Arena style will measure from the player's hands. Each play style keeps its own records (`Progress.records[playStyle]`).
- **Traditions** decide what the afternoon is for (`lib/sol-y-sombra/traditions.ts`): the moves offered and the finale (a finish, or a time limit). The verdict and the ring serve all of them.

## Consequences

- Rules never depend on the style; a style can't change an outcome.
- The settings already list every play style, tradition and style, with the ones still to come shown and disabled.
- A tradition with new moves needs new ring beats (a `PassKind` planned like the others in `choreography.ts`); the rig is built for that, but each move is real work.

## Alternatives considered

- **One painter with options**: simpler today, but the 3D style shares nothing with Canvas 2D drawing below the frame.
- **Styles reading the ring directly**: they would depend on the rig's internals; the frame keeps them to what a picture needs.
