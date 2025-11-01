"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_POSTS } from "lib/mock";

export default function AdminPostDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const post = MOCK_POSTS.find(p => p.post_id === id);
  if (!post) return notFound();

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* LEFT */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h1 className="text-sm font-semibold text-white">
            Post #{post.post_id} · by User {post.user_id}
          </h1>
          <Link href="/admin/posts" className="text-sm text-white/70 hover:text-white">Back</Link>
        </div>
        <img
          src={post.image_url_censored}
          alt=""
          className="max-h-[70vh] w-full object-contain bg-black/40"
        />
        <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-4 text-sm text-white/80">
          <div>Created: <b className="text-white/90">{post.created_at}</b></div>
          <div>Average: <b className="text-white/90">{post.avg ?? "—"}</b></div>
          <div>Ratings: <b className="text-white/90">{post.rating_count}</b></div>
          <div>Status: <Badge>{post.status}</Badge></div>
          <div>Moderation: <Badge tone={post.moderation_status === "PENDING" ? "amber" : "green"}>{post.moderation_status}</Badge></div>
        </div>
      </div>

      {/* RIGHT — actions + audit */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-semibold text-white">Moderation</div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">Approve</button>
            <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">Reject</button>
            <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">Delete</button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-semibold text-white">Audit History</div>
          <ul className="space-y-2 text-sm text-white/80">
            <li>System created post record · {post.created_at}</li>
            <li>Auto-censor applied (plate) · {post.created_at}</li>
            <li>—</li>
          </ul>
        </div>
      </div>
    </section>
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
