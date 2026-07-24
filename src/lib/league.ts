import { prisma } from "@/lib/prisma";

/**
 * This app is single-league for now (see League model comment in schema.prisma).
 * Prefer the league matching SLEEPER_LEAGUE_ID; fall back to the first synced
 * league so pages still work if the env var changes after the initial sync.
 */
export async function getCurrentLeague() {
  const sleeperLeagueId = process.env.SLEEPER_LEAGUE_ID;
  if (sleeperLeagueId) {
    const league = await prisma.league.findUnique({ where: { sleeperLeagueId } });
    if (league) return league;
  }

  const fallback = await prisma.league.findFirst({ orderBy: { createdAt: "asc" } });
  if (!fallback) {
    throw new Error("No league found — run a Sleeper sync first.");
  }
  return fallback;
}
