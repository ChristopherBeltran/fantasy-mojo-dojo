export type ActiveTab = "home" | "standings" | "matchups" | "commissioner";

export const NAV_ITEMS: { tab: ActiveTab; label: string; href: string }[] = [
  { tab: "home", label: "Home", href: "/" },
  { tab: "standings", label: "Standings", href: "/standings" },
  { tab: "matchups", label: "Matchups", href: "/matchups" },
  { tab: "commissioner", label: "Commissioner", href: "/commissioner/photos" },
];

// Labels for the TopNav breadcrumb.
export const TAB_LABELS: Record<ActiveTab, string> = {
  home: "Home",
  standings: "Standings",
  matchups: "Matchups",
  commissioner: "Commissioner",
};
