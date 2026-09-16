import { NextResponse } from "next/server";
import { getCurrentLeague } from "@/lib/league";
import { regeneratePoster } from "@/lib/posterGen";

export async function POST(
  _req: Request,
  { params }: { params: { managerAId: string; managerBId: string } },
) {
  try {
    const league = await getCurrentLeague();
    const poster = await regeneratePoster(
      league.id,
      params.managerAId,
      params.managerBId,
    );
    return NextResponse.json({ poster });
  } catch (err) {
    console.error(
      `Failed to regenerate poster for ${params.managerAId} vs ${params.managerBId}`,
      err,
    );
    return NextResponse.json({ error: "Regeneration failed" }, { status: 500 });
  }
}
