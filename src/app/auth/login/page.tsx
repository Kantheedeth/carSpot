// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !pw) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      // TODO: replace with real API call (fetch("/api/login", { ... }))
      await new Promise((r) => setTimeout(r, 600));
      // Fake “logged in”
      if (typeof window !== "undefined") localStorage.setItem("carspot_auth", "demo");

      router.replace("/"); // go to feed
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function signInWithGoogle() {
    // TODO: wire to real OAuth (NextAuth / your backend)
    alert("Google sign-in placeholder");
  }

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 p-6 ring-1 ring-white/10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-4 w-4 rounded-full bg-lime-400 shadow-[0_0_8px_2px_rgba(163,230,53,.45)]" />
          <h1 className="text-xl font-semibold">Welcome back to CarSpot</h1>
          <p className="mt-1 text-sm text-white/60">Log in to rate, post, and bookmark cars.</p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-white/70">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 outline-none placeholder:text-white/40 focus:border-white/30"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-white/70">Password</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 outline-none placeholder:text-white/40 focus:border-white/30"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div className="mt-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${
              loading ? "bg-white/40 text-black/60" : "bg-white text-black hover:opacity-90"
            }`}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            Continue with Google
          </button>

          <div className="mt-1 flex items-center justify-between text-sm text-white/60">
            <a className="hover:text-white" href="#">Forgot password?</a>
            <a className="hover:text-white" href="#">Create account</a>
          </div>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-white/50">
        By continuing, you agree to CarSpot’s Terms & Privacy.
      </p>
    </div>
  );
}
