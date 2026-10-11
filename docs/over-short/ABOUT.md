# Over / Short: about the game

You command a field gun on the Western Front. You can't see the target: you call an elevation, the gun fires, and
a minute later a voice on the field telephone tells you where the round came down. Over. Short. Over, by less.
Then: direct hit. Over / Short is one of the very first artillery games, written in 1973, rebuilt as a painted
battlefield with a shell you can ride along its arc, an observer's field glasses, a campaign that keeps taking
away the thing you just learned to rely on, and a full-physics battery with charges, wind and an enemy gun hunting
yours.

## The game

Every round is a little experiment. The gun's greatest range is on the card, the target's distance is on the card,
and the barrel goes where you put it: drag it, turn the dial, or type a figure. Fire, and the camera rides the shell
up its long arc and over the fields; then the view cuts to the observer's glasses as the round lands in a fountain
of earth, beyond the target or in front of it. The slip from the telephone tells you how far. Now you have a
bracket, and the next round goes in between.

The moment people talk about afterwards is the dump going up: the round lands square on the stacked shells, the
first blast throws timber into the air, and then the secondaries go off one after another while a column of black
smoke climbs out of the glasses.

In Field Artillery the other side shoots back. Their rounds walk in on your gun, each closer than the last; the
view comes in close as one lands beside the pit, the crew get down and earth comes down on them. Then the team of
horses comes up, the gun is hooked to its limber and hauled down the road, and their next round falls on the empty
pit.

## What's new

- **Classic**, the 1973 drill: five targets, five rounds each, the 18-round standard, with the original's one bug
  fixed.
- **Campaign**: twenty missions in five chapters, each breaking the perfect formula a little more: an observer who
  only says over or short, a gun nobody has the tables for, targets on hills and in a gale, real air that drags the
  shell down, moving convoys, a race against the clock, and an enemy battery whose rounds walk closer to your gun
  every turn.
- **Your own range table**: from the fourth chapter the battery keeps its gun and every round it fires goes into a
  table you can read the next elevation from.
- **The observer's map**: every fall of shot plotted with its round number, so the bracket shows.
- **A painted Great War**: the gun and its crew, shell-scarred fields, a ruined farm, a church spire, an observation
  balloon and a spotter biplane; a grey overcast by day, star shells and gun flashes at night.
- **Field Artillery**: four charges, an elevation and a line; real air, wind across the line of fire and real
  hills; an observer who says "Add 200. Left 50."; ten shoots, from a target behind a crest to a bridge dropped by
  night before a column crosses, with an enemy battery firing back on its own clock. Easy, Normal and Hard.
- **Counter-Battery Duel**: two guns either side of a ridge, both firing at once, against a friend on the same screen
  or a cautious, aggressive or methodical computer commander.
- **Daily Barrage**: one shoot a day, the same for everyone, with a share line of over, short and hit marks.
- **The 1970s**: Gunner and Cannoneer themselves, on a teletype and a green screen with its PC speaker, quirks and
  all.
- Twenty keycaps for the Keyring, from First Bracket to 1973 Gunner and Cannoneer.

Everything that differs from 1973 is in [CHANGES-FROM-ORIGINAL.md](CHANGES-FROM-ORIGINAL.md).

## The original

Gunner is a short BASIC program from 1973: it tells you the greatest range of your gun and the distance to a
target, asks for an elevation, and answers with how far over or short the round fell, until you hit or run out of
rounds. Five targets make a game; more than 18 rounds in all, and it suggests a refresher course at the artillery
school. Its physics is the textbook vacuum formula, so a player with a calculator hits every target with the first
round.

We also had **Cannoneer**, a remake of Gunner for the IBM PC: the same program line for line, but in metres, with a
smaller gun, new wording, and sound from the PC speaker: a report, a rising whistle and a thud for every round.
Over / Short's Classic uses Cannoneer's metric scale.

## Who made it

- **Tom Kloos** of the Oregon Museum of Science and Industry in Portland wrote Gunner, according to the description
  of the game reproduced from *BASIC Computer Games* (1978), which also says **David Ahl** later modified it
  extensively. Wikipedia credits Gunner (1973) to Tom Kloos as well. The program's own title lines name only
  Creative Computing of Morristown, New Jersey.
- **Cannoneer**'s author is unknown to us: the listing names no one.

## Where it went

Gunner travelled the way the early BASIC games did: on paper. It was collected by David Ahl, whose *BASIC Computer
Games* (Creative Computing, 1978) put dozens of such programs in the hands of people typing them into their first
home computers; Wikipedia dates Gunner to 1973, the year Ahl's first collection appeared from Digital Equipment
Corporation, though we could not confirm that it was in that first book. Cannoneer is one of the many rewrites
typed into IBM PCs in the 1980s. Our copies came to us as plain BASIC listings, `GUNNER.BAS` and `CANNON.BAS`.

## Facts and trivia

- Gunner is one of the earliest artillery games, the family that later produced *Artillery* (published in
  *Creative Computing* in 1976), *Scorched Earth* (1991) and *Worms* (1995).
- Gunner's guns reach from 20,000 to almost 60,000 yards, between 11 and 34 miles.
- Both programs turn degrees into radians by dividing by 57.3. On Gunner's longest gun that rounding moves a round
  by at most 13.7 yards.
- A round that fell exactly 100 short was reported as **over** by 100: the program only calls a round short when it
  is more than 100 short.
- The sixth elevation you type at one target is never fired: before it leaves the barrel, the enemy finds your gun.
- The artillery school the program sends you back to is real: the US Army's School of Fire for Field Artillery
  opened at Fort Sill, Oklahoma, in 1911.
- Cannoneer's whistle climbs from 3,000 to 4,000 Hz in a hundred steps over about two seconds. Over / Short's own
  whistle climbs too, as a nod to it.

## Sources

- The two listings, `GUNNER.BAS` and `CANNON.BAS`, read line by line ([NOTES.md](NOTES.md)).
- Wikipedia, "Artillery game": Gunner (1973) by Tom Kloos; *Artillery* by Mike Forman in *Creative Computing*, 1976.
- Internet Archive, "Gunner : Tom Kloos" (archive.org/details/gunner.qb64): the game's description from *BASIC
  Computer Games*, crediting Tom Kloos of the Oregon Museum of Science and Industry, with modifications by David Ahl.
- Wikipedia, "BASIC Computer Games": the 1973 DEC edition and the 1978 Creative Computing edition.
- Wikipedia, "Scorched Earth (video game)" (1991) and "Worms (1995 video game)".
- Wikipedia, "United States Army Field Artillery School": the School of Fire at Fort Sill, opened in 1911.
