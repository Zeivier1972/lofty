export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { execSync } from "child_process"

// Admin-only diagnostic: tells us what chromium binaries exist on the server
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const run = (cmd: string): string => {
    try {
      return execSync(cmd, { encoding: "utf8", timeout: 10000 }).trim()
    } catch (e: any) {
      return `(error: ${e?.message?.split("\n")[0]})`
    }
  }

  return NextResponse.json({
    env: {
      PATH: process.env.PATH,
      SHOWINGNEW_CHROMIUM_PATH: process.env.SHOWINGNEW_CHROMIUM_PATH || "(not set)",
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "(not set)",
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD || "(not set)",
      HOME: process.env.HOME,
    },
    which: {
      chromium: run("which chromium 2>/dev/null || echo 'not found'"),
      "chromium-browser": run("which chromium-browser 2>/dev/null || echo 'not found'"),
      "google-chrome": run("which google-chrome 2>/dev/null || echo 'not found'"),
    },
    find: {
      "/usr": run("find /usr -name 'chromium*' -type f 2>/dev/null | head -10 || echo 'none'"),
      "/nix": run("find /nix -name 'chromium*' -type f 2>/dev/null | head -10 || echo 'none'"),
      "/opt": run("find /opt -name 'chromium*' -type f 2>/dev/null | head -10 || echo 'none'"),
      "/root": run("find /root -name 'chromium*' 2>/dev/null | head -10 || echo 'none'"),
      "ms-playwright": run("find / -path '*ms-playwright/chromium*' -name 'chrome' -type f 2>/dev/null | head -5 || echo 'none'"),
    },
    nixProfileBins: run("ls /root/.nix-profile/bin/ 2>/dev/null | grep -i chrom || echo 'none'"),
    nixSystemBins: run("ls /nix/var/nix/profiles/system/sw/bin/ 2>/dev/null | grep -i chrom || echo 'none'"),
    playwrightCacheDir: run("ls ~/.cache/ms-playwright/ 2>/dev/null || echo 'empty or missing'"),
  })
}
