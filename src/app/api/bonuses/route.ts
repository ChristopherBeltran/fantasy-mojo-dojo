import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateBonusSpec, BonusSpecGenerationError } from "@/lib/claude";
import { computeAndSaveBonusResult } from "@/lib/bonusCompute";

/**
 * Creates a new bonus from a natural-language prompt.
 *
 * This is the ONLY place Claude gets called for bonus logic. Once the spec
 * is generated and saved, every future computation reuses the stored DSL —
 * no AI calls happen on page load or in the cron job.
 */
export async function POST(req: Request) {
  const { leagueId, promptText } = await req.json();

  if (!leagueId || !promptText) {
    return NextResponse.json({ error: "leagueId and promptText are required" }, { status: 400 });
  }

  let spec;
  try {
    spec = await generateBonusSpec(promptText);
  } catch (err) {
    if (err instanceof BonusSpecGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  const bonus = await prisma.bonus.create({
    data: {
      leagueId,
      promptText,
      label: spec.label,
      dslJson: spec,
    },
  });

  // Compute an initial leaderboard immediately so the UI isn't empty
  // until the next cron run.
  await computeAndSaveBonusResult(bonus.id);

  // Home is time-based (revalidate = 300) cached; bust it now so the new
  // bonus shows up immediately instead of after the next scheduled refresh.
  revalidatePath("/");

  return NextResponse.json({ bonus }, { status: 201 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId");

  const bonuses = await prisma.bonus.findMany({
    where: leagueId ? { leagueId, active: true } : { active: true },
    include: {
      results: {
        orderBy: { computedAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ bonuses });
}
