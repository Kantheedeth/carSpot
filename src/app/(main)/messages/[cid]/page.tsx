"use client";

import {
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
} from "react";
import { useSession } from "@/lib/usuSession";

type MessageDto = {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  sender_display_name: string | null;
  sender_profile_pic_url: string | null;
  body: string;
  created_at: string;
  seen_at: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");

function formatTimestamp(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function ThreadPage({
  params,
}: {
  params: Promise<{ cid: string }>;
}) {
  const { cid } = use(params);
  const conversationId = Number(cid);
  const isValidConversation = Number.isFinite(conversationId) && conversationId > 0;

  const { user, isAuthed, loading } = useSession();

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [text, setText] = useState("");
  const [fetching, setFetching] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const endpoint = useMemo(() => {
    if (!isValidConversation) return null;
    const path = `/api/dm/${conversationId}/messages`;
    return API_BASE ? `${API_BASE}${path}` : path;
  }, [conversationId, isValidConversation]);

  useEffect(() => {
    if (!endpoint) {
      setError("Invalid conversation.");
      setFetching(false);
      return;
    }

    if (!isAuthed) {
      if (!loading) {
        setMessages([]);
        setError("Login to view messages.");
        setFetching(false);
      }
      return;
    }

    let cancelled = false;
    setFetching(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(endpoint, {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("You are not part of this conversation.");
          }
          throw new Error("Failed to load messages.");
        }

        const data: MessageDto[] = await res.json();
        if (!cancelled) {
          setMessages(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setMessages([]);
          setError(
            err instanceof Error ? err.message : "Failed to load messages."
          );
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint, isAuthed, loading]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
    });
  }, [messages.length]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!endpoint || !text.trim() || sending) return;

    const payload = { body: text.trim() };
    setSending(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to send message.");
      }

      const message: MessageDto = await res.json();
      setMessages((prev) => [...prev, message]);
      setText("");
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        })
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  if (!isValidConversation) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl bg-red-900/20 p-4 text-center text-sm text-red-200 ring-1 ring-red-400/40">
        Invalid conversation id.
      </section>
    );
  }

  if (!isAuthed && !loading) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
        Login to view this conversation.
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      {error && (
        <div className="mb-3 rounded-xl bg-red-900/30 p-3 text-sm text-red-100 ring-1 ring-red-400/30">
          {error}
        </div>
      )}

      <div
        ref={scrollRef}
        className="
          h-[60vh] overflow-y-auto rounded-2xl
          bg-neutral-900/60 p-4 ring-1 ring-white/10
        "
      >
        {fetching ? (
          <div className="text-sm text-white/60">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-white/60">
            No messages yet—break the ice!
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === user?.user_id;
            return (
              <div
                key={m.message_id}
                className={`mb-2 flex ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`
                    max-w-[75%] rounded-2xl px-3 py-2 text-[15px]
                    ${isMe ? "bg-white text-black" : "bg-white/10 text-white"}
                  `}
                >
                  {m.body}
                  <div
                    className={`mt-1 text-[11px] ${
                      isMe ? "text-black/50" : "text-white/50"
                    }`}
                  >
                    {formatTimestamp(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={sendMessage}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!isAuthed || sending || fetching}
          className="
            flex-1 rounded-xl border border-white/10 bg-white/5
            px-3 py-2 text-white placeholder-white/40
            focus:outline-none focus:ring-2 focus:ring-white/20
            disabled:cursor-not-allowed disabled:opacity-40
          "
          placeholder={isAuthed ? "Type a message" : "Login to send messages"}
        />
        <button
          disabled={!isAuthed || sending || fetching || !text.trim()}
          className="
            rounded-xl bg-white px-4 py-2 font-medium text-black
            hover:bg-neutral-200 transition-colors
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
