-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('STARTED', 'PENDING', 'COMPLETE');

-- AlterTable
ALTER TABLE "scorecards" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "report_type_id" TEXT,
    "scorecard_id" TEXT,
    "forename" TEXT,
    "middlename" TEXT,
    "surname" TEXT,
    "dob" TIMESTAMP(3),
    "address" JSONB,
    "reference" TEXT,
    "enduser_agreement" BOOLEAN NOT NULL DEFAULT false,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReportStatus" NOT NULL DEFAULT 'STARTED',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_action_results" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "action_name" TEXT NOT NULL,
    "request_payload" JSONB NOT NULL,
    "result_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_action_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_audit_logs" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_action_results_report_id_action_name_key" ON "report_action_results"("report_id", "action_name");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_report_type_id_fkey" FOREIGN KEY ("report_type_id") REFERENCES "report_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_scorecard_id_fkey" FOREIGN KEY ("scorecard_id") REFERENCES "scorecards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_action_results" ADD CONSTRAINT "report_action_results_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_audit_logs" ADD CONSTRAINT "report_audit_logs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
