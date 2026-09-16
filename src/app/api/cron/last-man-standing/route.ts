import { NextResponse } from "next/server";
import { syncLeague } from "@/lib/sleeperSync";
import { computeLastManStanding } from "@/lib/lastManStanding";

/**
 * Weekly job (see vercel.json for schedule — Tuesday morning, same slot as
 * the daily-sync cron's MNF-correction run). Syncs latest scores itself
 * rather than assuming the other Tuesday cron already ran, since Vercel
 * doesn't guarantee ordering between separate cron entries at the same time.
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
  const result = await computeLastManStanding(league.id);

  return NextResponse.json({ synced: true, ...result });
}
