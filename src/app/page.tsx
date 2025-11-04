"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// import { MOCK_POSTS } from "lib/mock";  // ← stop using this

type PostFeedDto = {
  post_id: number;
  user_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  avg_rating: number | null; // from API: SELECT ... AS avg_rating
  rating_count: number;
  created_at: string;
  display_name?: string; // add this in API if you want (JOIN User)
  status: "PUBLISHED" | "PENDING" | "DELETED";
  moderation_status: "PENDING" | "PASSED" | "REJECTED";
};

type Ratings = Record<number, number>;

const FRIENDS = [
  /* ... keep your list ... */
];

export default function FeedPage() {
  const [ratings, setRatings] = useState<Ratings>({});
  const [posts, setPosts] = useState<PostFeedDto[]>([]);
  const [bmk, setBmk] = useState<Set<number>>(new Set()); //bookmarks const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());

  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  const devHeaders = { "x-user-id": "1", "x-role": "ADMIN" }; // dev only


  useEffect(() => {
    (async () => {
      // 1) posts
      const res = await fetch(`${base}/api/posts?page=1&limit=20`, {
        headers: devHeaders,
        cache: "no-store",
      });
      if (res.ok) setPosts(await res.json());

      // 2) bookmarks (array of post_ids)
      const r2 = await fetch(`${base}/api/me/bookmarks`, {
        headers: devHeaders,
        cache: "no-store",
      });
      if (r2.ok) {
        const rows: { post_id: number }[] = await r2.json();
        setBmk(new Set(rows.map(r => r.post_id)));
      }
    })();
  }, [base]);

    async function toggleBookmark(postId: number) {
    // optimistic flip
    const next = new Set(bmk);
    const makeSaved = !next.has(postId);
    if (makeSaved) next.add(postId);
    else next.delete(postId);
    setBmk(next);

    try {
      if (makeSaved) {
        await fetch(`${base}/api/posts/${postId}/bookmark`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devHeaders },
          body: JSON.stringify({ post_id: postId }),
        });
      } else {
        await fetch(`${base}/api/posts/${postId}/bookmark`, {
          method: "DELETE",
          headers: devHeaders,
        });
      }
    } catch {
      // rollback on error
      const rb = new Set(next);
      if (makeSaved) rb.delete(postId);
      else rb.add(postId);
      setBmk(rb);
    }
  }


  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-lg font-semibold text-white">Latest Posts</h2>

      {posts.map((p) => (
        <PostRow
          key={p.post_id}
          p={p}
          value={ratings[p.post_id] ?? 7}
          onChange={(v) => setRatings((r) => ({ ...r, [p.post_id]: v }))}
          isBookmarked={bmk.has(p.post_id)}
          onToggleBookmark={() => toggleBookmark(p.post_id)}
          apiBase={base}
        />
      ))}
    </section>
  );
}

/* ---------------- Post Row ---------------- */

function PostRow({
  p,
  value,
  onChange,
  isBookmarked,
  onToggleBookmark,
  apiBase,
}: {
  p: PostFeedDto;
  value: number;
  onChange: (v: number) => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  apiBase: string;
}) {
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedTo, setSharedTo] = useState<string | null>(null);

  const imgPath = (p.image_url_censored || p.image_url_orig || "").trim();
  const imgSrc = imgPath.startsWith("/") ? `${apiBase}${imgPath}` : `${apiBase}/${imgPath}`;

  const MAX = 180;
  const TAP_TOL = 8;

  return (
    <article className="overflow-hidden rounded-2xl bg-neutral-900/60 ring-1 ring-white/10">
      {/* image + swipe-confirm (unchanged) */}
      <div className="relative">
        <img
          src={imgSrc}
          alt="car"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            const noSlash = `${apiBase}${imgPath.replace(/^\/+/, "")}`;
            if (el.src !== noSlash) el.src = noSlash;
          }}
          className="w-full object-cover transition-[filter] duration-100"
          style={{ aspectRatio: "4/3", filter: `brightness(${1 - 0.25 * ratio}) blur(${12 * ratio}px)` }}
        />

        <motion.div
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: MAX }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={(_, info) => {
            const dist = Math.max(0, Math.min(MAX, info.offset.x));
            setRatio(dist / MAX);
          }}
          onDragEnd={(_, info) => {
            const dist = Math.max(0, Math.min(MAX, info.offset.x));
            const r = dist / MAX;
            if (dist <= TAP_TOL) {
              router.push(`/post/${p.post_id}`);
              setRatio(0);
              return;
            }
            if (r >= 0.98) {
              setConfirming(true);
              // TODO: POST /api/posts/:id/rate with { score: value }
              setTimeout(() => setConfirming(false), 900);
            }
            setRatio(0);
          }}
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
          <div className="h-full bg-white/70 transition-[width]" style={{ width: `${ratio * 100}%` }} />
        </div>
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white/80 transition-opacity"
          style={{ opacity: ratio }}
        >
          {ratio >= 0.98 ? "✅ Confirmed!" : "➡️ Swipe to confirm"}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-white">
            {p.display_name ?? `User ${p.user_id}`}
          </h3>
          <div className="text-sm text-white/60">
            ⭐ <span className="text-white">{p.avg_rating ?? "—"}</span>{" "}
            <span className="text-white/50">({p.rating_count})</span>
          </div>
        </div>

        {/* --- Slider --- */}
        <div className="mt-2">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-white"
          />
          <div className="mt-1 flex justify-between text-[11px] text-white/50">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <span key={n} className={n === value ? "text-white font-semibold -translate-y-[1px]" : ""}>
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* --- Actions: Bookmark (left) + Share (right) --- */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleBookmark();
            }}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 transition-colors",
              isBookmarked
                ? "bg-amber-500/20 text-amber-300 ring-amber-400/30"
                : "bg-white/5 text-white/80 ring-white/10 hover:bg-white/10",
            ].join(" ")}
            title={isBookmarked ? "Remove bookmark" : "Save"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1z" />
            </svg>
            {isBookmarked ? "Saved" : "Save"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={async (e) => {
                e.preventDefault();
                const url = typeof window !== "undefined"
                  ? `${window.location.origin}/post/${p.post_id}`
                  : `/post/${p.post_id}`;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: "CarSpot", url });
                    setSharedTo("shared");
                  } else {
                    await navigator.clipboard.writeText(url);
                    setSharedTo("copied");
                  }
                  setShareOpen(true);
                  setTimeout(() => setShareOpen(false), 1200);
                } catch {}
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/10"
              title="Share"
            >
              <span className="text-lg">🖼️</span> Share
            </button>

            <AnimatePresence>
              {shareOpen && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-xs text-white/60"
                >
                  {sharedTo === "copied" ? "Link copied" : "Shared"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </article>
  );
}
