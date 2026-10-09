# Two Humps: changes from the original

We kept *Desert*'s soul: forty miles, six commands, a canteen of six drinks, a camel that tires, something
gaining on you every turn, and a camel that sometimes just keeps going. We changed what it means when the camel
keeps going, who is chasing you, and every word on the screen.

## Kept

| In the original | In Two Humps |
|---|---|
| Forty miles across the Gobi | Forty miles across the real southern Gobi (30 per Expedition leg) |
| Six commands: drink, moderate speed, full speed, stop, status, hope for help | Drink, walk, gallop, make camp, scan, signal, on keys `1` to `6` |
| Six drinks; four turns without one, and the fifth is fatal | The same on Normal (seven sips on Chill, five on Hard) |
| Moderate speed 0–9 miles for one point of fatigue; full speed 0–18 in even steps for three | The same ranges and costs; the camel has seven humps of strength |
| Stopping rests the camel completely, but the pursuers move | Making camp does the same, and after dark the night's sleep counts as several turns |
| Pursuers who set off after a few turns and gain on you | Three pursuers, each with its own way of moving (see below) |
| The camel repeating a move by itself, at about 58% | The camel running on by itself, at 58% on Normal |
| Drinking takes no time | The same |
| Status costs a drink | Scan costs a sip, our nod to it |
| One chance in ten that help comes | The same on Normal, with herders that bring three sips |
| Oases that refill the canteen; sandstorms that shove you about | Oases, gusts, a sore hump, dust devils, singing dunes and fossils |
| The pursuers plan to come to your victory party | They do come: as a breeze, with a gift, or in party bibs |
| Waiting out an ambush is always safe | Waiting out a dust devil is always safe, but your pursuer gains a step |

## Changed

| In the original | In Two Humps | Why |
|---|---|---|
| The repeat is invisible, adds fatigue and **never adds miles**: only the last stride counts | Every stride on the run is shown, always pays miles, costs fatigue, uses no water or time, and you can pull the reins | The 1982 repeat is a bug that punishes the player for nothing they can see. Made visible and fair, it becomes the game's best decision. Our brief expected the old repeats to give free miles; reading the code showed they don't (see [NOTES.md](NOTES.md), fact 9) |
| A fresh camel's first gallop kills it about one time in three, without warning | A stride that would take the camel past seven humps is refused, or, on the run, warned about on the dial | Nobody should lose a game to a roll they couldn't see |
| A tribe of human pursuers who want to cook you, and ambushers named after a real people | The Haboob, a rival caravan, and the Ladle Gang of pygmy jerboas | No real peoples as villains, and nothing frightening. The jerboas are our heir to the original's running jokes: the knock-kneed hop and the dream of camel soup |
| Five closing remarks that mock the dead | No deaths at all. You shelter from the storm, the rival throws the party for himself, the gang makes porridge, a herder brings you home | All ages |
| Typos call for help | Commands are cards and keys; there are no typos | Kept in 1982 mode, with a secret keycap |
| Status prints three lines and uses a drink | Every number is on screen all the time; Scan shows the odds and the oases ahead | Nothing hidden but the dice |
| The hurt hump is called luck but moves the pursuers a mile closer | A sore hump halves your next stride, and says so | It should mean what it says |
| A sandstorm moves you 0–9 miles either way and can leave you below zero | A gust moves you 1–6 miles either way, never below the start | The old storm could undo a whole turn and break the mile counter |
| Drinking from an empty canteen kills you | It just can't be done | A rule nobody would guess |
| An ambush: run (half the time fatal) or wait (always safe) | A dust devil: chase the packs (half the time it costs the camel two humps) or wait (safe, but your pursuer gains) | The same choice, with a real cost on both sides |
| The same desert every time BASIC starts | Every crossing has its own seed; the Daily Crossing has the day's | Variety; the Daily keeps the "same for everyone" idea on purpose |
| Text on an 80-column screen | A side-on painted diorama of the Gobi with a sky that follows the clock | It's the collection's idea of a rebuild |
| Function keys labelled with the commands (which typed words a numeric prompt refused) | Cards you click, and keys `1` to `6` | The old keys never worked as commands |

