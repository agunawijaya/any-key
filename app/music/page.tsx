import type { Metadata } from "next";
import { BopBox } from "@/components/bopbox/BopBox";
import { loadProgramDocs } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Bop Box — Any Key",
  description: "Eleven tunes from a 1981 PC, played twelve ways: from the composers' own scores to jazz, house, dangdut, koplo and hip-hop. With live sheet music.",
};

export default async function MusicPage() {
  return <BopBox docs={await loadProgramDocs("music")} />;
}
