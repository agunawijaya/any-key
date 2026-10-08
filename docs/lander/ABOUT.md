# Don't Crater: about the game

**Don't Crater** drops you towards the Moon, Mars, a metal asteroid or Earth at 5,000 km/h, with nothing but an engine and a tank that is never quite big enough: wait as long as you dare, then burn hard enough to stop right at the ground. It is the Any Key rebuild of *Lander*, a 1979 game for the TRS-80 home computer.

## The game

Every flight is one long fall and one big decision. Burn early and you hang in the sky with an empty tank; burn late and the ground arrives first. Get it right and the speed melts away in the last few metres, the dust settles, and a tiny astronaut climbs out to plant the flag you designed. Get it wrong and you make a new crater, or, if you never touched the engine at all, you strike oil.

The worlds look like travel posters, by day in the light theme and by night in the dark one: Earth's coastal lights, the blue sunset of Mars, the Moon by Earthshine. A dashed line shows where a full burn would stop you, so you can see the physics while you learn it, and a flight recorder shows afterwards how close you came to the perfect run.

## What's new

- **Fly it live** with a throttle lever and time warp, or in the original's ten-second turns with a predicted path. See [CHANGES-FROM-ORIGINAL.md](CHANGES-FROM-ORIGINAL.md) for everything that changed.
- **Ten missions and a Daily Drop**: cargo, short tanks, hot entries, dead instruments, and one descent a day that everyone flies.
- **Free Flight**: the lander leans and drifts, and has to stand upright on a ledge between the rocks or on a barge at sea.
- **Your own flag**, planted on every landing under 5 km/h, with emblems you earn.
- **Help that teaches**: a burn guide, a landing assist and fuel settings from Generous to Tight.
- **1979 mode**: the original program's numbers and quirks, turn for turn, on a blocky screen.

## The original

*Lander* is a landing simulator for one player. You are falling towards a world at 5,000 km/h, and your only control is the engine. Every ten seconds of flight you type a **burn rate** from 0 to 100. A bigger burn slows you down faster and uses more fuel. You have to reach the ground at **under 20 km/h** to survive.

You choose one of four destinations: Earth, the Moon, Mars, or an invented "Asteroid Alpha". A panel in the corner shows the elapsed time, your height, your speed and your fuel. The rest of the screen is a picture drawn with the machine's block graphics: your lander at the top, and the ground rising to meet it as you get lower. A gentle landing is rewarded with a small animation of an astronaut planting a flag. A hard one gets a wreck, an explosion, or a joke.

