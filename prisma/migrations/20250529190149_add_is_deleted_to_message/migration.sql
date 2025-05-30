/*
  Warnings:

  - You are about to drop the column `deletedFor` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `forwardedFromId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `otpsExpires` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_forwardedFromId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "unread" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "deletedFor",
DROP COLUMN "forwardedFromId",
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "otpsExpires";
