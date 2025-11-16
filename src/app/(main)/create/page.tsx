"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { useRouter } from "next/navigation";

type Stage = "idle" | "cropping" | "scanning" | "censored";

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [previewCensored, setPreviewCensored] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const router = useRouter();

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setConfirm(false);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    setPreviewUrl(null);
    setPreviewToken(null);
    setPreviewCensored(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedPixels(null);
    setStage("cropping");
  }

  async function runScan(target: File) {
    if (!croppedPixels) {
      setScanError("Adjust the crop before scanning.");
      return;
    }
    setStage("scanning");
    setProgress(0);
    setPreviewCensored(false);
    setScanError(null);
    setPreviewToken(null);
    const timer = setInterval(() => {
      setProgress((prev) =>
        prev >= 95 ? prev : Math.min(95, prev + Math.random() * 12 + 6)
      );
    }, 180);
    try {
      const form = new FormData();
      form.append("photo", target);
      form.append("crop_x", String(Math.round(croppedPixels.x)));
      form.append("crop_y", String(Math.round(croppedPixels.y)));
      form.append("crop_width", String(Math.round(croppedPixels.width)));
      form.append("crop_height", String(Math.round(croppedPixels.height)));
      const res = await fetch(`${apiBase}/api/posts/preview`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const payload = await res.json().catch(() => null);
      if (res.status === 422 && payload?.error === "car_not_detected") {
        window.alert("No car detected in this photo. Please try another image.");
        resetAll();
        return;
      }
      if (!res.ok || !payload?.ok || !payload.preview) {
        throw new Error(
          (payload as { error?: string } | null)?.error ||
            "Unable to scan this image."
        );
      }
      setPreviewUrl(payload.preview);
      setPreviewCensored(Boolean(payload.censored));
      setPreviewToken(typeof payload.token === "string" ? payload.token : null);
      setProgress(100);
      setStage("censored");
    } catch (err) {
      console.error("scan failed", err);
      setScanError(
        err instanceof Error ? err.message : "Unable to scan this image."
      );
      setPreviewUrl(null);
      setPreviewToken(null);
      setStage("cropping");
    } finally {
      clearInterval(timer);
    }
  }

  function resetAll() {
    setStage("idle");
    setFile(null);
    setFileUrl(null);
    setPreviewUrl(null);
    setProgress(0);
    setPreviewCensored(false);
    setPreviewToken(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedPixels(null);
    setScanError(null);
    setConfirm(false);
    setSubmitError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handlePublish() {
    if (!(stage === "censored" && confirm)) return;
    if (!previewToken && !file) {
      setSubmitError("Upload and scan a photo first.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const fd = new FormData();
      if (previewToken) {
        fd.append("preview_token", previewToken);
      } else if (file) {
        fd.append("photo", file);
        if (croppedPixels) {
          fd.append("crop_x", String(Math.round(croppedPixels.x)));
          fd.append("crop_y", String(Math.round(croppedPixels.y)));
          fd.append("crop_width", String(Math.round(croppedPixels.width)));
          fd.append("crop_height", String(Math.round(croppedPixels.height)));
        }
      }

      const res = await fetch(`${apiBase}/api/posts`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const payload = await res.json().catch(() => null);
      if (res.status === 422 && payload?.error === "car_not_detected") {
        setSubmitError("No car detected in this photo. Please try another image.");
        resetAll();
        return;
      }
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

          {stage === "cropping" && fileUrl && (
            <div className="relative h-[420px] w-full bg-black">
              <Cropper
                image={fileUrl}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) =>
                  setCroppedPixels({
                    x: pixels.x,
                    y: pixels.y,
                    width: pixels.width,
                    height: pixels.height,
                  })
                }
                showGrid={false}
                restrictPosition
              />
            </div>
          )}

          {stage === "censored" && (previewUrl || fileUrl) && (
            <div className="relative">
              <img
                src={previewUrl ?? fileUrl ?? ""}
                alt="preview"
                className="h-[420px] w-full object-cover"
              />
              {!previewCensored && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3 text-xs text-white/80">
                  AI preview did not detect a license plate—double-check this photo before publishing.
                </div>
              )}
            </div>
          )}
        </div>

        {stage === "cropping" && fileUrl && (
          <div className="mt-3 space-y-2 text-sm text-white/80">
            <div>Adjust the frame, then scan to lock in the crop.</div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {scanError && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {scanError}
          </div>
        )}

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

          {stage === "cropping" && file ? (
            <button
              onClick={() => runScan(file)}
              className="rounded-lg border border-white/15 bg-emerald-500/20 px-3 py-2 text-sm text-white hover:bg-emerald-500/30"
            >
              Scan selection
            </button>
          ) : stage === "scanning" ? (
            <button
              disabled
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/60"
            >
              Scanning…
            </button>
          ) : stage === "censored" ? (
            <button
              onClick={() => {
                setStage("cropping");
                setPreviewUrl(null);
                setPreviewToken(null);
                setPreviewCensored(false);
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              Adjust crop
            </button>
          ) : null}
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
