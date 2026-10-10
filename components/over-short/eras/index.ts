import { greatWar } from "./great-war";
import type { Era } from "./types";

/** Every era a player can choose in the settings; the first is the default. More arrive in a later prompt. */
export const ERAS: Era[] = [greatWar];

export const eraById = (id: string): Era => ERAS.find((era) => era.id === id) ?? ERAS[0];
