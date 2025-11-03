"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation"; // ← add this line

type Stage = "idle" | "scanning" | "censored";
type Box = { x: number; y: number; w: number; h: number };

export default function CreatePage() {
  // Toggle this to preview the old "locked" card if you want.
  const isLocked = false; // ← set true to show the “Posting locked” message

  if (isLocked) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-yellow-300/40 bg-yellow-50/60 p-4 text-yellow-900">
          <h1 className="mb-2 text-xl font-semibold">Create Post</h1>
          <div className="rounded-lg border border-yellow-300/50 bg-yellow-100/60 p-4">
            <p className="text-sm font-medium">Posting locked</p>
            <p className="text-sm">
              Rate 5 posts close to average to unlock. Remaining: 2
            </p>

            {/* Use Link for internal navigation */}
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1 rounded border border-yellow-300/70 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-900 hover:bg-yellow-100"
            >
              Go rate posts <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CreateFlow />;
}

function CreateFlow() {
  const [stage, setStage] = useState<Stage>("idle");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null); // remember picked file
  const [submitting, setSubmitting] = useState(false); // show upload state
  const router = useRouter(); // navigate after upload

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); // save file object
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    fakeScan();
  }

  function fakeScan() {
    setStage("scanning");
    setProgress(0);
    setBoxes([]);
    // Simulate progress
    let pct = 0;
    const id = setInterval(() => {
      pct += Math.random() * 18 + 8;
      if (pct >= 100) {
        pct = 100;
        clearInterval(id);
        // Example detected plate box — percentages of the image container
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
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handlePublish() {
    if (!(stage === "censored" && confirm) || !file) return;

    try {
      setSubmitting(true);

      const fd = new FormData();
      fd.append("photo", file); // field name must be "photo"

      const base = process.env.NEXT_PUBLIC_API_BASE!; // from your .env.local
      const res = await fetch(`${base}/api/posts`, {
        method: "POST",
        body: fd,
        headers: {
          "x-user-id": "1", // temporary test user
          "x-role": "ADMIN",
        },
      });

      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { post_id: number };
      router.push(`/post/${data.post_id}`); // go to new post page
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
      {/* LEFT: Main card */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4 ring-1 ring-white/10">
        <h1 className="mb-3 text-xl font-semibold text-white">
          Upload Car Post
        </h1>

        {/* Upload / Preview panel */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
          {/* Idle state */}
          {stage === "idle" && (
            <label
              htmlFor="file"
              className="grid h-72 place-items-center cursor-pointer transition hover:bg-white/5"
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

          {/* Scanning state */}
          {stage === "scanning" && (
            <div className="grid h-72 place-items-center">
              <div className="w-full max-w-sm">
                <p className="mb-2 text-center text-sm text-white/80">
                  AI scanning your photo…
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-white"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs text-white/60">
                  {progress}%
                </p>
              </div>
            </div>
          )}

          {/* Censored preview */}
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
                    className="absolute rounded-md backdrop-blur-lg bg-black/20 border border-white/20"
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

        {/* Hidden file input */}
        <input
          id="file"
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />

        {/* Controls under the panel */}
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

        {/* Safety confirmation */}
        {stage === "censored" && (
          <label className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/90">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I confirm this photo does not reveal personal location or
              sensitive information other than the automatically blurred
              regions.
            </span>
          </label>
        )}

        {/* Footer actions */}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={resetAll}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            Reset
          </button>

          <button
            onClick={handlePublish}
            disabled={!(stage === "censored" && confirm && file) || submitting}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              stage === "censored" && confirm && file && !submitting
                ? "bg-white text-black hover:opacity-90"
                : "bg-white/30 text-black/60 cursor-not-allowed"
            }`}
          >
            {submitting ? "Publishing..." : "Ready Post"}
          </button>
        </div>
      </div>

      {/* RIGHT: Steps rail (static) */}
      <aside className="space-y-4">
        <StepsHeader />
        <StepsList stage={stage} />
        <AuditBox />
      </aside>
    </div>
  );
}

/* ——— Small presentational pieces ——— */

function StepsHeader() {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
      <h2 className="text-base font-semibold text-white">
        AI Censorship Journey
      </h2>
      <p className="mt-1 text-sm text-white/60">
        Upload → Scan → Censor → Ready
      </p>
    </div>
  );
}

function StepsList({ stage }: { stage: Stage }) {
  const done = (s: Stage) =>
    stage === "censored" || (stage === "scanning" && s !== "censored");

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
      <ul className="space-y-3 text-sm">
        <StepRow
          label="User chooses photo"
          active={stage !== "idle"}
          done={stage !== "idle"}
        />
        <StepRow
          label="AI begins image scan"
          active={stage === "scanning"}
          done={stage !== "idle"}
        />
        <StepRow
          label="AI detects plate region(s)"
          active={stage === "scanning"}
          done={done("scanning")}
        />
        <StepRow
          label="Automatic blur applied"
          active={stage === "censored"}
          done={stage === "censored"}
        />
        <StepRow
          label="Publish with censored preview"
          active={false}
          done={false}
        />
      </ul>
    </div>
  );
}

function StepRow({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${
          done
            ? "bg-lime-400 text-black"
            : active
            ? "bg-white text-black"
            : "bg-white/10 text-white/70"
        }`}
      >
        {done ? "✓" : active ? "•" : ""}
      </span>
      <span
        className={`text-white/90 ${done ? "opacity-80 line-through" : ""}`}
      >
        {label}
      </span>
    </li>
  );
}

function AuditBox() {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4 text-sm text-white/80">
      <div className="mb-1 font-medium">Audit & Transparency</div>
      <p className="text-white/60">
        A censor log (preview-only) can be sent to the moderation system. This
        is UI-only for now.
      </p>
    </div>
  );
}
