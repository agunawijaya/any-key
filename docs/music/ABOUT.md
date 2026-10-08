# Bop Box: about the game

Bop Box is a jukebox from 1981 that turned into a band. Press a letter to pick one of eleven tunes, press a number to pick who plays it, and watch every note light up on a piano as it sounds: the tune as the first IBM PC beeped it, as a jazz trio, a house track, a dangdut band, or the full orchestra its composer wrote for.

## The game

Press **F** and you get *La Cucaracha*, because in 1981 the menu filed the cockroach song under BUG. Press **9** and it beeps out of a square-wave speaker, a little sharp and a little clipped, on a 26-key piano on a blue screen. Now press **5** while it plays. A dangdut band picks the tune up on the same bar, kendang thumping, suling bending the notes, and the whole page changes colour with it. That is the moment people remember: switching from 1981 to an orchestra, a trap beat or a Mozart symphony in the middle of a phrase without the tune missing a step.

There is nothing to win. You poke at it: mute the violins and play the melody yourself, slow the waltz to half speed and follow it in numbers, hear the Funeral March of a Marionette as phonk, or press **L** and let the 1981 excerpt carry on into the whole piece.

## What's new

- **Twelve styles** for every tune, from Orchestra and Jazz to Dangdut, Koplo and Hip-hop, plus an AI Remix with a genre of its own for each tune.
- **The Original Score:** Gounod's orchestra, Sousa's band and Mozart's symphony orchestra, every part read from free editions of the full scores (the editions are listed in [ARCHITECTURE.md](ARCHITECTURE.md)).
- **Every tune twice:** the excerpt the 1981 program played, and the whole piece, up to the Blue Danube's thirteen and three-quarter minutes.
- **Four ways to watch:** live sheet music, falling notes, Indonesian numbered notation (*not angka*) and a stage full of musicians.
- **A band you can mix and a piano you can play,** with MIDI and WAV downloads of whatever you make.
- **PC Speaker ’81,** the original beep rebuilt from the program's own pitch maths and timing.

The full list, and the reasons, are in [CHANGES-FROM-ORIGINAL.md](CHANGES-FROM-ORIGINAL.md).

## The original

*The IBM Personal Computer Music* is a short demonstration program in IBM Personal Computer BASIC. IBM shipped it on the PC DOS diskette for the original IBM PC. It shows a menu of eleven tunes and plays the one you pick on the PC's one-voice speaker. While a tune plays, a small piano keyboard drawn from text characters marks the key that is sounding.

