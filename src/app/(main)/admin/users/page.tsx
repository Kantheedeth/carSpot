"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "../AdminGuard";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");

type AdminUser = {
  user_id: number;
  display_name: string | null;
  email: string | null;
  status: string;
  created_at: string;
  post_count: number;
  follower_count: number;
  following_count: number;
  bookmark_count: number;
  successful_matches: number;
  eligible_to_post: boolean;
  remaining_to_post: number;
  last_checked: string | null;
  is_admin: boolean;
};

type UsersResponse = {
  page: number;
  limit: number;
  total: number;
  rows: AdminUser[];
};

export default function AdminUsers() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("created_desc");

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (sort) params.set("sort", sort);
        const res = await fetch(`${API_BASE}/api/admin/users?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(res.status === 403 ? "Admin access denied" : "Failed to load users");
        }
        const body: UsersResponse = await res.json();
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load users");
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
  }, [page, search, statusFilter, sort]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.limit));
  }, [data]);

  return (
    <AdminGuard>
      <section className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-white">Admin · Users</h1>
            <div className="text-sm text-white/60">
              {data ? `${data.total} total` : loading ? "Loading…" : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-3 text-sm text-white/80">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search users"
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
              <option value="ACTIVE">Active</option>
              <option value="BANNED">Banned</option>
              <option value="DELETED">Deleted</option>
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
              <option value="posts_desc">Most posts</option>
              <option value="posts_asc">Fewest posts</option>
            </select>
            {(search || statusFilter) && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setStatusFilter("");
                }}
                className="rounded-lg border border-white/15 px-3 py-2"
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
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Posts</Th>
                <Th>Eligible</Th>
                <Th>Remaining</Th>
                <Th>Followers</Th>
                <Th>Following</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <Td colSpan={9}>
                    <div className="py-8 text-center text-white/60">Loading users…</div>
                  </Td>
                </tr>
              ) : !data || data.rows.length === 0 ? (
                <tr>
                  <Td colSpan={9}>
                    <div className="py-8 text-center text-white/60">No users found.</div>
                  </Td>
                </tr>
              ) : (
                data.rows.map((u) => (
                  <tr key={u.user_id} className="text-white/90">
                    <Td>#{u.user_id}</Td>
                    <Td>
                      <div className="font-medium text-white">{u.display_name ?? `User ${u.user_id}`}</div>
                      <div className="text-xs text-white/60">{u.email ?? "no email"}</div>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          u.status === "ACTIVE"
                            ? "green"
                            : u.status === "BANNED"
                            ? "red"
                            : "slate"
                        }
                      >
                        {u.status}
                      </Badge>
                    </Td>
                    <Td>{u.post_count}</Td>
                    <Td>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] ${u.eligible_to_post ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/70"}`}
                      >
                        {u.eligible_to_post ? "Yes" : "No"}
                      </span>
                    </Td>
                    <Td>{u.remaining_to_post}</Td>
                    <Td>{u.follower_count}</Td>
                    <Td>{u.following_count}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/u/${u.user_id}`}
                          className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
                        >
                          View
                        </Link>
                      </div>
                    </Td>
                  </tr>
                ))
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
    <td colSpan={colSpan} className="px-3 py-2 align-middle">
      {children}
    </td>
  );
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "red" }) {
  const map = {
    slate: "bg-white/10 text-white/80",
    green: "bg-emerald-500/15 text-emerald-200",
    red: "bg-rose-500/15 text-rose-200",
  } as const;
  return <span className={`rounded px-2 py-0.5 text-[11px] ${map[tone]}`}>{children}</span>;
}
