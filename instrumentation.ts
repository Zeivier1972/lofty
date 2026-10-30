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

  // Every 20 min: integration health check — alerts (SMS + email) only when a
  // service breaks or recovers (no report spam). Catches outages fast.
  schedule("*/20 * * * *", () => {
    fetch(`${base}/api/cron/system-check?report=0`, { headers })
      .catch(e => console.error("[cron] health-check error:", e))
  })

  // Daily 8am ET (12:00 UTC): full system status report email.
  schedule("0 12 * * *", () => {
    fetch(`${base}/api/cron/system-check?report=1`, { headers })
      .catch(e => console.error("[cron] daily report error:", e))
  })

  // Daily 9am Colombia (14:00 UTC): date-anchored event countdown reminders
  // (7 / 3 / 1 / 0 days before each event).
  schedule("0 14 * * *", () => {
    fetch(`${base}/api/cron/event-reminders`, { headers })
      .catch(e => console.error("[cron] event-reminders error:", e))
  })

  // Webinar sequence every 15 min: creates the Zoom meeting 3 days out, sends
  // the 1-day / 1-hour / live reminders and the post-session follow-up.
  // Listed in railway.toml too, but those [[crons]] entries never run — this
  // job had zero calls in production before it was added here.
  schedule("2,17,32,47 * * * *", () => {
    fetch(`${base}/api/cron/webinar-reminders`, { headers })
      .catch(e => console.error("[cron] webinar-reminders error:", e))
  })

  // Sofía's lead-attention jobs. Both were only listed in railway.toml, whose
  // [[crons]] entries never run — neither had a single request in production.
  //
  // 14:00 UTC (~9-10 AM ET): Warm → Hot pacing. Expires stale call tasks,
  // releases the next batch of queued Warm enrollments only while Catherine's
  // open call queue is under the cap, and builds her daily call-list task.
  schedule("0 14 * * *", () => {
    fetch(`${base}/api/cron/warm-plan-release`, { headers })
      .catch(e => console.error("[cron] warm-plan-release error:", e))
  })

  // 11:37 UTC (~7:30am ET): Sofía's morning briefing email for Catherine —
  // today's appointments, buy-now leads to call, replies, new leads.
  schedule("37 11 * * *", () => {
    fetch(`${base}/api/cron/sofia-briefing`, { headers })
      .catch(e => console.error("[cron] sofia-briefing error:", e))
  })

  // Every 15 min: appointment reminders (24 h and 1 h before).
  schedule("4,19,34,49 * * * *", () => {
    fetch(`${base}/api/cron/appointment-reminders`, { headers })
      .catch(e => console.error("[cron] appointment-reminders error:", e))
  })

  // 16:00 UTC (~noon ET): the buy-now playbook — buy-now leads (lib/buyer-intent)
  // get a call task for Catherine, a call invite from Sofía and the Hot stage.
  schedule("0 16 * * *", () => {
    fetch(`${base}/api/cron/hot-buyer-followup`, { headers })
      .catch(e => console.error("[cron] hot-buyer-followup error:", e))
  })

  // Property-alert emails, also railway.toml-only until now.
  // Hourly (:05): Sofía emails buyers new MLS matches for their search —
  // bounded by EMAIL_DAILY_LIMIT, with a 60-day per-listing dedup.
  schedule("5 * * * *", () => {
    fetch(`${base}/api/cron/match-alerts`, { headers })
      .catch(e => console.error("[cron] match-alerts error:", e))
  })

  // Daily 12:47 UTC (~8:47 AM ET): one email per active saved search with
  // new listings that match it.
  schedule("47 12 * * *", () => {
    fetch(`${base}/api/cron/saved-search-alerts`, { headers })
      .catch(e => console.error("[cron] saved-search-alerts error:", e))
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

  // Daily MLS/IDX sync at 3 AM ET (07:00 UTC) — only activates when Bridge API token is configured
  if (process.env.BRIDGE_SERVER_TOKEN) {
    const mlsSecret = process.env.MLS_SYNC_SECRET || ""
    schedule("0 7 * * *", () => {
      console.log("[cron] MLS sync — daily listings update")
      fetch(`${base}/api/mls/sync`, {
        method: "POST",
        headers: mlsSecret ? { "x-sync-secret": mlsSecret } : {},
      }).then(r => r.json()).then(d => {
        console.log(`[cron] MLS sync done — ${d.created ?? 0} new, ${d.updated ?? 0} updated, ${d.errors ?? 0} errors`)
      }).catch(e => console.error("[cron] MLS sync error:", e))
    })
    console.log("[cron] MLS daily sync scheduled for 3am ET (BRIDGE_SERVER_TOKEN is set)")
  }

  console.log("[cron] scheduled: social autopilot 9am+6pm ET, calls every 15min, smart-plans+heygen hourly")
}
