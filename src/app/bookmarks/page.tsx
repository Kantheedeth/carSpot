import Link from "next/link";
import { MOCK_BOOKMARKS, MOCK_POSTS } from "lib/mock";

export default function BookmarksPage() {
  const posts = MOCK_POSTS.filter((p) => MOCK_BOOKMARKS.includes(p.post_id));

  if (posts.length === 0) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
          No bookmarks yet. Start saving your favorite cars!
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <Link
          key={p.post_id}
          href={`/post/${p.post_id}`}
          className="
            group overflow-hidden rounded-2xl
            bg-neutral-900/60 ring-1 ring-white/10
            hover:bg-white/5 transition-colors
          "
        >
          {/* taller and smoother image ratio */}
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src={p.image_url_censored}
              alt="car"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>

          {/* bottom info */}
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <div className="text-white/70">
              ⭐ <span className="text-white">{p.avg ?? "—"}</span>
              <span className="text-white/50"> ({p.rating_count})</span>
            </div>
            <div className="text-[11px] text-white/40">#{p.post_id}</div>
          </div>
        </Link>
      ))}
    </section>
  );
}
