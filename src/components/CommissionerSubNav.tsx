// Plain <a> tags rather than Link — same reasoning as Sidebar's commissioner
// entry: only a full browser navigation reliably works with HTTP Basic Auth
// across the whole /commissioner/* surface.
const TABS = [
  { href: "/commissioner/photos", label: "Photos & Teams" },
  { href: "/commissioner/settings", label: "Poster Prompt" },
] as const;

export function CommissionerSubNav({ active }: { active: "photos" | "settings" }) {
  return (
    <div className="flex gap-1 mb-5 border-b border-border">
      {TABS.map((tab) => {
        const isActive = tab.href.endsWith(active);
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`text-sm font-semibold px-3 py-2 -mb-px border-b-2 transition-colors ${
              isActive
                ? "border-brandTeal text-slate-100"
                : "border-transparent text-muted hover:text-slate-100"
            }`}
          >
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}
