"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "../AdminGuard";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
const ORIGIN = API_BASE.replace(/\/api$/, "");

type AdminPost = {
  post_id: number;
  user_id: number;
  display_name: string | null;
  image_url_orig: string | null;
  image_url_censored: string | null;
  status: "PUBLISHED" | "PENDING" | "DELETED";
  moderation_status: "PENDING" | "PASSED" | "REJECTED";
  rating_count: number;
  avg_rating: number | null;
  created_at: string;
};

type PostsResponse = {
  page: number;
  limit: number;
  total: number;
  rows: AdminPost[];
};

export default function AdminPosts() {
  const [data, setData] = useState<PostsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [moderationFilter, setModerationFilter] = useState(""
  );
  const [sort, setSort] = useState("created_desc");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.limit));
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (statusFilter) params.set("status", statusFilter);
        if (moderationFilter) params.set("moderation", moderationFilter);
        if (search) params.set("search", search);
        if (sort) params.set("sort", sort);

        const res = await fetch(`${API_BASE}/api/admin/posts?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(res.status === 403 ? "Admin access denied" : "Failed to load posts");
        }
        const body: PostsResponse = await res.json();
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load posts");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, statusFilter, moderationFilter, sort, search]);

  const resolveImage = (path: string | null) => {
    if (!path) return null;
    return path.startsWith("/") ? `${ORIGIN}${path}` : `${ORIGIN}/${path}`;
  };

  return (
    <AdminGuard>
      <section className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-white">Admin · Posts</h1>
            <div className="text-sm text-white/60">
              {data ? `${data.total} total` : loading ? "Loading…" : ""}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-3 text-sm text-white/80">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search posts or users"
              className="flex-1 min-w-[200px] rounded-lg bg-black/30 px-3 py-2 text-white placeholder:text-white/50"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg bg-black/30 px-3 py-2"
            >
              <option value="">All statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="PENDING">Pending</option>
              <option value="DELETED">Deleted</option>
            </select>
            <select
              value={moderationFilter}
              onChange={(e) => {
                setModerationFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg bg-black/30 px-3 py-2"
            >
              <option value="">All moderation</option>
              <option value="PASSED">Passed</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="rounded-lg bg-black/30 px-3 py-2"
            >
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="ratings_desc">Most ratings</option>
              <option value="ratings_asc">Fewest ratings</option>
            </select>
            {(statusFilter || moderationFilter || search) && (
              <button
                onClick={() => {
                  setStatusFilter("");
                  setModerationFilter("");
                  setSearchInput("");
                }}
                className="rounded-lg border border-white/15 px-3 py-2 text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-950/40 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

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
              {loading ? (
                <tr>
                  <Td colSpan={8}>
                    <div className="py-8 text-center text-white/60">Loading posts…</div>
                  </Td>
                </tr>
              ) : !data || data.rows.length === 0 ? (
                <tr>
                  <Td colSpan={8}>
                    <div className="py-8 text-center text-white/60">No posts found.</div>
                  </Td>
                </tr>
              ) : (
                data.rows.map((p) => {
                  const img = resolveImage(p.image_url_censored || p.image_url_orig);
                  return (
                    <tr key={p.post_id} className="text-white/90">
                      <Td>#{p.post_id}</Td>
                      <Td>
                        {img ? (
                          <img src={img} className="h-12 w-20 rounded object-cover" alt="" />
                        ) : (
                          <div className="h-12 w-20 rounded bg-white/5" />
                        )}
                      </Td>
                      <Td>
                        #{p.user_id} {p.display_name ? `· ${p.display_name}` : ""}
                      </Td>
                      <Td>{p.avg_rating != null ? p.avg_rating.toFixed(2) : "—"}</Td>
                      <Td>{p.rating_count}</Td>
                      <Td>
                        <Badge>{p.status}</Badge>
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            p.moderation_status === "PENDING"
                              ? "amber"
                              : p.moderation_status === "REJECTED"
                              ? "red"
                              : "green"
                          }
                        >
                          {p.moderation_status}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/posts/${p.post_id}`}
                            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
                          >
                            View
                          </Link>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > data.limit && (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-neutral-900/60 p-3 text-sm text-white/80">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-white/15 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <div>
              Page {page} / {totalPages}
            </div>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-white/15 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </AdminGuard>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}
function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td className="px-3 py-2 align-middle" colSpan={colSpan}>
      {children}
    </td>
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
