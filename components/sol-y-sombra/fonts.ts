import { Abril_Fatface, Playfair_Display, Sancreek } from "next/font/google";

/** The poster's headline: an ornamental wood type with spurred serifs, for the title and the matador's name. */
export const headlineFont = Sancreek({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--sys-headline" });

/** Banners and the names of the passes: a fat, high-contrast face. */
export const bannerFont = Abril_Fatface({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--sys-banner" });

/** Small print on the poster: dates, the ring's name, the fine lines. */
export const printFont = Playfair_Display({ subsets: ["latin", "latin-ext"], style: ["normal", "italic"], variable: "--sys-print" });

/** The font families as canvas can use them, once the page has the variables. */
export const FONT_STACKS = {
  headline: `${headlineFont.style.fontFamily}, Georgia, serif`,
  banner: `${bannerFont.style.fontFamily}, Georgia, serif`,
  print: `${printFont.style.fontFamily}, Georgia, serif`,
};
