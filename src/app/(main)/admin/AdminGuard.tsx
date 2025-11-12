"use client";

import Link from "next/link";
import { useSession } from "@/lib/usuSession";

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, isAuthed, loading } = useSession();

  if (loading) {
    return (
      <section className="rounded-2xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
        Checking admin access…
      </section>
    );
  }

  if (!isAuthed || !isAdmin) {
    return (
      <section className="rounded-2xl bg-neutral-900/60 p-6 text-center text-white/70 ring-1 ring-white/10">
        <p className="text-sm">
          You need admin privileges to view this page.
        </p>
        <div className="mt-4">
          <Link
            href="/"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            Back to feed
          </Link>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
