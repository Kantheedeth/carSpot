"use client";

export default function AdminSettings() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Admin · Tools</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <ToolCard
          title="Recalculate Averages"
          desc="Recompute all post averages from raw rating data."
          cta="Run recalculation"
        />
        <ToolCard
          title="Fix Broken Averages"
          desc="Detect missing/NaN averages and repair."
          cta="Fix now"
        />
        <ToolCard
          title="Reset Posting Eligibility"
          desc="Reset eligibility counters across users."
          cta="Reset eligibility"
        />
        <ToolCard
          title="Purge Flagged Cache"
          desc="Clear caches used by moderation queues."
          cta="Purge cache"
        />
        <ToolCard
          title="Export Audit History"
          desc="Export latest audit log for review."
          cta="Download CSV"
        />
        <ToolCard
          title="Rebuild Search Index"
          desc="Rebuild indexes used in discovery pages."
          cta="Rebuild"
        />
      </div>
    </section>
  );
}

function ToolCard({
  title,
  desc,
  cta,
}: {
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm text-white/60">{desc}</p>
      <div className="mt-3">
        <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
          {cta}
        </button>
      </div>
    </div>
  );
}
