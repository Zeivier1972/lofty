-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "buyerBathroomsMin" DOUBLE PRECISION,
ADD COLUMN "buyerMustHaves" TEXT,
ADD COLUMN "buyerTimelineMonths" INTEGER,
ADD COLUMN "buyerPurpose" TEXT,
ADD COLUMN "matchPrefsCompletedAt" TIMESTAMP(3);
