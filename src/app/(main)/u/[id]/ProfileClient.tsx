// app/u/[id]/ProfileClient.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";

type UserStats = {
  user_id: number;
  display_name: string | null;
  status: "ACTIVE" | "BANNED" | "DELETED";
  post_count: number;
  follower_count: number;
  following_count: number;
  bookmark_count: number;
  successful_matches: number;
  eligible_to_post: boolean;
  remaining_to_post: number;
  last_checked: string | null;
};

type UserPost = {
  post_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  created_at: string;
  avg_rating: number | null;
  rating_count: number;
};

export default function ProfileClient({
  id,
  stats,
  posts,
  meId,
}: {
  id: string;
  stats: UserStats;
  posts: UserPost[];
  meId?: number;            // 👈 new
}) {
  const uid = Number(id);
  const me = meId === uid;  // 👈 real "is this my profile?"

  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  const origin = apiBase.replace(/\/api$/, "");

  const initials = useMemo(() => {
    const name = stats.display_name ?? `User ${uid}`;
    return (
      name
        .trim()
        .split(/\s+/)
        .map((s) => s[0]?.toUpperCase() || "")
        .slice(0, 2)
        .join("") || "U"
    );
  }, [stats.display_name, uid]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header card */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 ring-1 ring-white/10">
        <div className="h-28 w-full bg-[radial-gradient(circle_at_20%_20%,rgba(163,230,53,.25),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,.12),transparent_55%)]" />
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-semibold text-white shadow-inner">
              {initials}
            </div>
            <div>
              {/* 👇 uses display_name from API */}
              <h1 className="text-xl font-semibold text-white">
                {stats.display_name ?? `User ${uid}`}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-white/70">
                <StatPill label="Posts" value={stats.post_count} />
                <Dot />
                <StatPill label="Followers" value={stats.follower_count} />
                <Dot />
                <StatPill label="Following" value={stats.following_count} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {me ? (
              <Link
                href="/settings"
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
              >
                Edit profile
              </Link>
            ) : (
              <>
                <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:opacity-90">
                  Follow
                </button>
                <Link
                  href="/messages"
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
                >
                  Message
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Posts grid (unchanged) */}
      {/* ...your existing posts rendering stays the same... */}
      {/* I’ll leave that part exactly as you had it */}
      {posts.length === 0 ? (
        <section className="rounded-2xl border border-white/10 bg-neutral-900/50 p-6 text-center text-white/70">
          No posts yet.
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/60">
            Posts
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {posts.map((p) => {
              const rel =
                (p.image_url_censored || p.image_url_orig || "").trim();
              const src = rel.startsWith("/")
                ? `${origin}${rel}`
                : `${origin}/${rel}`;

              return (
                <li key={p.post_id}>
                  <Link
                    href={{
                      pathname: `/post/${p.post_id}`,
                      query: { from: `/u/${id}` },
                    }}
                    className="group block overflow-hidden rounded-xl border border-white/10 bg-neutral-900/50 ring-1 ring-white/10"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={src}
                        alt="car"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          const noSlash = `${origin}${rel.replace(/^\/+/, "")}`;
                          if (el.src !== noSlash) el.src = noSlash;
                        }}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="text-white/80">
                        ⭐{" "}
                        <span className="text-white">
                          {p.avg_rating ?? "—"}
                        </span>{" "}
                        <span className="text-white/50">
                          ({p.rating_count})
                        </span>
                      </div>
                      <div className="text-white/40 text-[11px]">
                        {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/80">
      {label} <b className="text-white">{value}</b>
    </span>
  );
}
function Dot() {
  return <span className="mx-1 text-white/30">•</span>;
}
