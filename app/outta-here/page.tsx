import type { Metadata } from "next";
import { OuttaHere } from "@/components/outta/OuttaHere";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Outta Here — Any Key",
  description:
    "The walls grow while you hesitate. A 1980 TRS-80 escape game rebuilt with wood to push, glass to bomb, a Mega bomb for stone, four chasers, thirty screens on five old computers, a daily escape and the original, bugs and all.",
};

export default async function OuttaHerePage() {
  return <OuttaHere docs={await loadProgramDocs("escape")} />;
}
