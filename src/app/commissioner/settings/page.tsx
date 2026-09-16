import { PageShell } from "@/components/PageShell";
import { PosterPromptEditor } from "@/components/PosterPromptEditor";
import { getCurrentLeague } from "@/lib/league";
import { getPosterPromptTemplate } from "@/lib/posterGen";

// Management page, not a public view — always fetch fresh.
export const revalidate = 0;

export default async function CommissionerSettingsPage() {
  const league = await getCurrentLeague();
  const { value, isDefault } = await getPosterPromptTemplate();

  return (
    <PageShell activeTab="commissioner" leagueName={league.name}>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Commissioner</h1>
      <p className="text-sm text-muted mb-5">League settings and management tools.</p>

      <div className="space-y-6">
        {/* Plain <a> rather than Link — same reasoning as Sidebar's commissioner
            entry: only a full browser navigation reliably works with HTTP
            Basic Auth across the whole /commissioner/* surface. */}
        <a
          href="/commissioner/photos"
          className="flex items-center justify-between gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-brandTeal/50 transition-colors"
        >
          <div>
            <p className="font-semibold text-slate-100">Photos & Teams</p>
            <p className="text-sm text-muted">
              Upload manager reference photos and set favorite NFL teams.
            </p>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-faint shrink-0"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </a>

        <div>
          <h2 className="text-lg font-bold tracking-tight mb-1">Poster prompt</h2>
          <p className="text-sm text-muted mb-3">
            Edit the prompt used to generate each week&apos;s AI matchup posters —
            changes take effect on the next generation, no deploy needed.
          </p>
          <PosterPromptEditor initialValue={value} initialIsDefault={isDefault} />
        </div>
      </div>
    </PageShell>
  );
}
