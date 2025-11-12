"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeletePostButton({
  postId,
  backHref = "/",
}: {
  postId: number;
  backHref?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");

  async function handleDelete() {
    if (busy) return;
    const confirmDelete = window.confirm(
      "Delete this post? This action cannot be undone."
    );
    if (!confirmDelete) return;

    try {
      setBusy(true);
      setError(null);

      const res = await fetch(`${apiBase}/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const msg =
          (payload as { message?: string; error?: string })?.message ||
          (payload as { message?: string; error?: string })?.error ||
          "Failed to delete post.";
        throw new Error(msg);
      }

      router.push(backHref || "/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete post."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleDelete}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
        disabled={busy}
        title="Delete this post"
      >
        🗑 Delete
      </button>
      {error && (
        <p className="text-xs text-rose-300 text-right max-w-xs">{error}</p>
      )}
    </div>
  );
}
