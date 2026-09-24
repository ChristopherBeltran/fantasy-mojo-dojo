"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

// Hidden entirely for non-commissioners, same as RegeneratePosterButton —
// the POST is already commissioner-gated in middleware, but league members
// shouldn't see a button that only ever fails for them.
export function AddBonusModal({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  if (!commissionerAuthorized) return null;

  function close() {
    if (submitting) return;
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!promptText.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, promptText }),
      });

      if (res.status === 201) {
        const { bonus } = await res.json();
        setOpen(false);
        setPromptText("");
        router.push(`/bonuses/${bonus.id}`);
        return;
      }

      if (res.status === 401) {
        setError("Commissioner authentication required to add a bonus.");
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Something went wrong — please try again.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-brandTeal hover:bg-brandTeal/90 text-app font-bold text-sm px-4 py-2.5 rounded-lg transition-colors shrink-0"
      >
        + Add a bonus
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
            <h2 className="font-bold text-lg mb-1">Add a bonus</h2>
            <p className="text-sm text-muted mb-4">
              Describe the award in plain English — e.g. &quot;highest regular season points.&quot;
            </p>

            <form onSubmit={handleSubmit}>
              <textarea
                autoFocus
                rows={3}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                disabled={submitting}
                placeholder="Award the biggest blowout of the season"
                className="w-full bg-cardHover border border-border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-faint focus:outline-none focus:border-brandTeal disabled:opacity-60"
              />

              {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={close}
                  disabled={submitting}
                  className="text-sm text-muted hover:text-slate-100 px-3 py-2 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !promptText.trim()}
                  className="bg-brandTeal hover:bg-brandTeal/90 text-app font-bold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  {submitting ? "Creating…" : "Create bonus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