## The three pursuers

Each takes one idea from the original pursuers and makes a different puzzle of it.

- **The Haboob** keeps the original's steady, relentless gain, a little slower at night. It never sleeps, so the
  question is when you can afford to camp. Its wall grows from a brown band on the horizon to a towering front as
  it closes in.
- **The rival caravan**, led by Captain Bluster, races you instead of chasing you. He camps every night and
  gallops at dawn, and every oasis he reaches first is dry when you get there. A tall dust plume warns that he
  may sprint.
- **The Ladle Gang** keeps the original's wild steps (2.5 to 11.5 miles in 1982; 2.5 to 11 here) and its joke
  about soup. Five-toed pygmy jerboas really live in the Gobi, hop, come out at night and eat seeds, so the gang
  sleeps in its burrows all day, hunts all night, and stops for a handful of seeds. The real animal has tiny ears;
  our cartoon jerboas borrowed the long-eared jerboa's, because big ears read from across a desert.

## Added

- **Three pursuers**, a pick screen with each one alive in its own little scene, and three difficulties.
- **Previews on every command**: miles, fatigue after, and the pursuer's possible gain.
- **The reins**: `Space` or a click on the camel; a dial with the odds and the cost of one more stride.
- **Events** of our own: gusts, a sore hump, dust devils, singing dunes, fossils.
- **A day and night**: the sun moves with every turn, strides are shorter in the dark, nights pass in a
  time-lapse round the campfire, and in the light appearance treks start at dawn, in the dark one at dusk.
- **The Expedition**: five real places, each with a pursuer, a twist and a page of field journal.
- **The Daily Crossing** with kit numbering, a Keyring entry and a share line.
- **A tutorial** that teaches the whole game in about a minute.
- **Fifteen keycaps** on the Keyring, one of them secret.
- **Records and settings**: wins and best turns per pursuer and difficulty; miles or kilometres.
- **Sound**: a wind bed that rises as the storm nears, footfalls by gait, the dunes' hum, the storm's roar, a
  campfire, water, and squeaks.

## Left out

- **The player's name.** The original asked for a last name to use in its prompt. We have no prompt to put it in.
- **The instructions screen.** The tutorial and the How to play page replace it.
- **The busy-wait pauses.** Every moment that waits can be skipped with `Enter`.

## Deviations from our brief

- **The repeat gives no miles in 1982.** The brief described the old repeats as free miles; the code shows they
  add fatigue and nothing else. Our run-on is the fair version of what the brief imagined.
- **The dunes hum at about 96 Hz, not 450.** The brief gave about 450 Hz as the pitch of singing sand. Published
  measurements of booming dunes put the hum at about 70 to 105 Hz (higher squeaks come from sand underfoot, not
  from dune avalanches), so we tuned to the measurements; see [ABOUT.md](ABOUT.md#sources).
- **Big ears.** The real five-toed pygmy jerboa's ears are small; ours are cartoon ears, approved by the owner and
  explained in the game's docs.
- **No three.js.** The brief allowed WebGL for the storm and the sky; everything is Canvas 2D (ADR 0005).

## Faithful modes

**1982 mode** runs the original's rules from `lib/two-humps/original.ts`, a state machine that follows the
listing line by line:

- the same six commands and their numbers, the same dice (`INT(10*RND)` and friends), the same fatigue limits;
- the repeat, exactly: hidden strides that cost fatigue and add no miles, and the return addresses they leave;
- status costing a drink, typos calling for help, a negative number stopping BASIC with an error, waiting always
  being safe, the hurt hump moving the pursuers closer, the sandstorm going below zero, the empty canteen;
- the same sequence of dice every time the mode is opened, as without `RANDOMIZE`;
- only a capital `Y` playing again.

What it changes: every line of text is new; the pursuers are the Ladle Gang and the ambushers are gerbil bandits
who want biscuits; deaths become "the trek is over" with our own closing remarks; `F1` to `F6` submit their
numbers (in 1982 they typed words the prompt refused); and a panel under the screen shows what BASIC hid. Where
we had to guess: how BASICA rounds a command like 2.5 (we round halves up), and how deep its stack goes.
