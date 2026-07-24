import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/PageShell";
import { getCurrentLeague } from "@/lib/league";

export const revalidate = 300;

interface StandingsRow {
  managerId: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export default async function StandingsPage() {
  const league = await getCurrentLeague();

  // Standings reflect regular season only — playoff results are shown on the
  // team's own page but don't affect record/points here.
  const matchups = await prisma.matchup.findMany({
    where: { leagueId: league.id, isPlayoff: false },
    include: { manager: true },
  });

  const rows = new Map<string, StandingsRow>();
  for (const m of matchups) {
    const row = rows.get(m.managerId) ?? {
      managerId: m.managerId,
      name: m.manager.teamName ?? m.manager.displayName,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
    row.pointsFor += m.points;
    row.pointsAgainst += m.opponentPoints ?? 0;
    if (m.opponentPoints != null) {
      if (m.points > m.opponentPoints) row.wins += 1;
      else if (m.points < m.opponentPoints) row.losses += 1;
      else row.ties += 1;
    }
    rows.set(m.managerId, row);
  }

  const standings = [...rows.values()].sort((a, b) =>
    b.wins !== a.wins ? b.wins - a.wins : b.pointsFor - a.pointsFor
  );

  return (
    <PageShell activeTab="standings" leagueName={league.name}>
      <h1 className="text-2xl font-extrabold tracking-tight mb-5">Standings</h1>

      {standings.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <h3 className="font-bold text-lg mb-1.5">No games synced yet</h3>
          <p className="text-sm text-muted">Run a sync once the season has games to see standings here.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-faint text-[11px] uppercase tracking-wide">
                <th className="px-5 py-2 font-semibold">Rank</th>
                <th className="px-5 py-2 font-semibold">Team</th>
                <th className="px-5 py-2 font-semibold text-right">Record</th>
                <th className="px-5 py-2 font-semibold text-right">PF</th>
                <th className="px-5 py-2 font-semibold text-right">PA</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.managerId} className={`border-t border-border ${i === 0 ? "bg-brandTeal/5" : ""}`}>
                  <td className={`px-5 py-3 font-bold ${i === 0 ? "text-brandTeal" : "text-muted"}`}>{i + 1}</td>
                  <td className={`px-5 py-3 ${i === 0 ? "font-semibold" : ""}`}>
                    <Link href={`/team/${s.managerId}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right tabular text-slate-300">
                    {s.wins}-{s.losses}
                    {s.ties ? `-${s.ties}` : ""}
                  </td>
                  <td className="px-5 py-3 text-right tabular text-slate-300">{s.pointsFor.toFixed(1)}</td>
                  <td className="px-5 py-3 text-right tabular text-slate-300">{s.pointsAgainst.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
