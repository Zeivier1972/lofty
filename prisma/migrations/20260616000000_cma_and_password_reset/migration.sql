-- CMA Report and Password Reset Token tables

CREATE TABLE IF NOT EXISTS "CMAReport" (
  "id"             TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "address"        TEXT NOT NULL,
  "bedrooms"       INTEGER,
  "bathrooms"      DOUBLE PRECISION,
  "sqft"           INTEGER,
  "yearBuilt"      INTEGER,
  "condition"      TEXT NOT NULL DEFAULT 'GOOD',
  "notes"          TEXT,
  "comps"          TEXT NOT NULL DEFAULT '[]',
  "estimatedMin"   DOUBLE PRECISION,
  "estimatedMax"   DOUBLE PRECISION,
  "estimatedValue" DOUBLE PRECISION,
  "shareToken"     TEXT NOT NULL,
  "contactId"      TEXT,
  "agentId"        TEXT,
  "isPublic"       BOOLEAN NOT NULL DEFAULT true,
  "sentAt"         TIMESTAMP(3),
  "viewedAt"       TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CMAReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CMAReport_shareToken_key" ON "CMAReport"("shareToken");

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id"        TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
