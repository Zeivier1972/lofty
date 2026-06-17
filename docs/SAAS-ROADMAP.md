# SaaS Roadmap — Opening CRM to Other Realtors

> **Status:** On hold. Catherine Gomez only for now.
> **Revisit when:** Ready to expand beyond solo use.

---

## Competitive Position

This CRM has no direct competitor at its price point:

| Feature | This CRM | Follow Up Boss | kvCORE | Sierra |
|---|---|---|---|---|
| AI Voice Calls | ✅ Built-in | ❌ | ❌ | ❌ |
| WhatsApp | ✅ | ❌ | ❌ | ❌ |
| Facebook Bot | ✅ | ❌ | ❌ | ❌ |
| SMS Drips | ✅ | ✅ | ✅ | ✅ |
| Email Drips | ✅ | ✅ | ✅ | ✅ |
| AI Blog Writing | ✅ | ❌ | ❌ | ❌ |
| MLS/IDX | 🔄 Pending | ❌ | ✅ | ✅ |
| Price | $99–$149/mo | $69–$499/mo | $500+/mo | $500+/mo |

**Pitch:** *"kvCORE-level automation + AI calling + WhatsApp, for what you're paying Follow Up Boss."*

---

## Suggested Pricing Tiers

| Tier | Price | Includes |
|---|---|---|
| Solo | $99–$129/mo | 1 agent, limited AI calls |
| Pro | $199–$249/mo | 1 agent, full AI + automation |
| Team | $399–$499/mo | Up to 5 agents |
| Brokerage | Custom | 10+ agents |

*Note: Factor in ~$20–$40/mo per active user in API costs (VAPI, OpenAI, Twilio).*

---

## The Core Problem to Solve: Multi-Tenancy

The CRM is currently single-tenant (built for Catherine only). Everything is hardcoded:
- "Catherine Gomez" in AI prompts
- Phone number, email, Calendly link
- One Twilio account, one Facebook page, one database

Every hardcoded value must become a per-realtor setting.

---

## What Each New Realtor Would Connect at Signup

| Integration | What They Provide |
|---|---|
| Twilio | Their own phone number for SMS/WhatsApp |
| VAPI | Their AI calling assistant configuration |
| Facebook Page | Connect their business page for bot campaigns |
| Facebook Pixel | Their pixel ID for their public site |
| Email (Resend) | Their sending domain |
| MLS/IDX | Their Bridge credentials (agent license, MLS ID) |
| Calendly/Booking | Their booking URL |
| Branding | Logo, colors, bio, headshot |

---

## Build Phases

### 🔴 Phase 1 — Foundation (Must have before launch) ~6–8 weeks

1. **Multi-tenant database** — add `tenantId` to every table. Contacts, campaigns, conversations — completely isolated per realtor. Biggest architectural change.
2. **Stripe billing** — subscription management, free trial, cancel/upgrade.
3. **Signup & onboarding flow** — new realtor signs up → enters info → connects integrations → goes live.
4. **Settings panel per tenant** — name, headshot, phone, email, bio, AI persona name, booking link, branding.
5. **De-hardcode everything** — replace all "Catherine", "305-283-0872", hardcoded URLs with dynamic values from tenant settings.

### 🟡 Phase 2 — Core Integrations ~4–6 weeks

6. **Twilio number provisioning** — buy numbers in bulk and assign one per tenant (smoother UX than each realtor bringing their own account).
7. **VAPI assistant per tenant** — each realtor gets their own AI assistant with their name and voice.
8. **Facebook Page OAuth** — each realtor connects their FB page to their bot campaigns.
9. **Webhook routing** — route Twilio, VAPI, and Facebook webhooks to the correct tenant.

### 🟢 Phase 3 — Polish & Scale ~3–4 weeks

10. **Super-admin panel** — manage all tenants: active users, usage, suspend accounts, billing overview.
11. **Custom subdomains** — `marialopez.loftycrm.com` or their own domain.
12. **Usage limits per tier** — cap AI calls, SMS, contacts by plan.
13. **White-label public site** — each realtor gets their own branded public landing page.

---

## Timeline Summary

| Phase | Estimated Time |
|---|---|
| Phase 1 — Foundation | 6–8 weeks |
| Phase 2 — Integrations | 4–6 weeks |
| Phase 3 — Polish | 3–4 weeks |
| **Total** | **~3–4 months** |

---

## First Step When Ready

Start with the **Phase 1 database migration** — adding `tenantId` to all Prisma models. Everything else builds on that foundation.
