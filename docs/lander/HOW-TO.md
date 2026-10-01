# Lander (LANDER.BAS): How to Play the Original

This guide explains how to run and play the original 1979 *Lander* (`lander.bas`), which Any Key is rebuilding as **Don't Crater**. It covers running the program today, the questions it asks, what the screen shows, the rules, how a game ends, and a strategy that lands softly on every world.

For background see [ABOUT.md](ABOUT.md). For the formulas and internals see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

## The rules in one paragraph

You start high above a world, falling at 5,000 km/h. Every ten seconds you choose a burn rate from 0 to 100. The engine slows you down in proportion to the burn, and uses that much fuel for every second it runs. Reach the ground slower than 20 km/h to survive; at 5 km/h or less you also get to plant a flag. Run out of fuel and you fall the rest of the way.

## Running it today

`lander.bas` is a plain-text listing for a **TRS-80 Model I or III with Level II BASIC**. It will not run in GW-BASIC or other PC BASICs: it depends on the TRS-80's screen, its block graphics and its cursor codes.

1. Use a TRS-80 emulator that can type or load a BASIC listing (for example *trs80gp* or *sdltrs*, or an online Model I/III emulator). Choose a Model I or III with Level II BASIC and at least 16K of memory.
2. Load the listing as BASIC text, or paste it into the emulator's keyboard buffer, then type `RUN`.
3. The listing contains the label `<16>` inside one terrain string. On a real machine that was a single character. Replace the four characters with one space (or join a `CHR$(191)` block in its place), or the ground on that screen will be shifted by three characters.

On the original hardware the program came on cassette and was loaded with `CLOAD`.

## What happens, screen by screen

1. **Title.** A big-letter title and the publisher's copyright, then a question: do you want instructions? Answer `1` for yes, `2` for no.
2. **A pause.** While a message asks you to wait, the program builds its pictures: the lander, the flames, the dust, the astronaut, the flag and six versions of the ground. On a 1.77 MHz Z80 this took a noticeable moment. If you asked for instructions, a page of them appears here, followed by a second pause.
3. **Choose a world.** `1` Earth, `2` the Moon, `3` Mars, `4` Asteroid Alpha. Anything else asks again.
4. **The flight screen.** A framed panel at the top right shows the elapsed time, height (km), speed (km/h, positive means falling) and fuel. Below it the program asks for a burn rate. Your lander sits near the top of the screen; the ground is at the bottom, with the world's name under it.
5. **Each turn.** Type a number and press ENTER. The flame under the lander flickers, more times for bigger burns, and ten seconds of flight are worked out at once. The panel updates and the ground is redrawn if you have passed a height mark (100, 50, 25, 10 and 1 km). Below 1 km the lander steps down the screen towards the landing strip, and near the ground its exhaust kicks up dust.
6. **The ending.** At touchdown (or when the fuel runs out) an animation plays, then the verdict appears at the top left: what happened, your impact speed and the elapsed time. The program asks whether to try again: `1` goes back to the choice of world, `2` ends the program.

## What the program accepts

| You type | What happens |
|---|---|
| A number from 0 to 100 | Used as this turn's burn. Decimals such as 37.5 are fine. |
| 0 | No burn: you fall freely for ten seconds. |
| A negative number, or more than 100 | Refused. A warning flashes about twenty times, then you are asked again. No time passes. |
| Text | Level II BASIC's own input check rejects it (with `?REDO`) before the program sees it. |
| Just ENTER | Level II BASIC keeps the variable's previous value, so the last burn is used again. This is how we understand Level II's `INPUT`; Don't Crater's 1979 mode copies it. |

## How a game ends

The verdict depends only on the speed at impact:

| Speed at impact | Verdict | Animation |
|---|---|---|
| Under 2 km/h | Landed, excellent | A cheer, then the astronaut and flag |
| 2 to 5 km/h | Landed, not bad | A cheer, then the astronaut and flag |
| 5 to 19 km/h | Landed, rough | A cheer |
| 19 to 20 km/h | Landed, rough | **A wreck with rising sparks** (the two use different cut-offs) |
| 20 to 30 km/h | Crashed: module destroyed | A wreck with rising sparks |
| 30 to 45 km/h | Crashed: module destroyed, pilot hurt | A wreck with rising sparks |
| 45 to 100 km/h | Crashed: no survivors | Flashing explosion, then the wreck |
| 100 to 250 km/h | Disintegrated | Explosion and wreck |
| 250 to 5,000 km/h | A new crater | Explosion and wreck |
| 5,000 km/h and up | Struck oil | Explosion and wreck |

If the fuel runs out before touchdown, the program immediately works out how fast you would hit the ground from where you are, adds an estimated fall time to the clock, and gives the verdict for that speed.

The elapsed time is **not** reset when you try again, so the time reported after your second flight includes the first.

## How to land every time

The fuel-cheapest way down is to fall freely for as long as possible and then brake flat out, so that your speed reaches zero just as you reach the ground. Rockets that land upright today use the same idea (a "hoverslam").

1. **Coast.** Enter 0 for the first several turns. On the Moon that is about 7 turns, on Mars about 11, on Earth about 10, on the asteroid about 6.
2. **Brake hard.** Then burn 100 turn after turn. Watch the speed fall: you want it near zero when the height is a few hundred metres (a fraction of a kilometre on the panel).
3. **Ease down.** Near the ground, use the burn that just holds your speed steady, then a little less to sink slowly:

| World | Burn that holds speed steady near the ground | Turns for a perfect landing | Fuel left |
|---|---|---|---|
| Earth | about 28 | about 36 | about 20% |
| The Moon | about 6 | about 20 | about 17% |
| Mars | about 14 | about 28 | about 27% |
| Asteroid Alpha | about 0.7 | about 28 | about 11% |

These numbers come from simulating the program's own arithmetic (see ORIGINAL-ARCHITECTURE.md). The steady burn creeps down as the tank empties, because the lander gets lighter.

Two warnings:

- **Burning too early** wastes fuel on slowing down high up, and you may run dry before the end.
- **A big burn close to the ground** can stop you and send you back up (the speed turns negative). You then have to fall back down, which costs more turns and fuel.

## Trying it in Don't Crater

Don't Crater's **1979 mode** plays with exactly the same arithmetic and the same turn structure, including the never-reset clock and the 19-to-20 km/h mix-up. The words, the pictures and the terrain are new.
