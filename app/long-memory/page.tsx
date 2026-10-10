import type { Metadata } from "next";
import { SameTrickTwice } from "@/components/long-memory/SameTrickTwice";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Same Trick Twice — Any Key",
  description: "A seed-sowing game as old as history, against an opponent that studies every loss. Beat it once. It remembers.",
};

export default async function SameTrickTwicePage() {
  return <SameTrickTwice docs={await loadProgramDocs("long-memory")} />;
}
