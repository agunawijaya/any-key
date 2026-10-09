# Two Humps: about the game

**Two Humps** sends you forty miles across the Gobi on a Bactrian camel with a mind of its own, with something
coming up behind you: a wall of sand, a boastful rival with a caravan, or a gang of pygmy jerboas who have heard
that camel soup is delicious. It is the Any Key rebuild of *Desert*, a 1982 game for the IBM PC.

## The game

Every turn you pick one of six things to do: drink, walk, gallop, make camp, scan the horizon or signal for help.
Each card tells you exactly what it will cost before you choose: how far you might get, how tired the camel will
be, and how much ground your pursuer will make up meanwhile. Nothing is hidden except the dice.

And then the camel runs on. After a walk or a gallop, if nothing else happens, the camel may simply keep going
by itself, stride after stride. Every extra stride is free of water and time, but it tires the camel. A dial
shows the odds that it carries on; you can let it run, or pull the reins. That one decision, made over and over,
is the game: when is enough?

Light the screen in the light appearance and the trek sets off at dawn; switch to dark and it sets off at dusk,
under the Milky Way. The sun moves with every turn, nights pass in a time-lapse round the campfire, and when the
Haboob closes in the sky goes brown, the sand streaks sideways and the gauges shake.

Lose, and nobody gets hurt: you shelter behind your camel while the storm roars past, or the jerboas, far too
small to lift a camel, invite you for porridge instead. Win, and there is a party at the ger camp with lanterns
and a cake, and your pursuer turns up as a guest.

## What's new

- **Three pursuers**, each a different puzzle: the Haboob never sleeps, the rival drinks your oases dry, and the
  Ladle Gang sleeps all day and hunts all night.
- **The runaway camel made fair**: in 1982 the camel's extra strides were a hidden bug that cost strength and
  paid nothing. Here you see every stride, it always pays miles, and you hold the reins.
- **An Expedition** of five legs through real places in the southern Gobi, each with a twist and a page of field
  journal, and fossils to find at Bayanzag.
- **A Daily Crossing** that everyone plays with the same desert, and a share line to compare.
- **1982 mode**: the original program's rules and numbers in a terminal, bugs and all, with a panel that shows
  what BASIC kept quiet.
- See [CHANGES-FROM-ORIGINAL.md](CHANGES-FROM-ORIGINAL.md) for everything that changed and why.

## The original

*Desert* is a turn-based survival game for one player on the IBM Personal Computer, written in IBM BASICA. You
have to cross forty miles of the Gobi on a camel. Each turn you type one of six command numbers, listed along the
bottom of the screen: drink, go at a moderate speed, go at full speed, stop for the night, check your status, or
hope for help. Your canteen holds six
drinks and you can go four turns without one. Galloping covers twice the ground but wears the camel out three
times as fast. A band of pursuers sets off after your third turn and gains on you every turn after that.

Along the way things happen: an oasis, a sandstorm that can blow you backwards, a hurt hump, or an ambush that
asks you to choose between running for it and waiting. The program is 255 lines long. How it works, and how to
play it today, is in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

The program's text and listing stay outside this project; we describe it in our own words.

### What makes this one different

- **A camel that repeats itself.** When nothing happens on a move, the program jumps back to its command
  dispatcher from inside a subroutine, so the same move starts again without anything being printed. The
  repeats add fatigue and roll for events again, and only the last stride's miles are ever added. A fresh
  camel's first gallop kills it about a third of the time, and the screen never says why.
- **A status report that costs a drink.** The status lines have no jump at the end, so they run straight on
  into the drinking routine.
- **Typos call for help.** Any number but 1 to 6 counts as "hope for help", which works one time in ten.
- **Waiting is always safe.** After an ambush, waiting can never hurt you: the flag that should keep you
  prisoner is never set.

The full list, with line numbers and how we checked each one, is in [NOTES.md](NOTES.md).

