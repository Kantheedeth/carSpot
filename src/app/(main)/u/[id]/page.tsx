// app/u/[id]/page.tsx
import { cookies } from "next/headers";
import ProfileClient from "./ProfileClient";

export default async function Page({ params }: { params: { id: string } }) {
  const base = process.env.NEXT_PUBLIC_API_BASE!.replace(/\/+$/, "");

  const cookieStore = await cookies();
  const token = cookieStore.get("carspot_token")?.value;

  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };

  const [statsRes, postsRes, meRes] = await Promise.all([
    fetch(`${base}/api/users/${params.id}/stats`, { headers, cache: "no-store" }),
    fetch(`${base}/api/users/${params.id}/posts`, { headers, cache: "no-store" }),
    fetch(`${base}/api/auth/me`, { headers, cache: "no-store" }),
  ]);

  const rawStats = await statsRes.json();
  const rawPosts = await postsRes.json();

  // 🔹 stats can be:
  //  - direct row
  //  - { ok, stats }
  //  - [row]
  const stats =
    rawStats?.stats ??
    (Array.isArray(rawStats) ? rawStats[0] : rawStats);

  // 🔹 posts can be:
  //  - [rows]
  //  - { ok, posts: [rows] }
  const posts = Array.isArray(rawPosts)
    ? rawPosts
    : Array.isArray(rawPosts?.posts)
    ? rawPosts.posts
    : [];

  let meId: number | undefined;
  if (meRes.ok) {
    const meJson = await meRes.json().catch(() => null);
    if (meJson?.user?.user_id) {
      meId = meJson.user.user_id;
    }
  }

  return (
    <ProfileClient
      id={params.id}
      stats={stats}
      posts={posts}
      meId={meId}
    />
  );
}
