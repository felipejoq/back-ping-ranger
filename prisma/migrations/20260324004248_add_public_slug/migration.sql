/*
  Warnings:

  - A unique constraint covering the columns `[publicSlug]` on the table `Monitor` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Monitor" ADD COLUMN     "publicSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Monitor_publicSlug_key" ON "Monitor"("publicSlug");