To run the original today, see [Playing the original](ORIGINAL-ARCHITECTURE.md#playing-the-original). For its internals, see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

### At a glance

| | |
|---|---|
| Title (from the program header) | The IBM Personal Computer Music |
| Version | Program 1.10, "(C) Copyright IBM Corp 1981, 1982". The embedded tune data is still labelled "Music Scroll, Version 1.00, 1981" |
| Owner | IBM ("Licensed Material – Program Property of IBM") |
| Language | IBM Personal Computer BASIC. It runs under both Disk BASIC (`BASIC.COM`) and Advanced BASIC (`BASICA.COM`) |
| Distributed on | PC DOS 1.00 (as version 1.00), PC DOS 1.10, the PC DOS 2.00 Supplemental Programs diskette, and PC DOS 2.10 (a lightly edited copy) |
| How it was started | Item **A** of IBM's `SAMPLES` menu program, or directly with `BASICA MUSIC` |
| Target machine | IBM PC model 5150 with the Color/Graphics Monitor Adapter (40-column colour text) and the built-in speaker |

### The hardware it was written for

- **IBM PC model 5150**, released 12 August 1981 and developed in Boca Raton, Florida. It has an Intel 8088 CPU at 4.77 MHz and Microsoft's Cassette BASIC in ROM.
- **Display.** MUSIC uses the Color/Graphics Monitor Adapter in 40-column colour text mode. The screen has a blue background, a white-and-black keyboard in a red frame, and a white-on-red title bar.
- **Sound.** The PC speaker can only make a square wave. Channel 2 of the Intel 8253 timer chip produces it by dividing a 1.19318 MHz clock (the 14.31818 MHz system crystal divided by 12) by a 16-bit number. It has only two output levels and can play one tone at a time. BASIC's `SOUND` statement takes a frequency in hertz and a duration in timer "clock ticks", which occur 18.2 times per second.
- **BASIC levels.** IBM's BASIC came in three levels: Cassette (in ROM), Disk (`BASIC.COM`) and Advanced (`BASICA.COM`). The two disk-based versions build on the ROM, so they only run on genuine IBM machines. `SOUND` exists at every level, but `PLAY` is Advanced-only. MUSIC plays every note with `SOUND`. It also wraps its single `PLAY` command in an error trap, so it runs happily under plain Disk BASIC too.

### The eleven tunes

The menu letters, labels and titles below are the ones shown by the program. The facts about each tune come from the sources listed at the end.

| Key | Label | Title as shown | What it is |
|---|---|---|---|
| A | MARCH | FUNERAL MARCH OF A MARIONETTE - GOUNOD | Charles Gounod, *Marche funèbre d'une marionnette*. Written for piano in 1872 and orchestrated in 1879. Best known as the theme of Alfred Hitchcock's TV series, which began in 1955. |
| B | STARS | STARS AND STRIPES FOREVER - SOUSA | John Philip Sousa. Composed on 25 December 1896, premiered on 14 May 1897, and made the US National March by Act of Congress in 1987. |
| C | FORTY | Symphony #40 by Mozart | Opening theme of Symphony No. 40 in G minor, K. 550 (first movement, *Molto allegro*). Mozart entered it in his catalogue on 25 July 1788. The program keeps the original key. |
| D | HAT | Mexican Hat Dance - Traditional | The *jarabe tapatío*, a 19th-century courtship dance from Guadalajara and the national dance of Mexico. Its standard music is credited to Jesús González Rubio (19th century). |
| E | HUMOR | Humoresque by Dvorak | Antonín Dvořák, Humoresque No. 7 from the *Humoresques*, Op. 101 (1894). Dvořák wrote it in G♭ major. The program plays it a semitone higher, in G major. |
| F | BUG | La Cucaracha - Mexican Folk Song | A Spanish-Mexican folk *corrido* whose origins are obscure. It became widely popular during the Mexican Revolution in the 1910s. *Cucaracha* means "cockroach". |
| G | POP | Pop! Goes the Weasle - Anonymous | "Pop! Goes the Weasel", an English dance and nursery rhyme. It was a dance craze in 1852–53, and its tune comes from the 18th-century "The Haymakers". |
| H | DANDY | Yankee Doodle - Anonymous | A song from before the American Revolution, sung by British officers to mock colonial "Yankees". The earliest known lyrics date from 1755 or 1758 (the date is disputed). The chorus contains "Yankee Doodle dandy". It is the state song of Connecticut. |
| I | SAKURA | Sakura - Japanese Folk Melody | "Sakura Sakura". Despite its reputation it is not ancient: it began as an urban Edo-period melody, got its present lyrics in the Meiji era, and was published in an 1888 koto collection. The program's notes (A, B, C, E, F) are the Japanese *in* (miyako-bushi) pentatonic scale. |
| J | BLUE | Blue Danube Waltz by J.S.Strauss | *An der schönen blauen Donau*, Op. 314, by Johann Strauss II. Composed in 1866 and first performed on 15 February 1867. The program plays it in D major, the key of the famous waltz theme. |
| K | SCALES | SCALES | Not a piece: a chromatic scale of 28 notes, from A♯3 up to C♯6 and back down. |

## Who made it

**No individual author can be verified.** Neither version 1.00 nor version 1.10 of `MUSIC.BAS` has an author line. The program only carries IBM's copyright and licence notice.

This is not because IBM never credited anyone. Several sibling programs on the same diskettes do name their authors in their header remarks:

| Sample program | Credited author (from its own header) |
|---|---|
| `ART`, `MORTGAGE`, `SAMPLES` (1.00); `ART`, `MORTGAGE`, `COLORBAR` (1.10) | Glenn Stuart Dardick |
| `SPACE` | R. Heiney & M. Hallerman |
| `COMM` | M. C. Rojas |
| `MUSIC`, `DONKEY`, `BALL`, `CALENDAR`, `CIRCLE`, `PIECHART` | *none* |

`DONKEY` also has no author line, yet it is well documented elsewhere as the work of Bill Gates and Neil Konzen at Microsoft. So a missing credit tells us nothing either way. According to his professional biography, Glenn S. Dardick was on the original IBM PC development team in Boca Raton. It would be easy to guess that he also wrote MUSIC, because it plugs into his `SAMPLES` menu and uses the same title-screen layout. That layout is shared by every sample, though, including DONKEY, so it proves nothing. **Treat the programmer of MUSIC as unknown.** What we can say is that it is an IBM-copyrighted program from the 1981 launch software for the PC. The BASIC interpreter it runs on was written by Microsoft for IBM.

## Where it went

The PCjs archive preserves directory listings and full disk images of the early PC DOS diskettes. Comparing them shows the program's history:

- **PC DOS 1.00 (August 1981).** This was version 1.00. `MUSIC.BAS` itself was only the player (4,224 bytes). Each tune lived in its own small file: `BUG`, `BLUE`, `HUMOR`, `POP`, `FORTY`, `DANDY`, `MARCH`, `STARS`, `HAT`, `SCALES` and `SAKURA`. **The menu labels are those file names**, which is why none is longer than eight characters. The player loaded the chosen tune with `CHAIN MERGE`. IBM stored all the other BASIC samples in compact tokenised form, but it kept these tune files as plain ASCII text. They had to be: BASIC can only merge files saved as ASCII.
- **PC DOS 1.10 (May 1982).** This is version 1.10, the version this project ports. All eleven tunes were merged into one 8,704-byte `MUSIC.BAS`, and a tune is now selected with `RESTORE` instead of loading a file. The note data is identical to the 1.00 tune files, header included. That is why the data section still says "Version 1.00, 1981". The tunes also appear in the same order as the separate files did on the 1.00 disk. The `SAMPLES` menu of 1.10 lists MUSIC as needing 48 KB of memory, up from 32 KB in 1.00. The 1.10 `SAMPLES` also dropped its own author line.
- **PC DOS 2.00 (March 1983).** The sample programs moved to a second "Supplemental Programs" diskette. Its `MUSIC.BAS` is byte-for-byte the same file as in PC DOS 1.10 (the MD5 checksums match).
- **PC DOS 2.10 (file dated October 1983).** This copy is stored as plain text and still says version 1.10, but it contains three quiet fixes. "Weasle" becomes "Weasel". The padding after "SCALES" is removed. The closing bars of the Mozart excerpt move up a semitone, from C6/C♯6 to C♯6/D6.

The listing used for this port matches the PC DOS 1.10 disk image line for line. Every line number, DATA statement and string is the same.

## Facts and trivia

### Why the labels are jokes

Every label had to be an eight-character DOS file name in version 1.00, so IBM abbreviated, sometimes with a pun:

- **BUG** is *La Cucaracha*, "the cockroach".
- **DANDY** comes from the "Yankee Doodle dandy" line of the chorus.
- **FORTY** is Mozart's Symphony No. 40.
- **HUMOR** is short for Humoresque.
- **HAT** is the Mexican *Hat* Dance.
- **STARS**, **BLUE**, **POP**, **MARCH**, **SAKURA** and **SCALES** are plain shortenings.

The menu letters A–K do not follow the order in which the tunes are stored. In the data the order is BUG, BLUE, HUMOR, POP, FORTY, DANDY, MARCH, STARS, HAT, SCALES, SAKURA. That is exactly the order in which the separate tune files sat in the PC DOS 1.00 directory.

### Quirks in the credits

- **"J.S.Strauss".** The Blue Danube is by Johann Strauss II, whose full name was Johann Baptist Strauss. The initials "J.S." do not match his name, and nobody knows why IBM used them. German sources call him "Johann Strauß Sohn" ("son"), which might explain the "S", but that is only a guess. It may just be a slip.
- **"Weasle"** is misspelled. IBM corrected it in the PC DOS 2.10 copy.
- **"STACCATTO"** is misspelled in a program comment (see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md)).
- **"Dvorak"** is written without the háček. Code page 437 has no ř anyway.
- **The Funeral March of a Marionette** is correctly credited to Gounod. Wikipedia notes that Hitchcock's show gave the piece its widest audience, even though few listeners could have named the composer or the title.

