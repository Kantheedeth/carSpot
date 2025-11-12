"use client";

import Link from "next/link";
import { MOCK_POSTS } from "lib/mock";

export default function AdminPosts() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Admin · Posts</h1>
        <div className="text-sm text-white/60">{MOCK_POSTS.length} total</div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-white/70">
            <tr>
              <Th>ID</Th>
              <Th>Image</Th>
              <Th>User</Th>
              <Th>Avg</Th>
              <Th>Ratings</Th>
              <Th>Status</Th>
              <Th>Moderation</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {MOCK_POSTS.map(p => (
              <tr key={p.post_id} className="text-white/90">
                <Td>#{p.post_id}</Td>
                <Td>
                  <img src={p.image_url_censored} className="h-12 w-20 rounded object-cover" />
                </Td>
                <Td>#{p.user_id} {p.display_name ? `· ${p.display_name}` : ""}</Td>
                <Td>{p.avg ?? "—"}</Td>
                <Td>{p.rating_count}</Td>
                <Td>
                  <Badge>{p.status}</Badge>
                </Td>
                <Td>
                  <Badge tone={p.moderation_status === "PENDING" ? "amber" : p.moderation_status === "REJECTED" ? "red" : "green"}>
                    {p.moderation_status}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/posts/${p.post_id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">View</Link>
                    <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">Approve</button>
                    <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">Reject</button>
                    <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">Delete</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-middle">{children}</td>;
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
