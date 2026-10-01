import Link from "next/link";
import type {
  BusinessReviewView,
  LocalAuthorityWorkspace,
  WindowMonths,
} from "@/lib/continuum/local-authority/types";
import type { ReviewWindowMethod } from "@/lib/intelligence/review-velocity/types";

const WINDOW_OPTIONS = [3, 6, 12, 24] as const;

function dateLabel(value: string | null): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function monthLabel(value: string | null): string {
  if (!value) return "Tracking not started";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function metric(value: number | null, digits = 0): string {
  return value === null ? "Unavailable" : value.toFixed(digits);
}

function methodLabel(method: ReviewWindowMethod): string {
  if (method === "exact-timestamps") return "Exact timestamps";
  if (method === "snapshot-delta") return "Snapshot delta";
  return "Unavailable";
}

function SummaryItem({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-t border-white/[0.08] pt-4">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-[#8d8073]">{label}</dt>
      <dd className="mt-2 font-serif text-[1.35rem] leading-tight text-[#efe8de]">{value}</dd>
      <dd className="mt-2 text-[11px] leading-relaxed text-[#8d8073]">{note}</dd>
    </div>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-white/[0.08] pt-8 md:mt-16 md:pt-10">
      <p className="text-[10px] uppercase tracking-[0.26em] text-[#8d8073]">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-[1.6rem] font-normal tracking-[-0.025em] text-[#efe8de]">{title}</h2>
      {children}
    </section>
  );
}

function ChangePanel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-5 md:p-6">
      <h2 className="text-[10px] uppercase tracking-[0.24em] text-[#ad9164]">{title}</h2>
      {items.length ? (
        <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-[#d8cfc4]">
          {items.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-4 text-[14px] leading-relaxed text-[#a99c90]">{empty}</p>
      )}
    </div>
  );
}

function WindowCell({ business, months }: { business: BusinessReviewView; months: WindowMonths }) {
  const row = business.windows[months];
  return (
    <td className="whitespace-nowrap px-3 py-4 text-right text-[13px] text-[#d8cfc4]">
      {row.reviewsAdded === null ? <span className="text-[#6f655d]">—</span> : `+${row.reviewsAdded}`}
    </td>
  );
}

function Trend({ business, months }: { business: BusinessReviewView; months: WindowMonths }) {
  const usingExact = business.role === "self" && business.exactReviewHistory.length > 0;
  const history = usingExact
    ? business.exactReviewHistory
    : business.snapshots.map((row) => ({ observedAt: row.capturedOn, reviewCount: row.reviewCount }));
  const sorted = [...history]
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const latest = sorted.at(-1);
  const cutoff = latest
    ? new Date(new Date(latest.observedAt).setUTCMonth(new Date(latest.observedAt).getUTCMonth() - months)).getTime()
    : 0;
  const points = sorted.filter((row) => Date.parse(row.observedAt) >= cutoff);
  if (points.length < 2 || business.windows[months].reviewsAdded === null) {
    return (
      <div className="border-t border-white/[0.06] py-4 first:border-t-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[14px] text-[#d8cfc4]">{business.business}</h3>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#6f655d]">Insufficient {months}m coverage</span>
        </div>
      </div>
    );
  }
  const min = Math.min(...points.map((row) => row.reviewCount));
  const max = Math.max(...points.map((row) => row.reviewCount));
  const range = Math.max(1, max - min);
  const path = points.map((row, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
    const y = 28 - ((row.reviewCount - min) / range) * 24;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <div className="border-t border-white/[0.06] py-4 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[14px] text-[#d8cfc4]">{business.business}</h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">
          {usingExact ? "Exact review timestamps" : "Observed snapshots"}
        </span>
      </div>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="mt-3 h-12 w-full" role="img" aria-label={`${business.business} observed review-count movement`}>
        <path d={path} fill="none" stroke={business.role === "self" ? "#ad9164" : "#796b5f"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map((row, index) => {
          const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
          const y = 28 - ((row.reviewCount - min) / range) * 24;
          return <circle key={`${row.observedAt}-${row.reviewCount}`} cx={x} cy={y} r="1.35" fill="#d8cfc4" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-[#6f655d]">
        <span>{dateLabel(points[0].observedAt)} · {points[0].reviewCount}</span>
        <span>{dateLabel(points.at(-1)!.observedAt)} · {points.at(-1)!.reviewCount}</span>
      </div>
    </div>
  );
}

export function LocalAuthorityWorkspaceView({ workspace, selectedWindow }: { workspace: LocalAuthorityWorkspace; selectedWindow: WindowMonths }) {
  const hourglass = workspace.hourglass;
  const trackingMessage = workspace.trackingStartedAt
    ? `Review tracking began ${monthLabel(workspace.trackingStartedAt)}.`
    : "Review tracking has not started.";

  return (
    <div className="hg-concierge-fade mt-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#ad9164]">Visibility operations</p>
          <h1 className="mt-2 font-serif text-[2.2rem] font-normal leading-[1.05] tracking-[-0.04em] text-[#efe8de] md:text-[2.7rem]">Local Authority</h1>
          <p className="mt-4 max-w-[42rem] text-[15px] leading-relaxed text-[#b7aa9c]">
            Evidence-backed local visibility, review momentum, corroboration, and founder action. Review activity is a directional customer-activity proxy only.
          </p>
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#6f655d]">Updated {dateLabel(workspace.lastUpdated)}</p>
      </div>

      <dl className="mt-10 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryItem label="Google rating" value={metric(hourglass.rating, 1)} note={hourglass.rating === null ? "Unavailable" : "Observed · Google Places snapshot"} />
        <SummaryItem label="Google reviews" value={metric(hourglass.totalReviews)} note={hourglass.totalReviews === null ? "Unavailable" : "Canonical review evidence"} />
        <SummaryItem label="3-month pace" value={hourglass.windows[3].monthlyRate === null ? "Unavailable" : `${hourglass.windows[3].monthlyRate.toFixed(1)} / month`} note={methodLabel(hourglass.windows[3].method)} />
        <SummaryItem label="Pace state" value={hourglass.pace} note="Compares current and prior 3-month review-count rates" />
        <SummaryItem label="Latest visibility signal" value={workspace.latestVisibilitySignal} note={workspace.localFalcon.latestCapturedOn ? "Observed · imported report" : workspace.searchSignals.length ? "Observed · Search Console" : "Unavailable"} />
        <SummaryItem label="Corroboration" value={workspace.corroborationSummary} note="Verified evidence only; unknown sources remain unknown" />
      </dl>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <ChangePanel title="What changed?" items={workspace.changes} empty="No material Local Authority changes since the prior observation." />
        <ChangePanel title="What needs attention?" items={workspace.attention} empty="No measurement-blocking Local Authority gaps are open." />
      </div>

      <Section eyebrow="Review evidence" title="Competitor review velocity">
        <p className="mt-3 max-w-[48rem] text-[13px] leading-relaxed text-[#8d8073]">{trackingMessage} Historical windows stay unavailable until an observation exists at or before the comparison date. Short history is never annualized.</p>
        <div className="mt-6 overflow-x-auto rounded-[18px] border border-white/[0.08]">
          <table className="min-w-[1060px] w-full border-collapse text-left">
            <thead className="bg-white/[0.025] text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">
              <tr><th className="px-4 py-4">Business</th><th className="px-3 py-4 text-right">Rating</th><th className="px-3 py-4 text-right">Total reviews</th><th className="px-3 py-4 text-right">+3m</th><th className="px-3 py-4 text-right">+6m</th><th className="px-3 py-4 text-right">+12m</th><th className="px-3 py-4 text-right">+24m</th><th className="px-3 py-4 text-right">Reviews/month (3m)</th><th className="px-3 py-4">Pace</th><th className="px-4 py-4">Evidence coverage</th></tr>
            </thead>
            <tbody>
              {workspace.businesses.map((business) => (
                <tr key={business.business} className="border-t border-white/[0.06]">
                  <th scope="row" className="px-4 py-4 text-[13px] font-normal text-[#efe8de]">{business.business}</th>
                  <td className="px-3 py-4 text-right text-[13px] text-[#d8cfc4]">{metric(business.rating, 1)}</td>
                  <td className="px-3 py-4 text-right text-[13px] text-[#d8cfc4]">{metric(business.totalReviews)}</td>
                  <WindowCell business={business} months={3} /><WindowCell business={business} months={6} /><WindowCell business={business} months={12} /><WindowCell business={business} months={24} />
                  <td className="px-3 py-4 text-right text-[13px] text-[#d8cfc4]">{business.windows[3].monthlyRate === null ? "—" : business.windows[3].monthlyRate.toFixed(1)}</td>
                  <td className="px-3 py-4 text-[13px] text-[#d8cfc4]">{business.pace}</td>
                  <td className="px-4 py-4 text-[11px] leading-relaxed text-[#8d8073]">
                    {business.latestSnapshotAt ? `${business.windows[3].coverageDays} days · ${methodLabel(business.windows[3].method)}` : "Unavailable"}<br />
                    {business.role === "self" && business.latestReviewAt ? `Latest exact review ${dateLabel(business.latestReviewAt)}` : `Evidence through ${dateLabel(business.latestSnapshotAt)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-[#6f655d]">Review growth is not revenue, sales, transaction volume, customer count, or customer share.</p>
      </Section>

      <Section eyebrow="Observed history" title="Review-count movement">
        <div className="mt-5 flex flex-wrap gap-2" aria-label="History window">
          {WINDOW_OPTIONS.map((months) => <Link key={months} href={`?window=${months}`} aria-current={selectedWindow === months ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-4 text-[10px] uppercase tracking-[0.18em] ${selectedWindow === months ? "border-[#ad9164]/60 text-[#efe8de]" : "border-white/[0.08] text-[#8d8073]"}`}>{months}m</Link>)}
        </div>
        <div className="mt-5 rounded-[18px] border border-white/[0.08] px-5">
          {workspace.businesses.map((business) => <Trend key={business.business} business={business} months={selectedWindow} />)}
        </div>
        {workspace.shareOfTrackedReviewGrowth !== null ? (
          <div className="mt-5 rounded-[18px] border border-white/[0.08] p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-[#8d8073]">Share of tracked review growth</p><p className="mt-2 font-serif text-[1.6rem] text-[#efe8de]">{(workspace.shareOfTrackedReviewGrowth * 100).toFixed(1)}%</p><p className="mt-2 text-[12px] text-[#8d8073]">Six-month window · all five businesses have comparable snapshot coverage</p></div>
        ) : null}
      </Section>

      <Section eyebrow="Imported evidence" title="Local Falcon">
        {workspace.localFalcon.latestCapturedOn ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <SummaryItem label="Latest import" value={dateLabel(workspace.localFalcon.latestCapturedOn)} note="Canonical competitor review-count evidence" />
            <SummaryItem label="Imported rows" value={metric(workspace.localFalcon.importedSnapshotRows)} note="Local Falcon Review Velocity scores are never treated as review counts" />
          </div>
        ) : <p className="mt-5 text-[14px] text-[#a99c90]">No imported Local Falcon competitor evidence yet.</p>}
      </Section>

      <Section eyebrow="Search context" title="Search signals">
        {workspace.searchSignals.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{workspace.searchSignals.map((signal) => <SummaryItem key={signal.label} label={signal.label} value={signal.value} note={`${signal.trend ? `${signal.trend} · ` : ""}${signal.source}`} />)}</div>
        ) : <p className="mt-5 text-[14px] text-[#a99c90]">No current Search Console evidence is available in Agent OS.</p>}
        <Link href="/executive-dashboard#search-authority" className="mt-5 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164]">Open deeper search analysis →</Link>
      </Section>

      <Section eyebrow="Entity evidence" title="Corroboration register">
        <div className="mt-6 overflow-x-auto rounded-[18px] border border-white/[0.08]">
          <table className="min-w-[920px] w-full border-collapse text-left">
            <thead className="bg-white/[0.025] text-[10px] uppercase tracking-[0.16em] text-[#8d8073]"><tr><th className="px-4 py-4">Source</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Last checked</th><th className="px-4 py-4">Evidence / note</th><th className="px-4 py-4">Next action</th><th className="px-4 py-4">Owner</th></tr></thead>
            <tbody>{workspace.corroboration.map((row) => <tr key={row.sourceId} className="border-t border-white/[0.06] text-[13px] text-[#d8cfc4]"><th scope="row" className="px-4 py-4 font-normal text-[#efe8de]">{row.url ? <a href={row.url} rel="noreferrer" target="_blank" className="underline decoration-white/20 underline-offset-4">{row.authority}</a> : row.authority}<span className="mt-1 block text-[9px] uppercase tracking-[0.16em] text-[#6f655d]">{row.provenance}</span></th><td className="px-4 py-4">{row.status}</td><td className="px-4 py-4">{dateLabel(row.lastChecked)}</td><td className="max-w-[18rem] px-4 py-4 text-[#a99c90]">{row.evidence ?? "No evidence recorded."}</td><td className="max-w-[18rem] px-4 py-4 text-[#a99c90]">{row.nextAction ?? "No action recorded."}</td><td className="px-4 py-4 text-[#a99c90]">{row.owner ?? "Unassigned"}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section eyebrow="Founder workflow" title="Action queue">
        {workspace.actions.length ? <div className="mt-6 space-y-3">{workspace.actions.map((row) => <article key={row.id} className="grid gap-3 rounded-[18px] border border-white/[0.08] p-5 md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.17em] text-[#8d8073]"><span>{row.status}</span><span>·</span><span>{row.priority} priority</span><span>·</span><span>{row.related}</span></div><h3 className="mt-2 text-[15px] text-[#efe8de]">{row.title}</h3><p className="mt-2 text-[12px] leading-relaxed text-[#8d8073]">{row.evidence}</p></div><Link href="/executive-dashboard/concierge/action/new" className="inline-flex min-h-11 items-center text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">Create Open Job →</Link></article>)}</div> : <p className="mt-5 text-[14px] text-[#a99c90]">No unresolved Local Authority conditions are producing actions.</p>}
      </Section>
    </div>
  );
}
