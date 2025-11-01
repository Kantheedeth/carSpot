"use client";
import Link from "next/link";
import { MOCK_POSTS } from "lib/mock";

export default function PostDetail({ params }: { params: { id: string } }) {
  const post = MOCK_POSTS.find((p) => String(p.post_id) === params.id);
  if (!post) return <div className="text-white/80">Post not found.</div>;

  return (
    <div className="space-y-4">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-white/70 hover:text-white">
          ← Back to feed
        </Link>
        <div className="text-sm text-white/70">
          ⭐ <span className="text-white">{post.avg ?? "—"}</span>{" "}
          <span className="text-white/50">({post.rating_count})</span>
        </div>
      </div>

      {/* full-bleed image in a dark frame */}
      <div className="rounded-2xl card ring overflow-hidden">
        <img
          src={post.image_url_censored}
          alt="car"
          className="w-full max-h-[82vh] object-contain bg-black/40"
        />
      </div>
    </div>
  );
}
