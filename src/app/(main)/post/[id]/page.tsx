// app/post/[id]/page.tsx  (Server Component)
import { api } from "@/lib/api";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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

function getBackendOrigin() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  return apiBase.replace(/\/api$/, "");
}

function safePath(p?: string) {
  if (!p) return "/";
  try {
    const dec = decodeURIComponent(p);
    if (dec.startsWith("/") && !dec.startsWith("//")) return dec;
  } catch {}
  return "/";
}

export default async function PostDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { from?: string };
}) {
  const post = await api<PostDto>(`/api/posts/${params.id}`);
  if (!post) return <div className="text-white/80">Post not found.</div>;

  const origin = getBackendOrigin();
  const rel = (post.image_url_censored || post.image_url_orig || "").trim();
  const src = rel.startsWith("/") ? `${origin}${rel}` : `${origin}/${rel}`;

  const backHref = safePath(searchParams?.from);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* ✅ replaced back link with arrow icon only */}
        <Link
          href={backHref}
          className="
          inline-flex h-9 w-9 items-center justify-center
          rounded-full bg-neutral-900/60 text-white
          ring-1 ring-white/10 hover:bg-white/10
          transition-colors shadow-sm backdrop-blur-sm
          "
          title="Go back"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </Link>

        <div className="text-sm text-white/70">
          ⭐{" "}
          <span className="text-white">
            {post.avg_rating != null ? post.avg_rating.toFixed(2) : "—"}
          </span>{" "}
          <span className="text-white/50">({post.rating_count})</span>
        </div>
      </div>

      <div className="rounded-2xl card ring overflow-hidden">
        <img
          src={src}
          alt="car"
          className="w-full max-h-[82vh] object-contain bg-black/40"
        />
      </div>
    </div>
  );
}
