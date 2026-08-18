-- AlterTable
ALTER TABLE "texts" ADD COLUMN     "language" VARCHAR(5) NOT NULL DEFAULT 'de';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "review_settings" TEXT;