### Interesting facts

- **It plays slightly sharp.** The note table is built from a base value of 36.8 Hz, a little above the equal-tempered 36.708 Hz for that key (D1), and then rounded to whole hertz. The timer chip can only divide its clock by a whole number, which adds one more tiny rounding step. As a result, concert A plays at **441.10 Hz** instead of 440 Hz, about 4 cents sharp. Every note in the tunes lands between 0.2 and 7.9 cents sharp. The details are in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).
- **Rests are a tone too high to hear.** `SOUND` cannot play silence directly, so IBM's own BASIC manual tells programmers to "play" 32767 Hz for a rest. MUSIC does exactly that, both for rests and for the short pause after every note.
- **The note glyph is character 14.** The marker that moves across the keys is ♫, character 14 in the PC's character set (code page 437). The single note ♪ is character 13, and `PRINT` would treat that as a carriage return.
- **The keyboard is only 26 keys wide.** It runs from B3 to C6. Some tunes go outside that range, and those notes sound without lighting up. Oddly, the SCALES demo starts and ends exactly one semitone beyond each edge of the drawn keyboard.
- **Boilerplate shared with its siblings.** The opening statement `DEF SEG: POKE 106,0` and the boxed "IBM / Personal Computer" title screen appear in almost every IBM sample program of 1981. In IBM's own `SAMPLES` listing, the POKE carries the comment "CLEAR KYBD BUFFER".
- **It leaves a mess behind.** Run on its own and exited with Esc, MUSIC leaves BASIC in 40-column mode with the function-key line switched off.

