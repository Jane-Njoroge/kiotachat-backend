/*
  Warnings:

  - You are about to drop the column `originalMessageId` on the `Message` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Conversation_participant1Id_participant2Id_idx";

-- DropIndex
DROP INDEX "Message_conversationId_createdAt_idx";

-- DropIndex
DROP INDEX "OTP_userId_idx";

-- DropIndex
DROP INDEX "User_email_idx";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "originalMessageId",
ADD COLUMN     "isForwarded" BOOLEAN NOT NULL DEFAULT false;