## Who made it

The title screen calls the program number **2004** of the **IPCO Personal Computer Owners Group** in Pittsburgh,
and a remark in the listing says IPCO translated it in February 1982. The listing names no author.

**Who wrote it is unknown.** Its premise matches an earlier game, *Camel* (see below), closely enough that it is
almost certainly an adaptation, but we could not find who made the IBM version.

## Where it went

### Camel, and a shorter desert

David Ahl's *More BASIC Computer Games* (1979) printed *Camel*, crediting the idea to the **Heath Users Group**:
a crossing of the Gobi on a camel, chased by a tribe of pursuers, with six drinks in a canteen, oases, sandstorms
and ambushes, over two hundred miles. *Desert* keeps the same ingredients over a much shorter crossing of forty
miles and lists its six commands on the IBM PC's function-key line. Our brief says later ports credit *Camel* to a
named programmer; we found no source for that, so we don't repeat it.

### User groups and disks

In the early 1980s, owners of the new IBM PC formed local user groups that traded public-domain programs on
floppy disks, numbered like library books. IPCO was one of them, and the number 2004 on the title screen suggests
*Desert* went round as part of its library. We don't know how many copies were made or who played them.

## The real Gobi

Two Humps is set in the real southern Gobi, in Mongolia's Ömnögovi province, and everything the game says about
it is meant to be true.

- **The camel.** Bactrian camels have two humps, and the humps hold fat, not water. When a camel has used up its
  reserves the humps go soft and flop over, which is why our camel's humps sag as it tires.
- **The jerboas.** The five-toed pygmy jerboa lives in the Gobi, hops on its long hind legs, comes out only at
  night and eats mostly seeds, which is why seeds stop the Ladle Gang. The real animal has very small ears; our
  cartoon gang borrowed theirs from a neighbour, the long-eared jerboa, which also lives in the southern Gobi and
  has the biggest ears for its size of any animal.
- **The storm.** A haboob is a wall of dust pushed ahead of a thunderstorm by the cold air rushing out beneath
  it; the word comes from Arabic. The Gobi is one of the world's great sources of dust, and its storms can blot
  out the sun.
- **The singing sands.** Some big dunes boom when dry sand avalanches down a steep face, with a low hum of about
  70 to 105 hertz. Khongoryn Els is famous for it, and our dunes hum at about 96.
- **The oases.** Gobi oases are shaded by desert poplars (*Populus euphratica*) and reeds, not palms. The
  scrubby bushes along the route are saxaul, a desert shrub; Bayanzag's name means "rich in saxaul".
- **The places.** Khermen Tsav's red canyons, Khongoryn Els's dunes, Bayanzag's Flaming Cliffs, the ice gorge of
  Yolyn Am, and a ger camp: each Expedition leg ends on a journal page about the real place.

## The three pursuers

| | The Haboob | The rival caravan | The Ladle Gang |
|---|---|---|---|
| What | A wall of sand rolling across the desert | Captain Bluster, boastful and friendly, with three camels and a pennant | Five pygmy jerboas with a very big soup ladle |
| How it moves | Steadily, day and night, a little slower after dark | Camps every night and gallops at dawn; sometimes only threatens to | Asleep in burrows by day; wild hops of up to 11 miles at night |
| The puzzle | It never sleeps: when can you afford to camp? | Oases are shared: if he gets there first, they're dry | Camping at night is the risk, not the rest |
| If it wins | You shelter behind your camel until it has passed | He throws your party for himself, and saves you some cake | They make porridge and ask you to stay |

## Facts and trivia

- In 1982 the camel's runaway strides were invisible, cost strength, and never added a mile. Over 30,000
  simulated tries, a fresh camel's first gallop killed it 34.1% of the time: two repeats in a row, at 58.1% each.
- Asking for your status in 1982 used up a drink.
- The 1982 program never shuffles its dice, so in a freshly started BASIC the desert plays out the same way every
  time. Our 1982 mode keeps that.
