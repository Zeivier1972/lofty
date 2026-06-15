// Runs idempotent ALTER TABLE statements using the Prisma client (not CLI).
// Avoids the wasm engine issue where prisma db push can't resolve DATABASE_URL.
const { PrismaClient } = require("@prisma/client")

const STMTS = [
  // configurable bot buttons (PR #64)
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "greetingButtons" TEXT NOT NULL DEFAULT 'Sí, me interesa,Quiero más info'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonA" TEXT NOT NULL DEFAULT 'Comprar para vivir'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonB" TEXT NOT NULL DEFAULT 'Invertir / Airbnb'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonC" TEXT NOT NULL DEFAULT 'Solo explorando'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "greetingButtons" TEXT NOT NULL DEFAULT 'Sí, me interesa,Quiero más info'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonA" TEXT NOT NULL DEFAULT 'Comprar para vivir'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonB" TEXT NOT NULL DEFAULT 'Invertir / Airbnb'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonC" TEXT NOT NULL DEFAULT 'Solo explorando'`,
]

async function main() {
  const db = new PrismaClient()
  for (const sql of STMTS) {
    await db.$executeRawUnsafe(sql).catch(e => console.warn("[db-migrate] skip:", e.message))
  }
  await db.$disconnect()
  console.log("[db-migrate] done")
}

main().catch(e => { console.error("[db-migrate] fatal:", e); process.exit(1) })
