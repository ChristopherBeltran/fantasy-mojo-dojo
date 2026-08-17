import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLeague } from "@/lib/sleeperSync";
import { computeAndSaveBonusResult } from "@/lib/bonusCompute";
import { generateWeeklyPosters } from "@/lib/posterGen";

/**
 * Daily job (see vercel.json for schedule):
 *   1. Pull latest data from Sleeper
 *   2. Recompute every active bonus's leaderboard from that data
 *   3. Generate any matchup posters missing for the current week (Gemini
 *      call — idempotent, so this is a no-op once a week's posters exist)
 *
 * Bonuses only ever call Claude once, at creation time — the one AI call
 * that *does* happen here is poster generation, and only for pairs that
 * don't already have one. This route is intentionally cheap to re-run and
 * safe if it fails partway.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!leagueId) {
    return NextResponse.json(
      { error: "SLEEPER_LEAGUE_ID not set" },
      { status: 500 },
    );
  }

  const { league } = await syncLeague(leagueId);

  const bonuses = await prisma.bonus.findMany({
    where: { leagueId: league.id, active: true },
  });

  const results = [];
  for (const bonus of bonuses) {
    try {
      await computeAndSaveBonusResult(bonus.id);
      results.push({ bonusId: bonus.id, ok: true });
    } catch (err) {
      console.error(`Bonus ${bonus.id} failed to compute`, err);
      results.push({ bonusId: bonus.id, ok: false });
    }
  }

  let posterResult;
  try {
    posterResult = await generateWeeklyPosters(league.id);
  } catch (err) {
    console.error("Poster generation failed", err);
    posterResult = { error: "Poster generation failed" };
  }

  return NextResponse.json({
    synced: true,
    bonusesComputed: results,
    posters: posterResult,
  });
}
