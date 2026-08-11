-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "username" TEXT,
    "gender" TEXT,
    "telephone" TEXT,
    "extension" TEXT,
    "mobile" TEXT,
    "webdev_email" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_options" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "bank_account_validation" BOOLEAN NOT NULL DEFAULT true,
    "driving_licence_validation" BOOLEAN NOT NULL DEFAULT true,
    "ni_number_validation" BOOLEAN NOT NULL DEFAULT true,
    "passport_validation" BOOLEAN NOT NULL DEFAULT true,
    "address_insights" BOOLEAN NOT NULL DEFAULT true,
    "address_lookup" BOOLEAN NOT NULL DEFAULT true,
    "remote_check" BOOLEAN NOT NULL DEFAULT true,
    "property_register_search" BOOLEAN NOT NULL DEFAULT true,
    "nfi_address" BOOLEAN NOT NULL DEFAULT true,
    "nfi_amberhill" BOOLEAN NOT NULL DEFAULT true,
    "email_risk" BOOLEAN NOT NULL DEFAULT true,
    "otp_email" BOOLEAN NOT NULL DEFAULT true,
    "otp_sms" BOOLEAN NOT NULL DEFAULT true,
    "phone_match" BOOLEAN NOT NULL DEFAULT true,
    "phone_number_validation" BOOLEAN NOT NULL DEFAULT true,
    "bankaccount" BOOLEAN NOT NULL DEFAULT true,
    "credit_activity" BOOLEAN NOT NULL DEFAULT true,
    "config_full_er" BOOLEAN NOT NULL DEFAULT false,
    "config_age_min" INTEGER,
    "config_age_max" INTEGER,
    "config_nfi_address" BOOLEAN NOT NULL DEFAULT false,
    "bridger_client_id" TEXT,
    "bridger_client_secret" TEXT,
    "bridger_predefined_search" TEXT,
    "bridger_user_id" TEXT,
    "bridger_customer_toggle" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "path_identifier" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ip" TEXT,
    "status" INTEGER NOT NULL,
    "application" TEXT,
    "level" TEXT,
    "channel" TEXT,
    "server_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_client_id_key" ON "user_profiles"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_username_key" ON "user_profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "companies_client_id_key" ON "companies"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_options_client_id_key" ON "user_options"("client_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_options" ADD CONSTRAINT "user_options_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
