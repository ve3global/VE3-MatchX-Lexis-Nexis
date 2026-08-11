/*
  Warnings:

  - Added the required column `updated_at` to the `report_types` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReportTypeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "report_types" ADD COLUMN     "age_max" INTEGER,
ADD COLUMN     "age_min" INTEGER,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reference_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "ReportTypeStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
