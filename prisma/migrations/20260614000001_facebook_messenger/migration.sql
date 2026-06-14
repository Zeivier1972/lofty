-- Facebook Messenger integration: add PSID to contacts + message table

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "facebookPsid" TEXT;

CREATE TABLE IF NOT EXISTS "FacebookMessage" (
  "id"          TEXT NOT NULL,
  "psid"        TEXT NOT NULL,
  "pageId"      TEXT NOT NULL DEFAULT '',
  "body"        TEXT NOT NULL,
  "direction"   TEXT NOT NULL DEFAULT 'INBOUND',
  "status"      TEXT NOT NULL DEFAULT 'SENT',
  "messageId"   TEXT,
  "attachments" TEXT,
  "contactId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacebookMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FacebookMessage_contactId_fkey'
  ) THEN
    ALTER TABLE "FacebookMessage"
      ADD CONSTRAINT "FacebookMessage_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
