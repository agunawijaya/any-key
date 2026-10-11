import type { Metadata } from "next";
import { SolYSombra } from "@/components/sol-y-sombra/SolYSombra";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Sol y Sombra — Any Key",
  description: "One cape. One charge. Hold still.",
};

export default async function SolYSombraPage() {
  return <SolYSombra docs={await loadProgramDocs("sol-y-sombra")} />;
}
