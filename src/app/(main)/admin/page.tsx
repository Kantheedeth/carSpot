"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "./AdminGuard";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
const ORIGIN = API_BASE.replace(/\/api$/, "");

type DashboardSummary = {
  total_posts: number;
  active_users: number;
  pending_reviews: number;
  active_posts: number;
  new_users_7d: number;
  new_posts_7d: number;
};

type QueueEntry = {
  post_id: number;
  user_id: number;
  display_name: string | null;
  image_url_orig: string | null;
  image_url_censored: string | null;
  status: string;
  moderation_status: string;
  rating_count: number;
  avg_rating: number | null;
  created_at: string;
  flagged: number;
};

type RatingEntry = {
  rating_id: number;
  user_id: number;
  post_id: number;
  score: number;
  created_at: string;
  rater_display_name: string | null;
  post_owner_id: number | null;
  post_owner_display_name: string | null;
};

type DashboardResponse = {
  summary: DashboardSummary;
  queue: QueueEntry[];
  ratings: RatingEntry[];
  user_activity: { day: string; count: number }[];
};

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

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(res.status === 403 ? "Admin access denied" : "Failed to load dashboard");
        }

        const body: DashboardResponse = await res.json();
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setUserLoading(true);
      setUserError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/users?limit=20`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(res.status === 403 ? "Admin access denied" : "Failed to load users");
        }
        const body = await res.json();
        if (!cancelled) {
          setUsers(body.rows ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setUserError(err instanceof Error ? err.message : "Failed to load users");
          setUsers([]);
        }
      } finally {
        if (!cancelled) setUserLoading(false);
      }
    }

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = data?.summary;
  const queue = data?.queue ?? [];
  const ratings = data?.ratings ?? [];
  const activity = data?.user_activity ?? [];

  async function mutateUser(
    userId: number,
    action: "grant" | "revoke" | "delete"
  ) {
    const endpoint =
      action === "grant"
        ? `/api/admin/users/${userId}/grant-admin`
        : action === "revoke"
        ? `/api/admin/users/${userId}/revoke-admin`
        : `/api/admin/users/${userId}/delete`;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Action failed");
      }

      setUsers((prev) =>
        prev.map((user) => {
          if (user.user_id !== userId) return user;
          if (action === "grant") {
            return { ...user, is_admin: true };
          }
          if (action === "revoke") {
            return { ...user, is_admin: false };
          }
          return { ...user, status: "DELETED", is_admin: false };
        })
      );
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Action failed, please try again."
      );
    }
  }

  const stats = useMemo(
    () => [
      { label: "Total Posts", value: summary?.total_posts ?? "—" },
      { label: "Active Posts", value: summary?.active_posts ?? "—" },
      { label: "Pending Posts", value: summary?.pending_reviews ?? "—" },
      { label: "Active Users", value: summary?.active_users ?? "—" },
    ],
    [summary]
  );

  const activitySeries = useMemo(() => {
    const map = new Map(activity.map((entry) => [entry.day, entry.count]));
    const today = new Date();
    return Array.from({ length: 14 }, (_, idx) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (13 - idx));
      const key = d.toISOString().slice(0, 10);
      return {
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: map.get(key) ?? 0,
      };
    });
  }, [activity]);
  const maxActivity = Math.max(1, ...activitySeries.map((p) => p.value));

  const resolveImage = (path: string | null) => {
    if (!path) return null;
    return path.startsWith("/") ? `${ORIGIN}${path}` : `${ORIGIN}/${path}`;
  };

  return (
    <AdminGuard>
      <section className="space-y-6">
        <Header title="Admin · Dashboard" subtitle="Overview, moderation queue, recent audit events." />

        {error && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-950/40 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-center text-white/70">
            Loading dashboard…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((s) => (
                <StatCard key={s.label} label={s.label} value={s.value} />
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">New Users · Last 14 Days</h2>
                <span className="text-xs text-white/60">Daily sign-ups</span>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {activitySeries.map((point) => {
                  const height = (point.value / maxActivity) * 120;
                  return (
                    <div key={point.label} className="flex flex-col items-center text-[11px] text-white/60">
                      <div
                        className="mb-1 w-4 rounded bg-white/30"
                        style={{ height: `${height}px` }}
                        title={`${point.value} sign-ups`}
                      ></div>
                      <span className="rotate-0 whitespace-nowrap">{point.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h2 className="text-sm font-semibold text-white">Moderation Queue</h2>
                  <Link className="text-sm text-white/70 hover:text-white" href="/admin/posts">
                    View all →
                  </Link>
                </div>

                {queue.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-white/60">Nothing flagged 🎉</div>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {queue.map((p) => {
                      const img = resolveImage(p.image_url_censored || p.image_url_orig);
                      return (
                        <li key={p.post_id} className="flex items-center gap-3 px-4 py-3">
                          {img ? (
                            <img src={img} alt="" className="h-14 w-20 rounded object-cover" />
                          ) : (
                            <div className="h-14 w-20 rounded bg-white/5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/admin/posts/${p.post_id}`}
                                className="truncate text-sm font-medium text-white hover:underline"
                              >
                                Post #{p.post_id}
                              </Link>
                              <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                                {p.moderation_status}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-white/60">
                              by {p.display_name ?? `User ${p.user_id}`} •{" "}
                              {new Date(p.created_at).toLocaleString()} • ⭐{" "}
                              {p.avg_rating != null ? p.avg_rating.toFixed(2) : "—"} ({p.rating_count}) • 🚩{" "}
                              {p.flagged ?? 0}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
                <div className="border-b border-white/10 px-4 py-3">
                  <h2 className="text-sm font-semibold text-white">Recent Ratings</h2>
                </div>
                {ratings.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-white/60">
                    No ratings recorded yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {ratings.map((rating) => (
                      <li key={rating.rating_id} className="px-4 py-3 text-sm text-white/80">
                        <div className="font-medium text-white">
                          {rating.rater_display_name ?? `User ${rating.user_id}`} rated{" "}
                          {rating.score}/10 on Post #{rating.post_id}
                        </div>
                        <div className="text-xs text-white/60">
                          Owner: {rating.post_owner_display_name ?? `User ${rating.post_owner_id ?? "?"}`}
                        </div>
                        <div className="text-xs text-white/50">
                          {new Date(rating.created_at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}

        <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
          <div className="flex flex-wrap items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Manage Users</h2>
              <p className="text-xs text-white/50">
                View vuserstats and grant admin or delete accounts.
              </p>
            </div>
          </div>
          {userError && (
            <div className="px-4 py-3 text-sm text-rose-200">{userError}</div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/60">
                <tr>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Posts</th>
                  <th className="px-3 py-2 text-left">Followers</th>
                  <th className="px-3 py-2 text-left">Following</th>
                  <th className="px-3 py-2 text-left">Bookmarks</th>
                  <th className="px-3 py-2 text-left">Matches</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {userLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-white/60">
                      Loading users…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-white/60">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.user_id} className="text-white/80">
                      <td className="px-3 py-2">
                        <div className="font-semibold">
                          <Link
                            href={`/u/${user.user_id}`}
                            className="text-white hover:underline"
                          >
                            {user.display_name ?? `User ${user.user_id}`}
                          </Link>
                        </div>
                        <div className="text-xs text-white/50">{user.email ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            user.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : user.status === "DELETED"
                              ? "bg-rose-500/15 text-rose-200"
                              : "bg-white/10 text-white/80"
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{user.post_count}</td>
                      <td className="px-3 py-2">{user.follower_count}</td>
                      <td className="px-3 py-2">{user.following_count}</td>
                      <td className="px-3 py-2">{user.bookmark_count}</td>
                      <td className="px-3 py-2">{user.successful_matches}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              mutateUser(user.user_id, user.is_admin ? "revoke" : "grant")
                            }
                            className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                          >
                            {user.is_admin ? "Revoke Admin" : "Grant Admin"}
                          </button>
                          <button
                            onClick={() => {
                              if (
                                user.status !== "DELETED" &&
                                window.confirm("Delete this account?")
                              ) {
                                mutateUser(user.user_id, "delete");
                              }
                            }}
                            className="rounded-lg border border-rose-400/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                            disabled={user.status === "DELETED"}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminGuard>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
