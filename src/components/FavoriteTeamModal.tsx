"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NFL_TEAMS } from "@/lib/nflTeams";

const NONE_VALUE = "";

export function FavoriteTeamModal({
  managerId,
  managerLabel,
  currentTeam,
}: {
  managerId: string;
  managerLabel: string;
  currentTeam: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(currentTeam ?? NONE_VALUE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setTeam(currentTeam ?? NONE_VALUE);
    setError(null);
    setOpen(true);
  }

  function close() {
    if (saving) return;
    setOpen(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/managers/${managerId}/favorite-team`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: team === NONE_VALUE ? null : team }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Failed to save — please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="text-sm text-brandTeal hover:underline"
      >
        {currentTeam ?? "Set favorite team"}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-5">
            <h2 className="font-bold text-lg mb-1">Favorite NFL team</h2>
            <p className="text-sm text-muted mb-4">
              {managerLabel} can only have one favorite team on file.
            </p>

            <select
              autoFocus
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              disabled={saving}
              className="w-full bg-cardHover border border-border rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-brandTeal disabled:opacity-60"
            >
              <option value={NONE_VALUE}>None</option>
              {NFL_TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="text-sm text-muted hover:text-slate-100 px-3 py-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-brandTeal hover:bg-brandTeal/90 text-app font-bold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
