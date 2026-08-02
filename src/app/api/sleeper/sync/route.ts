import { NextResponse } from "next/server";
import { syncLeague } from "@/lib/sleeperSync";

export async function POST() {
  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!leagueId) {
    return NextResponse.json(
      { error: "SLEEPER_LEAGUE_ID not set" },
      { status: 500 },
    );
  }

  try {
    const result = await syncLeague(leagueId);
    return NextResponse.json({ ok: true, weeksSynced: result.weeksSynced });
  } catch (err) {
    console.error("Sleeper sync failed", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
