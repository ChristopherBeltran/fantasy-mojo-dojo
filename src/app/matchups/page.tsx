import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/PageShell";
import { getCurrentLeague } from "@/lib/league";

export const revalidate = 300;

export default async function MatchupsPage() {
  const league = await getCurrentLeague();

  const latest = await prisma.matchup.aggregate({
    where: { leagueId: league.id },
    _max: { week: true },
  });
  const week = latest._max.week;

  const rows = week
    ? await prisma.matchup.findMany({
        where: { leagueId: league.id, week },
        include: { manager: true, opponent: true },
      })
    : [];

  const seenPairs = new Set<string>();
  const pairs = rows.filter((m) => {
    if (!m.opponentId || !m.opponent) return false; // bye week
    const key = [m.managerId, m.opponentId].sort().join(":");
    if (seenPairs.has(key)) return false;
    seenPairs.add(key);
    return true;
  });

  return (
    <PageShell activeTab="matchups" leagueName={league.name}>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Matchups</h1>
      <p className="text-sm text-muted mb-5">{week ? `Week ${week}` : "No games synced yet"}</p>

      {pairs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <h3 className="font-bold text-lg mb-1.5">No matchups yet</h3>
          <p className="text-sm text-muted">Run a sync once the season has games to see this week&apos;s pairings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pairs.map((m) => {
            const homeName = m.manager.teamName ?? m.manager.displayName;
            const awayName = m.opponent!.teamName ?? m.opponent!.displayName;
            const homeWinning = m.points > (m.opponentPoints ?? 0);
            return (
              <div
                key={m.id}
                className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className={`flex-1 min-w-0 truncate ${homeWinning ? "font-semibold text-slate-100" : "text-slate-300"}`}>
                  {homeName}
                </div>
                <div className="flex items-center gap-3 tabular font-bold shrink-0">
                  <span className={homeWinning ? "text-brandTeal" : "text-slate-300"}>{m.points.toFixed(1)}</span>
                  <span className="text-faint text-xs">–</span>
                  <span className={!homeWinning ? "text-brandTeal" : "text-slate-300"}>
                    {(m.opponentPoints ?? 0).toFixed(1)}
                  </span>
                </div>
                <div
                  className={`flex-1 min-w-0 truncate text-right ${!homeWinning ? "font-semibold text-slate-100" : "text-slate-300"}`}
                >
                  {awayName}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
