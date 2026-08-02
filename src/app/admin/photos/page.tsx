import { PageShell } from "@/components/PageShell";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { getCurrentLeague } from "@/lib/league";
import { prisma } from "@/lib/prisma";

// Management page, not a public view — always fetch fresh so uploads show
// up immediately via router.refresh() rather than waiting on a time-based cache.
export const revalidate = 0;

export default async function AdminPhotosPage() {
  const league = await getCurrentLeague();
  const managers = await prisma.manager.findMany({
    where: { leagueId: league.id },
    orderBy: { displayName: "asc" },
  });

  return (
    <PageShell activeTab="commissioner" leagueName={league.name}>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">
        Manager Photos
      </h1>
      <p className="text-sm text-muted mb-5">
        Upload a reference photo per manager — used to generate each week&apos;s
        matchup posters. A pairing only gets a poster once both managers have a
        photo.
      </p>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {managers.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between px-5 py-4"
          >
            <div>
              <p className="font-semibold">{m.teamName ?? m.displayName}</p>
              <p className="text-xs text-muted">{m.displayName}</p>
            </div>
            <PhotoUploadForm managerId={m.id} currentPhotoUrl={m.photoUrl} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
