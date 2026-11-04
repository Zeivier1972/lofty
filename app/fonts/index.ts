/**
 * Fonts served from the repo instead of next/font/google.
 *
 * next/font/google downloads each font from Google at build time; when that
 * download fails the whole Railway build fails ("Failed to build an image",
 * a next/font TypeError in the build log). Bundling the files makes the
 * build independent of Google Fonts. Latin subset (covers Spanish), from
 * the @fontsource packages (SIL Open Font License — see LICENSE-*.txt).
 */

import localFont from "next/font/local"

/** Cormorant Garamond as `--font-display` (Parkside, House of Wellness). */
export const cormorantDisplay = localFont({
  src: [
    { path: "./cormorant-garamond-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./cormorant-garamond-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
})

/** Cormorant Garamond as `--mp-serif` (Millenia Park, GZ Tower). */
export const cormorantMp = localFont({
  src: [
    { path: "./cormorant-garamond-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--mp-serif",
  display: "swap",
})

/** Jost as `--font-display` (Domus). */
export const jostDisplay = localFont({
  src: [
    { path: "./jost-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./jost-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./jost-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
})

/** Jost as `--mp-sans` (Millenia Park, GZ Tower). */
export const jostMp = localFont({
  src: [
    { path: "./jost-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./jost-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./jost-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./jost-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--mp-sans",
  display: "swap",
})

/** Inter (variable weight) for the app and the client portal. */
export const inter = localFont({
  src: "./inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
})
