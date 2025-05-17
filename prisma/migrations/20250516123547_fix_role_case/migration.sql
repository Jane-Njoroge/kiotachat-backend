/*
  Warnings:

  - You are about to drop the column `participant1Id` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `participant2Id` on the `Conversation` table. All the data in the column will be lost.
  - Added the required column `adminId` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_participant1Id_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_participant2Id_fkey";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "participant1Id",
DROP COLUMN "participant2Id",
ADD COLUMN     "adminId" INTEGER NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
