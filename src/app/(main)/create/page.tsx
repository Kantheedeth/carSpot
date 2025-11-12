"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "idle" | "scanning" | "censored";
type Box = { x: number; y: number; w: number; h: number };

type GateData = {
  unlocked: boolean;
  required: number;
  successful_matches: number;
  remaining: number;
};

type GateState = {
  loading: boolean;
  data?: GateData;
  error?: string;
  needsLogin?: boolean;
};

const FALLBACK_REQUIRED = 5;

function normalizeGate(payload: any): GateData {
  const required =
    Number(payload?.required ?? FALLBACK_REQUIRED) || FALLBACK_REQUIRED;
  const successful =
    Number(payload?.successful_matches ?? payload?.successful ?? 0) || 0;
  const remaining = Math.max(
    0,
    Number(payload?.remaining ?? required - successful)
  );
  const unlocked =
    typeof payload?.unlocked === "boolean"
      ? payload.unlocked
      : successful >= required;

  return {
    unlocked,
    required,
    successful_matches: successful,
    remaining,
  };
}

export default function CreatePage() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  const [eligibility, setEligibility] = useState<GateState>({ loading: true });

  const loadEligibility = useCallback(async () => {
    setEligibility((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch(`${apiBase}/api/posts/eligibility`, {
        credentials: "include",
        cache: "no-store",
      });

      if (res.status === 401) {
        setEligibility({
          loading: false,
          needsLogin: true,
          error: "Login required to create posts.",
        });
        return;
      }

      const payload = await res.json().catch(() => null);
      if (!payload || !res.ok) {
        setEligibility({
          loading: false,
          error: payload?.error || "Unable to check posting eligibility.",
        });
        return;
      }

      setEligibility({
        loading: false,
        data: normalizeGate(payload),
      });
    } catch {
      setEligibility({
        loading: false,
        error: "Unable to check posting eligibility.",
      });
    }
  }, [apiBase]);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  if (eligibility.loading) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-center text-white/70">
        Checking posting eligibility…
      </div>
    );
  }

  if (eligibility.needsLogin) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-center text-white/80">
        <h1 className="text-xl font-semibold text-white">Create Post</h1>
        <p className="mt-2 text-sm text-white/60">
          Please log in to rate cars and share your own posts.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Log in
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            Browse feed
          </Link>
        </div>
      </div>
    );
  }

  if (eligibility.error && !eligibility.data) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/30 bg-rose-900/40 p-6 text-center text-rose-100">
        <p className="text-sm">{eligibility.error}</p>
        <button
          onClick={loadEligibility}
          className="mt-4 rounded-lg border border-white/30 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          Try again
        </button>
      </div>
    );
  }

  if (eligibility.data && !eligibility.data.unlocked) {
    return (
      <LockedCard gate={eligibility.data} onRefresh={loadEligibility} />
    );
  }

  if (!eligibility.data) return null;

  return (
    <CreateFlow
      apiBase={apiBase}
      gate={eligibility.data}
      onGateUpdate={(gate) => setEligibility({ loading: false, data: gate })}
    />
  );
}

