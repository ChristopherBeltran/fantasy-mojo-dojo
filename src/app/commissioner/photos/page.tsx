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
  });

  return (
    <PageShell activeTab="commissioner" leagueName={league.name}>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Manage league members</h1>
      <p className="text-sm text-muted mb-5">
        Upload a reference photo per manager — used to generate each week&apos;s
        matchup posters (a pairing only gets a poster once both managers have
        one) — and set each manager&apos;s favorite NFL team.
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
            <PhotoUploadForm managerId={m.id} currentPhotoUrl={m.photoUrl} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
