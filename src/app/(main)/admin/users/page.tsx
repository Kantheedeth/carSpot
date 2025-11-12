"use client";

import Link from "next/link";
import { MOCK_POSTS, MOCK_USERSTATS } from "lib/mock";
import AdminGuard from "../AdminGuard";

type Row = {
  user_id: number;
  name: string;
  posts: number;
  eligible: boolean;
  remaining: number;
  followers: number;
  following: number;
  bookmarks: number;
};

export default function AdminUsers() {
  // Synthesize user list from your mocks
  const userIds = Array.from(new Set(MOCK_POSTS.map(p => p.user_id)));
  const rows: Row[] = userIds.map(uid => {
    const s = MOCK_USERSTATS(uid);
    return {
      user_id: uid,
      name: s.display_name,
      posts: s.post_count,
      eligible: s.eligible_to_post,
      remaining: s.remaining_to_post,
      followers: s.follower_count,
      following: s.following_count,
      bookmarks: s.bookmark_count,
    };
  });

  return (
    <AdminGuard>
      <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Admin · Users</h1>
        <div className="text-sm text-white/60">{rows.length} users</div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-white/70">
            <tr>
              <Th>ID</Th>
              <Th>Name</Th>
              <Th>Posts</Th>
              <Th>Eligible</Th>
              <Th>Remaining</Th>
              <Th>Followers</Th>
              <Th>Following</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map(u => (
              <tr key={u.user_id} className="text-white/90">
                <Td>#{u.user_id}</Td>
                <Td>{u.name}</Td>
                <Td>{u.posts}</Td>
                <Td>
                  <span className={`rounded px-2 py-0.5 text-[11px] ${u.eligible ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/70"}`}>
                    {u.eligible ? "Yes" : "No"}
                  </span>
                </Td>
                <Td>{u.remaining}</Td>
                <Td>{u.followers}</Td>
                <Td>{u.following}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/u/${u.user_id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">View</Link>
                    <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">Reset Eligible</button>
                    <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">Ban</button>
                    <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">Delete (keep ratings)</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </section>
    </AdminGuard>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-middle">{children}</td>;
}
