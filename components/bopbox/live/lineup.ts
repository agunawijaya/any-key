import type { StyleId } from "@/lib/music/arrange";
import type { SoloInstrumentId } from "@/lib/music/arrange/patches";
import type { Performance } from "@/lib/music/perform/cues";
import { Concert } from "./shows/concert";
import { Cypher } from "./shows/cypher";
import { DangdutStage } from "./shows/dangdut";
import { DjBooth } from "./shows/djBooth";
import { JazzClub } from "./shows/jazz";
import { Pc5150 } from "./shows/pc5150";
import { PianoCam } from "./shows/pianoCam";
import { PopStage } from "./shows/pop";
import { Recital } from "./shows/recital";
import { RobotLab } from "./shows/robotLab";
import { Rooftop } from "./shows/rooftop";
import type { Show } from "./stage";

export type ShowOptions = { styleId: StyleId; instrument: SoloInstrumentId };

/** Who performs each style, and where. */
const SHOWS: Record<StyleId, (perf: Performance, options: ShowOptions) => Show> = {
  orchestra: (perf) => new Concert(perf),
  original: (perf) => new Concert(perf),
  pop: (perf) => new PopStage(perf),
  jazz: (perf) => new JazzClub(perf),
  dangdut: (perf) => new DangdutStage(perf),
  house: (perf) => new DjBooth(perf),
  koplo: (perf) => new DjBooth(perf),
  hiphop: (perf) => new Cypher(perf),
  solo: (perf, { instrument }) => (instrument === "piano" ? new PianoCam(perf) : new Recital(perf, instrument)),
  pc81: (perf) => new Pc5150(perf),
  remix: (perf) => new RobotLab(perf),
  lofi: (perf) => new Rooftop(perf),
};

export function createShow(perf: Performance, options: ShowOptions): Show {
  return SHOWS[options.styleId](perf, options);
}
