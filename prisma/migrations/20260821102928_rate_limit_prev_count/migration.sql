-- AlterTable
ALTER TABLE "rate_limit_counters" ADD COLUMN     "prev_count" INTEGER NOT NULL DEFAULT 0;
