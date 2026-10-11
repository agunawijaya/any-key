# Sol y Sombra: changes from the original

We kept what made _Bull_ tense: a bull of uncertain quality, helpers whose work matters, one choice after another between safety and daring, a moment of truth you choose yourself, and a crowd that judges. We mended the arithmetic that said the opposite of the instructions, gave the two finishes their difference back, and put the whole afternoon in a ring you can watch.

## Kept

| In the original | In Sol y Sombra |
|---|---|
| A bull drawn from five qualities, the best the most dangerous | Five qualities, Magnificent to Meek, with the same trade-off: a finer bull is riskier and worth more to the crowd |
| Two crews whose work is rated before you start | The picadores and the banderilleros, rated Masterly to Poor |
| Three cape moves: the veronica, the outside move, the swirl | The same three, in the same order, on keys 1, 2 and 3 |
| Later passes are safer and the kill likelier | The bull tires: each pass a little safer, the finish likelier |
| The kill is tried when you choose, and may fail | The moment of truth when you press K; a miss lets you try again |
| A goring, and a choice to run or stay | A goring, and a choice to retire or get up and carry on |
| Bravery after a goring impresses the crowd | Getting up adds courage to the crowd's meter |
| The crowd's verdict in tiers | Four tiers: polite silence, applause, a lap of honour, carried out on shoulders |
| The question-and-answer game, its quirks and its wording's spirit | 1970s mode, question for question |

## Changed

| In the original | In Sol y Sombra | Why |
|---|---|---|
| Better crews make passes more dangerous and kills harder (the ratings sit under the risk) | Better crews make passes safer, and the card says by how much | The instructions promised it; players read it that way |
| The crews' ratings are drawn from the bull's quality | The crews' work is drawn on its own, mostly middling | The link was hidden, and with the inversion mended it only made fine bulls easy |
| Both ways to kill use the same test (line 1240 reads an unset variable) | Over the horns is steadier; waiting for the charge is riskier and worth twice as much | Two choices that are really two |
| A veronica is barely riskier than a swirl | The veronica is six times riskier than the swirl and worth six times as much bravery | A choice between safety and daring should be one |
| The crowd rolls three times, once per tier | The crowd rolls once, from a meter you watch fill, and the dial shows each award's chance first | Honest odds; the extra rolls pulled everyone towards the middle |
| A fatal goring, and awards after it | Nobody dies: a serious goring ends the afternoon with the matador helped to the infirmary, fine, and a little sympathy from the crowd | All ages, no death on screen |
| The bull is killed | The bull, finished, goes down to rest on the sand, gets up later and walks back to the pens | No blood, no death, the bull dignified |
| Running from the ring is booed and earns nothing | Retiring after a goring is allowed; the crowd is cooler (applause at most), not hostile | Getting out of danger isn't cowardice |
| YES and NO in capitals | Cards, buttons and keys | A modern game |
| Ears and a tail as trophies | A lap of honour and the shoulders through the great gate | Honours the crowd gives, not parts of an animal |

## Added

- **The ring**: the paseo, the bull's entrance, the crews' work, every pass, a fall, getting up, a finish, the bull resting and going home, a lap of honour, the shoulders; all played by a rig in real time, drawn as a living 1900s poster in light (an afternoon) and dark (an evening festival under lamps).
- **The bull's habits**: two tells per bull (hooking to one side, charging late, tiring early, following the cloth, keeping its strength), each changing the odds the cards show.
- **Close calls**: a clean pass with the horns brushing the suit, worth bravery and artistry.
- **The crowd's meter**: bravery, artistry, the bull, the risk taken, the finish and courage, always on screen.
- **Variety**: the crowd tires of the same move three times running.
- **Sound**: a wordless crowd, the olé, hooves, the bull's breath, the cape, a short fanfare.
- **Keycaps**: eight, one secret, through the Keyring.
- **Records** per play style, and settings for slow motion, the stands' fullness and the ring's sounds.

## Left out

- The program's opening greeting, which hailed the reader as a lover of bloodshed, and every other line of its text: our words are our own, and the 1970s mode words the same questions afresh.
- Horses: the picadores ride in a real corrida, and the original counts horses lost; ours show their work in a card, not in the ring.
- Blood, wounds, death, and the trophies cut from a bull.
- Six bulls and three matadors: an afternoon here is one bull.

## Faithful modes

**1970s mode** (`components/sol-y-sombra/Terminal1970s.tsx`, model in `lib/sol-y-sombra/original.ts`) plays the 1978 program question for question:

- every random draw in the original's order: the bull, both crews from the bull, the casualties, each pass's goring test, the coins after a goring, the kill test and the crowd's three rolls;
- the inversion, the kill choice that changes nothing, the three rolls, the award after a fatal goring, the cheers after a failed kill that the matador survived;
- `YES` and `NO` accepted only in capitals; cape moves only 0, 1 or 2; a non-number answered with the interpreter's own "?REDO FROM START";
- the instructions shown for any answer but exactly `NO`;
- no random seed: the first afternoon after opening the terminal is always the same, and later ones continue the same stream of numbers.

Where it has to guess: the interpreter's handling of an empty answer (read as zero, from Microsoft BASIC's manual rather than a run). The fatal goring is worded neutrally (the matador "did not survive the goring"), and the trophies are called trophies rather than ears and a tail.
