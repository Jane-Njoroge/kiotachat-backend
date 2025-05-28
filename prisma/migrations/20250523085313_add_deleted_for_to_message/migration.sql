-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedFor" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
