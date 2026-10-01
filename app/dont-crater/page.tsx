import type { Metadata } from "next";
import { DontCrater } from "@/components/dontcrater/DontCrater";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Don't Crater — Any Key",
  description: "Fall from orbit at 5,000 km/h and land like a feather. A 1979 descent simulator rebuilt with four worlds, a throttle lever, missions, a daily drop and your own flag.",
};

export default async function DontCraterPage() {
  return <DontCrater docs={await loadProgramDocs("lander")} />;
}
