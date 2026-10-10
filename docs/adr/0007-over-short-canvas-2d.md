# ADR 0007: Over / Short draws its battlefield with Canvas 2D

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 07a (Over / Short), approved by the owner with the hero frames

## Context

Over / Short needs two views of one war: the side view, where the camera rides a shell along an arc kilometres long
over a landscape in parallax, and the observer's field glasses, a perspective view of cratered ground with the
target in it and the round landing beyond or before it. Both carry smoke, earth, fire and star-shell light. The
prompt left the choice between Canvas 2D and WebGL to this ADR; the target is 60 frames a second at 1920 × 1080 in
both appearances.

## Decision

**Canvas 2D**, two canvases per firing screen, both painted by one director (`components/over-short/play/director.ts`):

1. **The side view** (`scene/side.ts`): parallax layers painted once into 768-pixel tiles kept in a cache, a sky
   painted once per size and appearance, and at night a second, flare-lit painting of each layer shown through a
   mask of the lights' reach.
2. **The observer's view** (`scene/front.ts`): a ground painted pixel by pixel at half resolution, once per post,
   with props drawn far to near each frame. Its canvas is always full size; in its corner it is only scaled down by
   CSS (and painted every other frame), so filling the screen for the fall of shot repaints nothing.

Particles (`scene/particles.ts`) are shared by both views: soft smoke and dust go through a half-size layer, fire
through a few cached gradient sprites, billows through tinted noise sprites.

## Why

- **The hero frames were drawn this way** and approved: painterly land, billowing smoke, star-shell light.
- **Paint once, composite every frame.** Almost everything that costs is painted once (tiles, sky, ground) and then
  only moved; per frame the work is drawing images and particles.
- **No library.** WebGL would have meant three.js or our own shaders for what is mostly a 2D painting.
- **Fast enough**, measured in Chromium at 1920 × 1080 with the GPU: 60 frames a second on the menu, while aiming,
  during a flight and through the fall of shot, light and dark. One lesson along the way: a `ctx.filter` blur applied
  per draw inside the frame loop (a wall of sandbags in an early hero frame) halved the frame rate; anything blurred
  is painted blurred once and cached.

## Consequences

- Without a graphics card the browser paints on the processor: the canvases are then painted at 0.6 of the screen's
  pixel ratio (`scene/detail.ts`), which keeps 47–60 frames a second by day and 21–30 at night. On a real graphics
  card detail is never lowered.
- Changing the side view's zoom repaints its tiles, so the camera keeps one scale (4,200 m across the screen) and
  moves only sideways.
- Heights in the side view are squeezed, not to scale; the target card states a target's height.
