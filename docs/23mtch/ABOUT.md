# Stickler: about the game

Stickler is a staring contest with a pile of sticks. You and Sparky, a smug little match head who is very strict about the rules, take turns picking up 1, 2 or 3 sticks, and whoever has to take the last one gets burnt. There is a secret that wins every single time. Sparky knows it. Can you work it out before he does?

## The game

A round takes a minute or two. The sticks lie on a wooden table; you pick a few, strike, and watch them flare and fly to your side. Sparky thinks, mutters, takes his share, and somehow the pile keeps landing on numbers that feel wrong for you. Then it clicks: he always leaves you the same counts. Once you see the pattern you can turn it on him, and the best moment in the game is when Sparky realises it too, starts to sweat, and has to pick up the last stick himself while it goes up in a burst of embers.

If the trick doesn't click, the Coach will walk you to it one hint at a time, and after every game a short note shows the exact move where it slipped away.

## What's new

- **Sparky**, an opponent with eight moods and three levels, from a Rookie who guesses to a Master who never misses.
- **Handfuls**: every take has to be a real handful, and the game ends with someone sweeping up the whole pile at once.
- **A ten-table Ladder** with bigger takes, several rows and the famous 1-3-5-7 table from a 1961 film, plus a **Daily** puzzle to share and **Versus** for two players.
- **Three stick styles**: matches, glow sticks or candy sticks, each with its own table, sounds and ending, in light and dark.
- **1981 mode**, the original as it played on an IBM PC, on a green screen.

The full list of what we kept, changed and added is in [CHANGES-FROM-ORIGINAL.md](CHANGES-FROM-ORIGINAL.md).

## The original

*23 Matches* (`23mtch.bas`) is a 1970s BASIC take-away game played by one human against the computer. The game starts with 23 matches. On each turn a player takes 1, 2 or 3, and **whoever has to take the last match loses**. The human always moves first.

The program is 46 lines of BASIC, one statement per line, with four numeric variables. When it can win, the computer plays perfectly. When it cannot, it takes a "random" 1 to 3. After every game a new one starts. There is no score and no way to quit.

The game was meant to teach. The write-up in DEC's *101 BASIC Computer Games* (1973) shows how to find the strategy by reasoning backwards, and notes that because the computer gives you the first move, "if you play wisely, you can win". Ahl's teacher's guide turned the game into a classroom exercise: play it with a partner using buttons or coins, then play `23MTCH` on the computer. The guide adds: "You should always be able to win."