function CreateFlow({
  apiBase,
  gate,
  onGateUpdate,
}: {
  apiBase: string;
  gate: GateData;
  onGateUpdate: (gate: GateData) => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    fakeScan();
  }

  function fakeScan() {
    setStage("scanning");
    setProgress(0);
    setBoxes([]);
    let pct = 0;
    const id = setInterval(() => {
      pct += Math.random() * 18 + 8;
      if (pct >= 100) {
        pct = 100;
        clearInterval(id);
        setBoxes([{ x: 62, y: 60, w: 20, h: 10 }]);
        setStage("censored");
      }
      setProgress(Math.round(pct));
    }, 200);
  }

  function resetAll() {
    setStage("idle");
    setFileUrl(null);
    setProgress(0);
    setBoxes([]);
    setConfirm(false);
    setSubmitError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handlePublish() {
    if (!(stage === "censored" && confirm) || !file) return;

    try {
      setSubmitting(true);
      setSubmitError(null);

      const fd = new FormData();
      fd.append("photo", file);

      const res = await fetch(`${apiBase}/api/posts`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload) {
        const msg =
          (payload as { message?: string; error?: string })?.message ||
          (payload as { message?: string; error?: string })?.error ||
          "Upload failed.";

        if (
          payload &&
          typeof payload === "object" &&
          "required" in payload &&
          "successful_matches" in payload
        ) {
          onGateUpdate(normalizeGate(payload));
        }

        setSubmitError(msg);
        return;
      }

      const data = payload as { post_id: number };
      router.push(`/post/${data.post_id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4 ring-1 ring-white/10">
        <h1 className="mb-3 text-xl font-semibold text-white">Upload Car Post</h1>

        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
          {stage === "idle" && (
            <label
              htmlFor="file"
              className="grid h-72 cursor-pointer place-items-center transition hover:bg-white/5"
            >
              <div className="text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-white/10 text-3xl">
                  +
                </div>
                <div className="rounded-lg border px-3 py-1.5 text-sm text-white/80">
                  Upload Car Photo
                </div>
              </div>
            </label>
          )}

          {stage === "scanning" && (
            <div className="grid h-72 place-items-center">
              <div className="w-full max-w-sm">
                <p className="mb-2 text-center text-sm text-white/80">
                  AI scanning your photo…
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-white" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-center text-xs text-white/60">
                  {progress}%
                </p>
              </div>
            </div>
          )}

          {stage === "censored" && fileUrl && (
            <div className="relative">
              <img
                src={fileUrl}
                alt="preview"
                className="h-[420px] w-full object-cover"
                style={{ filter: "blur(1.6px) brightness(0.98)" }}
              />
              <div className="pointer-events-none absolute inset-0">
                {boxes.map((b, i) => (
                  <div
                    key={i}
                    className="absolute rounded-md border border-white/20 bg-black/20 backdrop-blur-lg"
                    style={{
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      width: `${b.w}%`,
                      height: `${b.h}%`,
                    }}
                    title="auto-censored area"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          id="file"
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            {stage === "idle" ? "Choose photo" : "Change photo"}
          </button>

          {stage !== "idle" && (
            <button
              onClick={fakeScan}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              Re-scan
            </button>
          )}
        </div>

        {stage === "censored" && (
          <label className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/90">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I confirm this photo hides personal info and the automatically
              blurred areas look good.
            </span>
          </label>
        )}

        <div className="mt-4 space-y-3">
          <div className="text-xs uppercase tracking-wide text-white/50">
            Tips before publishing
          </div>
          <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-semibold text-white">Photo clarity</p>
              <p className="mt-1 text-white/70">
                Use bright, sharp photos. Avoid faces, plates, or locations.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-semibold text-white">Swipe to rate</p>
              <p className="mt-1 text-white/70">
                Keep rating community posts to stay eligible for posting.
              </p>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {submitError}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={resetAll}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
            disabled={submitting}
          >
            Reset
          </button>
          <button
            onClick={handlePublish}
            disabled={submitting || stage !== "censored" || !confirm}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      <GateSidebar gate={gate} />
    </div>
  );
}

function LockedCard({
  gate,
  onRefresh,
}: {
  gate: GateData;
  onRefresh: () => void;
}) {
  const progress =
    gate.required > 0 ? gate.successful_matches / gate.required : 0;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="space-y-4 rounded-2xl border border-yellow-400/30 bg-yellow-950/40 p-6 text-yellow-50">
        <div>
          <h1 className="text-xl font-semibold">Posting locked</h1>
          <p className="mt-1 text-sm text-yellow-100/90">
            Rate and match{" "}
            <b className="text-yellow-50">{gate.required}</b> posts to unlock
            publishing. You&apos;re at{" "}
            <b className="text-yellow-50">{gate.successful_matches}</b>, so{" "}
            <b className="text-yellow-50">{gate.remaining}</b> more to go.
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-yellow-300/30 bg-yellow-300/5 p-4 text-sm text-yellow-50">
          <div className="flex items-center justify-between">
            <span>Match progress</span>
            <span>
              {gate.successful_matches}/{gate.required}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-yellow-200/20">
            <div
              className="h-full rounded-full bg-yellow-300"
              style={{ width: `${Math.min(1, progress) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-yellow-900 hover:bg-white/90"
          >
            Go rate posts
          </Link>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-yellow-300/60 px-4 py-2 text-sm text-yellow-50 hover:bg-yellow-300/10"
          >
            Check again
          </button>
        </div>
      </div>
    </div>
  );
}

function GateSidebar({ gate }: { gate: GateData }) {
  const progress =
    gate.required > 0 ? gate.successful_matches / gate.required : 0;
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900/50 p-4 text-sm text-white/80">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/40">
          Posting status
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {gate.unlocked ? "You can post!" : "Keep rating"}
        </h2>
        <p className="mt-1 text-xs text-white/60">
          Match {gate.required} posts to maintain posting privileges.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Matched posts</span>
          <span>
            {gate.successful_matches}/{gate.required}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${Math.min(1, progress) * 100}%` }}
          />
        </div>
        {gate.remaining > 0 ? (
          <p className="mt-2 text-xs text-white/60">
            {gate.remaining} more matched ratings needed.
          </p>
        ) : (
          <p className="mt-2 text-xs text-white/60">
            Great job! Keep rating to stay eligible.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
        <p className="font-semibold text-white">Need a reminder?</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Swipe right on the feed to leave ratings.</li>
          <li>Matching the community average grows your score.</li>
          <li>New posts stay eligible when you keep rating.</li>
        </ul>
      </div>
    </div>
  );
}
