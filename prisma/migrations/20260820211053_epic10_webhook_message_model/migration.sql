-- DropForeignKey
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_webhook_id_fkey";

-- DropForeignKey
ALTER TABLE "webhooks" DROP CONSTRAINT "webhooks_client_id_fkey";

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "notification_webhook_secret" TEXT,
ADD COLUMN     "notification_webhook_url" TEXT;

-- DropTable
DROP TABLE "webhook_deliveries";

-- DropTable
DROP TABLE "webhooks";

-- CreateTable
CREATE TABLE "webhook_messages" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_attempts" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "signature" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_attempts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "webhook_messages" ADD CONSTRAINT "webhook_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_attempts" ADD CONSTRAINT "webhook_attempts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "webhook_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

