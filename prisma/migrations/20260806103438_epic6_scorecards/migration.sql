/*
  Warnings:

  - Added the required column `updated_at` to the `scorecards` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ScorecardStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- AlterTable
ALTER TABLE "report_types" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "scorecards" ADD COLUMN     "status" "ScorecardStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
