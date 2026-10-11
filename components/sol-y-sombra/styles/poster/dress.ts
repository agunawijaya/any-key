import type { MatadorColours } from "../../render/matadorFigure";

/*
 * Costumes for everyone who isn't the matador (he wears the palette's own
 * suit of lights): the two men of his crew in suits embroidered in silver,
 * and admirers from the stands in shirtsleeves.
 */

export const CREW_DRESS: Partial<MatadorColours>[] = [
  { suit: "#20463c", jacket: "#20463c", gold: "#d5d7dc", stocking: "#f0b3c0" },
  { suit: "#4a2340", jacket: "#4a2340", gold: "#d5d7dc", stocking: "#f0b3c0" },
  { suit: "#2d2a33", jacket: "#f3ece0", gold: "#a8302a", stocking: "#2d2a33", slipper: "#3a2a20", shirt: "#f3ece0", tie: "#f3ece0" },
  { suit: "#5a4632", jacket: "#e9dcc0", gold: "#2c4b86", stocking: "#5a4632", slipper: "#2a1d16", shirt: "#e9dcc0", tie: "#e9dcc0" },
];
