-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_types" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scorecard_id" TEXT,
    "primary_actions" TEXT[],
    "secondary_actions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecards" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pass_threshold" INTEGER,
    "fail_threshold" INTEGER,
    "groups" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_client_id_key" ON "clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_token_key" ON "access_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "report_types_client_id_name_key" ON "report_types"("client_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "scorecards_client_id_name_key" ON "scorecards"("client_id", "name");

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_types" ADD CONSTRAINT "report_types_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_types" ADD CONSTRAINT "report_types_scorecard_id_fkey" FOREIGN KEY ("scorecard_id") REFERENCES "scorecards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecards" ADD CONSTRAINT "scorecards_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
