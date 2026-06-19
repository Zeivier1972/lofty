export async function register() {
  // Only run in Node.js runtime (not Edge), and only in production/server
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { schedule } = await import("node-cron")

  const secret = process.env.CRON_SECRET || ""
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://lofty-production.up.railway.app"
  const headers: Record<string, string> = secret ? { Authorization: `Bearer ${secret}` } : {}

  // 9am ET = 13:00 UTC (EDT) — morning post
  schedule("0 13 * * *", () => {
    console.log("[cron] social autopilot — morning")
    fetch(`${base}/api/cron/social-autopilot?slot=morning`, { headers })
      .catch(e => console.error("[cron] morning error:", e))
  })

  // 6pm ET = 22:00 UTC (EDT) — evening post + HeyGen video on Tue/Fri
  schedule("0 22 * * *", () => {
    console.log("[cron] social autopilot — evening")
    fetch(`${base}/api/cron/social-autopilot?slot=evening`, { headers })
      .catch(e => console.error("[cron] evening error:", e))
  })

  // Every 15 min: fire scheduled VAPI calls (Sofia outbound calls to leads)
  schedule("*/15 * * * *", () => {
    fetch(`${base}/api/cron/calls`, { headers }).catch(e => console.error("[cron] calls error:", e))
  })

  // Every hour: fire smart plans, SOI check, score decay, HeyGen video check
  schedule("0 * * * *", () => {
    Promise.allSettled([
      fetch(`${base}/api/cron/smart-plans`, { headers }),
      fetch(`${base}/api/cron/score-decay`, { headers }),
      fetch(`${base}/api/cron/soi-check`, { headers }),
      fetch(`${base}/api/cron/social-autopilot?slot=check`, { headers }),
    ])
  })

  console.log("[cron] scheduled: social autopilot 9am+6pm ET, calls every 15min, smart-plans+heygen hourly")
}
