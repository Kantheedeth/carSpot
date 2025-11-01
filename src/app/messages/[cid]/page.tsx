"use client";

import { useState, useRef, useEffect } from "react";
import { MOCK_MESSAGES } from "lib/mock";

export default function ThreadPage({ params }: { params: { cid: string } }) {
  const cid = Number(params.cid);
  const msgs =
    (MOCK_MESSAGES.threads[cid] ?? []) as {
      id: number;
      sender_id: number;
      body: string;
      at: string;
    }[];

  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // auto scroll to bottom on load / new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs.length]);

  return (
    <section className="mx-auto max-w-3xl">
      {/* Message area */}
      <div
        ref={scrollRef}
        className="
          h-[60vh] overflow-y-auto rounded-2xl
          bg-neutral-900/60 p-4 ring-1 ring-white/10
        "
      >
        {msgs.map((m) => {
          const isMe = m.sender_id === 1; // demo: user #1 is "me"
          return (
            <div
              key={m.id}
              className={`mb-2 flex ${isMe ? "justify-end" : "justify-start"}`}
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
                  {m.at}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          // TODO: send message to API
          setText("");
          // scroll will auto-fire via effect if msgs is reactive to API response
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="
            flex-1 rounded-xl border border-white/10 bg-white/5
            px-3 py-2 text-white placeholder-white/40
            focus:outline-none focus:ring-2 focus:ring-white/20
          "
          placeholder="Type a message"
        />
        <button
          className="
            rounded-xl bg-white px-4 py-2 font-medium text-black
            hover:bg-neutral-200 transition-colors
          "
        >
          Send
        </button>
      </form>
    </section>
  );
}
