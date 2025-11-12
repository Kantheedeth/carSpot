"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          profile_pic_url: profilePicUrl || undefined,
        }),
      });
      router.push("/"); // logged in via cookie
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Login failed";
      setErr("Login failed: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 text-white">
      <h1 className="text-3xl font-bold mb-4">Create your CarSpot account</h1>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-3 bg-black/40 p-5 rounded-2xl border border-white/10"
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
          type="text"
          required
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg bg-[#111827] border border-white/20 px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-[#111827] border border-white/20 px-3 py-2 text-sm"
        />
        <input
          type="url"
          placeholder="Profile picture URL (optional)"
          value={profilePicUrl}
          onChange={(e) => setProfilePicUrl(e.target.value)}
          className="w-full rounded-lg bg-[#111827] border border-white/20 px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white text-black py-2 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full text-center text-xs text-white/60 hover:text-white mt-1"
        >
          Already have an account? Log in
        </button>

        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      </form>
    </div>
  );
}
