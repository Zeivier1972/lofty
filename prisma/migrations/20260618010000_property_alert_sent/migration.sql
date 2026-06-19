-- CreateTable
CREATE TABLE "PropertyAlertSent" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyAlertSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAlertSent_contactId_propertyId_key" ON "PropertyAlertSent"("contactId", "propertyId");
