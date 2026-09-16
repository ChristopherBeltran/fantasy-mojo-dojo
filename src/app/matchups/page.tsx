import { PageShell } from "@/components/PageShell";
import { RegeneratePosterButton } from "@/components/RegeneratePosterButton";
import { getCurrentLeague } from "@/lib/league";
import { getCurrentWeek, getWeekPairs } from "@/lib/currentWeek";
import { prisma } from "@/lib/prisma";

// Rendered per-request rather than statically at build time — Neon's
// serverless DB auto-suspends when idle, and a build-time prerender can
// fail if it hits the DB mid-wake.
export const dynamic = "force-dynamic";

export default async function MatchupsPage() {
  const league = await getCurrentLeague();

  const week = await getCurrentWeek(league.id);
  const pairs = week ? await getWeekPairs(league.id, week) : [];

  const posters = week
    ? await prisma.matchupPoster.findMany({ where: { leagueId: league.id, week } })
    : [];
  const posterByPair = new Map(posters.map((p) => [`${p.managerAId}:${p.managerBId}`, p]));

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
            const [managerAId, managerBId] = [m.managerId, m.opponentId!].sort();
            const pairKey = `${managerAId}:${managerBId}`;
            const poster = posterByPair.get(pairKey);
            return (
              <div key={m.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {poster && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={poster.imageUrl} alt={`${homeName} vs ${awayName} matchup poster`} className="w-full" />
                    <div className="absolute bottom-2 right-2">
                      <RegeneratePosterButton managerAId={managerAId} managerBId={managerBId} />
                    </div>
                  </div>
                )}
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div
                    className={`flex-1 min-w-0 truncate ${homeWinning ? "font-semibold text-slate-100" : "text-slate-300"}`}
                  >
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
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
