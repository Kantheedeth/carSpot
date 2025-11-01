import Link from "next/link";
import { MOCK_MESSAGES } from "lib/mock";

export default function MessagesInbox() {
  return (
    <section className="mx-auto max-w-3xl space-y-3">
      {MOCK_MESSAGES.inbox.map((c) => (
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
            <div className="font-medium text-white">{c.other_user}</div>
            <div className="truncate text-sm text-white/60">{c.last}</div>
          </div>
          <div className="shrink-0 text-xs text-white/40">{c.when}</div>
        </Link>
      ))}
    </section>
  );
}
