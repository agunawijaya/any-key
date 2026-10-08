# <Our title>: how the rebuild works

<!-- For programmers who will change the game. Point to files; explain why things are the way they are. -->

One paragraph: the shape of the game in code.

## Module map

A table or Mermaid diagram of `lib/<id>/`, `components/<id>/` and `app/<id>/`: what each file owns.

## State machines

The game's screens and phases as Mermaid state diagrams, with the events that move between them.

## The engine

Rules, scoring and daily generation: pure TypeScript, seeded with the kit RNG. What each function guarantees.

## AI

Opponents, helpers and bots: how they choose, and how strength is tuned. Remove if there are none.

## Drawing

Where every visual is defined (SVG, Canvas, CSS) and how to change it: palettes, light and dark, motion.

## Sound

Where every sound is made and how to change it.

## Kit integration

The manifest (`lib/<id>/manifest.ts`), the shell's pause items and results, the progress store and its
versions, achievements and dailies through the Keyring.

## Tests

Unit tests, check scripts, bots and e2e: what each proves and how to run it.

## Known limits

What is missing or rough, and what would fix it.
