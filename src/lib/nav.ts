export type ActiveTab = "home" | "standings" | "matchups" | "lastManStanding" | "commissioner";

export const NAV_ITEMS: { tab: ActiveTab; label: string; href: string }[] = [
  { tab: "home", label: "Home", href: "/" },
  { tab: "standings", label: "Standings", href: "/standings" },
  { tab: "matchups", label: "Matchups", href: "/matchups" },
  { tab: "lastManStanding", label: "Last Man Standing", href: "/last-man-standing" },
  { tab: "commissioner", label: "Commissioner", href: "/commissioner/settings" },
];
