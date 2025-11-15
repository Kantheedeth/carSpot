class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
    throw new ApiError(message || `API ${res.status}`, res.status);
  }

  // handle empty response body gracefully
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
