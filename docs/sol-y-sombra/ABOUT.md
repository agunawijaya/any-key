# Sol y Sombra: about the game

**Sol y Sombra** puts you in the ring with a red cape and half a tonne of bull coming at you. You choose how close to let each charge pass, you read the crowd, and when the time feels right you go to the moment of truth. Then the stands decide what you earned: polite silence, applause, a lap of honour, or being carried out through the great gate on their shoulders. It is the Any Key rebuild of _Bull_, a text game from 1978, drawn as an early-1900s bullfight poster that has come alive.

## The game

An afternoon in the ring starts with the paseo: you and your two men cross the sand from the great gate and bow to the presidency. The bulls' door opens and your bull bursts out; its bill tells you what kind of animal it is (magnificent and dangerous, or meek and safe) and two habits it has, like hooking to one side or tiring early. Your crew work it first with their capes, and their card says plainly what their work did to your chances.

Then it's you. Each pass, three cards: the veronica, the cape swept slowly across with the horns going by your waist; the outside pass, the cape held out at arm's length; the swirl, a showy spin and the safest of the three. Every card shows its real odds of a goring, of a close call, and what the crowd will make of it. The bull paws the sand, lowers its head and charges, the cape blooms round you, and at the closest moment the picture slows and the stands breathe out an "olé".

If the horn catches you, you're thrown onto the sand, and your crew run in to draw the bull away. You can get up and carry on, which the crowd loves and which makes everything riskier from then on, or retire. When you're ready, the moment of truth: go in over the horns (the steadier way) or wait for the charge (rarer, and the crowd will rise for it). If it works, the bull goes down to rest on the sand, calm, and the stands come to their feet. One honest roll of the crowd's mood decides your reward, and a bull that rested always gets up afterwards and walks back to the pens.

## What's new

- **The ring itself**: the matador, his two men and the bull are rigged skeletons moving in real time, with planted feet, a cloth cape that billows and drags, dust kicked up by the hooves, and three and a half thousand people in the stands who stand, wave and throw flowers.
- **Choices that differ**: the three cape moves now carry very different risks and rewards, and the two finishes really are two choices (the 1978 program treated them as one).
- **Honest odds**: every card shows the chance the game will roll against. Better crews make you safer, as the 1978 instructions promised and its arithmetic didn't.
- **A crowd you can watch**: a meter of bravery, artistry, the bull's worth, the risk you took and your finish, and one roll at the end, shown on a dial as it lands.
- **No blood, no death**: gorings throw the matador down; a serious one ends in the infirmary, with him fine; the bull rests and goes home.
- **1970s mode**: the 1978 program, question for question, with every quirk it had.

The full list is in [CHANGES-FROM-ORIGINAL.md](CHANGES-FROM-ORIGINAL.md).

## The original

_Bull_ is a BASIC program of 193 lines, printed in _BASIC Computer Games_ (Creative Computing, 1978) for the Microsoft BASIC of the first home computers. You typed a cape move each pass, and when you chose to try the kill, a number for how; the program answered with lines of text: the bull's rating, how your helpers had done, whether you were gored, and what the crowd awarded you.

## Who made it

The listing carries only the Creative Computing header. Accounts of the book credit the program to David Sweet of Dartmouth, with later changes by students at Lexington High School and by Steve North of Creative Computing; we have not been able to check that against the book itself, so the Hall names Creative Computing only. David H. Ahl edited the book.

## Where it went

The program travelled with _BASIC Computer Games_, the best-selling computer book of its day, and with the collections of type-in programs that copied it for other BASICs. Our copy is the 1978 listing.

## Facts and trivia

- The program says better assistants help you; in its arithmetic they make every pass more dangerous and every kill harder.
- It asks how you want to kill (over the horns, or in the chest) and then treats both answers exactly the same: the test that would have told them apart reads a variable nothing ever sets.
- The crowd's verdict rolls the dice three times, once for each step of the award, which pulls the results towards the middle.
- A matador who doesn't survive is still given awards by the crowd.
- Your helpers' ratings are drawn from the bull's: a superb bull tends to bring superb helpers.
- With no random seed, every run on a freshly loaded computer dealt the same afternoon.

## Sources

- The program listing, `BULLFGHT.BAS` (the source of every fact above about how it works; the measurements are in [NOTES.md](NOTES.md)).
- _BASIC Computer Games_, ed. David H. Ahl, Creative Computing, 1978.
