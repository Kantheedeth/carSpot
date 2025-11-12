"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useGuest } from "@/lib/useGuest";

type InboxRow = {
  conversation_id: number;
  other_user: {
    user_id: number;
    display_name: string | null;
    profile_pic_url: string | null;
  };
  last_message: string | null;
  last_at: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");

function relativeTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

export default function MessagesInbox() {
  const isGuest = useGuest();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inboxUrl = useMemo(
    () => (API_BASE ? `${API_BASE}/api/dm/inbox` : "/api/dm/inbox"),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isGuest) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(inboxUrl, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.status === 404) {
          // server doesn't have the inbox route yet → treat as empty quietly
          if (!cancelled) {
            setRows([]);
            setError(null);
          }
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed with status ${res.status}`);
        }
        const data: InboxRow[] = await res.json();
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load messages");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [inboxUrl, isGuest]);

  if (isGuest) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl bg-neutral-900/50 p-6 text-center text-white/70 ring-1 ring-white/10">
        Login to view or send messages.
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-3">
      {loading && (
        <div className="rounded-xl bg-neutral-900/60 p-4 text-sm text-white/60 ring-1 ring-white/10">
          Loading messages…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl bg-red-900/30 p-4 text-sm text-red-200 ring-1 ring-red-400/30">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl bg-neutral-900/60 p-4 text-center text-sm text-white/60 ring-1 ring-white/10">
          No chats yet—go rate some rides and make a new friend!
        </div>
      )}

      {rows.map((c) => (
        <Link
          key={c.conversation_id}
          href={`/messages/${c.conversation_id}`}
          className="
            flex items-center justify-between rounded-xl
            bg-neutral-900/60 p-4 ring-1 ring-white/10
            hover:bg-white/5 transition-colors
          "
        >
          <div className="min-w-0">
            <div className="font-medium text-white">
              {c.other_user.display_name ?? `User ${c.other_user.user_id}`}
            </div>
            <div className="truncate text-sm text-white/60">
              {c.last_message ?? "No messages yet"}
            </div>
          </div>
          <div className="shrink-0 text-xs text-white/40">
            {relativeTime(c.last_at)}
          </div>
        </Link>
      ))}
    </section>
  );
}
