import { prisma } from "@/lib/prisma";
import { BonusCard } from "@/components/BonusCard";
import { AddBonusModal } from "@/components/AddBonusModal";
import { PageShell } from "@/components/PageShell";
import { getCurrentLeague } from "@/lib/league";

// Revalidate periodically so a manual refresh isn't required, but this is
// still just reading pre-computed rows — no Sleeper/Claude calls on load.
export const revalidate = 300;

export default async function HomePage() {
  const league = await getCurrentLeague();
  const bonuses = await prisma.bonus.findMany({
    where: { leagueId: league.id, active: true },
    include: { results: { orderBy: { computedAt: "desc" }, take: 1 } },
  });

  return (
    <PageShell activeTab="home" leagueName={league.name}>
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Season Bonuses
        </h1>
        <AddBonusModal leagueId={league.id} />
      </div>

      {bonuses.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <h3 className="font-bold text-lg mb-1.5">No bonuses added yet</h3>
          <p className="text-sm text-muted">
            Describe an award in plain English and we&apos;ll figure out how to
            track the leaders automatically.
          </p>
        </div>
      )}

      {bonuses.map((bonus) => {
        const latest = bonus.results[0];
        if (!latest) return null;
        return (
          <BonusCard
            key={bonus.id}
            bonusId={bonus.id}
            label={bonus.label}
            computedAt={latest.computedAt.toISOString()}
            leaderboard={latest.leaderboard as never}
          />
        );
      })}
    </PageShell>
  );
}
