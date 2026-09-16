import { NextResponse } from "next/server";
import { getCurrentLeague } from "@/lib/league";
import { regenerateAllCurrentWeekPosters } from "@/lib/posterGen";

export async function POST() {
  try {
    const league = await getCurrentLeague();
    const result = await regenerateAllCurrentWeekPosters(league.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to regenerate all posters", err);
    return NextResponse.json({ error: "Regeneration failed" }, { status: 500 });
  }
}
