import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/PageShell";
import { getCurrentLeague } from "@/lib/league";

export const revalidate = 300;

export default async function TeamPage({ params }: { params: { managerId: string } }) {
  const league = await getCurrentLeague();

  const manager = await prisma.manager.findUnique({ where: { id: params.managerId } });
  if (!manager || manager.leagueId !== league.id) notFound();

  const matchups = await prisma.matchup.findMany({
    where: { managerId: manager.id },
    include: { opponent: true },
    orderBy: { week: "asc" },
  });

  const name = manager.teamName ?? manager.displayName;
  const wins = matchups.filter((m) => m.opponentPoints != null && m.points > m.opponentPoints).length;
  const losses = matchups.filter((m) => m.opponentPoints != null && m.points < m.opponentPoints).length;

  return (
    // No dedicated "Team" nav entry — teams are reached via Standings/Matchups, so Standings stays highlighted.
    <PageShell activeTab="standings" leagueName={league.name}>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">{name}</h1>
      <p className="text-sm text-muted mb-5">
        {wins}-{losses} · {manager.displayName}
        {manager.favoriteNflTeam && (
          <>
            {" "}
            · <span className="text-slate-300">Fan of the {manager.favoriteNflTeam}</span>
          </>
        )}
      </p>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-[11px] uppercase tracking-wide">
              <th className="px-5 py-2 font-semibold">Week</th>
              <th className="px-5 py-2 font-semibold">Opponent</th>
              <th className="px-5 py-2 font-semibold text-right">Points</th>
              <th className="px-5 py-2 font-semibold text-right">Opp Points</th>
              <th className="px-5 py-2 font-semibold text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {matchups.map((m) => {
              const won = m.opponentPoints != null && m.points > m.opponentPoints;
              const lost = m.opponentPoints != null && m.points < m.opponentPoints;
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-5 py-3 text-slate-300">
                    {m.week}
                    {m.isPlayoff && (
                      <span className="ml-1.5 text-[10px] text-brandGold uppercase font-semibold">Playoff</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-300">
                    {m.opponent ? m.opponent.teamName ?? m.opponent.displayName : "Bye"}
                  </td>
                  <td className="px-5 py-3 text-right tabular text-slate-300">{m.points.toFixed(1)}</td>
                  <td className="px-5 py-3 text-right tabular text-slate-300">
                    {m.opponentPoints != null ? m.opponentPoints.toFixed(1) : "—"}
                  </td>
                  <td className={`px-5 py-3 text-right font-bold ${won ? "text-brandTeal" : lost ? "text-slate-400" : "text-muted"}`}>
                    {won ? "W" : lost ? "L" : m.opponentPoints != null ? "T" : "—"}
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
