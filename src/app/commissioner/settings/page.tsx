import { PageShell } from "@/components/PageShell";
import { CommissionerSubNav } from "@/components/CommissionerSubNav";
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
      <CommissionerSubNav active="settings" />
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Poster prompt</h1>
      <p className="text-sm text-muted mb-5">
        Edit the prompt used to generate each week&apos;s AI matchup posters —
        changes take effect on the next generation, no deploy needed.
      </p>

      <PosterPromptEditor initialValue={value} initialIsDefault={isDefault} />
    </PageShell>
  );
}
