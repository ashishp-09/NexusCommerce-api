-- AlterTable
ALTER TABLE "products" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'uncategorized',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
