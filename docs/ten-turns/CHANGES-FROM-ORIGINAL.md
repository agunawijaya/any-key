# Ten Turns in the Pit: changes from the original

The soul we kept is the rabbit's chase: one step for you, a pounce for it, and another, and another, each a little
less likely than the last, for ten turns in a round pit. Its arithmetic is unchanged: the same pounce directions,
the same chain odds, the same blind drop and the same one-in-317 squish.

## Kept

| In the original | In Ten Turns in the Pit |
|---|---|
| A round pit, radius 10, whole-number positions | The same pit, cell for cell (Tactics' last chapter widens it to 12) |
| Eight directions to run, one step at a time | The same eight, as pads, letters, the number pad or arrows |
| The rabbit pounces one cell towards you, rounded to the nearest of eight directions | The same rule (Classic and every plain pounce in Tactics) |
| Another pounce 1 in 2, then 1 in 3, then 1 in 4 | The same odds, shown as pips; Tactics' other rabbits vary them |
| The blind drop, and a squish if you land on the rabbit | The same drop and squish (1 in 317 in Classic) |
| Ten turns and you are released | Ten turns (12 or 15 in some Tactics pits) |
| Every quirk and bug | All kept in 1970s mode |

## Changed

| In the original | In Ten Turns in the Pit | Why |
|---|---|---|
| Line 131 drags you to the middle rows after every run | Fixed in Classic and Tactics | It is a slip, not a rule; it makes running away pointless |
| Straight north of the rabbit, it skips its move | Fixed | It turns the game into "run north for ever" |
| A landing in the last turn is never checked | Fixed | Being released with the rabbit sitting on you is a joke, not a win |
| The rabbit can step out of the pit | It stays in: in Classic it swings along the wall, in Tactics it bonks into it | A pit is a pit |
| The rabbit starts anywhere, even next to you | Classic places it after your drop, where good play survives at least 40 % | With every bug fixed, a start next to the player can't be survived at all |
| Running into the rabbit's cell is a crunch | You can't step onto the rabbit | Nobody does it on purpose; it was only ever a typo away |
| You typed an angle in degrees | Click a pad, or press a key; the terminal still takes degrees | Eight directions don't need arithmetic |
| A run into the wall: an error, and the question again | The cell shakes and says why | Same rule, kinder words |
| Positions and distances, printed | A pit you can see, from above at a gentle angle | The program's whole state fits in one picture |
| No author on screen | Inspired-by line naming Creative Computing and, as the book's notes credit him, Philip Stanway | Credit where it is due |

## Added

- **Tactics**: the rabbit's first pounce locked on the cell you start your turn on and shown as an arc; the chain odds
  as pips; rocks, burrows and tunnels, carrot patches; carrots, stones and a spade; the bobble hat; four kinds of
  rabbit; twenty pits in five chapters, each proved survivable by search; three medals a pit.
- **Classic's fair start**: the rabbit placed after the drop, never somewhere perfect play could not survive.
- **The Daily Pit**: one Tactics pit a day, generated from the day's number and checked for fairness, with a share
  line.
- **1970s mode** with a plotter beside the terminal showing where everyone really is.
- **The Spooky Storybook**: the pit, the kid, the rabbit, the pounce, the squish and the release drawn in code, by day
  and by moonlight; sound for every moment.
- **Thirteen keycaps** in the Keyring, records, settings, light and dark, keyboard, mouse and touch.

## Left out

- The program's words. Every line on screen, the terminal's included, is ours.
- The spare string array on line 103: it was written to and never read.
- The clock-seeded random numbers: every game is seeded by our own generator, so the Daily Pit is the same for
  everyone and every run can be replayed in the checks.

## Faithful modes

**1970s mode** is the program's rules and numbers, turn for turn: the terminal asks where to drop you and which angle
to run at, prints positions, distances and pounce angles, and keeps every quirk on: the pull to the middle rows, the
run past the wall, the frozen rabbit, the rabbit leaving the pit, the angle boundary at 23 degrees, the last-turn
loophole. The squish and the crunch come as big letters made of characters. The plotter beside it marks the pit, you
and the rabbit, so you can watch the pull happen. Two secret keycaps are earned only here.
