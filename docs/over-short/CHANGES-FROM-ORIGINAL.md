# Over / Short: changes from the original

The soul we kept: you never see the target, you call an elevation, and a voice tells you over or short. Everything
else, the painted war, the ride along the arc, the campaign, is there to make that report matter more.

## Kept

| In the original | In Over / Short |
|---|---|
| The gun's greatest range and the target's distance are given | The same on Classic's target card |
| A target somewhere from 10% to 90% of the greatest range | The same in Classic |
| Elevations from 1° to 89°, fractions allowed; out-of-range ones refused without cost | The same; the dial and the figure stop at the limits |
| Range = greatest range × sin 2θ, no air, no wind | The vacuum model in Classic and Chapter 1 lands exactly there |
| Over or short, and by how much | The observer's report, spoken in words with the figure, and plotted on the map |
| A hit within 100 | 100 m in Classic |
| Five targets a game, five rounds each, the enemy finds the gun after that | The same in Classic |
| 18 rounds or fewer for the five is the standard; more earns the artillery school | The same, school included |
| Cannoneer's metric gun of 10,000–13,999 m | Classic's gun |
| Cannoneer's rising whistle | Our own synthesised whistle climbs as the shell comes in |

## Changed

| In the original | In Over / Short | Why |
|---|---|---|
| A round exactly 100 short is reported over | Reported short | It is a bug; the 1970s mode (prompt 07b) will keep it |
| The error is truncated with INT before it is judged, so the hit window is lopsided by a unit | Judged on the exact distance, 100 m either way | Fair to both sides |
| Degrees divided by 57.3 | Exact radians | No reason to keep an approximation the player cannot see |
| The sixth elevation is asked for, then never fired | The game ends on the fifth miss at one target | Asking for a round that is never fired only to tell you that you lost felt like a trick |
| Gunner's guns of 20,000–59,999 yards | Classic uses Cannoneer's metres; yards are a display setting | On Gunner's scale the hit window is a tenth of a degree wide and halving cannot find it in five rounds (NOTES.md); Cannoneer's scale is playable with tenths of a degree |
| The same gun and targets every time the program is loaded | A fresh seed every game | The dice should be dice |
| Typed text only | A dial, arrow keys, typing, and dragging the barrel | Every way to lay a gun, all equivalent |
| Messages on a teletype | A painted battlefield, the shell's flight followed by the camera, the fall of shot seen through the observer's glasses, the report on a message slip | The report is the heart of the game; now it is a moment |
| Lower-case y accepted only by Cannoneer | Buttons and keys | Nothing to type at the end |

## Added

- **The Campaign**: twenty missions in five chapters, each breaking the 1973 formula a little more: reports with no
  distance; an unknown or worn gun; targets on hills and in a gale (a vacuum model with a sloping ground line and a
  steady push from the wind); real air (a point-mass model with drag, integrated in fixed steps); a convoy on the
  move, a last-shells mission, a clock, and an enemy battery whose rounds walk in until you move the gun. Medals per
  mission; every mission proved winnable within its rounds by a simulated gunner (NOTES.md).
- **The battery's range table**, kept from mission to mission in Chapters 4 and 5.
- **The observer's map** and **the firing table** for every game.
- **The textbook hint**, an assist for the Campaign that shows where the 1973 formula says a round will land.
- **Eras**, a cosmetic layer: the Great War now, more to come. They never change a shot.
- **Units**: metres or yards.
- **Achievements** through the Keyring, and records for both play styles.
- **Sound**: the report and its echo, the whistle, the impact, the telephone line, the crew's call and cheer, the
  enemy's incoming round, birds between barrages.
- A self-playing battlefield behind the menus and on the game's card in the Hall.

## Left out

- **The opening paragraphs of orders.** The briefing says the same in our words.
- **Typing Y or N to play again.** The results card has the collection's three actions.
- **Cannoneer's victory fanfare and drone.** Our own sounds replace them.

## Faithful modes

None yet: a **1970s mode** with both programs as they were, Gunner and Cannoneer turn for turn with every quirk
(the 57.3, the truncated error, the exactly-100 "over", the sixth-round defeat, the 18-round verdict), comes in
prompt 07b. The engine already reproduces their rules in `lib/over-short/original.ts`, which the checks use to verify
every fact in NOTES.md.
