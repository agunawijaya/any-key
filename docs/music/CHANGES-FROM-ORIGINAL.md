# Bop Box: changes from the original

The soul we kept is the 1981 program's whole idea: press a letter, hear a tune, and watch a piano mark every note as it sounds. Everything else grew around that.

## Kept

| In the original | In Bop Box |
|---|---|
| Eleven tunes, picked with the keys **A–K** | The same eleven tunes on the same letters. **F** is still the cockroach song |
| Upper and lower case letters both work | They still do |
| A piano on screen that marks the key that is sounding | A piano that lights every sounding key, in the colour of the instrument playing it |
| Short excerpts of each tune | The *1981* length plays the same stretch of each tune, in our own transcription |
| One square-wave voice, slightly sharp, with every note clipped short | The PC Speaker ’81 style, which recomputes the 1981 pitches and timing |
| A 26-key keyboard (B3–C6) on a blue screen in a red frame | The PC Speaker ’81 look, with a sign for notes that fall off the edge |
| The tune's title shown while it plays | The title, the composer and a line about the piece |
| The tunes' meters and, for most tunes, their keys (Mozart in G minor; Humoresque in G, a semitone above Dvořák's G♭) | Kept in the 1981 lengths, in the styles that keep the meter |

## Changed

| In the original | In Bop Box | Why |
|---|---|---|
| One square-wave voice | Twelve styles, from Orchestra to Koplo, Hip-hop and the composers' own scores | A tune deserves a band. The 1981 sound is still one key away (**9**) |
| Short excerpts only | The excerpt *and* the whole piece. **L** switches between them and keeps your place | Most players have never heard the whole Funeral March or the whole Blue Danube |
| A 26-key keyboard; notes outside it sounded without a mark | A keyboard sized to each arrangement, so every note shows. PC Speaker ’81 brings back the 26 keys | The 1981 limit was the screen's, not the music's; we keep it only where it is the point |
| Every note followed by a tick of silence, which stretched the rhythms | Rhythms as written. PC Speaker ’81 keeps the stretch | The gap was a side effect of BASIC's `SOUND`, not the composers' rhythm |
| A4 at 441.1 Hz, every note 0.2–7.9 cents sharp | Concert pitch (A4 = 440 Hz), except in PC Speaker ’81 | A band of real instruments sounds out of tune when every note is a little sharp |
| Esc stops a tune when the current note ends, up to about 1.4 s later | Space plays and pauses at once, and a new tune starts straight away | A pause should answer the moment you press it |
| Menu labels such as BUG, DANDY and FORTY | Full titles and composers in the tune list. The labels' story is told in [ABOUT.md](ABOUT.md) | The labels were eight-letter file names, not titles |
| Credits spelled "J.S.Strauss", "Weasle" and "Dvorak" | Johann Strauss II, Weasel, Dvořák | The quirks are history, told in [ABOUT.md](ABOUT.md); the credits on screen should be right |
| A title screen; press the space bar to continue | The studio opens ready to play | One screen fewer between a player and the music |
| Esc at the menu leaves the program, back to BASIC or the SAMPLES menu | *Back to the Hall*, Esc or the browser's Back button returns to the Hall | The collection's navigation standard (`docs/NAVIGATION.md`) |
| 40-column colour text | Drawn in SVG, Canvas and CSS, in designed light and dark themes; each style repaints the page | The collection draws everything in code and works in both themes |

## Added

- **Twelve styles:** Orchestra, Pop, Jazz, House, Dangdut, Koplo, Lo-fi, Hip-hop, Solo (on any of 18 instruments), PC Speaker ’81, an AI Remix with a different genre for every tune, and the Original Score, which plays every part of Gounod's, Sousa's and Mozart's own scores and our setting for the instruments of the other eight tunes.
- **Full versions** of all eleven tunes, most of them read from public-domain editions, from about a minute long to nearly fourteen minutes.
- **Four views:** sheet music with chord symbols, falling notes, *not angka* (Indonesian numbered notation) and a stage with the whole band.
- **A band you can mix:** mute any player from the Band list or the Stage.
- **A keyboard you can play**, while the music runs or on its own.
- **A transport:** a position bar, a jump of one bar either way, back to start, loop, and speeds from 0.5× to 1.5×.
- **Downloads:** any arrangement as a MIDI file or a WAV recording.
- **Eight keycaps** on the Keyring, from First Note to Concert Hall (see [HOW-TO-PLAY.md](HOW-TO-PLAY.md)).
- **The Story tab**, with these six pages inside the game.
- **Memory:** the length you chose is remembered in this browser.