- Bayanzag was named the Flaming Cliffs by Roy Chapman Andrews, whose American expedition found the first
  dinosaur eggs recognised by science there in 1923, and the first remains of *Velociraptor*.
- Yolyn Am's ice used to last all year; now it usually melts by September. The gorge is named after the
  lammergeier, the bearded vulture.
- A ger's door traditionally faces south, away from the north wind, and every visitor is offered tea.

## Sources

- Five-toed pygmy jerboa: [Animal Diversity Web, *Cardiocranius paradoxus*](https://animaldiversity.org/accounts/Cardiocranius_paradoxus/) (range, nocturnal habits, seed diet, hopping, small ears); [Wikipedia](https://en.wikipedia.org/wiki/Five-toed_pygmy_jerboa).
- Long-eared jerboa: [Wikipedia, *Euchoreutes naso*](https://en.wikipedia.org/wiki/Long-eared_jerboa); [Live Science, largest ears for body size](https://www.livescience.com/largest-animal-ears-relative-to-body-size.html).
- Bactrian camel humps: [Cleveland Zoological Society, "A camel's hump"](https://www.clevelandzoosociety.org/z/2021/04/06/truth-or-tail-a-camels-hump); [Denver Zoo fact sheet](https://denverzoo.org/wp-content/uploads/2018/09/Bactrian-Camel.pdf).
- Haboob: [Wikipedia](https://en.wikipedia.org/wiki/Haboob); [US National Weather Service, dust storms](https://www.weather.gov/safety/wind-dust-storm).
- Booming dunes: M. L. Hunt and N. M. Vriend, ["Booming Sand Dunes"](http://www2.ess.ucla.edu/~jewitt/Hunt10.pdf), *Annual Review of Earth and Planetary Sciences* 38 (2010); [Wikipedia, Singing sand](https://en.wikipedia.org/wiki/Singing_sand).
- Khongoryn Els: [Wikipedia](https://en.wikipedia.org/wiki/Khongoryn_Els); [Gobi Gurvansaikhan National Park](https://en.wikipedia.org/wiki/Gobi_Gurvansaikhan_National_Park).
- Bayanzag and the 1923 finds: [Wikipedia, Flaming Cliffs](https://en.wikipedia.org/wiki/Bayanzag); [American Museum of Natural History, dinosaur eggs](https://www.amnh.org/dinosaurs/dinosaur-eggs); [Wikipedia, Roy Chapman Andrews](https://en.wikipedia.org/wiki/Roy_Chapman_Andrews).
- Yolyn Am: [Wikipedia](https://en.wikipedia.org/wiki/Yolyn_Am).
- Khermen Tsav: [Wikipedia, Baruungoyot Formation](https://en.wikipedia.org/wiki/Baruungoyot_Formation) (its red beds and Late Cretaceous age); [Escape to Mongolia, Khermen Tsav](https://www.escapetomongolia.com/blog/khermen-tsav-canyon-in-gobi-desert).
- Desert poplar in Gobi oases: [Wikipedia, Ekhiin-Gol](https://en.wikipedia.org/wiki/Ekhiin-Gol); saxaul and Bayanzag's name: [Wikipedia, Flaming Cliffs](https://en.wikipedia.org/wiki/Bayanzag).
- Gers: [Wikipedia, Architecture of Mongolia](https://en.wikipedia.org/wiki/Architecture_of_Mongolia); [Mongolian tea ritual, MACA](https://www.maca-usa.org/MACADocuments/MongolTeaRitual.pdf).
- *Camel*: David H. Ahl (ed.), *More BASIC Computer Games*, Creative Computing Press, 1979; [Internet Archive copy of *Camel*](https://archive.org/details/camel.qb64).
- Facts about *Desert* itself come from `DESERT.BAS`; see [NOTES.md](NOTES.md).
