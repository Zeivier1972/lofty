export async function register() {
  // Only run in Node.js runtime (not Edge), and only in production/server
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { schedule } = await import("node-cron")
  const { runAutopilot, checkHeygenVideos } = await import("./lib/social-autopilot")

  // 9am ET = 13:00 UTC (EDT) — morning post
  schedule("0 13 * * *", async () => {
    console.log("[cron] social autopilot — morning")
    try { await runAutopilot("morning") } catch (e) { console.error("[cron] morning error:", e) }
  })

  // 6pm ET = 22:00 UTC (EDT) — evening post + HeyGen video on Tue/Fri
  schedule("0 22 * * *", async () => {
    console.log("[cron] social autopilot — evening")
    try {
      await checkHeygenVideos()
      await runAutopilot("evening")
    } catch (e) { console.error("[cron] evening error:", e) }
  })

  // Every hour: fire smart plans, SOI check, score decay (existing logic)
  schedule("0 * * * *", async () => {
    const secret = process.env.CRON_SECRET || ""
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const headers: Record<string, string> = secret ? { Authorization: `Bearer ${secret}` } : {}
    await Promise.allSettled([
      fetch(`${base}/api/cron/smart-plans`, { headers }),
      fetch(`${base}/api/cron/score-decay`, { headers }),
      fetch(`${base}/api/cron/soi-check`, { headers }),
    ])
  })

  console.log("[cron] scheduled: social autopilot 9am+6pm ET, smart-plans hourly")
}
