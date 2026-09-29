import { MusicPreview } from "./MusicPreview";

/** Each program brings its own living preview; the halls just place it. */
export function ProgramPreview({ id }: { id: string }) {
  switch (id) {
    case "music":
      return <MusicPreview />;
    default:
      return null;
  }
}
