import type { Metadata } from "next";
import { TenTurns } from "@/components/ten-turns/TenTurns";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Ten Turns in the Pit — Any Key",
  description: "It's fluffy. It's hungry. It's faster than you. Last ten turns in a pit with a very hungry rabbit.",
};

export default async function TenTurnsPage() {
  return <TenTurns docs={await loadProgramDocs("ten-turns")} />;
}
