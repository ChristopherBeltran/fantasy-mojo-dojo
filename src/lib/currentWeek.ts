import { prisma } from "@/lib/prisma";

/** Latest week with any synced matchup data for a league, or null if none yet. */
export async function getCurrentWeek(leagueId: string): Promise<number | null> {
  const latest = await prisma.matchup.aggregate({
    where: { leagueId },
    _max: { week: true },
  });
  return latest._max.week;
}

/**
 * Head-to-head pairs for a given week, deduped from the double-direction
 * Matchup rows (see sleeper/sync/route.ts) into one row per pairing. Bye
 * weeks (no opponent) are excluded. The surviving row's managerId/opponentId
 * are whichever direction was seen first — callers that need a stable order
 * (e.g. poster generation) should sort the pair themselves.
 */
export async function getWeekPairs(leagueId: string, week: number) {
  const rows = await prisma.matchup.findMany({
    where: { leagueId, week },
    include: { manager: true, opponent: true },
  });

  const seen = new Set<string>();
  return rows.filter((m) => {
    if (!m.opponentId || !m.opponent) return false; // bye week
    const key = [m.managerId, m.opponentId].sort().join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
