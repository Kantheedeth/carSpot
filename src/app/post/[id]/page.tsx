import { api } from "@/lib/api";
import Link from "next/link";

type PostDto = {
  post_id: number;
  user_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  moderation_status: "PENDING" | "PASSED" | "REJECTED";
  status: "PENDING" | "PUBLISHED" | "DELETED";
  flagged: number;
  score_sum: number;
  rating_count: number;
  avg_rating: number | null;
  created_at: string;
};

export default async function PostDetail({ params }: { params: { id: string } }) {
  const post = await api<PostDto>(`/api/posts/${params.id}`);

  if (!post) return <div className="text-white/80">Post not found.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-white/70 hover:text-white">
          ← Back to feed
        </Link>
        <div className="text-sm text-white/70">
          ⭐ <span className="text-white">
            {post.avg_rating != null ? post.avg_rating.toFixed(2) : "—"}
          </span>{" "}
          <span className="text-white/50">({post.rating_count})</span>
        </div>
      </div>

      <div className="rounded-2xl card ring overflow-hidden">
        <img
          src={post.image_url_censored || post.image_url_orig}
          alt="car"
          className="w-full max-h-[82vh] object-contain bg-black/40"
        />
      </div>
    </div>
  );
}
