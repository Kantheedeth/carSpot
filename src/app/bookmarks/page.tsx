// app/bookmarks/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SavedRow = {
  post_id: number;
  image_url_orig: string;
  created_at: string;
  avg_rating: number | null;   // from SELECT (p.score_sum/NULLIF(...)) AS avg_rating
  rating_count: number;
};

export default function BookmarksPage() {
  const [rows, setRows] = useState<SavedRow[] | null>(null);
  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  const devHeaders = { "x-user-id": "1", "x-role": "ADMIN" }; // dev only

  useEffect(() => {
    (async () => {
      const res = await fetch(`${base}/api/me/bookmarks`, {
        headers: devHeaders,
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(await res.text());
        setRows([]);
        return;
      }
      setRows(await res.json());
    })();
  }, [base]);

  if (rows === null) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
          Loading your bookmarks…
        </div>
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
          No bookmarks yet. Start saving your favorite cars!
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((p) => {
        const path = (p.image_url_orig || "").trim();
        const src = path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
        return (
          <Link
            key={p.post_id}
            href={`/post/${p.post_id}`}
            className="group overflow-hidden rounded-2xl bg-neutral-900/60 ring-1 ring-white/10 hover:bg-white/5 transition-colors"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={src}
                alt="car"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  const noSlash = `${base}${path.replace(/^\/+/, "")}`;
                  if (el.src !== noSlash) el.src = noSlash;
                }}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="text-white/70">
                ⭐ <span className="text-white">{p.avg_rating ?? "—"}</span>
                <span className="text-white/50"> ({p.rating_count})</span>
              </div>
              <div className="text-[11px] text-white/40">#{p.post_id}</div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
