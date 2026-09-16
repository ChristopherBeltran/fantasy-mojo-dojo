"use client";

import { useState } from "react";
import type { ActiveTab } from "@/lib/nav";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function PageShell({
  activeTab,
  leagueName,
  children,
}: {
  activeTab: ActiveTab;
  leagueName: string;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <TopNav
        leagueName={leagueName}
        activeTab={activeTab}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
      />
      <div className="flex">
        <Sidebar activeTab={activeTab} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-5">{children}</main>
      </div>
    </>
  );
}
