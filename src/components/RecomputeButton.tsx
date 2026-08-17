"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Manual fallback for the daily cron (see FEATURE_PLAN Phase 5) — visible to
// everyone like AddBonusModal, but the POST itself requires the commissioner
// Basic Auth already enforced in middleware for /api/bonuses/:path*.
export function RecomputeButton({ bonusId }: { bonusId: string }) {
  const router = useRouter();
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRecomputing(true);
    setError(null);

    try {
      const res = await fetch(`/api/bonuses/${bonusId}/compute`, {
        method: "POST",
      });

      if (!res.ok) {
        setError(
          res.status === 401
            ? "Commissioner authentication required."
            : "Recompute failed — please try again.",
        );
        return;
      }

      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-red-400">{error}</span>}
      <button
        onClick={handleClick}
        disabled={recomputing}
        className="text-[11px] font-semibold text-muted hover:text-slate-100 border border-border rounded-full px-2.5 py-1 transition-colors disabled:opacity-60"
      >
        {recomputing ? "Recomputing…" : "Recompute now"}
      </button>
    </div>
  );
}
