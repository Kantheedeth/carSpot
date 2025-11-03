"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { img } from "framer-motion/client";
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

  useEffect(() => {
    const load = async () => {
      const base = process.env.NEXT_PUBLIC_API_BASE!;
      const res = await fetch(`${base}/api/posts?page=1&limit=20`, {
        headers: { "x-user-id": "1", "x-role": "ADMIN" }, // temp dev
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(await res.text());
        return;
      }
      const data = (await res.json()) as PostFeedDto[];
      setPosts(data);
    };
    load();
  }, []);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-lg font-semibold text-white">Latest Posts</h2>

      {posts.map((p) => (
        <PostRow
          key={p.post_id}
          p={p}
          value={ratings[p.post_id] ?? 7}
          onChange={(v) => setRatings((r) => ({ ...r, [p.post_id]: v }))}
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
}: {
  p: PostFeedDto; // ← use the API dto
  value: number;
  onChange: (v: number) => void;
}) {
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedTo, setSharedTo] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, ""); 
  const imgPath = (p.image_url_censored || p.image_url_orig || "").trim();
  const imgSrc = imgPath.startsWith("/") ? `${base}${imgPath}` : `${base}/${imgPath}`;




  const pct = ((value - 1) / 9) * 100;
  const MAX = 180;
  const TAP_TOL = 8;

  return (
    <article className="overflow-hidden rounded-2xl bg-neutral-900/60 ring-1 ring-white/10">
      <div className="relative">
        <img
          src={imgSrc}
          alt="car"
          onError={(e) => {
            console.warn("Image failed:", (e.target as HTMLImageElement).src);
            const noSlash = `${base}${imgPath.replace(/^\/+/, "")}`;
            if ((e.target as HTMLImageElement).src !== noSlash) {
              (e.target as HTMLImageElement).src = noSlash; // fallback try
            }
          }}
          className="w-full object-cover transition-[filter] duration-100"
          style={{
            aspectRatio: "4 / 3",
            filter: `brightness(${1 - 0.25 * ratio}) blur(${12 * ratio}px)`,
          }}
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
          <div
            className="h-full bg-white/70 transition-[width]"
            style={{ width: `${ratio * 100}%` }}
          />
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

        {/* …keep the rest of your slider / actions UI unchanged… */}
        {/* (uses value/onChange, confirming, share, etc.) */}
      </div>
    </article>
  );
}
