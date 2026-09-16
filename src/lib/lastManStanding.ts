import { prisma } from "@/lib/prisma";
import { getCurrentWeek } from "@/lib/currentWeek";

export const LMS_START_WEEK = 3;
export const LMS_END_WEEK = 14;

/**
 * Catches up every unprocessed week (not just the latest) so a missed cron
 * run doesn't leave a permanent gap — safe and idempotent to call repeatedly,
 * same shape as computeAndSaveBonusResult / generateWeeklyPosters. A week is
 * "processed" once it has at least one LastManStandingElimination row; once
 * only one manager remains alive, later weeks are skipped entirely (the
 * competition has a winner).
 */
export async function computeLastManStanding(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const currentWeek = await getCurrentWeek(leagueId);
  if (currentWeek == null) {
    return { processedWeeks: [], reason: "No synced matchup data yet" };
  }

  const allManagers = await prisma.manager.findMany({ where: { leagueId } });
  const processedWeeks: { week: number; eliminatedManagerIds: string[] }[] = [];

  const lastWeekToProcess = Math.min(currentWeek, LMS_END_WEEK);
  for (let week = LMS_START_WEEK; week <= lastWeekToProcess; week++) {
    const existing = await prisma.lastManStandingElimination.findFirst({
      where: { leagueId, season: league.season, week },
    });
    if (existing) continue;

    const eliminatedSoFar = await prisma.lastManStandingElimination.findMany({
      where: { leagueId, season: league.season, week: { lt: week } },
      select: { managerId: true },
    });
    const eliminatedIds = new Set(eliminatedSoFar.map((e) => e.managerId));
    const survivors = allManagers.filter((m) => !eliminatedIds.has(m.id));

    if (survivors.length <= 1) {
      // Winner already decided — nothing left to eliminate.
      continue;
    }

    // Cumulative regular-season points through this week, for tiebreaking.
    const cumulative = await prisma.matchup.groupBy({
      by: ["managerId"],
      where: {
        leagueId,
        isPlayoff: false,
        week: { lte: week },
        managerId: { in: survivors.map((s) => s.id) },
      },
      _sum: { points: true },
    });
    const cumulativeByManager = new Map(cumulative.map((c) => [c.managerId, c._sum.points ?? 0]));

    const thisWeekScores = await prisma.matchup.findMany({
      where: { leagueId, week, managerId: { in: survivors.map((s) => s.id) } },
      select: { managerId: true, points: true },
    });
    if (thisWeekScores.length === 0) {
      // This week hasn't synced for these managers yet — stop here rather
      // than skipping ahead, so we don't accidentally process week N+1
      // before week N.
      break;
    }

    const lowestScore = Math.min(...thisWeekScores.map((s) => s.points));
    const tiedForLowest = thisWeekScores.filter((s) => s.points === lowestScore);

    let eliminatedManagerId: string;
    if (tiedForLowest.length === 1) {
      eliminatedManagerId = tiedForLowest[0].managerId;
    } else {
      eliminatedManagerId = tiedForLowest.reduce((lowest, candidate) => {
        const lowestTotal = cumulativeByManager.get(lowest.managerId) ?? 0;
        const candidateTotal = cumulativeByManager.get(candidate.managerId) ?? 0;
        return candidateTotal < lowestTotal ? candidate : lowest;
      }).managerId;
    }

    await prisma.lastManStandingElimination.create({
      data: { leagueId, season: league.season, week, managerId: eliminatedManagerId },
    });
    processedWeeks.push({ week, eliminatedManagerIds: [eliminatedManagerId] });
  }

  return { processedWeeks };
}
