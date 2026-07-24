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
  return (
    <>
      <TopNav leagueName={leagueName} activeTab={activeTab} />
      <div className="flex">
        <Sidebar activeTab={activeTab} />
        <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-5">{children}</main>
      </div>
    </>
  );
}
