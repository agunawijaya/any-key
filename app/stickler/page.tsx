import type { Metadata } from "next";
import { Stickler } from "@/components/stickler/Stickler";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Stickler — Any Key",
  description: "Take 1, 2 or 3 sticks. Never the last one. A 1970s mind game with a secret, rebuilt with a sore-loser opponent, a ladder, a daily puzzle and three stick styles.",
};

export default async function SticklerPage() {
  return <Stickler docs={await loadProgramDocs("23mtch")} />;
}
