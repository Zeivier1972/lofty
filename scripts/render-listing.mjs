#!/usr/bin/env node
/**
 * Render a listing video locally using Remotion.
 *
 * Usage:
 *   node scripts/render-listing.mjs --config ./listing-config.json
 *   node scripts/render-listing.mjs --config ./listing-config.json --output ./my-video.mp4
 *
 * Download the config JSON from the Content Studio > Listing Video tab in the CRM.
 */

import { bundle } from "@remotion/bundler"
import { renderMedia, selectComposition } from "@remotion/renderer"
import { createRequire } from "module"
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { parseArgs } from "util"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir   = resolve(__dirname, "..")

// ─── Parse CLI args ───────────────────────────────────────────────────────────

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    config:  { type: "string", short: "c" },
    output:  { type: "string", short: "o" },
    concurrency: { type: "string", default: "4" },
  },
  allowPositionals: true,
})

// Default to the file Content Studio downloads if no --config is given
const configArg = values.config ?? "video-ad-config.json"

const configPath = resolve(process.cwd(), configArg)
if (!existsSync(configPath)) {
  console.error(`❌  Config file not found: ${configPath}`)
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, "utf-8"))
const { scenes, agentName, agentTitle, agentPhone, propertyAddress, price, brandColor, meta } = config

if (!scenes?.length) {
  console.error("❌  Config has no scenes. Re-download from the CRM.")
  process.exit(1)
}

const outputPath = values.output
  ? resolve(process.cwd(), values.output)
  : resolve(rootDir, `output/listing-${Date.now()}.mp4`)

const fps    = meta?.fps    ?? 30
const width  = meta?.width  ?? 720
const height = meta?.height ?? 1280
const totalFrames = scenes.reduce((sum, s) => sum + Math.round(s.duration_seconds * fps), 0)

console.log("")
console.log("🎬  Lofty CRM — Listing Video Renderer")
console.log("────────────────────────────────────────────────")
console.log(`📋  Property : ${propertyAddress || "(not set)"}`)
console.log(`💰  Price    : ${price || "(not set)"}`)
console.log(`👤  Agent    : ${agentName}`)
console.log(`🎞  Scenes   : ${scenes.length}`)
console.log(`⏱  Duration : ${(totalFrames / fps).toFixed(1)}s  (${totalFrames} frames @ ${fps}fps)`)
console.log(`📐  Format   : ${width}×${height} (9:16 Reels / TikTok)`)
console.log(`📁  Output   : ${outputPath}`)
console.log("")

// Ensure output directory exists
const { mkdirSync } = await import("fs")
mkdirSync(resolve(outputPath, ".."), { recursive: true })

// ─── Bundle & Render ──────────────────────────────────────────────────────────

console.log("📦  Bundling Remotion compositions…")
const bundled = await bundle({
  entryPoint: resolve(rootDir, "remotion/Root.tsx"),
  webpackOverride: (config) => config,
})

console.log("🔍  Selecting composition…")
const composition = await selectComposition({
  serveUrl: bundled,
  id: "ListingVideo",
  inputProps: {
    scenes,
    agentName: agentName ?? "Catherine Gomez",
    agentTitle: agentTitle ?? "Real Estate Agent",
    agentPhone: agentPhone ?? "",
    propertyAddress: propertyAddress ?? "",
    price: price ?? "",
    brandColor: brandColor ?? "#FF4D1C",
  },
})

console.log(`🎨  Rendering ${totalFrames} frames… (this may take a few minutes)`)
console.log("")

let lastPercent = -1
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: outputPath,
  inputProps: composition.defaultProps,
  concurrency: parseInt(values.concurrency ?? "4", 10),
  onProgress: ({ progress }) => {
    const pct = Math.round(progress * 100)
    if (pct !== lastPercent && pct % 5 === 0) {
      lastPercent = pct
      const bar = "█".repeat(pct / 5) + "░".repeat(20 - pct / 5)
      process.stdout.write(`\r  [${bar}] ${pct}%`)
    }
  },
})

console.log("")
console.log("")
console.log("✅  Video rendered successfully!")
console.log(`📹  Saved to: ${outputPath}`)
console.log("")
console.log("Next steps:")
console.log("  1. Preview your video")
console.log("  2. Upload to Instagram Reels, TikTok, or Facebook")
console.log("  3. Or use the CRM's Publish feature to post automatically")
console.log("")
