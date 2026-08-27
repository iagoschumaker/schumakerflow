-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "driveAccessToken" TEXT,
ADD COLUMN     "driveEmail" TEXT,
ADD COLUMN     "driveRefreshToken" TEXT,
ADD COLUMN     "driveTokenExpiry" TIMESTAMP(3);