## Left out

- **IBM's note data.** Every tune is our own transcription of a public-domain piece; nothing of the program's data tables is copied. The 1981 lengths follow the excerpts the program played, so the tunes are recognisably the same eleven, but the notes are ours.
- **The title screen, the selection prompt and the echo of your key.** The tune list, the style cards and the play button do their jobs.
- **The 32,767 Hz "rest".** A rest in Bop Box is plain silence, in every style. The tone was inaudible anyway.
- **The keyboard housekeeping** that cancelled half-typed function-key text during a tune. A browser has no such thing.
- **The return to the SAMPLES menu** and the screen left in 40 columns on exit. The Hall takes their place.
- **The wide title bar** that the padded SCALES title produced, and the other quirks of the 40-column screen.

## Faithful modes

**PC Speaker ’81** (key **9**) recreates how MUSIC.BAS sounded and looked, using the measurements in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

What it reproduces exactly:

- **Pitch.** Each note's frequency is computed the program's way: the table value rounded to whole hertz from 36.8 × 2^((n − 6)/12), then the timer's whole-number divisor with the remainder thrown away. A4 sounds at 441.10 Hz, and every note is as sharp as it was in 1981.
- **Time.** Every note lasts a whole number of timer ticks of 1/18.2 s, and a silent tick follows every event, so dotted rhythms soften and tunes stretch the way they did. The studio's clock runs in those ticks, so the score, the keys and the bar counter follow the stretched rhythm.
- **One voice.** A single square wave, nothing else.
- **The look.** Only the 26 keys the 1981 screen drew (B3–C6), on CGA blue in a red frame, in both light and dark themes. A note outside those keys lights an "off the edge" sign instead of a key.

Where it has to guess, or differs:

- **The notes are ours.** The mode plays our transcription of each excerpt, timed in ticks at a speed set per tune, not IBM's data. Seven tunes come within 10 % of the original's playing time. Four differ more: Humoresque plays in 9.9 s against 14.1 s (the original spreads each swung beat over six ticks as a note, a rest and a note; we write a dotted rhythm over four), The Blue Danube in 25.9 s against 40.5 s (71 notes against 102), Sakura in 27.4 s against 19.8 s (50 notes against 36) and Symphony No. 40 in 18.6 s against 21.1 s. [NOTES.md](NOTES.md) has the full comparison.
- **Fewer notes off the edge.** Our La Cucaracha has none of the three low notes the 1981 version played below the keyboard, our Scales runs exactly from B3 to C6 where the 1981 scale began and ended a semitone beyond each edge, our Yankee Doodle sits lower, and our Mozart excerpt never reaches C♯6. So only the Funeral March, the Mexican Hat Dance and The Blue Danube go off the edge, against six tunes in 1981.
- **No staccato exception.** The 1981 program skipped the silent tick after a rest of exactly one tick. The mode adds the tick after every event. None of our 1981 excerpts has a one-tick rest, so this changes nothing in them.
- **The key lights while the note sounds.** The 1981 marker appeared in the silent tick just before its note and left in the tick after; here the key lights for the note itself. The difference is one tick, about 55 ms.
- **The sound.** The browser's square-wave oscillator with 2 ms ramps at each end, at a fixed level. The real speaker's cone, its case and its two-level output are not modelled, and the timer's clock is taken as 1,193,180 Hz for the divisor and the tone alike (a difference of 0.002 cents).
- **The controls are today's.** Space pauses at once, the speed control and Loop work, and other keys are not ignored.