The listing comes from a copyrighted book, so this project does not reproduce it. Only short phrases are quoted. To play the original yourself, see [Playing the original](ORIGINAL-ARCHITECTURE.md#playing-the-original). For its internals and file format, see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

## Who made it

### Bob Albrecht and People's Computer Company

The DEC write-up mentions that one version was submitted from Plainedge High School in North Massapequa, New York, but it credits the published version to **Bob Albrecht, People's Computer Co., Menlo Park, California**. Ahl's 1973 teacher's guide also credits Albrecht with *Trap*, *Stars* and *Hurkle*. The 1978 *BASIC Computer Games* calls him the original author.

Albrecht is a key figure in early personal computing:

- In 1955 he left a master's program to work at Minneapolis-Honeywell. In 1962 he was a senior applications analyst at Control Data Corporation when he gave a talk at a Denver high school. The students' response turned him towards teaching young people to program.
- After working with the Portola Institute, in October 1972 he launched **People's Computer Company (PCC)** in Menlo Park together with Dennis Allison and George Firedrake. PCC was a newsletter rather than a company, named after Janis Joplin's band Big Brother and the Holding Company. It also ran a walk-in storefront where children could learn "about having fun with computers".
- PCC printed the Tiny BASIC design, which led to *Dr. Dobb's Journal*. It published early best-sellers such as *My Computer Likes Me When I Speak BASIC*, argued for software without copyright, and ran until 1981.
- Albrecht brought the first Altair 8800 to the Homebrew Computer Club, and he is in the "who's who" of Steven Levy's *Hackers*.

His dates of birth and death are **unverified**.

### David Ahl at Digital Equipment Corporation

Line 10 of our file says Ahl converted the program to **RSTS/E**. RSTS was DEC's time-sharing operating system for the PDP-11. It first shipped as RSTS-11 in 1970, and the extended version, RSTS/E, followed in 1973. Its native language was **BASIC-PLUS**.

David H. Ahl was born in 1939. DEC hired him in 1969 to develop its educational products, and he edited *EDU*, DEC's education newsletter. Around 1971 he ported *Hamurabi* and *Lunar Lander* from FOCAL to BASIC, then asked readers to send in more games, and he persuaded DEC to publish the result as a book. He left DEC in 1974 and founded *Creative Computing*.

What the conversion actually changed in 23MTCH is **unverified**. The program uses only statements common to most BASICs, and the book's sample run was made on a DEC EduSystem 30, not on RSTS/E.

## Where it went

### Where it was published

| Date | Publication | Publisher | 23 Matches content |
|---|---|---|---|
| July 1973; reprinted April 1974 and March 1975 | *101 BASIC Computer Games* | Digital Equipment Corporation, Maynard, Mass. | Write-up, listing and sample run on pages 226–227 of the March 1975 printing. First game in the "Piles of Objects" family, before BATNUM. Apart from OCR noise, the listing matches our program, minus lines 5 and 10. |
| November 1973 | *Understanding Mathematics and Logic Using BASIC Computer Games* (Ahl) | DEC | Classroom exercises and a sample run. |
| Unverified | RSTS games DECtape, "volume 1", with Ahl's catalog program | DEC | Machine-readable 23MTCH **with** lines 5 and 10. |
| October 1978 | *BASIC Computer Games*, Microcomputer Edition | Creative Computing Press (trade edition: Workman) | A **different** program for Microsoft BASIC, converted by Steve North, in which a coin toss decides who moves first. |

The 1973 book sold about 10,000 copies. After leaving DEC, Ahl bought the rights and republished the collection, and the 1978 edition became the first computer book to sell a million copies. Whether any Creative Computing reprint of the 1973 book includes lines 5 and 10 is **unverified**.

Any Key's file is the **DEC (1973) version**, not the 1978 rewrite.

### How it reached the PC

Our file is a **tokenized GW-BASIC program**, not plain text. When decoded, it matches the 23MTCH on a DECtape image of Ahl's RSTS games, published in the `agn453/RSTS-E` GitHub repository. The tape's catalog says that all but two of its games run on RSTS-11 and RSTS/E. The match extends to the "ALBRECHR" misspelling and to the padding that lines up the statements after line numbers 5, 10 and 100. There are only two differences:

- DEC's `GO TO`, written with a space, is stored as a single GOTO token. GW-BASIC's tokenizer does this automatically, and its source notes that ANSI allows "GO TO" with spaces.
- Some trailing spaces are gone.

The printed book has no lines 5 and 10. Our file therefore almost certainly descends from DEC's machine-readable copy, rather than from someone typing in the printed listing.

The file's internal line links put the first line at offset &H126E. PC-BASIC, which copies GW-BASIC's memory layout, gives the same base for saved files under its default settings. So the file was saved by GW-BASIC, or by something that imitates it, without the `,A` (ASCII) option. The file carries no date. **Who** converted it, **when**, and **by what route** (bulletin board, shareware disk or archive CD) are unknown.

The program needed no edits to run on a PC, because GW-BASIC understands every statement it uses. One function does behave differently: `RND(0)` makes the computer's "random" move fully predictable on a PC (see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md#what-rnd0-really-does)).

## The mathematics

In game-theory terms, *23 Matches* is a **subtraction game**: one pile, and each move subtracts 1, 2 or 3. It is played under the **misère** convention, where making the last move loses. Such games are often loosely called Nim.

Reasoning backwards:

- With 1 match left, the player to move must take it and loses.
- From 2, 3 or 4 you can leave 1, so those positions win.
- From 5, every move leaves 2, 3 or 4, so 5 loses.
- The pattern repeats: **the player to move loses at 1, 5, 9, 13, 17 and 21**, the numbers that are 1 more than a multiple of 4.

The general rule for one pile, takes of 1 to *k*, and last-object-loses play is that the second player wins exactly when *n* ≡ 1 (mod *k* + 1). Here 23 = 4 × 5 + 3, so **the first player wins by taking 2**, which leaves 21. After that, the first player answers each take with 4 minus it, leaving 17, 13, 9, 5 and then 1. The human always moves first, so the intro's jokey hope that the best computer wins is empty against anyone who knows the rule, and the book says so openly.

The DEC book builds on this idea step by step. After 23MTCH comes BATNUM, where you set the minimum and maximum take, the winning rule and who starts. Its write-up states the general rule: leave 1 more than a multiple of (maximum take + 1). Then comes NIM, with several piles. Stickler's Handfuls and its rows of sticks follow the same path (see [ARCHITECTURE.md](ARCHITECTURE.md#the-mathematics-inside)).

## Facts and trivia

- **"ALBRECHR".** The credit line misspells Albrecht's name. The DEC tape has the same typo, while the credit line of another program on the tape (REVERSE) spells it correctly. So the error was made at DEC and has travelled with the file ever since.
- **"(HA HA)".** The intro's boast about the best computer comes with its own laugh.
- **"1 MATCHES".** The count always uses the plural.
- **A graceful loser.** Faced with the last match, the computer concedes instead of taking it.
- **Six-character names.** `23MTCH` fits the six-character names used for every program in the DEC book, such as BATNUM, BAGLES and TICTAC.
- **An outdated write-up.** The 1978 book still says the computer gives you the first move, but its rewritten program tosses a coin, and in the sample run the computer wins the toss.
- **Who wrote what.** Ahl's 1978 acknowledgments thank Albrecht for "setting me straight as to who wrote what".
- **More than 101.** The DEC book's introduction admits there are 108 games, because seven of the 101 write-ups cover an extra version.
- **Public domain?** Wikipedia reports that in June 2022 Ahl put everything he had written into the public domain. The 1975 printing is copyrighted by Digital Equipment Corporation and the program is credited to Albrecht, so it is unclear whether this listing is covered, and this project treats it as copyrighted.

## Sources

- *101 BASIC Computer Games*, DEC, March 1975 printing (scan and OCR text): https://archive.org/details/bitsavers_decBooks10Mar75_26006648 and https://archive.org/stream/bitsavers_decBooks10Mar75_26006648/101_BASIC_Computer_Games_Mar75_djvu.txt
- *Understanding Mathematics and Logic Using BASIC Computer Games*, DEC, 1973: https://archive.org/details/understanding-mathematics-and-logic-using-basic-computer-games
- *BASIC Computer Games*, Microcomputer Edition, 1978 (OCR text): https://archive.org/stream/Basic_Computer_Games_Microcomputer_Edition_1978_Creative_Computing/Basic_Computer_Games_Microcomputer_Edition_1978_Creative_Computing_djvu.txt
- Atari Archives, *BASIC Computer Games*, 23 Matches: https://www.atariarchives.org/basicgames/showpage.php?page=177
- agn453/RSTS-E repository (README and DECtape image): https://github.com/agn453/RSTS-E and https://github.com/agn453/RSTS-E/blob/master/software/ahl_basic_games.dta
- Microsoft GW-BASIC source, tokenizer (`GWMAIN.ASM`): https://github.com/microsoft/GW-BASIC
- PC-BASIC memory model (`memory.py`): https://github.com/robhagemans/pcbasic/blob/master/pcbasic/basic/memory/memory.py
- Wikipedia, "Bob Albrecht": https://en.wikipedia.org/wiki/Bob_Albrecht
- Wikipedia, "People's Computer Company": https://en.wikipedia.org/wiki/People%27s_Computer_Company
- Wikipedia, "David H. Ahl": https://en.wikipedia.org/wiki/David_H._Ahl
- Wikipedia, "BASIC Computer Games": https://en.wikipedia.org/wiki/BASIC_Computer_Games
- Wikipedia, "RSTS/E": https://en.wikipedia.org/wiki/RSTS/E
- Wikipedia, "BASIC-PLUS": https://en.wikipedia.org/wiki/BASIC-PLUS
- Wikipedia, "Nim" (section "The subtraction game"): https://en.wikipedia.org/wiki/Nim
- Wikipedia, "Subtraction game": https://en.wikipedia.org/wiki/Subtraction_game
