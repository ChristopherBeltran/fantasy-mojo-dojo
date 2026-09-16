"use client";

import { useState } from "react";

export function PosterPromptEditor({
  initialValue,
  initialIsDefault,
}: {
  initialValue: string;
  initialIsDefault: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [isDefault, setIsDefault] = useState(initialIsDefault);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const res = await fetch("/api/settings/poster-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Save failed — please try again.");
        return;
      }

      setIsDefault(false);
      setStatus("Prompt saved.");

      if (confirm("Prompt saved. Regenerate this week's posters with the new prompt now?")) {
        await handleRegenerateAll();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset to the default prompt? Your custom wording will be discarded.")) return;

    setResetting(true);
    setError(null);
    setStatus(null);

    try {
      const res = await fetch("/api/settings/poster-prompt", { method: "DELETE" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Reset failed — please try again.");
        return;
      }

      const body = await res.json();
      setValue(body.value);
      setIsDefault(body.isDefault);
      setStatus("Reset to default.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setResetting(false);
    }
  }

  async function handleRegenerateAll() {
    setRegenerating(true);
    setError(null);
    setStatus(null);

    try {
      const res = await fetch("/api/posters/regenerate-all", { method: "POST" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Regeneration failed — please try again.");
        return;
      }

      const body = await res.json();
      setStatus(
        body.week == null
          ? "No synced week to regenerate posters for."
          : `Regenerated ${body.regenerated} poster(s) for week ${body.week}${body.failed ? ` (${body.failed} failed)` : ""}.`,
      );
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm text-muted">
            Placeholders: <code className="text-slate-300">{"{{teamA}}"}</code>,{" "}
            <code className="text-slate-300">{"{{teamB}}"}</code>,{" "}
            <code className="text-slate-300">{"{{teamAApparelInstruction}}"}</code>,{" "}
            <code className="text-slate-300">{"{{teamBApparelInstruction}}"}</code>
          </p>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              isDefault ? "bg-cardHover text-muted" : "bg-brandTeal/10 text-brandTeal"
            }`}
          >
            {isDefault ? "Using default" : "Customized"}
          </span>
        </div>

        <textarea
          rows={16}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving || resetting}
          className="w-full bg-cardHover border border-border rounded-lg px-3 py-2 text-sm text-slate-100 font-mono placeholder:text-faint focus:outline-none focus:border-brandTeal disabled:opacity-60"
        />

        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        {status && <p className="text-sm text-brandTeal mt-2">{status}</p>}

        <div className="flex justify-between items-center mt-4">
          <button
            onClick={handleReset}
            disabled={saving || resetting || regenerating}
            className="text-sm text-muted hover:text-slate-100 disabled:opacity-60"
          >
            {resetting ? "Resetting…" : "Reset to default"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || resetting || regenerating || !value.trim()}
            className="bg-brandTeal hover:bg-brandTeal/90 text-app font-bold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : regenerating ? "Regenerating posters…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
