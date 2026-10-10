import { cast, type Role } from "@/lib/music/perform/cast";
import type { TrackCues } from "@/lib/music/perform/cues";
import type { Look } from "./figure";
import { Cellist } from "./instruments/cello";
import { Accordionist, KalimbaPlayer, KotoPlayer, Metronome, MusicBoxPlayer } from "./instruments/folk";
import { Guitarist } from "./instruments/guitars";
import { Harpist } from "./instruments/harp";
import { GrandPianist, Keyboardist } from "./instruments/keyboards";
import { Drummer, MalletPlayer, SmallPercussion, Timpanist, type MalletKind } from "./instruments/percussion";
import { Bassist, Violinist } from "./instruments/strings";
import { Singer } from "./instruments/voice";
import { WindPlayer } from "./instruments/winds";
import type { Player, Seat } from "./players";

/*
 * Who draws a track: from its role (cast.ts) and where it is played. In a
 * concert hall players sit; in a band the winds stand up front and the
 * pianist may have a stage keyboard instead of a grand.
 */

export type Venue = { kind: "concert" | "band" | "solo"; grand?: boolean };

const MALLETS: Record<number, MalletKind> = { 9: "glockenspiel", 14: "glockenspiel", 98: "glockenspiel", 11: "vibraphone", 12: "marimba", 114: "steelDrums" };

export function playerFor(cues: TrackCues[], look: Look, seat: Seat, venue: Venue): Player | undefined {
  const lead = cues[0];
  const { track } = lead;
  const c = cast(track);
  const standing = venue.kind !== "concert";
  switch (c.role) {
    case "violin":
    case "viola":
      return new Violinist(lead, look, seat, { section: 0, pizzicato: !!c.pizzicato, viola: c.role === "viola" });
    case "cello":
      return new Cellist(lead, look, seat, !!c.pizzicato);
    case "bass":
      // A jazz or band bass is plucked; an orchestra's is bowed unless the part says pizzicato.
      return new Bassist(lead, look, seat, !!c.pizzicato || (venue.kind !== "concert" && track.patch.program === 32));
    case "harp":
      return new Harpist(lead, look, seat);
    case "flute":
    case "piccolo":
    case "oboe":
    case "clarinet":
    case "bassoon":
    case "sax":
    case "trumpet":
    case "trombone":
    case "horn":
    case "tuba":
    case "suling":
      return new WindPlayer(lead, look, seat, { standing: standing && !["bassoon", "horn", "tuba"].includes(c.role) });
    case "timpani":
      return new Timpanist(lead, look, seat);
    case "mallets":
      if (track.patch.program === 108) return new KalimbaPlayer(lead, look, seat);
      if (track.patch.program === 10) return new MusicBoxPlayer(lead, look, seat);
      return new MalletPlayer(lead, look, seat, MALLETS[track.patch.program] ?? "glockenspiel");
    case "piano":
      return venue.grand ? new GrandPianist(cues, look, seat) : new Keyboardist(cues, look, seat, "stage");
    case "organ":
      return new Keyboardist(cues, look, seat, "organ");
    case "synth":
      return new Keyboardist(cues, look, seat, "synth");
    case "accordion":
      return new Accordionist(lead, look, seat);
    case "guitar":
    case "bassGuitar":
    case "plucked":
      return new Guitarist(lead, look, seat, venue.kind === "concert" || (venue.kind === "solo" && track.patch.program === 24));
    case "koto":
      return new KotoPlayer(lead, look, seat);
    case "drumkit":
      return new Drummer(lead, look, seat, track.patch.program === 40 || /brush/i.test(track.name) ? "brushes" : track.patch.program === 48 ? "rods" : "sticks");
    case "tambourine":
    case "handDrums":
    case "cowbell":
      return /metronome/i.test(track.name) ? new Metronome(lead, seat) : new SmallPercussion(lead, look, seat);
    case "voice":
      return new Singer(lead, look, seat);
    default:
      return undefined;
  }
}

/** How wide a player needs to be on stage. */
export function widthOf(role: Role) {
  const widths: Partial<Record<Role, number>> = { bass: 48, harp: 74, piano: 112, koto: 124, timpani: 96, drumkit: 84, mallets: 96, guitar: 60, plucked: 56, bassGuitar: 60, accordion: 60 };
  return widths[role] ?? 54;
}
