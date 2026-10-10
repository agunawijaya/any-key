import type { Metadata } from "next";
import { OverShort } from "@/components/over-short/OverShort";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Over / Short — Any Key",
  description: "Call the angle. Trust the observer. One of the first artillery games ever written, reborn.",
};

export default async function OverShortPage() {
  return <OverShort docs={await loadProgramDocs("over-short")} />;
}
