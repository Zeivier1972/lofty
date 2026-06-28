#!/usr/bin/env node
/**
 * Downloads Playwright's Chromium browser during Railway builds.
 * Only runs when RAILWAY_ENVIRONMENT is set (Railway production/preview).
 * Skipped locally to avoid unnecessary 150MB downloads.
 */

if (!process.env.RAILWAY_ENVIRONMENT && !process.env.INSTALL_PLAYWRIGHT_BROWSERS) {
  console.log("[postinstall] Not on Railway — skipping Playwright browser install.")
  process.exit(0)
}

const { execSync } = require("child_process")

console.log("[postinstall] Installing Playwright Chromium for ShowingNew scraper...")
try {
  // --with-deps installs required system libraries (libnss3, libatk, etc.) via apt-get
  execSync("npx playwright install chromium --with-deps", { stdio: "inherit" })
  console.log("[postinstall] Playwright Chromium installed successfully.")
} catch (e) {
  // Non-fatal: app works fine without the scraper
  console.error("[postinstall] Playwright install failed (non-fatal):", e.message)
}
