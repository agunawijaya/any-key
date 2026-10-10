# ADR 0012: Ten Turns in the Pit separates rules, choreography and looks behind a style interface

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 10a (Ten Turns in the Pit)

## Context

The prompt plans four looks for the same game: the Spooky Storybook now, and in prompt 10c a Gladiator Arena, 1970s
Graph Paper and a Sci-Fi Lab. A look is a player preference in settings, not an unlock, and rules, pits, records and
dailies must never depend on it. Prompt 10b adds a real-time play style, the Arena, which needs the same looks.

## Decision

**Three layers with one contract between the last two.**

1. **Rules** (`lib/ten-turns/`) decide everything at once: `act`, `rabbitsTurn` and `endTurn` return the new state and
   the hops that led to it.
2. **Choreography** (`components/ten-turns/play/`) turns a rules step into beats: a crouch, a leap, a landing, a page
   turn. Beats move a `Scene` in world terms (cells, poses, effects) and cue sounds by name. The play screens own it.
3. **Styles** (`components/ten-turns/styles/<id>/`) draw. Every animation frame the screen hands the style a
   `SceneFrame` (`scene/view.ts`): the board's lasting features, the kid, the rabbits, floor marks (reachable cells,
   tool targets, the rabbit's intent, rustling grass) and effects (dust, landing shadows, stars, the shout, the page
   turn, the blackout, the burp, things in the air), plus the camera's zoom. The release page gets a
   `ReleaseMoment`.

A style implements `PitStyle` (`styles/style.ts`): `resize`, `setNight`, `setBoard`, `render`, `renderRelease`,
`project`, `cellAt`, `dispose`. `styles/index.ts` lists every style with a factory, or `null` for the coming ones;
Settings and the menu read that list. The chosen style is stored in the save's settings.

## Why

- **Looks can't change outcomes** when they only ever see a frame description after the rules have decided.
- **One choreography for every look.** Timing, anticipation and the order of events (the feel of the game) are
  designed once; a new style only draws poses and effects it is told about.
- **Real time fits too.** The Arena can build `SceneFrame`s from its own clock and every style draws it unchanged.
- **Sound stays with play**, cued by name from the choreography, so a style never has to know about audio.

## Consequences

- A style must draw every pose and effect in `scene/view.ts`, in both appearances, even ones its theme finds odd (a
  1970s graph-paper rabbit still needs a squash pose).
- Adding a new kind of moment means a field in `SceneFrame` and a drawing in every style.
- Buttons over the canvas (the step pads) are placed with the style's `project`, so each style decides its own camera
  and the pads follow.
