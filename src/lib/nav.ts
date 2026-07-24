export type ActiveTab = "home" | "standings" | "matchups";

export const NAV_ITEMS: { tab: ActiveTab; label: string; href: string }[] = [
  { tab: "home", label: "Home", href: "/" },
  { tab: "standings", label: "Standings", href: "/standings" },
  { tab: "matchups", label: "Matchups", href: "/matchups" },
];
