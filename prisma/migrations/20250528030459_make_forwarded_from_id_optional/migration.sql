-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_forwardedFromId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "unread" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "forwardedFromId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_forwardedFromId_fkey" FOREIGN KEY ("forwardedFromId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
