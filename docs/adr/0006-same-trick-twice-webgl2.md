# ADR 0006: Same Trick Twice draws its board with WebGL2, without a library

- **Status:** Accepted
- **Date:** 2026-10-09
- **Decided in:** prompt 09 (Same Trick Twice), approved by the owner with the hero frames

## Context

The prompt asks for a hand-carved hardwood board seen at a slight angle, with real depth in the pits, wood grain,
tool marks and a worn polish, glossy natural seeds that settle physically, a sunlit courtyard by day and a single
warm lamp at night, a small brass-cornered book whose pages turn and glow, all at 60 frames a second at
1920 × 1080, with no images. It offered Canvas, WebGL or SVG and asked for an ADR.

## Decision

The board, the table, the seeds and the book are drawn in **3D with raw WebGL2** in one canvas
(`components/long-memory/scene/`), with no library:

1. **Geometry from code.** The board is a fine height grid for the top face (bowls as spherical caps, rounded rims,
   gouge marks) and a band swept round its outline for the sides. Seeds are instanced, squashed spheres. The book is
   boxes and two curved page blocks.
2. **Materials as solid textures.** The wood is a 3D function of position (growth rings round a tilted log axis,
   warped by noise), so every hollow cuts down through the rings as a carved bowl would. The seeds' mottling, the
   stone, the cloth and the leather are noise too. The book's pages are painted with Canvas 2D at run time from the
   Learner's lessons.
3. **One lighting model**: a key light (the sun, or a spot lamp), a shadow map with soft filtering, a sky-and-table
   ambient, a clear-coat specular for the polish, ambient occlusion from the seeds, and the book's glow as a small
   extra light. Tone mapping happens in each shader, so there is no post-processing pass.
4. **The HUD stays in the DOM**: counts, totals, the turn line and the pit buttons are HTML over the canvas,
   positioned from the camera, so they are accessible and crisp.

## Why

- **The look needs light.** Deep bowls, rounded rims catching the sun, seeds with real shadows and a lamp's
  glint are what the prompt describes; lighting them by hand in 2D would be a fake of each effect, one by one.
- **Solid wood is free in 3D.** Rings that run continuously from the face into every hollow come from one function;
  in 2D each hollow would need its own painted grain.
- **No library weight.** three.js would add a large chunk for features we use a few of. The renderer is about
  3,600 lines of our own code, shaders included, loaded only on this game's page.
- **Fast enough.** 60 frames a second at 1920 × 1080 in both appearances on the reference laptop (RTX 4060, Chromium
  through ANGLE and Direct3D 11). The board mesh is static; seeds are one instanced draw.

## Consequences

- A browser without WebGL2 gets a message instead of the board; the 1970s terminal still works.
- WebGL drawn on the processor (no graphics card) cannot carry the full board. The renderer has a light level of
  detail (coarser mesh, cheaper shading, drawing only while something changes), chosen only when the renderer
  is software; any graphics card keeps the full board. See the game's ARCHITECTURE.md.
- New 3D objects follow the same pattern: a mesh builder, a material function in `shaders.ts`, and a draw call in
  `Renderer.ts`.
- The Hall card runs a second, small instance of the same renderer.
