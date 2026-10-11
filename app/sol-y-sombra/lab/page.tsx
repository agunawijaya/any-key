import type { Metadata } from "next";
import { MotionLab } from "@/components/sol-y-sombra/lab/MotionLab";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Sol y Sombra motion lab — Any Key",
  description: "The rig on a plain ring, and the game's scenes one by one, for judging movement.",
  robots: { index: false },
};

/** The motion lab: the rig without the art, the hero frames, and the scenes between passes. */
export default async function SolYSombraLabPage() {
  return <MotionLab docs={await loadProgramDocs("sol-y-sombra")} />;
}
