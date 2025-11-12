"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/usuSession";

type BookmarkFeedRow = {
  post_id: number;
  user_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  display_name: string | null;
  avg_rating: number | null;
  rating_count: number;
  created_at: string;
};

const formatAvg = (value: number | null | undefined, count?: number) => {
  if (!count) return "—";
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : "—";
};

export default function BookmarksPage() {
  const { user, loading } = useSession();
  const [posts, setPosts] = useState<BookmarkFeedRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  const origin = apiBase.replace(/\/api$/, "");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setPosts([]);
      setFetching(false);
      return;
    }

    (async () => {
      try {
        setFetching(true);
        setError(null);
        const res = await fetch(`${apiBase}/api/me/bookmarks?mode=feed`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data: BookmarkFeedRow[] = await res.json();
        setPosts(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load bookmarks right now.");
        setPosts([]);
      } finally {
        setFetching(false);
      }
    })();
  }, [apiBase, user, loading]);

  async function removeBookmark(postId: number) {
    const prev = posts;
    setPosts((rows) => rows.filter((p) => p.post_id !== postId));
    try {
      const res = await fetch(`${apiBase}/api/posts/${postId}/bookmark`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (err) {
      console.error(err);
      setPosts(prev); // rollback
      setError("Failed to remove bookmark. Please try again.");
    }
  }

  if (loading || fetching) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
          Loading your bookmarks…
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
          Login to save and view bookmarks.
        </div>
      </section>
    );
  }

  if (!posts.length) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
          No bookmarks yet. Start saving your favorite cars!
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Saved Cars</h2>
        <Link
          href="/"
          className="text-sm text-white/60 hover:text-white transition"
        >
          Back to feed →
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

      {posts.map((p) => {
        const imgPath = (p.image_url_censored || p.image_url_orig || "").trim();
        const imgSrc = imgPath
          ? imgPath.startsWith("/")
            ? `${origin}${imgPath}`
            : `${origin}/${imgPath}`
          : "/placeholder.png";
        const owner = p.display_name ?? (p.user_id ? `User ${p.user_id}` : "User");

        return (
          <article
            key={p.post_id}
            className="overflow-hidden rounded-2xl bg-neutral-900/60 ring-1 ring-white/10"
          >
            <Link
              href={`/post/${p.post_id}?from=/bookmarks`}
              className="block relative"
            >
              <img
                src={imgSrc}
                alt="car"
                className="w-full object-cover"
                style={{ aspectRatio: "4/3" }}
              />
            </Link>

            <div className="px-4 pb-4 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/80">
                  <span className="font-semibold text-white">{owner}</span>
                </div>

                <div className="text-sm text-white/60">
                  ⭐ <span className="text-white">{formatAvg(p.avg_rating)}</span>{" "}
                  <span className="text-white/40">({p.rating_count})</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-white/60">
                <button
                  onClick={() => removeBookmark(p.post_id)}
                  className="rounded-full border border-white/15 px-3 py-1 text-white/70 hover:bg-white/10"
                >
                  Remove
                </button>
                <Link
                  href={`/post/${p.post_id}?from=/bookmarks`}
                  className="rounded-full border border-white/15 px-3 py-1 text-white/70 hover:bg-white/10"
                >
                  View post
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
