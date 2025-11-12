"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

type SessionUser = {
  user_id: number;
  roles: string[];
} | null;

export function useSession() {
  const [user, setUser] = useState<SessionUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api<{ ok: boolean; user: SessionUser }>("/api/auth/me");
        if (!cancelled && res.ok !== false) {
          setUser(res.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    user,
    loading,
    isAuthed: !!user,
    isAdmin: !!user?.roles?.includes("ADMIN"),
  };
}
