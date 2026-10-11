# ADR 0013: Sol y Sombra draws its Vintage Poster with Canvas 2D over a 3D rig

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 11a (Sol y Sombra), with the owner's approval of the motion prototype and the hero frames

## Context

Sol y Sombra's look is an early-1900s bullfight poster come alive: flat inks, a strong outline, the ring split into a golden sun side and a cool shade side, a poster frame with ornamental lettering, three and a half thousand people in the stands. Its movement is the showpiece: a matador, two crew, a bull and a cloth cape moving in 3D, seen from cameras that change with each beat. Everything is drawn in code (ADR 0002), in light and dark, at 60 frames a second at 1920 × 1080. Prompt 11b adds a Stylized 3D style over the same rig.

## Decision

**Canvas 2D, projecting the 3D rig through a pinhole camera of our own** (`components/sol-y-sombra/render/camera.ts`), drawn by the Vintage Poster style (`components/sol-y-sombra/styles/poster/`).

- **Depth by sorting, not by a z-buffer.** Each figure is broken into parts (limbs as capsules, the head, the cape's cells, the bull's body, legs, horns), each with a depth; parts are painted back to front. Inked outlines make the overlaps read cleanly, as on a print.
- **The bowl painted outside in.** Each layer of the stands (roof, gallery, each row from the top, the wall, the passage, the barrier) is nearer the sand than the layer behind and above it, so painting whole layers from the outside in overlaps correctly from anywhere on the sand, with no per-shape sorting.
- **One path per colour.** Thousands of quads would be thousands of draw calls; each layer is gathered into one `Path2D` per ink and filled once. The GPU process, not the script, had been the bottleneck.
- **Cache what doesn't move.** The sky, the stands with the crowd and the sand are painted into an offscreen canvas, repainted when the camera moves or twelve times a second for the crowd's waving; the paper, rules and lettering are cached until the text or the size changes. The director holds the camera still for each beat, so most frames only composite.
- **Two inks per surface.** Every surface has a sun ink and a shade ink; figures and the cape across the shadow line are mixed towards the shade's tint. Gradients only for the sky and lamp glows.

## Consequences

- 60 fps at 1920 × 1080 with a GPU in the menu, the paseo and the passes (59–60 measured); the simulation costs about 1 ms a frame.
- A moving camera repaints the cached background every frame. Only the lap of honour pans; other beats hold a composed shot.
- Figures are drawn over the cached stands, so a figure behind the wall (the bull deep in the pens' doorway) is drawn over it; the stage hides the bull once it has gone through.
- The style draws a frame the rig composes (`RingFrame`, ADR 0015); a WebGL style can draw the same frame without touching the rig.

## Alternatives considered

- **SVG**: thousands of DOM nodes for the crowd and the cape's cells every frame; too slow.
- **WebGL for the poster**: possible, but flat inks, outlines and lettering are what Canvas 2D does natively, and the hero frames were approved as drawn. WebGL is kept for the Stylized 3D style.
