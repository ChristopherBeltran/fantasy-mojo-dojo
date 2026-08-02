-- AlterTable
ALTER TABLE "Manager" ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "MatchupPoster" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "managerAId" TEXT NOT NULL,
    "managerBId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchupPoster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchupPoster_leagueId_week_idx" ON "MatchupPoster"("leagueId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "MatchupPoster_leagueId_week_managerAId_managerBId_key" ON "MatchupPoster"("leagueId", "week", "managerAId", "managerBId");

-- AddForeignKey
ALTER TABLE "MatchupPoster" ADD CONSTRAINT "MatchupPoster_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupPoster" ADD CONSTRAINT "MatchupPoster_managerAId_fkey" FOREIGN KEY ("managerAId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupPoster" ADD CONSTRAINT "MatchupPoster_managerBId_fkey" FOREIGN KEY ("managerBId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
