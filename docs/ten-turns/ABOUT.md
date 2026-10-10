# Ten Turns in the Pit: about the game

**Ten Turns in the Pit** is a chase on a round patch of earth. You are dropped into a pit with one very fluffy,
very hungry rabbit, and you have to stay out of its teeth for ten turns, until a rope ladder comes down. It is the
Any Key rebuild of *Man-Eating Rabbit*, a Creative Computing program from the end of the 1970s, kept turn for turn in
a terminal and redesigned twice over as a picture book you can play.

## The game

The pit is a circle ten steps across from its middle. On your turn you take one step in any of eight directions;
then the rabbit pounces, one cell at a time, towards you. A pounce that misses may be followed by another, and
another: one chance in two, then one in three, then one in four. Most turns end with you still standing. Some end
with a crunch.

It starts with the drop. In Classic you choose where to be dropped without knowing where the rabbit is; land right
on it and it is flattened, and the pit is yours. In Tactics you see a patch of grass rustling and can try for it, or
drop well away.

There are two ways to play, chosen on the game menu and in Game settings:

- **Classic** is the 1970s game with its bugs fixed and its luck made fair. Drop in blind, then last ten turns with
  nothing but your feet. The rabbit is placed after your drop, anywhere that good play still survives at least four
  times in ten.
- **Tactics** turns the pit into a board game you can read. A dotted arc shows where the rabbit's first pounce will
  land, the pips show its odds of pouncing again, and the pit holds rocks, burrows, tunnels and carrot patches. You
  carry stones to set down, carrots to toss and a spade to dig with, and your bobble hat saves you once. Twenty pits
  in five chapters, from a first drop to a fifteen-turn pit with a rabbit that guesses where you will run.

A third way, the **Arena**, a real-time escape, is on its way.

## What's new

- **A picture book come alive**: the Spooky Storybook, a meadow pit by day and a moonlit one by night, with a rabbit
  that is adorable until it crouches, a slow-motion squish and a page turn, a release up a rope ladder at sunrise or
  moonrise.
- **Tactics**: the rabbit's next pounce shown before you move, four kinds of rabbit, tools, burrows and tunnels,
  three medals a pit, and every pit proved survivable by a search before it ships.
- **A fair Classic**: the 1970s rules without the bug that drags you to the middle, and no start that perfect play
  could not survive.
- **The Daily Pit**: one Tactics pit a day, the same for everyone, checked for fairness before it is offered.
- **1970s mode**: the original program's rules and numbers on a green terminal, quirk for quirk, with a plotter
  beside it that shows where everyone really is.
- **Thirteen keycaps** in the Keyring, records, sound, light and dark, mouse, keyboard and touch.

The full list is in [CHANGES-FROM-ORIGINAL.md](CHANGES-FROM-ORIGINAL.md).

## The original

*Man-Eating Rabbit* is a short BASIC program, 82 numbered lines. You typed where you wanted to be dropped, then an
angle to run at each turn, and the program printed where the rabbit was, how far away, and the angles of its
pounces. Survive ten turns and you were released.

It has more bugs than lines of interest, and they change the game:

- **The pull to the middle.** One line meant to multiply and added instead. After every run your north-south
  position comes out as 0, 1 or 2, so the program drags you back to the middle rows of the pit every turn, where the
  rabbit usually is. A player who simply runs away survives a third of the time instead of half.
- **The frozen rabbit.** Stand straight north of the rabbit and it skips its move. A player who knows this can run
  north for ever: perfect play survives 87 % of games, against 34 % once every bug is fixed.
- **The last-turn loophole.** A landing on you is only noticed when the next turn starts. After turn ten there is no
  next turn, so a rabbit that lands on you in the last turn sits there while you are released.

Our copy is `RABBIT.BAS`, a tokenized GW-BASIC file for the IBM PC. Everything we say about it comes from its
listing, which we decoded with our own detokenizer; see [NOTES.md](NOTES.md).

## Who made it

The program's title lines name only Creative Computing of Morristown, New Jersey. It appears in David H. Ahl's
*More BASIC Computer Games* (Creative Computing, 1979), and the program notes from that book, as reproduced on the
Internet Archive, credit it to **Philip Stanway**. We have not yet read the printed page ourselves (see the open
questions in [NOTES.md](NOTES.md)).

## Where it went

From the book's pages into home computers by hand, one typed line at a time, and from there onto user-group disks
like the one our copy comes from, adapted for the IBM PC: it clears the screen and seeds its random numbers from the
clock. Whether the slip on the pull line was in the book or came in with the typing is one of our open questions.

## Facts and trivia

- After every run in the 1970s game your north-south position is **0, 1 or 2**, wherever you started.
- Perfect play survives the original **87 %** of the time, almost all of it thanks to the frozen rabbit.
- Fix every bug and perfect play survives a blind drop only **a third** of the time; from three steps away, about
  **3 %**.
- The rabbit pounces **e − 1**, about 1.72 times, a turn on average: the odds of 1 in 2, 1 in 3, 1 in 4 add up to
  that.
- The original happily lets the rabbit **leave the pit**: chasing you along the wall it can step outside the circle.
- A blind drop squashes the rabbit **1 time in 317**, one for every whole-number point in the pit.

## Sources

- `RABBIT.BAS`, a GW-BASIC tokenized file (82 lines, 2,304 bytes), decoded with `scripts/detokenize-gwbasic.ts`.
- David H. Ahl (ed.), *More BASIC Computer Games*, Creative Computing, 1979 (the listing; the credit to Philip
  Stanway as reproduced on the Internet Archive).
- Everything about the program's behaviour: its listing, our 1970s module (`lib/ten-turns/original.ts`) and the
  simulations in [NOTES.md](NOTES.md).
