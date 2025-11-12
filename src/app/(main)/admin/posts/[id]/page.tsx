"use client";

import { use, useEffect, useState } from "react";
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

  useEffect(() => {
    if (!Number.isFinite(postId)) {
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/posts/${postId}`, {
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true);
            setData(null);
          }
          return;
        }

        if (!res.ok) {
          throw new Error(res.status === 403 ? "Admin access denied" : "Failed to load post");
        }

        const body: PostResponse = await res.json();
        if (!cancelled) {
          setData(body);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load post");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const post = data?.post;
  const ratings = data?.ratings ?? [];

  const resolveImage = (path: string | null) => {
    if (!path) return null;
    return path.startsWith("/") ? `${ORIGIN}${path}` : `${ORIGIN}/${path}`;
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
                <div className="text-sm text-white/60">
                  Moderation actions will be wired up soon. For now this panel is read-only.
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
