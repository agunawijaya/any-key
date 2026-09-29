import { MusicPreview } from "./MusicPreview";
import { SticklerPreview } from "./SticklerPreview";

/** Each program brings its own living preview; the halls just place it. */
export function ProgramPreview({ id }: { id: string }) {
  switch (id) {
    case "music":
      return <MusicPreview />;
    case "23mtch":
      return <SticklerPreview />;
    default:
      return null;
  }
}
