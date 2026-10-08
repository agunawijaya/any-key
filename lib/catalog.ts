import { desertManifest } from "./desert/manifest";
import type { GameManifest } from "./kit/manifest";
import { landerManifest } from "./lander/manifest";
import { musicManifest } from "./music/manifest";
import { outtaManifest } from "./outta/manifest";
import { sticklerManifest } from "./stickler/manifest";

/** Every game in the Hall, in the order the Hall shows them. */
export const games: GameManifest[] = [musicManifest, sticklerManifest, landerManifest, outtaManifest, desertManifest];

export const playableGames = games.filter((game) => game.status === "playable");

export const gameById = (id: string) => games.find((game) => game.id === id);

export const oldestYear = Math.min(...games.map((game) => game.inspiredBy.year));
