# ADR 0011: Ten Turns in the Pit keeps three rabbit models and proves every pit with a solver

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided in:** prompt 10a (Ten Turns in the Pit)

## Context

*Man-Eating Rabbit* has bugs that decide the game (NOTES.md): line 131 drags the player to the middle rows, a rabbit
straight south of the player never moves, a landing in the last turn is never checked, the rabbit can leave the pit.
The prompt asks for the original turn for turn in 1970s mode, a Classic play style with the rules put right, and a
Tactics campaign whose every pit is survivable. Our rule (memory: every table winnable) is that no game we deal can
be lost by correct play from the start.

With every bug fixed the 1970s game turns out to be brutal: perfect play survives a blind drop only a third of the
time, and a rabbit that starts three steps away wins 97 % of the time.

## Decision

**Three models, one engine for play.**

1. **The 1970s program** (`lib/ten-turns/original.ts`): its arithmetic exactly, including its pi, its rounding and
   the angle cut to whole degrees, with each quirk a switch. 1970s mode runs it with every switch on.
2. **Classic** (`lib/ten-turns/classic.ts`): the same pounce and chain odds, every quirk fixed, the rabbit kept in the
   pit by swinging along the wall. To keep Classic fair, the rabbit is placed **after** the player's blind drop: on
   them 1 time in 317 (the original's squish odds), otherwise at random among the cells where perfect play still
   survives at least 40 %.
3. **Tactics** (`lib/ten-turns/tactics.ts`): the first pounce of a turn is locked on the cell the player starts it on
   and shown; four temperaments vary the chain odds and the reach; rocks and stones stop pounces; the hat saves once.
   Classic runs through the same engine with `rules: "classic"`, so there is one code path for play.

**Proof by solver and policy.** `solver.ts` solves the 1970s and Classic games exactly by backward induction;
`tacticsSolver.ts` solves a Tactics pit against one rabbit (player, rabbit, hat, dazed). A policy built on it, with one
turn of lookahead over every way the pounces can go, plays every campaign pit 200 times and every Daily Pit 80 times
in `npm run check:ten-turns`; each must clear a floor (88 % in chapter 1 down to 72 % in chapter 5, 70 % for a Daily).

**Two rules came from the solver**, not from design: a rabbit that bonks is dazed next turn and steps round
obstacles (otherwise one rock hid the player for the whole game), and a burrow caves in once you climb out (otherwise
a tunnel could be ridden back and forth for ever).

## Why

- **Faithful and fair are different games.** The 1970s rules are worth keeping exactly, bugs and all, as a curiosity
  and a puzzle; they are not a fair game. Splitting the models lets 1970s mode be exact while Classic and Tactics are
  sound.
- **Placing the rabbit after the drop** keeps the original's feel (you drop blind, and a lucky drop squashes it) while
  ruling out starts nobody could survive. It changes no rule the player can see.
- **A solver is cheaper than guessing.** It found both exploits above in minutes and tuned every pit's start so the
  chapters rise in difficulty.
- **One engine for Classic and Tactics** means one set of bugs, one animation path and one set of checks.

## Consequences

- The Tactics solver leaves out tools, carrots and second rabbits; the policy's survival rates are lower bounds on
  good play, so the floors are conservative.
- The Daily Pit's generator must solve the day's ground in the browser (one to three seconds, in a Web Worker).
- Any change to the Tactics rules must keep `scripts/check-ten-turns.ts` passing, including the check that the solver
  and the engine agree at sampled positions.
