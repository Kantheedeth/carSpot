"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { MOCK_POSTS } from "lib/mock";

type Ratings = Record<number, number>;

const FRIENDS = [
  { id: 1, name: "Aom", avatar: "🧋" },
  { id: 2, name: "Bank", avatar: "🚀" },
  { id: 3, name: "Chan", avatar: "🎧" },
  { id: 4, name: "Dao", avatar: "🌙" },
  { id: 5, name: "Film", avatar: "📷" },
  { id: 6, name: "Game", avatar: "🎮" },
  { id: 7, name: "Ice", avatar: "🧊" },
  { id: 8, name: "June", avatar: "☀️" },
  { id: 9, name: "Kate", avatar: "🐱" },
  { id: 10, name: "Mike", avatar: "🛠" },
];

export default function FeedPage() {
  const [ratings, setRatings] = useState<Ratings>({});

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-lg font-semibold text-white">Latest Posts</h2>

      {MOCK_POSTS.map((p) => (
        <PostRow
          key={p.post_id}
          p={p}
          value={ratings[p.post_id] ?? 7}
          onChange={(v) =>
            setRatings((r) => ({
              ...r,
              [p.post_id]: v,
            }))
          }
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
  p: typeof MOCK_POSTS[number];
  value: number;
  onChange: (v: number) => void;
}) {
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [ratio, setRatio] = useState(0); // 0..1 drag progress for blur
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedTo, setSharedTo] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  const pct = ((value - 1) / 9) * 100;

  // swipe thresholds
  const MAX = 180; // distance to fully confirm
  const TAP_TOL = 8; // <= px = treat as tap

  return (
    <article className="overflow-hidden rounded-2xl bg-neutral-900/60 ring-1 ring-white/10">
      {/* Image + swipe-to-confirm overlay */}
      <div className="relative">
        <img
          src={p.image_url_censored}
          alt="car"
          className="w-full object-cover transition-[filter] duration-100"
          style={{
            aspectRatio: "4 / 3",
            filter: `brightness(${1 - 0.25 * ratio}) blur(${12 * ratio}px)`,
          }}
        />

        {/* Transparent gesture layer */}
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

            // tiny tap => view full
            if (dist <= TAP_TOL) {
              router.push(`/post/${p.post_id}`);
              setRatio(0);
              return;
            }

            // full swipe => confirm save
            if (r >= 0.98) {
              setConfirming(true);
              // TODO: call API to persist rating (p.post_id, value)
              setTimeout(() => setConfirming(false), 900);
            }

            setRatio(0);
          }}
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />

        {/* progress indicator for swipe */}
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
          <div
            className="h-full bg-white/70 transition-[width]"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>

        {/* helper / confirmation text */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white/80 transition-opacity"
          style={{ opacity: ratio }}
        >
          {ratio >= 0.98 ? "✅ Confirmed!" : "➡️ Swipe to confirm"}
        </div>
      </div>

      {/* Below photo */}
      <div className="px-4 pb-4 pt-3">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-white">
            {p.display_name ?? `User ${p.post_id}`}
          </h3>
          <div className="text-sm text-white/60">
            ⭐ <span className="text-white">{p.avg ?? "—"}</span>{" "}
            <span className="text-white/50">({p.rating_count})</span>
          </div>
        </div>

        {/* Rating slider */}
        <div className="relative">
          <div
            className="pointer-events-none absolute -top-7 translate-x-[-50%] rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-black"
            style={{ left: `calc(${pct}% )` }}
          >
            {value}
          </div>

          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="w-full accent-white"
            aria-label="Rating from 1 to 10"
          />

          <div className="mt-1 grid grid-cols-10 text-[11px] text-white/50">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <span key={n} className="text-center">
                {n}
              </span>
            ))}
          </div>

          {confirming && (
            <div className="mt-3 inline-flex items-center rounded-full bg-white/10 px-2 py-1 text-xs text-white/90">
              Rating saved
            </div>
          )}
          {sharedTo && (
            <div className="mt-3 ml-2 inline-flex items-center rounded-full bg-white/10 px-2 py-1 text-xs text-white/90">
              Sent to {sharedTo}
            </div>
          )}
        </div>

        {/* Actions row: Share + Bookmark */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setShareOpen((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/5"
            aria-expanded={shareOpen}
          >
            <span className="text-[18px] leading-none">📤</span>
            <span>Share</span>
          </button>

          <button
            onClick={() => setBookmarked((b) => !b)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[18px] leading-none transition
              ${bookmarked ? "bg-white/10" : "hover:bg-white/5"}`}
            aria-pressed={bookmarked}
            title={bookmarked ? "Bookmarked" : "Bookmark"}
          >
            {bookmarked ? "🔖" : "🔖"}
          </button>
        </div>

        {/* Friend picker — slides open after Share */}
        <AnimatePresence initial={false}>
          {shareOpen && (
            <motion.div
              key="sharebar"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
            >
              <div className="flex items-center gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {FRIENDS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setSharedTo(f.name);
                      setShareOpen(false);
                      // TODO: call API to send post p.post_id to friend f.id
                      setTimeout(() => setSharedTo(null), 1200);
                    }}
                    className="flex min-w-[56px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-xs text-white/80 hover:bg-white/5"
                    title={`Send to ${f.name}`}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-lg">
                      {f.avatar}
                    </span>
                    <span className="max-w-[64px] truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}
