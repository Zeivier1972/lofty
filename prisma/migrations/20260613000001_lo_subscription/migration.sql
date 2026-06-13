-- Add monthly subscription fields to LoanOfficer
ALTER TABLE "LoanOfficer" ADD COLUMN IF NOT EXISTS "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 99;
ALTER TABLE "LoanOfficer" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "LoanOfficer" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "LoanOfficer" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'inactive';
ALTER TABLE "LoanOfficer" ADD COLUMN IF NOT EXISTS "subscriptionEndDate" TIMESTAMP(3);
