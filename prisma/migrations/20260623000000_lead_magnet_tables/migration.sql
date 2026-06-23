-- CreateTable
CREATE TABLE IF NOT EXISTS "LeadMagnet" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scriptSource" TEXT,
    "pdfUrl" TEXT,
    "guideUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadMagnet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeadMagnetDelivery" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT,

    CONSTRAINT "LeadMagnetDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeadMagnet_keyword_key" ON "LeadMagnet"("keyword");

-- AddForeignKey
ALTER TABLE "LeadMagnetDelivery" ADD CONSTRAINT "LeadMagnetDelivery_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMagnetDelivery" ADD CONSTRAINT "LeadMagnetDelivery_keyword_fkey"
    FOREIGN KEY ("keyword") REFERENCES "LeadMagnet"("keyword") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add instagramIgsid to Contact if not exists
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "instagramIgsid" TEXT;
