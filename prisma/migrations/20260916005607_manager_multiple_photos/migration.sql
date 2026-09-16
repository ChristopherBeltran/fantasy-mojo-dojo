-- CreateTable
CREATE TABLE "ManagerPhoto" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerPhoto_managerId_idx" ON "ManagerPhoto"("managerId");

-- AddForeignKey
ALTER TABLE "ManagerPhoto" ADD CONSTRAINT "ManagerPhoto_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing single photoUrl values into ManagerPhoto rows before
-- dropping the column, so nobody loses their already-uploaded reference photo.
INSERT INTO "ManagerPhoto" ("id", "managerId", "url", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), "id", "photoUrl", CURRENT_TIMESTAMP
FROM "Manager"
WHERE "photoUrl" IS NOT NULL;

-- AlterTable
ALTER TABLE "Manager" DROP COLUMN "photoUrl";
