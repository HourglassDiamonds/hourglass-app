import type { TodayIntelligenceStatus as Status } from "@/lib/continuum/today-sterling/publisher";

function timestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function TodayIntelligenceStatus({ status }: { status: Status }) {
  if (status.source === "canonical_fallback") {
    const detail = status.sterlingStatus === "disabled"
      ? "Sterling publication is off."
      : "No current validated Sterling publication is available.";
    return (
      <aside
        data-today-intelligence="canonical-fallback"
        data-sterling-publication={status.sterlingStatus}
        className="mb-6 rounded-xl border border-[#6f675f]/35 bg-[#171513]/70 px-4 py-3"
        aria-label="Today source status"
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#ad9164]">
          Canonical Today
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#b8ada2]">
          {detail} Projects and Jobs remain sourced from canonical Continuum; correspondence freshness is reported separately.
        </p>
      </aside>
    );
  }

  return (
    <aside
      data-today-intelligence="sterling"
      data-sterling-publication="active"
      className="mb-6 rounded-xl border border-[#ad9164]/40 bg-[#171513]/70 px-4 py-3"
      aria-label="Today source status"
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#ad9164]">
        Sterling verified
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#d8cfc4]">
        Published {timestamp(status.publishedAt)} · expires {timestamp(status.expiresAt)}
      </p>
      <details className="mt-2 text-[11px] leading-relaxed text-[#81776d]">
        <summary className="cursor-pointer">Publication evidence</summary>
        <dl className="mt-2 grid gap-1 break-all">
          <div><dt className="inline">Validation: </dt><dd className="inline">{status.validationResult}</dd></div>
          <div><dt className="inline">Run: </dt><dd className="inline">{status.runId}</dd></div>
          <div><dt className="inline">Watermark: </dt><dd className="inline">{status.sourceWatermark}</dd></div>
        </dl>
      </details>
    </aside>
  );
}
