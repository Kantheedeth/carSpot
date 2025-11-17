"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  const googleAuthUrl = apiBase
    ? `${apiBase}/api/auth/google`
    : "/api/auth/google";

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg =
          err.message.includes("Invalid credentials")
            ? "Invalid email or password."
            : err.message;
        setErr(msg);
      } else {
        setErr("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (!googleAuthUrl) {
      setErr("Google OAuth not configured.");
      return;
    }
    setErr("");
    setLoading(true);
    // Full page redirect so Google callback can return to the API host.
    window.location.href = googleAuthUrl;
  };

  const onGuest = async () => {
    setErr("");
    setLoading(true);
    try {
      await api("/api/auth/guest", { method: "GET" });
      router.push("/");
    } catch (err: unknown) {
      console.error(err);
      setErr("Guest mode failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 text-white">
      <h1 className="text-3xl font-bold mb-3">Welcome back to CarSpot</h1>
      <p className="text-gray-400 mb-6">
        Log in to rate, bookmark, and post. Or continue as guest to browse only.
      </p>

      <form
        onSubmit={onLogin}
        className="w-full max-w-sm space-y-3 bg-black/40 p-5 rounded-2xl border border-white/10 mb-4"
      >
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-[#111827] border border-white/20 px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-[#111827] border border-white/20 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white text-black py-2 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Log in"}
        </button>
        <button
          type="button"
          onClick={onGoogle}
          disabled={loading}
          className="w-full rounded-lg border border-white/20 bg-white/5 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <span className="text-lg">ⓖ</span> Continue with Google
        </button>

        <button
          type="button"
          onClick={() => router.push("/signup")}
          className="w-full text-center text-xs text-white/60 hover:text-white mt-1"
        >
          Need an account? Sign up
        </button>
      </form>

      <button
        onClick={onGuest}
        disabled={loading}
        className="px-8 py-2 border border-white/40 rounded-xl text-sm hover:bg-white/5 disabled:opacity-60"
      >
        Continue as guest
      </button>

      {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
    </div>
  );
}
