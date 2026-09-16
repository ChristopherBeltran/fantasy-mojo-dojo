-- CreateTable
CREATE TABLE "LastManStandingElimination" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LastManStandingElimination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LastManStandingElimination_leagueId_season_idx" ON "LastManStandingElimination"("leagueId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "LastManStandingElimination_leagueId_season_week_managerId_key" ON "LastManStandingElimination"("leagueId", "season", "week", "managerId");

-- AddForeignKey
ALTER TABLE "LastManStandingElimination" ADD CONSTRAINT "LastManStandingElimination_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LastManStandingElimination" ADD CONSTRAINT "LastManStandingElimination_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
