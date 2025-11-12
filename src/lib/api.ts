// src/lib/api.ts
export async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_BASE is not set");
  }

  const url = `${base}${path}`;

  const res = await fetch(url, {
    // caller can override method/body/etc.
    ...init,
    // always include cookies (guest + future real auth)
    credentials: "include",
    headers: {
      // sensible default; caller can override
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message: string | undefined;
    try {
      const parsed = text ? JSON.parse(text) : null;
      message = parsed?.error || parsed?.message;
    } catch {
      message = text;
    }
    const error = new Error(message || `API ${res.status}`);
    (error as any).status = res.status;
    throw error;
  }

  // handle empty response body gracefully
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
