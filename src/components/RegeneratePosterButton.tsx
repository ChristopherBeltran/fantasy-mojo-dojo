"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Unlike RecomputeButton/LmsRecomputeButton (visible to everyone, gated only
// on the POST), this button is hidden entirely for non-commissioners —
// regenerating burns real Gemini quota, so it shouldn't be a visible
// temptation for every league member.
export function RegeneratePosterButton({
  managerAId,
  managerBId,
}: {
  managerAId: string;
  managerBId: string;
}) {
  const router = useRouter();
  const [commissionerAuthorized, setCommissionerAuthorized] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!commissionerAuthorized) return null;

  async function handleClick() {
    setRegenerating(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/posters/${managerAId}/${managerBId}/regenerate`,
        {
          method: "POST",
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Regeneration failed — please try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full pl-3 pr-1 py-1">
      {error && <span className="text-[11px] text-red-400">{error}</span>}
      <button
        onClick={handleClick}
        disabled={regenerating}
        className="text-[11px] font-semibold text-slate-200 hover:text-white border border-white/30 rounded-full px-2.5 py-1 transition-colors disabled:opacity-60"
      >
        {regenerating ? "Regenerating…" : "Regenerate poster"}
      </button>
    </div>
  );
}
