"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ActiveTab } from "@/lib/nav";
import { NAV_ITEMS } from "@/lib/nav";

const ICONS: Record<ActiveTab, React.ReactNode> = {
  home: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  standings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 21h8M12 17v4M17 4H7v6a5 5 0 0010 0V4z" />
    </svg>
  ),
  matchups: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3L4 7l4 4" />
      <path d="M4 7h16" />
      <path d="M16 21l4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  ),
  lastManStanding: <span className="text-base leading-none">💪</span>,
  commissioner: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l7 4v5c0 4.418-3.134 7.86-7 9-3.866-1.14-7-4.582-7-9V7l7-4z" />
    </svg>
  ),
};

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="ml-auto text-faint shrink-0"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

export function Sidebar({ activeTab }: { activeTab: ActiveTab }) {
  const [commissionerAuthorized, setCommissionerAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/commissioner/status")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCommissionerAuthorized(Boolean(data.authorized));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar min-h-[calc(100vh-56px)] px-3 py-4 hidden md:block">
      <div className="px-2 mb-4">
        <p className="text-[10px] tracking-widest text-faint font-semibold uppercase mb-2">League</p>
      </div>
      <nav className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.tab === activeTab;
          const isCommissioner = item.tab === "commissioner";
          const className = isActive
            ? "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold bg-cardHover text-slate-100 border-l-2 border-brandTeal -ml-px"
            : "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted hover:text-slate-100 hover:bg-cardHover transition-colors";

          const content = (
            <>
              <span className={isActive ? "text-brandTeal" : ""}>{ICONS[item.tab]}</span>
              {item.label}
              {isCommissioner && !commissionerAuthorized && <LockIcon />}
            </>
          );

          // Plain <a> rather than Link: this route is gated by HTTP Basic
          // Auth in middleware, and only a full browser navigation reliably
          // triggers the native credentials prompt (Next's client-side
          // fetch-based routing doesn't).
          if (isCommissioner) {
            return (
              <a key={item.tab} href={item.href} className={className}>
                {content}
              </a>
            );
          }

          return (
            <Link key={item.tab} href={item.href} className={className}>
              {content}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
