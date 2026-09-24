import { PageShell } from "@/components/PageShell";
import { LmsRecomputeButton } from "@/components/LmsRecomputeButton";
import { TeamAvatar } from "@/components/TeamAvatar";
import { getCurrentLeague } from "@/lib/league";
import { prisma } from "@/lib/prisma";
import { LMS_START_WEEK, LMS_END_WEEK } from "@/lib/lastManStanding";

// Rendered per-request rather than statically at build time — Neon's
// serverless DB auto-suspends when idle, and a build-time prerender can
// fail if it hits the DB mid-wake.
export const dynamic = "force-dynamic";

export default async function LastManStandingPage() {
  const league = await getCurrentLeague();

  const [managers, eliminations] = await Promise.all([
    prisma.manager.findMany({
      where: { leagueId: league.id },
      orderBy: { displayName: "asc" },
    }),
    prisma.lastManStandingElimination.findMany({
      where: { leagueId: league.id, season: league.season },
    }),
  ]);

  const eliminationByManagerId = new Map(
    eliminations.map((e) => [e.managerId, e.week]),
  );

  const rows = managers
    .map((m) => ({
      manager: m,
      eliminatedWeek: eliminationByManagerId.get(m.id) ?? null,
    }))
    .sort((a, b) => {
      if (a.eliminatedWeek == null && b.eliminatedWeek == null) {
        return a.manager.displayName.localeCompare(b.manager.displayName);
      }
      if (a.eliminatedWeek == null) return -1;
      if (b.eliminatedWeek == null) return 1;
      return b.eliminatedWeek - a.eliminatedWeek;
    });

  const survivorCount = rows.filter((r) => r.eliminatedWeek == null).length;
  const winner =
    survivorCount === 1
      ? rows.find((r) => r.eliminatedWeek == null)?.manager
      : null;

  return (
    <PageShell activeTab="lastManStanding" leagueName={league.name}>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Last Man Standing
        </h1>
        <LmsRecomputeButton />
      </div>
      <p className="text-sm text-muted mb-5">
        Weeks {LMS_START_WEEK}–{LMS_END_WEEK}: every week, whoever scored the
        lowest among survivors is eliminated.
        {winner && (
          <span className="text-brandTeal font-semibold">
            {" "}
            {winner.teamName ?? winner.displayName} is the winner!
          </span>
        )}
      </p>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-[11px] uppercase tracking-wide">
              <th className="px-3 md:px-5 py-2 font-semibold" />
              <th className="px-3 md:px-5 py-2 font-semibold">Team</th>
              <th className="px-3 md:px-5 py-2 font-semibold">Status</th>
              <th className="px-3 md:px-5 py-2 font-semibold text-right">
                <span className="md:hidden">Out</span>
                <span className="hidden md:inline">Eliminated</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ manager, eliminatedWeek }) => {
              const isEliminated = eliminatedWeek != null;
              return (
                <tr
                  key={manager.id}
                  className={`border-t border-border ${isEliminated ? "opacity-50" : ""}`}
                >
                  <td className="px-3 md:px-5 py-3">
                    <TeamAvatar avatarId={manager.avatarUrl} />
                  </td>
                  <td
                    className={`px-3 md:px-5 py-3 ${isEliminated ? "line-through" : "font-semibold"}`}
                  >
                    {manager.teamName ?? manager.displayName}
                  </td>
                  <td className="px-3 md:px-5 py-3">
                    {isEliminated ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-400 text-[11px] font-semibold px-2 py-0.5">
                        Eliminated 🪦
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-brandTeal/10 text-brandTeal text-[11px] font-semibold px-2 py-0.5">
                        Alive
                      </span>
                    )}
                  </td>
                  <td className="px-3 md:px-5 py-3 text-right tabular text-slate-300">
                    {eliminatedWeek ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
