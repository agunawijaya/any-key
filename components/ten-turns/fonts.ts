import { Chewy, Fraunces } from "next/font/google";

/** The storybook's voice: a soft, slightly wonky book face for words on the page. */
export const bookFont = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
  variable: "--tt-book",
});

/** Big sound words: SQUISH, CRUNCH. */
export const shoutFont = Chewy({ subsets: ["latin"], weight: "400", variable: "--tt-shout" });
