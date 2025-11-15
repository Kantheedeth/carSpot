"use client";

import {
  use,
  useEffect,
  useState,
  useCallback,
  useRef,
  ChangeEvent,
} from "react";
import Link from "next/link";
import AdminGuard from "../../AdminGuard";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
const ORIGIN = API_BASE.replace(/\/api$/, "");

type PostDetail = {
  post_id: number;
  user_id: number;
  display_name: string | null;
  image_url_orig: string | null;
  image_url_censored: string | null;
  status: "PUBLISHED" | "PENDING" | "DELETED";
  moderation_status: "PENDING" | "PASSED" | "REJECTED";
  rating_count: number;
  avg_rating: number | null;
  created_at: string;
};

type RatingEntry = {
  rating_id: number;
  user_id: number;
  score: number;
  created_at: string;
  rater_display_name: string | null;
};

type PostResponse = {
  post: PostDetail;
  ratings: RatingEntry[];
};

export default function AdminPostDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const postId = Number(id);

  const [data, setData] = useState<PostResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationMessage, setModerationMessage] = useState<string | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceNote, setReplaceNote] = useState("");
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPost = useCallback(
    async (signal?: AbortSignal) => {
      if (!Number.isFinite(postId)) {
        setNotFound(true);
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setNotFound(false);

      const options: RequestInit = {
        credentials: "include",
        cache: "no-store",
      };
      if (signal) options.signal = signal;

      try {
        const res = await fetch(`${API_BASE}/api/admin/posts/${postId}`, options);

        if (res.status === 404) {
          if (!signal?.aborted) {
            setNotFound(true);
            setData(null);
          }
          return;
        }

        if (!res.ok) {
          throw new Error(res.status === 403 ? "Admin access denied" : "Failed to load post");
        }

        const body: PostResponse = await res.json();
        if (!signal?.aborted) {
          setData(body);
        }
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load post");
        setData(null);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [postId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPost(controller.signal);
    return () => controller.abort();
  }, [loadPost]);

  const post = data?.post;
  const ratings = data?.ratings ?? [];

  const resolveImage = (path: string | null) => {
    if (!path) return null;
    return path.startsWith("/") ? `${ORIGIN}${path}` : `${ORIGIN}/${path}`;
  };

  const handleApprove = async () => {
    if (!post || approveBusy) return;
    setApproveBusy(true);
    setModerationError(null);
    setModerationMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/posts/${post.post_id}/approve`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "" }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string } | null)?.error || "Failed to approve post"
        );
      }
      await loadPost();
      setModerationMessage("Post approved and flags cleared.");
    } catch (err) {
      setModerationError(
        err instanceof Error ? err.message : "Failed to approve post"
      );
    } finally {
      setApproveBusy(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setReplaceFile(file ?? null);
  };

  const handleReplace = async () => {
    if (!post || replaceBusy) return;
    if (!replaceFile) {
      setModerationError("Select an image to upload.");
      return;
    }
    setReplaceBusy(true);
    setModerationError(null);
    setModerationMessage(null);

    try {
      const form = new FormData();
      form.append("censored", replaceFile);
      if (replaceNote.trim()) form.append("note", replaceNote.trim());

      const res = await fetch(`${API_BASE}/api/admin/posts/${post.post_id}/censored`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string } | null)?.error || "Failed to replace image"
        );
      }
      await loadPost();
      setModerationMessage("Censored image updated.");
      setReplaceFile(null);
      setReplaceNote("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setModerationError(
        err instanceof Error ? err.message : "Failed to replace image"
      );
    } finally {
      setReplaceBusy(false);
    }
  };

  const handleReject = async () => {
    if (!post || rejectBusy) return;
    if (!rejectNote.trim()) {
      setModerationError("Add a short note explaining the rejection.");
      return;
    }
    setRejectBusy(true);
    setModerationError(null);
    setModerationMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/posts/${post.post_id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote.trim() }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string } | null)?.error || "Failed to reject post"
        );
      }
      await loadPost();
      setModerationMessage("Post rejected.");
      setRejectNote("");
    } catch (err) {
      setModerationError(
        err instanceof Error ? err.message : "Failed to reject post"
      );
    } finally {
      setRejectBusy(false);
    }
  };

  return (
    <AdminGuard>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Admin · Post Detail</h1>
          <Link href="/admin/posts" className="text-sm text-white/70 hover:text-white">
            Back
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-950/40 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        {notFound ? (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-center text-white/70">
            Post not found.
          </div>
        ) : loading || !post ? (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-center text-white/70">
            Loading post…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-semibold text-white">
                  Post #{post.post_id} · by {post.display_name ?? `User ${post.user_id}`}
                </h2>
                <span className="text-xs text-white/60">{new Date(post.created_at).toLocaleString()}</span>
              </div>
              {(() => {
                const img = resolveImage(post.image_url_censored || post.image_url_orig);
                return img ? (
                  <img src={img} alt="" className="max-h-[70vh] w-full bg-black/40 object-contain" />
                ) : (
                  <div className="h-64 w-full bg-neutral-800/60" />
                );
              })()}
              <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-4 text-sm text-white/80">
                <div>
                  Created: <b className="text-white/90">{new Date(post.created_at).toLocaleString()}</b>
                </div>
                <div>
                  Average:{" "}
                  <b className="text-white/90">
                    {post.avg_rating != null ? post.avg_rating.toFixed(2) : "—"}
                  </b>
                </div>
                <div>
                  Ratings: <b className="text-white/90">{post.rating_count}</b>
                </div>
                <div>
                  Status: <Badge>{post.status}</Badge>
                </div>
                <div>
                  Moderation:{" "}
                  <Badge
                    tone={
                      post.moderation_status === "PENDING"
                        ? "amber"
                        : post.moderation_status === "REJECTED"
                        ? "red"
                        : "green"
                    }
                  >
                    {post.moderation_status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
                <div className="mb-2 text-sm font-semibold text-white">Moderation</div>
                <div className="space-y-4 text-sm text-white/70">
                  <p>
                    Approve once the content looks safe. You can also upload a corrected censored image or reject the post entirely.
                  </p>
                  {moderationError && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                      {moderationError}
                    </div>
                  )}
                  {moderationMessage && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      {moderationMessage}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={approveBusy || post.moderation_status === "PASSED"}
                    className="w-full rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approveBusy ? "Approving…" : "Approve & Clear Flags"}
                  </button>

                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                    <p className="text-sm font-semibold text-white">Replace Censored Image</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="block w-full text-xs text-white/70 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white file:text-xs"
                    />
                    <input
                      type="text"
                      value={replaceNote}
                      onChange={(e) => setReplaceNote(e.target.value)}
                      placeholder="Optional note"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={handleReplace}
                      disabled={replaceBusy || !replaceFile}
                      className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {replaceBusy ? "Uploading…" : "Upload & Replace"}
                    </button>
                  </div>

                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                    <p className="text-sm font-semibold text-white">Reject Post</p>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      className="h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      placeholder="Explain why the post is rejected..."
                    />
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={rejectBusy}
                      className="w-full rounded-lg bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {rejectBusy ? "Rejecting…" : "Reject Post"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
                <div className="mb-2 text-sm font-semibold text-white">Recent Ratings</div>
                {ratings.length === 0 ? (
                  <div className="text-sm text-white/60">No ratings for this post yet.</div>
                ) : (
                  <ul className="space-y-2 text-sm text-white/80">
                    {ratings.map((rating) => (
                      <li key={rating.rating_id}>
                        <div className="font-medium text-white">
                          {rating.rater_display_name ?? `User ${rating.user_id}`} rated{" "}
                          {rating.score}/10
                        </div>
                        <div className="text-xs text-white/50">
                          {new Date(rating.created_at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </AdminGuard>
  );
}

function Badge({
  tone = "slate",
  children,
}: {
  tone?: "slate" | "green" | "amber" | "red";
  children: React.ReactNode;
}) {
  const map = {
    slate: "bg-white/10 text-white/80",
    green: "bg-emerald-500/15 text-emerald-200",
    amber: "bg-amber-500/15 text-amber-200",
    red: "bg-rose-500/15 text-rose-200",
  } as const;
  return <span className={`rounded px-2 py-0.5 text-[11px] ${map[tone]}`}>{children}</span>;
}
