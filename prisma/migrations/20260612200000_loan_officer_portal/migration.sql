-- Loan Officer / Partner Portal

CREATE TABLE IF NOT EXISTS "LoanOfficer" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "email"        TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "company"      TEXT,
  "phone"        TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "pricePerLead" DOUBLE PRECISION NOT NULL DEFAULT 25,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LeadShare" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "contactId"       TEXT NOT NULL,
  "loanOfficerId"   TEXT NOT NULL,
  "price"           DOUBLE PRECISION NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "paidAt"          TIMESTAMP(3),
  "stripeSessionId" TEXT,
  "loStatus"        TEXT NOT NULL DEFAULT 'NEW',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadShare_contactId_loanOfficerId_key" UNIQUE ("contactId", "loanOfficerId"),
  CONSTRAINT "LeadShare_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE,
  CONSTRAINT "LeadShare_loanOfficerId_fkey" FOREIGN KEY ("loanOfficerId") REFERENCES "LoanOfficer"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "LeadShareNote" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "leadShareId" TEXT NOT NULL,
  "author"      TEXT NOT NULL DEFAULT 'LO',
  "content"     TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadShareNote_leadShareId_fkey" FOREIGN KEY ("leadShareId") REFERENCES "LeadShare"("id") ON DELETE CASCADE
);