## Sources

- PCjs – BASIC Programs for PC DOS 1.00 (listings of MUSIC 1.00, the tune files and SAMPLES): https://www.pcjs.org/software/pcx86/app/ibm/basic/1.00/
- PCjs – IBM PC DOS 1.00 (directory listing, release date): https://www.pcjs.org/software/pcx86/sys/dos/ibm/1.00/
- PCjs – IBM PC DOS 1.10 (directory listing, release date): https://www.pcjs.org/software/pcx86/sys/dos/ibm/1.10/
- PCjs – IBM PC DOS 2.00 (supplemental diskette listing): https://www.pcjs.org/software/pcx86/sys/dos/ibm/2.00/
- PCjs disk images used for the file comparisons: https://diskettes.pcjs.org/pcx86/sys/dos/ibm/1.10/PCDOS110.json, https://diskettes.pcjs.org/pcx86/sys/dos/ibm/2.00/PCDOS200-DISK2.json, https://diskettes.pcjs.org/pcx86/sys/dos/ibm/2.10/PCDOS210-DISK2.json
- PCjs – IBM PC BASIC ROMs: https://www.pcjs.org/machines/pcx86/ibm/5150/rom/basic/
- IBM Personal Computer BASIC, Version 1.10 manual (May 1982): http://www.bitsavers.org/pdf/ibm/pc/languages/BASIC_1.1_May82.pdf
- OS/2 Museum – DOS 1.0 and 1.1: https://www.os2museum.com/wp/dos/dos-1-0-and-1-1/
- CDFS – Glenn S. Dardick biography: https://cdfs.org/glenn-s-dardick-president
- Wikipedia – DONKEY.BAS: https://en.wikipedia.org/wiki/DONKEY.BAS
- Wikipedia – IBM BASIC: https://en.wikipedia.org/wiki/IBM_BASIC
- Wikipedia – IBM Personal Computer: https://en.wikipedia.org/wiki/IBM_Personal_Computer
- Wikipedia – PC speaker: https://en.wikipedia.org/wiki/PC_speaker
- Wikipedia – Intel 8253: https://en.wikipedia.org/wiki/Intel_8253
- Wikipedia – Code page 437: https://en.wikipedia.org/wiki/Code_page_437
- Wikipedia – Funeral March of a Marionette: https://en.wikipedia.org/wiki/Funeral_March_of_a_Marionette
- Wikipedia – The Stars and Stripes Forever: https://en.wikipedia.org/wiki/The_Stars_and_Stripes_Forever
- Wikipedia – Symphony No. 40 (Mozart): https://en.wikipedia.org/wiki/Symphony_No._40_(Mozart)
- Wikipedia – Jarabe tapatío: https://en.wikipedia.org/wiki/Jarabe_tapat%C3%ADo
- Wikipedia – Humoresques (Dvořák): https://en.wikipedia.org/wiki/Humoresques_(Dvo%C5%99%C3%A1k)
- Wikipedia – La Cucaracha: https://en.wikipedia.org/wiki/La_Cucaracha
- Wikipedia – Pop Goes the Weasel: https://en.wikipedia.org/wiki/Pop_Goes_the_Weasel
- Wikipedia – Yankee Doodle: https://en.wikipedia.org/wiki/Yankee_Doodle
- Wikipedia – Sakura Sakura: https://en.wikipedia.org/wiki/Sakura_Sakura
- Wikipedia – The Blue Danube: https://en.wikipedia.org/wiki/The_Blue_Danube
- Wikipedia – Johann Strauss II: https://en.wikipedia.org/wiki/Johann_Strauss_II
