import type { ActiveTab } from "@/lib/nav";
import { NAV_ITEMS } from "@/lib/nav";

export function TopNav({ leagueName, activeTab }: { leagueName: string; activeTab: ActiveTab }) {
  const activeLabel = NAV_ITEMS.find((item) => item.tab === activeTab)?.label ?? "";

  return (
    <div className="border-b border-border bg-sidebar">
      <div className="flex items-center gap-3 px-4 h-14">
        {/* Mobile nav toggle — wiring this up is tracked under Phase 6 (mobile responsiveness pass) */}
        <button className="text-muted hover:text-slate-100 transition-colors md:hidden" aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="18" rx="1" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-brandTeal text-lg">🏈</span>
          <span className="font-extrabold text-lg tracking-tight">league hub</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted ml-2 min-w-0">
          <span className="text-slate-300 font-medium truncate">{leagueName}</span>
          <span>/</span>
          <span className="text-slate-100 font-semibold">{activeLabel}</span>
        </div>
      </div>
    </div>
  );
}
