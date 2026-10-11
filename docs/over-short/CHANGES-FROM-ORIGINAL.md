# Over / Short: changes from the original

The soul we kept: you never see the target, you call an elevation, and a voice tells you over or short. Everything
else, the painted war, the ride along the arc, the campaign, the full-physics battery, is there to make that report
matter more. The programs themselves are kept too, as they ran, on the 1970s terminals.

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
| A round exactly 100 short is reported over | Reported short | It is a bug; the 1970s terminals keep it |
| The error is truncated with INT before it is judged, so the hit window is lopsided by a unit | Judged on the exact distance, 100 m either way | Fair to both sides |
| Degrees divided by 57.3 | Exact radians | No reason to keep an approximation the player cannot see |
| The sixth elevation is asked for, then never fired | The game ends on the fifth miss at one target | Asking for a round that is never fired only to tell you that you lost felt like a trick |
| Gunner's guns of 20,000–59,999 yards | Classic uses Cannoneer's metres; yards are a display setting | On Gunner's scale the hit window is a tenth of a degree wide and halving cannot find it in five rounds (NOTES.md); Cannoneer's scale is playable with tenths of a degree |
| The same gun and targets every time the program is loaded | A fresh seed every game | The dice should be dice |
| Typed text only | A dial, arrow keys, typing, and dragging the barrel | Every way to lay a gun, all equivalent |
| One number to set: the elevation | In Field Artillery, a charge, an elevation and a line | A real battery laid all three, and the wind makes the line matter |
| "Over" or "short" by so much | In Field Artillery, the observer's correction: "Add 200. Left 50." | How forward observers actually spoke, and it gives left and right as well |
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
- **Achievements** through the Keyring, and records for every way to play.
- **Field Artillery**: the full-physics play style. Four charges, an elevation and a line in mils; rounds fly
  through air with wind along and across the line of fire, over real ground with crests; the observer answers with
  corrections in their own words, and a map from above shows left and right. Ten shoots: registration, a target
  behind a crest, a crosswind, a convoy crossing the line, smoke that blinds the observer, an enemy battery to
  silence first, a bridge to drop before a column crosses, two night shoots under star shells, and a job done under
  fire. An enemy battery fires on its own clock, its rounds walking in on the gun until it moves down the road.
  Easy, Normal and Hard; medals by rounds and time; every shoot proved winnable on every difficulty (NOTES.md).
- **The Counter-Battery Duel**: two guns either side of a ridge, firing together, against a friend on the same
  screen (the orders hidden between turns) or one of three computer commanders, cautious, aggressive or methodical.
- **The Daily Barrage**: one Field Artillery shoot a day, the same for everyone, numbered by the day, with a share
  string of round marks.
- **The 1970s terminals**: both programs, played as they ran (below).
- **Sound**: the report and its echo, the whistle, the impact, the telephone line and the field telephone's ring,
  the crew's call and cheer, the enemy's incoming round (falling in pitch where ours climbs), star shells, the
  horses and the limber, birds between barrages.
- A self-playing battlefield behind the menus and on the game's card in the Hall.

## Left out

- **The opening paragraphs of orders.** The briefing says the same in our words.
- **Typing Y or N to play again.** The results card has the collection's three actions; only the terminals ask.
- **Cannoneer's victory fanfare and drone.** Our own sounds replace them, except on Cannoneer's terminal, where its
  speaker plays them as the program did.

## Faithful modes

**The 1970s** plays both programs turn for turn, each on a terminal of its day: Gunner on a teletype, in yards and
capitals, printing at the speed of the machine; Cannoneer on an IBM PC's green screen, in metres, with its PC-speaker
report, whistle and thud, synthesised. What they do is theirs, quirks and all:

- Microsoft BASIC's single-precision arithmetic and its random numbers, from the state they have when a program is
  freshly loaded, so both fight the same war every time, as they did;
- the vacuum formula with 57.3 for 180/π, fractions of a degree taken as typed, and a hit judged after INT, with
  its lopsided window;
- a round exactly 100 short called over;
- elevations outside 1 to 89 refused without counting, and the interpreter's own complaint at letters;
- the sixth elevation at one target asked for and never fired;
- the 18-round verdict after the fifth target;
- Gunner playing again only on a capital Y, Cannoneer on y as well.

Every line on the terminals is written fresh: the orders, the reports and the verdicts say what the programs said
in our words. Six sessions of the unmodified programs, run in a GW-BASIC interpreter, are replayed by the checks
event for event (NOTES.md).
