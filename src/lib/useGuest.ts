"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

type MeResponse = {
  ok: boolean;
  user: { user_id: number; roles: string[] } | null;
};

export function useGuest() {
  const [isGuest, setIsGuest] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api<MeResponse>("/api/auth/me");
        if (!cancelled) {
          setIsGuest(!data?.user);
        }
      } catch {
        if (!cancelled) {
          setIsGuest(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return isGuest;
}
