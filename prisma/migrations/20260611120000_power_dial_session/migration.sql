-- AlterTable AIConfig
ALTER TABLE "AIConfig" ADD COLUMN IF NOT EXISTS "voicemailMsg" TEXT;

-- CreateTable PowerDialSession
CREATE TABLE "PowerDialSession" (
  "id"            TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "contactQueue"  TEXT NOT NULL,
  "currentIndex"  INTEGER NOT NULL DEFAULT 0,
  "totalCount"    INTEGER NOT NULL DEFAULT 0,
  "currentCallId" TEXT,
  "voicemailMsg"  TEXT,
  "callLog"       TEXT NOT NULL DEFAULT '[]',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PowerDialSession_pkey" PRIMARY KEY ("id")
);
