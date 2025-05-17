/*
  Warnings:

  - You are about to drop the column `adminId` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Conversation` table. All the data in the column will be lost.
  - Added the required column `participant1Id` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participant2Id` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_adminId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_userId_fkey";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "adminId",
DROP COLUMN "userId",
ADD COLUMN     "participant1Id" INTEGER NOT NULL,
ADD COLUMN     "participant2Id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participant1Id_fkey" FOREIGN KEY ("participant1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participant2Id_fkey" FOREIGN KEY ("participant2Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
