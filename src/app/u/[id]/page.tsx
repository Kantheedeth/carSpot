import Link from "next/link";
import { MOCK_USERSTATS, MOCK_POSTS } from "lib/mock";

export default function ProfilePage({
  params: { id },
}: {
  params: { id: string };
}) {
  const uid = Number(id);
  const me = uid === 1; // demo: user #1 is "You"
  const stats = MOCK_USERSTATS(uid);
  const posts = MOCK_POSTS.filter((p) => p.user_id === uid);

  const initials =
    (stats.display_name ?? "U")
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("") || "U";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header card */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 ring-1 ring-white/10">
        {/* banner */}
        <div className="h-28 w-full bg-[radial-gradient(circle_at_20%_20%,rgba(163,230,53,.25),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,.12),transparent_55%)]" />
        {/* content */}
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          {/* left */}
          <div className="flex items-center gap-4">
            {/* avatar */}
            <div className="grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-semibold text-white shadow-inner">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                {stats.display_name}
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

          {/* right / actions */}
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

      {/* Posts grid */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/60">
          Posts
        </h2>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-6 text-center text-white/70">
            No posts yet.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {posts.map((p) => (
              <li key={p.post_id}>
                <Link
                  href={`/post/${p.post_id}`}
                  className="group block overflow-hidden rounded-xl border border-white/10 bg-neutral-900/50 ring-1 ring-white/10"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={p.image_url_censored}
                      alt="car"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="text-white/80">
                      ⭐ <span className="text-white">{p.avg ?? "—"}</span>{" "}
                      <span className="text-white/50">({p.rating_count})</span>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        p.moderation_status === "PASSED"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : p.moderation_status === "PENDING"
                          ? "bg-yellow-500/15 text-yellow-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {p.moderation_status.toLowerCase()}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>  
  );        {/* ✅ closes return */}
}            {/* ✅ closes ProfilePage function */}

/* small pieces */
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
