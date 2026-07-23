import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BonusSpecSchema } from "@/lib/bonusSchema";
import { runBonusSpec, type MatchupRow } from "@/lib/bonusInterpreter";

/**
 * Runs a bonus's stored DSL spec against current matchup data and saves a
 * new BonusResult. This is pure computation over data already in Postgres —
 * NO calls to Sleeper or Claude happen here. This is what the daily cron
 * calls for every active bonus, and it's cheap enough to also run on demand.
 */
export async function computeAndSaveBonusResult(bonusId: string) {
  const bonus = await prisma.bonus.findUniqueOrThrow({ where: { id: bonusId } });
  const spec = BonusSpecSchema.parse(bonus.dslJson);

  const matchups = await prisma.matchup.findMany({
    where: { leagueId: bonus.leagueId },
    include: { manager: true },
  });

  const rows: MatchupRow[] = matchups.map((m) => ({
    managerId: m.managerId,
    displayName: m.manager.teamName ?? m.manager.displayName,
    week: m.week,
    isPlayoff: m.isPlayoff,
    points: m.points,
    opponentPoints: m.opponentPoints,
  }));

  const leaderboard = runBonusSpec(spec, rows);

  return prisma.bonusResult.create({
    data: { bonusId, leaderboard },
  });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await computeAndSaveBonusResult(params.id);
    return NextResponse.json({ result });
  } catch (err) {
    console.error(`Failed to compute bonus ${params.id}`, err);
    return NextResponse.json({ error: "Computation failed" }, { status: 500 });
  }
}
