export type ActiveTab = "home" | "standings" | "matchups" | "lastManStanding" | "commissioner";

export const NAV_ITEMS: { tab: ActiveTab; label: string; href: string }[] = [
  { tab: "home", label: "Home", href: "/" },
  { tab: "standings", label: "Standings", href: "/standings" },
  { tab: "matchups", label: "Matchups", href: "/matchups" },
  { tab: "lastManStanding", label: "Last Man Standing", href: "/last-man-standing" },
  { tab: "commissioner", label: "Commissioner", href: "/commissioner/settings" },
];

// Labels for the TopNav breadcrumb.
export const TAB_LABELS: Record<ActiveTab, string> = {
  home: "Home",
  standings: "Standings",
  matchups: "Matchups",
  lastManStanding: "Last Man Standing",
  commissioner: "Commissioner",
};
