export function TopNav({
  leagueName,
  onToggleMobileNav,
}: {
  leagueName: string;
  onToggleMobileNav: () => void;
}) {
  return (
    <div className="border-b border-border bg-sidebar">
      <div className="flex items-center gap-3 px-4 py-2 min-h-14">
        <button
          onClick={onToggleMobileNav}
          className="text-muted hover:text-slate-100 transition-colors shrink-0 md:hidden"
          aria-label="Toggle menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <span className="text-brandTeal text-lg">🏈</span>
          <span className="font-extrabold text-lg tracking-tight">
            Fantasy Mojo Dojo
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted min-w-0 ml-auto text-right md:ml-2 md:text-left">
          {/* Wraps rather than truncating — long league names were cut off on phones. */}
          <span className="text-slate-300 font-medium leading-tight break-words">
            {leagueName}
          </span>
        </div>
      </div>
    </div>
  );
}
