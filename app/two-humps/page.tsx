import type { Metadata } from "next";
import { TwoHumps } from "@/components/two-humps/TwoHumps";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Two Humps — Any Key",
  description: "Forty miles across the real Gobi on a camel with a mind of its own. Outrun a wall of sand, a rival caravan or a gang of jerboas.",
};

export default async function TwoHumpsPage() {
  return <TwoHumps docs={await loadProgramDocs("two-humps")} />;
}
