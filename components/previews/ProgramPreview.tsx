import { gameById } from "@/lib/catalog";
import { ComingSoonPreview } from "./ComingSoonPreview";
import { DontCraterPreview } from "./DontCraterPreview";
import { LongMemoryPreview } from "./LongMemoryPreview";
import { MusicPreview } from "./MusicPreview";
import { OuttaPreview } from "./OuttaPreview";
import { SticklerPreview } from "./SticklerPreview";
import { TwoHumpsPreview } from "./TwoHumpsPreview";

/** Each program brings its own living preview; the halls just place it. */
export function ProgramPreview({ id }: { id: string }) {
  switch (id) {
    case "music":
      return <MusicPreview />;
    case "23mtch":
      return <SticklerPreview />;
    case "escape":
      return <OuttaPreview />;
    case "lander":
      return <DontCraterPreview />;
    case "two-humps":
      return <TwoHumpsPreview />;
    case "long-memory":
      return <LongMemoryPreview />;
    default: {
      const game = gameById(id);
      return game ? <ComingSoonPreview game={game} /> : null;
    }
  }
}
