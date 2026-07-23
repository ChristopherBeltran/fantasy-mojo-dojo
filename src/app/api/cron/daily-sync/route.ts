import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLeague } from "@/app/api/sleeper/sync/route";
import { computeAndSaveBonusResult } from "@/app/api/bonuses/[id]/compute/route";

/**
 * Daily job (see vercel.json for schedule):
 *   1. Pull latest data from Sleeper
 *   2. Recompute every active bonus's leaderboard from that data
 *
 * No AI calls happen here — bonuses only call Claude once, at creation time.
 * This route is intentionally cheap and safe to re-run if it fails partway.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!leagueId) {
    return NextResponse.json({ error: "SLEEPER_LEAGUE_ID not set" }, { status: 500 });
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

  return NextResponse.json({ synced: true, bonusesComputed: results });
}
