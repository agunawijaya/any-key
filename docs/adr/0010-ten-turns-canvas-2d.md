# ADR 0010: Ten Turns in the Pit draws its storybook with Canvas 2D

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 10a (Ten Turns in the Pit), approved by the owner with the hero frames

## Context

The Spooky Storybook is a picture book come alive: an earth pit in a meadow seen from above at a gentle angle, a
soft white rabbit that crouches, leaps and lands in a puff of dust, a round-headed kid, a slow-motion squish with a
page turn, a release up a rope ladder at sunrise or moonrise. All of it drawn in code (ADR 0002), in light and dark,
at 60 frames a second at 1920 × 1080. The prompt left the choice of SVG, Canvas or WebGL to this ADR, and asked for a
style layer so that three more looks can follow in prompt 10c (ADR 0012).

## Decision

**Canvas 2D**, one canvas behind every screen of the game (`components/ten-turns/usePitCanvas.ts`), drawn by the
chosen style.

- **A small perspective camera** of our own (`scene/camera.ts`): the pit floor is a plane seen at 54 degrees, so the
  far wall is foreshortened and figures scale with depth. The camera answers both ways: floor to screen for drawing
  and for the buttons laid over the canvas, screen to cell for clicks.
- **Paint once, composite every frame.** The meadow, the pit's walls, roots, pebbles and floor are painted into an
  offscreen canvas once per size, appearance and pit (`styles/storybook/pit.ts`); each frame draws that image, then
  the floor marks, then the upright things sorted back to front, then effects.
- **Inked figures** (`styles/storybook/figure.ts`): each figure is built from parts that are outlined together, filled,
  shaded with a crescent on the side away from the light and rim-lit, so the kid and the rabbit read like ink and
  watercolour without any image.
- **Zoom without blur.** For the squish and other big moments the camera pushes in: while it moves, the painted
  backdrop is stretched to match; once it holds still a sharp backdrop is painted for the new view (after 180 ms).
- **No filters in the frame loop.** Soft shadows and dust are radial gradients; paper grain is a pattern made once.

## Why

- **The hero frames were drawn this way** and approved: soft fur, inked outlines, a moonlit pit with fireflies.
- **2D is what the look is.** A storybook page is flat painting with depth suggested by the camera; WebGL would mean
  shaders or a library for what is mostly layered 2D drawing.
- **Direct control of every stroke.** The rabbit's squash and stretch, the ears' flop, the pounce's arc and the page
  turn are a few lines each in Canvas 2D.
- **Fast enough**, measured in Chromium at 1920 × 1080 on the real game:

| Moment | GPU, light | GPU, dark | No GPU (SwiftShader), light | No GPU, dark |
|---|---|---|---|---|
| Menu (the pit playing itself) | 60 | 60 | 60 | 49 |
| The drop | 60 | 60 | 60 | 60 |
| A turn, waiting | 60 | 60 | 60 | 49 |
| Pounces | 60 | 60 | 60 | 49 |
| The squish (zoom and page turn) | 60 | 60 | 37 | 32 |

## Consequences

- Without a graphics card the squish drops to about 32 to 37 frames a second while the sharp zoomed backdrop is
  repainted. Detail is never lowered on a real graphics card, where everything holds 60.
- A new style is a class that draws a `SceneFrame` on this canvas (ADR 0012); it can paint its own backdrop and camera.
- Text in the canvas (the "SQUISH!" shout, the end page's words) uses the game's self-hosted fonts, so the canvas waits
  for them before its first frame.
