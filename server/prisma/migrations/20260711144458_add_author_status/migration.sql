-- AlterTable
ALTER TABLE "texts" ADD COLUMN     "author" TEXT,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'new';
