"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
      const form = new FormData();
      form.append("email", email);
      form.append("password", password);
      form.append("display_name", displayName);
      if (profilePicUrl) form.append("profile_pic_url", profilePicUrl);
      if (avatarFile) form.append("avatar", avatarFile);

      const res = await fetch(`${base}/api/auth/signup`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data as { error?: string })?.error || "Signup failed."
        );
      }
      router.push("/"); // logged in via cookie
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Signup failed";
      setErr(msg);
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
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-white/50">
            Profile picture (optional)
          </label>
          {avatarPreview ? (
            <div className="relative w-full">
              <img
                src={avatarPreview}
                alt="preview"
                className="h-32 w-32 rounded-full object-cover border border-white/20"
              />
              <button
                type="button"
                onClick={() => {
                  setAvatarFile(null);
                  setAvatarPreview(null);
                }}
                className="mt-2 text-xs text-white/60 hover:text-white"
              >
                Remove uploaded photo
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="w-full rounded-lg bg-[#111827] border border-white/20 px-3 py-2 text-sm"
            />
          )}
          <p className="text-xs text-white/40">
            Prefer a URL? Paste it below instead of uploading.
          </p>
          <input
            type="url"
            placeholder="https://example.com/me.jpg"
            value={profilePicUrl}
            onChange={(e) => setProfilePicUrl(e.target.value)}
            className="w-full rounded-lg bg-[#111827] border border-white/20 px-3 py-2 text-sm"
            disabled={!!avatarFile}
          />
        </div>

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
