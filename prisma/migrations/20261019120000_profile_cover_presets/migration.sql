BEGIN;

-- CreateEnum
CREATE TYPE "ProfileCoverPreset" AS ENUM ('ATLAS', 'CONTOUR', 'SIGNAL', 'GRID');

-- AlterTable
ALTER TABLE "InnovationProfile" ADD COLUMN "coverPreset" "ProfileCoverPreset" NOT NULL DEFAULT 'ATLAS';

COMMIT;
