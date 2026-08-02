export type ActiveTab = "home" | "standings" | "matchups" | "commissioner";

export const NAV_ITEMS: { tab: ActiveTab; label: string; href: string }[] = [
  { tab: "home", label: "Home", href: "/" },
  { tab: "standings", label: "Standings", href: "/standings" },
  { tab: "matchups", label: "Matchups", href: "/matchups" },
];

// Labels for the TopNav breadcrumb, including tabs with no Sidebar entry
// (e.g. "admin" — a commissioner-only surface, deliberately not in NAV_ITEMS).
export const TAB_LABELS: Record<ActiveTab, string> = {
  home: "Home",
  standings: "Standings",
  matchups: "Matchups",
  commissioner: "Commissioner",
};
