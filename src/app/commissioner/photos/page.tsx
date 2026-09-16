import { PageShell } from "@/components/PageShell";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { FavoriteTeamModal } from "@/components/FavoriteTeamModal";
import { getCurrentLeague } from "@/lib/league";
import { prisma } from "@/lib/prisma";

// Management page, not a public view — always fetch fresh so uploads/edits
// show up immediately via router.refresh() rather than waiting on a
// time-based cache.
export const revalidate = 0;

export default async function CommissionerManagersPage() {
  const league = await getCurrentLeague();
  const managers = await prisma.manager.findMany({
    where: { leagueId: league.id },
    orderBy: { displayName: "asc" },
    include: { photos: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <PageShell activeTab="commissioner" leagueName={league.name}>
      {/* Plain <a> rather than Link — same reasoning as Sidebar's commissioner
          entry: only a full browser navigation reliably works with HTTP
          Basic Auth across the whole /commissioner/* surface. */}
      <a href="/commissioner/settings" className="text-sm text-muted hover:text-slate-100 inline-block mb-3">
        ← Back to Commissioner
      </a>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Manage league members</h1>
      <p className="text-sm text-muted mb-5">
        Upload up to 3 reference photos per manager — used to generate each
        week&apos;s matchup posters (a pairing only gets a poster once both
        managers have at least one) — and set each manager&apos;s favorite
        NFL team.
      </p>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {managers.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between px-5 py-4 gap-4"
          >
            <div className="min-w-0">
              <p className="font-semibold truncate">{m.teamName ?? m.displayName}</p>
              <p className="text-xs text-muted truncate">{m.displayName}</p>
              <div className="mt-1">
                <FavoriteTeamModal
                  managerId={m.id}
                  managerLabel={m.teamName ?? m.displayName}
                  currentTeam={m.favoriteNflTeam}
                />
              </div>
            </div>
            <PhotoUploadForm managerId={m.id} photos={m.photos} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
