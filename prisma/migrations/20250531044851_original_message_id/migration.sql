-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "originalMessageId" INTEGER;

-- CreateIndex
CREATE INDEX "Conversation_participant1Id_participant2Id_idx" ON "Conversation"("participant1Id", "participant2Id");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "OTP_userId_idx" ON "OTP"("userId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
