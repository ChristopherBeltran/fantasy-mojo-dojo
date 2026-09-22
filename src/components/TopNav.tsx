export function TopNav({
  leagueName,
  onToggleMobileNav,
}: {
  leagueName: string;
  onToggleMobileNav: () => void;
}) {
  return (
    <div className="border-b border-border bg-sidebar">
      <div className="flex items-center gap-3 px-4 h-14">
        <button
          onClick={onToggleMobileNav}
          className="text-muted hover:text-slate-100 transition-colors md:hidden"
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-brandTeal text-lg">🏈</span>
          <span className="font-extrabold text-lg tracking-tight">Fantasy Mojo Dojo</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted ml-2 min-w-0">
          <span className="text-slate-300 font-medium truncate">{leagueName}</span>
        </div>
      </div>
    </div>
  );
}
