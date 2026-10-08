import type { Metadata } from "next";
import { KeyringPage } from "@/components/keyring/KeyringPage";

export const metadata: Metadata = {
  title: "Keyring — Any Key",
  description: "Every badge in every Any Key game is a keycap. Collect them on one ring, level up, and keep a daily streak going.",
};

export default function Page() {
  return <KeyringPage />;
}
