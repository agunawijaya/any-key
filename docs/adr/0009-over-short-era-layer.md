# ADR 0009: Over / Short's eras are a cosmetic layer behind one interface

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 07a (Over / Short)

## Context

Over / Short is to be played in four eras: the Great War now; the age of sail and Napoleon, the 1970s and a toy
tabletop in prompt 07c. Records, missions and the daily must stay fair whatever the era, and the player may change
era in the settings at any time.

## Decision

An era is an object of type `Era` (`components/over-short/eras/types.ts`) that supplies only look, sound and words:

- words: what each target kind is called, who the observer is, what the line is;
- the side view's sky and parallax layers; the observer's ground, skyline, props and optic;
- the gun (its drawing and where its muzzle is), the shell, its trail, the flares;
- each target kind in both views and three states, and the vehicles of a moving target;
- the effects for a fall of shot, a hit and the muzzle.

The engine (`lib/over-short/`) never imports an era. Targets in the engine are kinds (`battery`, `dump`, `bridge`,
`railyard`, `mast`, `convoy`), which each era names and draws its own way. The list of eras is `ERAS` in
`components/over-short/eras/index.ts`; the setting stores an era's id.

## Why

- **Fairness by construction.** An era cannot change a shot because it never sees one before it has been decided.
- **One firing screen.** The director and the panels ask the era for drawings and words and never branch on it.
- **Room to grow.** A new era is a folder and one line in `ERAS`; 07c adds three without touching the engine.

## Consequences

- Mission briefings are written with a `{target}` placeholder and era-neutral wording, so they read right in any
  era.
- An era that needs something the interface lacks (a new effect, a different camera for the observer) extends `Era`,
  and every era supplies it; record the extension in a new ADR.
