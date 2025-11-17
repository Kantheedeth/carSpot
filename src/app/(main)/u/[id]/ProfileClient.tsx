// app/u/[id]/ProfileClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type UserStats = {
  user_id: number;
  display_name: string | null;
  profile_pic_url: string | null;
  status: "ACTIVE" | "BANNED" | "DELETED";
  post_count: number;
  follower_count: number;
  following_count: number;
  bookmark_count: number;
  successful_matches: number;
  eligible_to_post: boolean;
  remaining_to_post: number;
  last_checked: string | null;
  is_following?: boolean;
};

type UserPost = {
  post_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  created_at: string;
  avg_rating: number | null;
  rating_count: number;
};

type ConnectionUser = {
  user_id: number;
  display_name: string | null;
  profile_pic_url: string | null;
};

function formatAvg(
  value: number | string | null | undefined,
  count?: number
) {
  if (!count) return "—";
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : "—";
}

export default function ProfileClient({
  id,
  stats,
  posts,
  meId,
  isAdmin = false,
}: {
  id: string;
  stats: UserStats;
  posts: UserPost[];
  meId?: number;
  isAdmin?: boolean;
}) {
  const uid = Number(id);
  const me = meId === uid;  // 👈 real "is this my profile?"
  const loggedIn = typeof meId === "number";
  const router = useRouter();

  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  const origin = apiBase.replace(/\/api$/, "");

  const [followers, setFollowers] = useState(stats.follower_count);
  const [isFollowing, setIsFollowing] = useState(Boolean(stats.is_following));
  const [followBusy, setFollowBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(stats.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    stats.profile_pic_url
  );
  const [editOpen, setEditOpen] = useState(false);
  const [connectionsType, setConnectionsType] = useState<null | "followers" | "following">(null);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);

  const coverImage =
    posts[0]?.image_url_censored || posts[0]?.image_url_orig || null;
  const coverSrc = coverImage
    ? coverImage.startsWith("/")
      ? `${origin}${coverImage}`
      : `${origin}/${coverImage}`
    : null;

  const displayNameSafe = displayName?.trim() || `User ${uid}`;

  const initials = useMemo(() => {
    const name = displayNameSafe;
    return (
      name
        .trim()
        .split(/\s+/)
        .map((s) => s[0]?.toUpperCase() || "")
        .slice(0, 2)
        .join("") || "U"
    );
  }, [displayNameSafe]);
  const canViewConnections = me || isAdmin;

  async function handleMessage() {
    if (messageBusy) return;
    if (!loggedIn) {
      window.location.href = "/login";
      return;
    }

    try {
      setMessageBusy(true);
      setMessageError(null);
      const res = await fetch(`${apiBase}/api/dm/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Unable to start chat");
      }
      if (data?.conversation_id) {
        router.push(`/messages/${data.conversation_id}`);
      } else {
        throw new Error("Conversation not available yet");
      }
    } catch (err) {
      const msg =
        (err as { message?: string }).message ||
        "Failed to start conversation. Make sure you both follow each other.";
      setMessageError(msg);
    } finally {
      setMessageBusy(false);
    }
  }

  async function openConnections(type: "followers" | "following") {
    if (!canViewConnections) return;
    setConnectionsType(type);
    setConnections([]);
    setConnectionsError(null);
    setConnectionsLoading(true);

    try {
      const res = await fetch(
        `${apiBase}/api/users/${id}/${type === "followers" ? "followers" : "following"}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string } | null)?.error ||
            "Unable to load list."
        );
      }
      setConnections(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setConnectionsError(
        err instanceof Error ? err.message : "Failed to load list."
      );
    } finally {
      setConnectionsLoading(false);
    }
  }

  function closeConnections() {
    setConnectionsType(null);
    setConnections([]);
    setConnectionsError(null);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header card */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 ring-1 ring-white/10">
        <div className="relative h-32 w-full">
          {coverSrc ? (
            <>
              <img
                src={coverSrc}
                alt="cover"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-neutral-900/90" />
            </>
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
          )}
        </div>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={
                  avatarUrl.startsWith("/")
                    ? `${origin}${avatarUrl}`
                    : `${origin}/${avatarUrl}`
                }
                alt="avatar"
                className="h-16 w-16 rounded-full border border-white/10 object-cover"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.onerror = null;
                  el.src = "/avatar-placeholder.png";
                }}
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-semibold text-white shadow-inner">
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-white">
                {displayNameSafe}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-white/70">
                <StatPill label="Posts" value={stats.post_count} />
                <Dot />
                <StatPill
                  label="Followers"
                  value={followers}
                  onClick={
                    canViewConnections
                      ? () => openConnections("followers")
                      : undefined
                  }
                />
                <Dot />
                <StatPill
                  label="Following"
                  value={stats.following_count}
                  onClick={
                    canViewConnections
                      ? () => openConnections("following")
                      : undefined
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {me ? (
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
                >
                  Edit profile
                </button>
                {editOpen && (
                  <EditProfileModal
                    initialName={displayNameSafe}
                    initialAvatar={avatarUrl}
                    onClose={() => setEditOpen(false)}
                    onUpdated={(next) => {
                      if (typeof next.display_name === "string") {
                        setDisplayName(next.display_name);
                      }
                      setAvatarUrl(
                        typeof next.profile_pic_url === "string"
                          ? next.profile_pic_url
                          : next.profile_pic_url === null
                          ? null
                          : avatarUrl
                      );
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <button
                  onClick={async () => {
                    if (followBusy) return;
                    if (!loggedIn) {
                      window.location.href = "/login";
                      return;
                    }

                    try {
                      setFollowBusy(true);
                      const next = !isFollowing;
                      const method = next ? "POST" : "DELETE";
                      const res = await fetch(
                        `${apiBase}/api/users/${id}/follow`,
                        {
                          method,
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                        }
                      );
                      if (!res.ok) throw new Error("follow failed");
                      const data = await res.json().catch(() => ({}));
                      setIsFollowing(next);
                      if (typeof data.follower_count === "number") {
                        setFollowers(data.follower_count);
                      } else {
                        setFollowers((prev) =>
                          Math.max(0, prev + (next ? 1 : -1))
                        );
                      }
                    } catch (err) {
                      console.error("follow toggle failed", err);
                    } finally {
                      setFollowBusy(false);
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isFollowing
                      ? "border border-white/30 bg-transparent text-white hover:bg-white/10"
                      : "bg-white text-black hover:opacity-90"
                  } ${followBusy ? "opacity-60" : ""}`}
                  disabled={followBusy}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  onClick={handleMessage}
                  disabled={messageBusy}
                  className="
                    rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white
                    hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed
                  "
                >
                  {messageBusy ? "Opening…" : "Message"}
                </button>
              </>
            )}
          </div>
        </div>
        {!me && messageError && (
          <p className="px-5 pb-2 text-sm text-red-300">{messageError}</p>
        )}
      </section>

      {/* Posts grid (unchanged) */}
      {/* ...your existing posts rendering stays the same... */}
      {/* I’ll leave that part exactly as you had it */}
      {posts.length === 0 ? (
        <section className="rounded-2xl border border-white/10 bg-neutral-900/50 p-6 text-center text-white/70">
          No posts yet.
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/60">
            Posts
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {posts.map((p) => {
              const rel =
                (p.image_url_censored || p.image_url_orig || "").trim();
              const src = rel.startsWith("/")
                ? `${origin}${rel}`
                : `${origin}/${rel}`;

              return (
                <li key={p.post_id}>
                  <Link
                    href={{
                      pathname: `/post/${p.post_id}`,
                      query: { from: `/u/${id}` },
                    }}
                    className="group block overflow-hidden rounded-xl border border-white/10 bg-neutral-900/50 ring-1 ring-white/10"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={src}
                        alt="car"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          const noSlash = `${origin}${rel.replace(/^\/+/, "")}`;
                          if (el.src !== noSlash) el.src = noSlash;
                        }}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="text-white/80">
                        ⭐{" "}
                        <span className="text-white">
                          {formatAvg(p.avg_rating, p.rating_count)}
                        </span>{" "}
                        <span className="text-white/50">
                          ({p.rating_count})
                        </span>
                      </div>
                      <div className="text-white/40 text-[11px]">
                        {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {connectionsType && (
        <ConnectionsModal
          type={connectionsType}
          rows={connections}
          loading={connectionsLoading}
          error={connectionsError}
          origin={origin}
          onClose={closeConnections}
        />
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const className =
    "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/80";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-pointer transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30`}
      >
        {label} <b className="text-white">{value}</b>
      </button>
    );
  }

  return (
    <span className={className}>
      {label} <b className="text-white">{value}</b>
    </span>
  );
}
function Dot() {
  return <span className="mx-1 text-white/30">•</span>;
}

type ConnectionsModalProps = {
  type: "followers" | "following";
  rows: ConnectionUser[];
  loading: boolean;
  error: string | null;
  origin: string;
  onClose: () => void;
};

function ConnectionsModal({
  type,
  rows,
  loading,
  error,
  origin,
  onClose,
}: ConnectionsModalProps) {
  const title = type === "followers" ? "Followers" : "Following";

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/90 p-5 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-sm text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-white/60">
            Loading…
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-red-300">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-white/60">
            No users to show yet.
          </div>
        ) : (
          <ul className="max-h-72 divide-y divide-white/10 overflow-y-auto">
            {rows.map((user) => {
              const avatar = user.profile_pic_url
                ? user.profile_pic_url.startsWith("/")
                  ? `${origin}${user.profile_pic_url}`
                  : `${origin}/${user.profile_pic_url}`
                : null;
              return (
                <li key={user.user_id} className="flex items-center gap-3 py-2">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={user.display_name ?? "avatar"}
                      className="h-10 w-10 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white/80">
                      {(user.display_name ?? `User ${user.user_id}`)
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <Link
                    href={`/u/${user.user_id}`}
                    className="text-sm font-medium text-white hover:underline"
                    onClick={onClose}
                  >
                    {user.display_name ?? `User ${user.user_id}`}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

type EditProfileModalProps = {
  initialName: string;
  initialAvatar: string | null;
  onClose: () => void;
  onUpdated: (data: {
    display_name?: string | null;
    profile_pic_url?: string | null;
  }) => void;
};

function EditProfileModal({
  initialName,
  initialAvatar,
  onClose,
  onUpdated,
}: EditProfileModalProps) {
  const [name, setName] = useState(initialName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAvatarFile(null);
      setPreview(null);
      setRemoveExisting(false);
      return;
    }
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
    setRemoveExisting(false);
  };

  async function handleSave() {
    if (!name.trim()) {
      setError("Display name is required.");
      return;
    }

    const form = new FormData();
    form.append("display_name", name.trim());
    if (avatarFile) {
      form.append("avatar", avatarFile);
    } else if (removeExisting && initialAvatar) {
      form.append("profile_pic_url", "");
    }

    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${base}/api/users/me`, {
        method: "PUT",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data as { error?: string })?.error || "Failed to update profile."
        );
      }
      const payload = (await res.json()) as {
        display_name?: string | null;
        profile_pic_url?: string | null;
      };
      onUpdated(payload);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/90 p-5 text-white shadow-2xl">
        <h3 className="text-lg font-semibold">Edit profile</h3>
        <p className="text-sm text-white/60">
          Update your display name and profile photo.
        </p>

        <div className="mt-4 space-y-3">
          <label className="text-xs uppercase tracking-wide text-white/50">
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
          />

          <label className="text-xs uppercase tracking-wide text-white/50">
            Profile photo
          </label>
          {preview ? (
            <div className="flex items-center gap-3">
              <img
                src={preview}
                alt="preview"
                className="h-16 w-16 rounded-full object-cover border border-white/20"
              />
              <button
                className="text-xs text-white/60 hover:text-white"
                onClick={() => {
                  setPreview(null);
                  setAvatarFile(null);
                }}
              >
                Remove uploaded photo
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
          )}
          {!preview && initialAvatar && !avatarFile && (
            <button
              type="button"
              onClick={() => setRemoveExisting((v) => !v)}
              className={[
                "text-xs underline",
                removeExisting ? "text-rose-300" : "text-white/60 hover:text-white",
              ].join(" ")}
            >
              {removeExisting ? "Will remove current photo" : "Remove current photo"}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2 text-sm">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-white/70 hover:bg-white/10"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-white px-3 py-1.5 font-semibold text-black disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
