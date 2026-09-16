"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

const MAX_PHOTOS = 3;

interface Photo {
  id: string;
  url: string;
}

export function PhotoUploadForm({
  managerId,
  photos,
}: {
  managerId: string;
  photos: Photo[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function handleDelete(photoId: string) {
    setDeletingId(photoId);
    setError(null);

    try {
      const res = await fetch(`/api/managers/${managerId}/photo/${photoId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Delete failed — please try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const atCap = photos.length >= MAX_PHOTOS;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative w-14 h-14 rounded-lg bg-cardHover border border-border overflow-hidden shrink-0 group"
          >
            {/* Blob URLs are on an unpredictable per-store domain, so a plain <img>
                is simpler here than configuring next/image remotePatterns for it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => handleDelete(photo.id)}
              disabled={deletingId === photo.id}
              aria-label="Delete photo"
              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold"
            >
              {deletingId === photo.id ? "…" : "✕"}
            </button>
          </div>
        ))}
        {photos.length === 0 && (
          <div className="w-14 h-14 rounded-lg bg-cardHover border border-border flex items-center justify-center text-faint text-[10px] text-center">
            No photos
          </div>
        )}
      </div>
      <label
        className={`text-sm ${
          atCap ? "text-faint cursor-not-allowed" : "text-brandTeal hover:underline cursor-pointer"
        }`}
      >
        {uploading ? "Uploading…" : atCap ? `${MAX_PHOTOS}/${MAX_PHOTOS} — delete one to add another` : "Add photo"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          disabled={uploading || atCap}
        />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
