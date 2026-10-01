import { DontCraterPreview } from "./DontCraterPreview";
import { MusicPreview } from "./MusicPreview";
import { OuttaPreview } from "./OuttaPreview";
import { SticklerPreview } from "./SticklerPreview";

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
    default:
      return null;
  }
}
