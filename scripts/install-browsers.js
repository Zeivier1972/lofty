#!/usr/bin/env node
/**
 * Downloads Playwright's Chromium browser.
 * When using Docker (Dockerfile), this is handled at build time — skip here.
 * When running locally with INSTALL_PLAYWRIGHT_BROWSERS=1, downloads the browser.
 */

if (!process.env.INSTALL_PLAYWRIGHT_BROWSERS) {
  // Docker builds handle this; local devs don't need it
  process.exit(0)
}

const { execSync } = require("child_process")
console.log("[postinstall] Installing Playwright Chromium...")
try {
  execSync("npx playwright install chromium --with-deps", { stdio: "inherit" })
  console.log("[postinstall] Done.")
} catch (e) {
  console.error("[postinstall] Failed (non-fatal):", e.message)
}
