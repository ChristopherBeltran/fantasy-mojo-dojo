"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

export function PhotoUploadForm({
  managerId,
  currentPhotoUrl,
}: {
  managerId: string;
  currentPhotoUrl: string | null;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("photo", file);

    try {
      const res = await fetch(`/api/managers/${managerId}/photo`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Upload failed — please try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-lg bg-cardHover border border-border overflow-hidden shrink-0 flex items-center justify-center text-faint text-[10px] text-center">
        {currentPhotoUrl ? (
          // Blob URLs are on an unpredictable per-store domain, so a plain <img>
          // is simpler here than configuring next/image remotePatterns for it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentPhotoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          "No photo"
        )}
      </div>
      <label className="text-sm text-brandTeal hover:underline cursor-pointer">
        {uploading ? "Uploading…" : currentPhotoUrl ? "Replace photo" : "Upload photo"}
        <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={uploading} />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
