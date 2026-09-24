-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "distribution" JSONB NOT NULL,
    "expected_requests" INTEGER,
    "status" "RunStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_tallies" (
    "run_id" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "run_tallies_pkey" PRIMARY KEY ("run_id","status")
);

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_tallies" ADD CONSTRAINT "run_tallies_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
