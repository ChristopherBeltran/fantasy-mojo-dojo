import { NextResponse } from "next/server";
import { getCurrentLeague } from "@/lib/league";
import { computeLastManStanding } from "@/lib/lastManStanding";

export async function POST() {
  try {
    const league = await getCurrentLeague();
    const result = await computeLastManStanding(league.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to compute Last Man Standing", err);
    return NextResponse.json({ error: "Computation failed" }, { status: 500 });
  }
}
