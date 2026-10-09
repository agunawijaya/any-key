# ADR 0005: Two Humps draws its Gobi with Canvas 2D

- **Status:** Accepted
- **Date:** 2026-10-09
- **Decided in:** prompt 03 (Two Humps), approved by the owner with the hero frames

## Context

Two Humps needs a side-on diorama with six parallax layers of dunes and ranges, a sky that follows a clock from
dawn to night with a turning star field and the Milky Way, a towering storm wall of dust, a rigged camel, a rival
caravan, a gang of jerboas, firelight and lanterns. The brief offered two ways to draw it: Canvas 2D with offscreen
layers, or WebGL with three.js, loaded lazily, for the storm and the sky. The target is 60 frames a second at
1920 × 1080 in both appearances, with reduced motion honoured, and nothing loaded from the network.

## Decision

Everything is drawn with **Canvas 2D** in one canvas per scene (`components/two-humps/scene/Diorama.ts`), with two
offscreen buffers:

1. **A backdrop** holding the sky, the sun, the stars and the three farthest layers. It is repainted only when the
   trek's clock or the far dunes move, or three times a second for the stars' twinkle.
2. **The storm wall**, painted at half the screen's size (never wider than 960 pixels) at most 24 times a second
   and scaled up, since dust is soft.

The near layers, the actors and the effects are drawn every frame.

## Why

- **It looks the part already.** The hero frames the owner approved were drawn this way: soft-lit billows for the
  storm, a column-shaded dune surface with slip faces, a Milky Way glow painted once and rotated.
- **One drawing model.** The camel, the jerboas, the gers and the dunes share light (`lightAt`) and paint helpers.
  A WebGL storm and sky would need a second light model kept in step with the first, and a second canvas to
  composite.
- **Weight.** three.js would add a large lazy chunk for two effects. Canvas 2D costs nothing to load.
- **Fast enough.** With the two buffers, measured in Chromium with the GPU: 60 frames a second at 1920 × 1080 on
  the menu and on the trek in both appearances; 53 to 56 at 2560 × 1440. Without a GPU (software rendering) the
  same scenes run at 20 to 30, which is the price of drawing everything by hand.

## Consequences

- A scene hooks in from layer 3 up; layers 0–2 live in the cached backdrop and can't have actors between them.
- Big full-screen effects (the sun's wash on the sand, the storm's shade) are drawn every frame and are the first
  place to look if a slower machine struggles.
- If the storm ever needs real volume (light scattering through the dust), WebGL is still the way to do it, in its
  own canvas behind the diorama.
