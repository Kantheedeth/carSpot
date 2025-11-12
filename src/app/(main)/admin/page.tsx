"use client";

import Link from "next/link";
import { MOCK_POSTS, MOCK_USERSTATS } from "lib/mock";

export default function AdminDashboard() {
  const totalPosts = MOCK_POSTS.length;
  const pending = MOCK_POSTS.filter(p => p.moderation_status === "PENDING").length;
  const rejected = MOCK_POSTS.filter(p => p.moderation_status === "REJECTED").length;
  const published = MOCK_POSTS.filter(p => p.status === "PUBLISHED").length;

  const users = Array.from(new Set(MOCK_POSTS.map(p => p.user_id)));
  const avgAll =
    Math.round(
      (100 *
        (MOCK_POSTS.reduce((acc, p) => acc + (p.avg ?? 0), 0) /
          Math.max(1, MOCK_POSTS.filter(p => p.avg != null).length))) /
        100
    * 100) / 100 || 0;

  const flagged = MOCK_POSTS.filter(
    p =>
      p.moderation_status === "PENDING" ||
      p.avg == null ||
      p.rating_count === 0
  );

  return (
    <section className="space-y-6">
      <Header title="Admin · Dashboard" subtitle="Overview, moderation queue, recent audit events." />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={totalPosts} />
        <StatCard label="Published" value={published} />
        <StatCard label="Pending Review" value={pending} />
        <StatCard label="Avg. Rating" value={avgAll.toFixed(2)} />
      </div>

      {/* Flagged / Queue */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Moderation Queue</h2>
            <Link className="text-sm text-white/70 hover:text-white" href="/admin/posts">View all →</Link>
          </div>

          {flagged.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-white/60">Nothing flagged 🎉</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {flagged.map(p => (
                <li key={p.post_id} className="flex items-center gap-3 px-4 py-3">
                  <img
                    src={p.image_url_censored}
                    alt=""
                    className="h-14 w-20 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/posts/${p.post_id}`}
                        className="truncate text-sm font-medium text-white hover:underline"
                      >
                        Post #{p.post_id}
                      </Link>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                        {p.moderation_status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-white/60">
                      by User {p.user_id} • {p.created_at} • ⭐ {p.avg ?? "—"} ({p.rating_count})
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10">Approve</button>
                    <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10">Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Audit feed (mock) */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Audit History</h2>
          </div>
          <ul className="divide-y divide-white/10">
            {[
              "System: recalculated averages",
              "Mod Anna: approved Post #2",
              "Mod Ken: rejected Post #7",
              "System: reset posting eligibility for User 3",
            ].map((t, i) => (
              <li key={i} className="px-4 py-3 text-sm text-white/80">
                {t}
                <div className="text-xs text-white/50">~ just now</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
