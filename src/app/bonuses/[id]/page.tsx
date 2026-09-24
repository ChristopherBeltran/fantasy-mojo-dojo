import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BonusCard } from "@/components/BonusCard";
import { PageShell } from "@/components/PageShell";
import { getCurrentLeague } from "@/lib/league";

export const revalidate = 300;

export default async function BonusDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const league = await getCurrentLeague();

  const [bonus, managers] = await Promise.all([
    prisma.bonus.findUnique({
      where: { id: params.id },
      include: { results: { orderBy: { computedAt: "desc" }, take: 1 } },
    }),
    prisma.manager.findMany({
      where: { leagueId: league.id },
      select: { id: true, avatarUrl: true },
    }),
  ]);

  if (!bonus || bonus.leagueId !== league.id) notFound();

  const latest = bonus.results[0];
  const avatarsByManagerId = Object.fromEntries(
    managers.map((m) => [m.id, m.avatarUrl]),
  );

  return (
    // No dedicated "Bonuses" nav entry — bonuses live on Home.
    <PageShell activeTab="home" leagueName={league.name}>
      <Link href="/" className="text-sm text-muted hover:text-slate-100">
        ← All bonuses
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight mt-2 mb-1">
        {bonus.label}
      </h1>
      <p className="text-sm text-muted mb-5">&quot;{bonus.promptText}&quot;</p>

      {latest ? (
        <BonusCard
          bonusId={bonus.id}
          label={bonus.label}
          computedAt={latest.computedAt.toISOString()}
          leaderboard={latest.leaderboard as never}
          avatarsByManagerId={avatarsByManagerId}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <h3 className="font-bold text-lg mb-1.5">Not computed yet</h3>
          <p className="text-sm text-muted">
            This bonus hasn&apos;t produced a leaderboard yet.
          </p>
        </div>
      )}
    </PageShell>
  );
}
