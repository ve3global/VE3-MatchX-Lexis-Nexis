-- CreateEnum
CREATE TYPE "RemoteCheckStatus" AS ENUM ('IN_PROGRESS', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "remote_check_transactions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "status" "RemoteCheckStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remote_check_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "remote_check_transactions_report_id_key" ON "remote_check_transactions"("report_id");

-- AddForeignKey
ALTER TABLE "remote_check_transactions" ADD CONSTRAINT "remote_check_transactions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