The program is 113 lines of BASIC. How it works, and how to play it today, is in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md); playing it is under [Playing the original](ORIGINAL-ARCHITECTURE.md#playing-the-original).

The program is a commercial product, so this project does not reproduce its listing, its text or its pictures. Only single words and short phrases are quoted.

### The machine: a TRS-80 with Level II BASIC

The program is written for the **TRS-80 Model I or Model III** with **Level II BASIC**, the 16K Microsoft-derived BASIC in ROM. Several features give this away:

- `PRINT @` places text at one of the screen's 1,024 character positions (64 columns by 16 rows).
- `SET` and `RESET` switch single "pixels" of the machine's 128 × 48 block graphics on and off.
- Character codes 128 to 191 are 2 × 3 blocks of those pixels. The program builds its pictures out of them.
- `CHR$(23)` switches the screen to 32 big characters per line, which the title screen uses.
- The cursor-control codes 24, 26 and 27 move the print position left, down and up. The program uses them to draw sprites several rows tall with a single `PRINT`.

The catalogue says all of its programs need a 16K Level II machine.

### What makes this one different

- **Four worlds from one recipe.** The program does not store a height, a fuel load and an engine size for each world. It works them out from the world's gravity. Heavier worlds start higher, carry more fuel and get a stronger engine. The same lander is 74% more powerful on Earth than on the asteroid.
- **A zooming picture.** While you are more than 1 km up, the lander stays at the top of the screen, and the ground is redrawn in six ever-closer stages as you fall. Only in the last kilometre does the lander itself move down the screen.
- **A flag for the best pilots.** Land at 5 km/h or less, and a tiny astronaut climbs out and plants a flag that waves for a few seconds. At 20 km/h you only get a cheer. Most players probably never saw the flag.
- **A crash ladder.** Anything from 20 km/h up is a crash, in escalating grades: wrecked, disintegrated, a new crater, and finally striking oil.

## Who made it

The title screen credits **Simutek**, with a 1979 copyright. Simutek (later Simutek Computer Products) was a small software publisher in Tucson, Arizona, which sold cassette software for the Radio Shack TRS-80 by mail order. Its surviving catalogue gives a P.O. box in Tucson and says the company had been supplying TRS-80 owners "for almost three years".

- Simutek sold its games in themed **packages** of five programs on one cassette, at $14.95 each. *Package One* (1979) held five space games: *Graphic-Trek 2000*, *Star Wars*, *Space Target*, *Invasion Worg* and *Saucers*.
- The same catalogue offered hardware at discount prices, and a BASIC compiler. Simutek later published **ZBasic**, a BASIC compiler whose 1982 manual survives in the Internet Archive.
- The catalogue invited programmers to send in their own games, promising royalties of 10 to 15 percent. Many of Simutek's games may therefore have been written by outside authors.

The listing does not name its programmer, and the catalogue does not either. **Who wrote Lander is unknown.**

## Where it went

### Sold as "Space Landers" in Package Four

The catalogue lists a game called **Space Landers** in *Package Four*, alongside *Life*, a dice game, *The Pharaoh* and *Robot Hunter*. The description says you can "pick what planet, asteroid or moon" you land on. A screenshot beside the description shows the same messages our listing prints after a gentle landing. Our file is therefore Space Landers, or a version of it.

There is one difference. The catalogue promises **three skill levels**, and our listing has none. It may be an earlier or later version than the one described. This is **unverified**.

"Asteroid Alpha" is not unique to this game. The planet list in *Invasion Worg* (Package One) also includes an "Asteroid Alpha", next to an "Asteroid Beta". It looks like a small shared Simutek universe.

### Fifty years of landing games

Landing games are one of the oldest kinds of computer game.

- **1969:** a high-school student, Jim Storer, wrote *Lunar* in the FOCAL language on a PDP-8. You typed a fuel rate every ten seconds and were told how hard you hit the Moon.
- **Early 1970s:** David Ahl converted it to BASIC. It became one of the best-known programs in *101 BASIC Computer Games* and was copied onto almost every early computer.
- **1979:** Atari released an arcade game with vector graphics, rotation and a thrust button. It was published in the same year as this program.

Simutek's *Lander* keeps the ten-second turns and the typed burn rate of the text games. It adds four worlds, a graphic display that zooms in as you fall, and an animated ending. Its jokes (a new crater, and "struck oil" for the fastest impacts) follow the tradition of the 1969 original, which also graded your crater.

**In Don't Crater**, the rebuild, every classic mode keeps this program's straight-down flight. A separate Free Flight mode adds the other branch of the family, sideways motion: the lander leans, arrives with a drift, and has to come down upright on a planned landing site among rocks, still flying this program's equations, now in two dimensions.

### Our copy

Our file is plain text (ASCII with DOS line endings), not a tokenized program, so it was probably listed out or typed in at some point. One line of the terrain data contains the text `<16>` where a single character should be. It looks like a byte (decimal 16) that a converter wrote out as a label. The screen layout only adds up if that label stands for one character. Where the file came from, and when, is **unknown**.

## Facts and trivia

- **Doing nothing strikes oil.** Everyone starts at 5,000 km/h, and the oil message appears at 5,000 km/h and above. If you type 0 every turn, you strike oil on every world, the Moon included.
- **Schrödinger's landing.** The picture and the message use different cut-offs: the wreck animation starts above 19 km/h, the crash message at 20 km/h. Land at 19.5 km/h and you see a wreck, then read that you have landed.
- **The clock never stops.** Choosing to try again resets everything except the elapsed-time clock. Your second landing's time includes your first flight.
- **Earth is gentler than Earth.** The program converts gravity with a division by 36 where a multiplication by 0.036 was needed. Its Earth pulls at 77% of the real strength. Its distance sums also make the lander travel 12.5% further than its own speedometer suggests.
- **The asteroid needs a very light touch.** To hover near the asteroid you need a burn of about 0.7, and the program accepts decimals. A burn of 1 is already too much.
- **Everything is winnable.** Simulations for this project show a perfect landing is possible on all four worlds. Earth takes the most turns (about 36) and the Moon the fewest (about 20).
- **Don't Crater swaps the made-up asteroid for a real one.** Psyche is a metal asteroid whose gravity is nearly as weak as Asteroid Alpha's (0.40 against 0.49 km/h gained per second, in the game's units); NASA's probe of the same name is due to arrive in 2029.

The trivia from the program's own code is checked line by line in [NOTES.md](NOTES.md).

## Sources

- Simutek, *TRS-80 Users Catalog C* (Tucson, around 1980; the archive copy is undated). Internet Archive: `simutek-trs-80-useradio-shack-catalog-c-19xx`.
- Simutek, *Package One* manual (1979). Internet Archive: `Simutek_Package_One_1979_Simutek`.
- Simutek, *ZBasic v2.2* manual (1982). Internet Archive: `ZBasic_v2.2_1982_Simutek`.
- Wikipedia: "Simutek Package One", "Lunar Lander (video game genre)".
- Psyche's gravity and radius, and the arrival date of NASA's probe: public NASA mission data (`lib/lander/worlds.ts` records the figures used).
- Analysis and simulations in this project: see ORIGINAL-ARCHITECTURE.md, NOTES.md and `scripts/check-lander.ts`.
