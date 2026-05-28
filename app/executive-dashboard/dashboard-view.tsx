import type { ReactNode } from "react";
import Header from "../shared-components/Header";
import type {
  ExecutiveDashboardData,
  MetricField,
} from "@/lib/intelligence/dashboard-data";

const SURFACE_BORDER = "border-[#e4dbcf]/62";
const SURFACE_BG = "bg-white/32";
const MUTED_LABEL = "text-[#948a80]";
const MUTED_TREND = "text-[#7a7268]";
const MUTED_BODY = "text-[#5f5851]";
const MUTED_FOOTER = "text-[#847a70]";

type MetricRhythm = "default" | "airy" | "tight";

function metricCardProps(
  label: string,
  field: MetricField,
  rhythm?: MetricRhythm,
) {
  return {
    label,
    value: field.value,
    trendLine: field.trendLine,
    sourceLabel: field.sourceLabel,
    status: field.status,
    rhythm,
  };
}

function StatusLabel({ children }: { children: string }) {
  return (
    <span className="shrink-0 text-[9px] uppercase tracking-[0.3em] text-[#948a80]">
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  trendLine,
  sourceLabel,
  status,
  rhythm = "default",
}: {
  label: string;
  value: string;
  trendLine?: string;
  sourceLabel?: string;
  status?: string;
  rhythm?: MetricRhythm;
}) {
  const valueSpacing =
    rhythm === "airy" ? "mt-5" : rhythm === "tight" ? "mt-3" : "mt-4";
  const padY = rhythm === "airy" ? "py-7 md:py-8" : "py-6 md:py-7";

  return (
    <div
      className={`rounded-sm border ${SURFACE_BORDER} ${SURFACE_BG} px-6 md:px-7 ${padY}`}
    >
      <div className="flex items-start justify-between gap-4">
        <p
          className={`max-w-[14ch] text-[9.5px] uppercase leading-[1.45] tracking-[0.34em] ${MUTED_LABEL}`}
        >
          {label}
        </p>
        {status ? <StatusLabel>{status}</StatusLabel> : null}
      </div>
      <p
        className={`${valueSpacing} font-serif text-[1.42rem] font-normal leading-[1.12] tracking-[-0.02em] text-[#1f1c19] md:text-[1.48rem]`}
      >
        {value}
      </p>
      {sourceLabel ? (
        <p className={`mt-2 text-[10px] uppercase tracking-[0.28em] ${MUTED_TREND}`}>
          {sourceLabel}
        </p>
      ) : null}
      {trendLine ? (
        <p
          className={`mt-3 text-[11.5px] leading-[1.6] tracking-[0.01em] ${MUTED_TREND}`}
        >
          {trendLine}
        </p>
      ) : null}
    </div>
  );
}

function WeeklySignalPanel({
  status,
  insight,
  note,
}: {
  status: string;
  insight: string;
  note: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-sm border border-[#d9cdb9]/72 ${SURFACE_BG} bg-[#f6f0e8]/75 shadow-[0_14px_40px_rgba(48,36,28,0.04)]`}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[#d4c4b0]/90 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_12%_20%,rgba(255,252,248,0.55),transparent_55%)]"
        aria-hidden
      />

      <div className="relative border-l border-[#d8cbb8]/85 px-8 py-9 md:px-11 md:py-11 lg:px-12 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.38em] text-[#8a8176]">
            Weekly Signal
          </p>
          <StatusLabel>{status}</StatusLabel>
        </div>

        <p className="mt-6 max-w-[42rem] font-serif text-[1.28rem] font-normal leading-[1.42] tracking-[-0.022em] text-[#1a1816] md:mt-7 md:text-[1.44rem] md:leading-[1.38] lg:text-[1.5rem]">
          {insight}
        </p>

        <p
          className={`mt-7 max-w-[40rem] border-t border-[#ebe5dc]/55 pt-7 text-[0.95rem] leading-[1.84] ${MUTED_BODY} md:mt-8`}
        >
          {note}
        </p>
      </div>
    </section>
  );
}

function SectionPanel({
  eyebrow,
  title,
  note,
  children,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[#e4dbcf]/55 pt-20 md:pt-24 lg:pt-28">
      <p className="text-[10px] uppercase tracking-[0.36em] text-[#8a8176]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-[1.3rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.45rem]">
        {title}
      </h2>
      {note ? (
        <p
          className={`mt-4 max-w-[42rem] text-[0.94rem] leading-[1.8] ${MUTED_BODY} md:mt-5`}
        >
          {note}
        </p>
      ) : null}
      <div className="mt-10 md:mt-12">{children}</div>
    </section>
  );
}

function ListPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-sm border ${SURFACE_BORDER} ${SURFACE_BG} px-6 py-3 md:px-7`}
    >
      <p
        className={`border-b border-[#ebe5dc]/65 py-5 text-[9.5px] uppercase tracking-[0.32em] ${MUTED_LABEL}`}
      >
        {title}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function ListRow({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-[#ebe5dc]/65 py-5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <span className="text-[0.93rem] leading-[1.52] text-[#2a2620]">{primary}</span>
      <span
        className={`shrink-0 text-[11px] leading-[1.55] ${MUTED_TREND} sm:max-w-[42%] sm:text-right`}
      >
        {secondary}
      </span>
    </li>
  );
}

function InsightBlock({
  label,
  body,
}: {
  label: string;
  body: string;
}) {
  return (
    <div
      className={`rounded-sm border ${SURFACE_BORDER} ${SURFACE_BG} px-6 py-6 md:px-7 md:py-7`}
    >
      <p className={`text-[9.5px] uppercase tracking-[0.32em] ${MUTED_LABEL}`}>
        {label}
      </p>
      <p className={`mt-4 text-[0.93rem] leading-[1.8] ${MUTED_BODY}`}>{body}</p>
    </div>
  );
}

type Props = {
  data: ExecutiveDashboardData;
  isLive: boolean;
  weekLabel?: string;
};

export function ExecutiveDashboardView({ data: d, isLive, weekLabel }: Props) {
  const badge = isLive && weekLabel
    ? `Internal · GA4 week of ${weekLabel}`
    : "Internal · Placeholder data";

  const footer = isLive
    ? "Hourglass Intelligence Engine · GA4 metrics are live from the latest weekly snapshot. GSC, GMB, path funnels, and Ledger indices show as Pending until wired into the ingestion layer."
    : "Scaffold only — no weekly report loaded. Run the GA4 weekly job for live metrics. See docs/executive-dashboard-system.md.";

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1140px] px-6 pb-28 md:px-12 md:pb-36 lg:px-14">
        <Header />

        <header className="border-b border-[#e4dbcf]/75 pb-14 pt-10 md:pb-16 md:pt-14">
          <p className="text-[10px] uppercase tracking-[0.38em] text-[#8a8176]">
            {badge}
          </p>
          <h1 className="mt-5 font-serif text-[2rem] font-normal leading-[1.1] tracking-[-0.03em] text-[#1a1816] md:text-[2.35rem]">
            Executive Dashboard
          </h1>
          <p className={`mt-6 max-w-[34rem] text-[1.02rem] leading-[1.9] ${MUTED_BODY}`}>
            Business momentum, consumer behavior, and authority signals.
          </p>
        </header>

        <div className="mt-20 md:mt-24 lg:mt-28">
          <WeeklySignalPanel
            status={d.weeklySignal.status}
            insight={d.weeklySignal.insight}
            note={d.weeklySignal.note}
          />
        </div>

        <div className="mt-24 space-y-24 md:mt-28 md:space-y-28 lg:mt-32 lg:space-y-32">
          <SectionPanel
            eyebrow="Search"
            title="Search + Authority Momentum"
            note={d.searchAuthority.sectionNote}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              <MetricCard
                {...metricCardProps(
                  "Total Impressions",
                  d.searchAuthority.totalImpressions,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Impressions Trend",
                  d.searchAuthority.impressionsTrend,
                )}
              />
              <MetricCard
                {...metricCardProps("Total Clicks", d.searchAuthority.totalClicks)}
              />
              <MetricCard
                {...metricCardProps("Clicks Trend", d.searchAuthority.clicksTrend)}
              />
              <MetricCard
                {...metricCardProps(
                  "Average Position",
                  d.searchAuthority.averagePosition,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Position Movement",
                  d.searchAuthority.positionMovement,
                )}
              />
              <MetricCard
                {...metricCardProps("CTR Trend", d.searchAuthority.ctrTrend)}
              />
              <MetricCard
                {...metricCardProps("Indexed Pages", d.searchAuthority.indexedPages)}
              />
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-7">
              <ListPanel title="Top Gaining Queries">
                {d.searchAuthority.topGainingQueries.map((row, i) => (
                  <ListRow
                    key={`gain-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Top Losing Queries">
                {d.searchAuthority.topLosingQueries.map((row, i) => (
                  <ListRow
                    key={`lose-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Top Pages by Impressions">
                {d.searchAuthority.topPagesByImpressions.map((row, i) => (
                  <ListRow
                    key={`imp-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Fastest Climbing Pages">
                {d.searchAuthority.fastestClimbingPages.map((row, i) => (
                  <ListRow
                    key={`climb-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Brand"
            title="Brand Demand"
            note={d.brandDemand.sectionNote}
          >
            <p className={`mb-8 max-w-[42rem] text-[11px] leading-[1.7] ${MUTED_TREND}`}>
              Tracked patterns: {d.brandDemand.trackedQueriesNote}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <MetricCard
                {...metricCardProps(
                  "Branded Impressions",
                  d.brandDemand.brandedImpressions,
                )}
              />
              <MetricCard
                {...metricCardProps("Branded Clicks", d.brandDemand.brandedClicks)}
              />
              <MetricCard
                {...metricCardProps("Branded CTR", d.brandDemand.brandedCtr)}
              />
              <MetricCard
                {...metricCardProps(
                  "Brand Search Growth",
                  d.brandDemand.brandSearchGrowth,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Non-Brand vs Brand",
                  d.brandDemand.nonBrandVsBrand,
                )}
              />
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Conversion"
            title="Consultation Funnel"
            note={d.consultationFunnel.sectionNote}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <MetricCard
                {...metricCardProps(
                  "Weekly Traffic",
                  d.consultationFunnel.weeklyTraffic,
                  "airy",
                )}
              />
              <MetricCard
                {...metricCardProps("Subscribers", d.consultationFunnel.subscribers)}
              />
              <MetricCard
                {...metricCardProps(
                  "Concierge Inquiries",
                  d.consultationFunnel.conciergeInquiries,
                  "tight",
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Consultation Conversion",
                  d.consultationFunnel.consultationConversion,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Returning Visitors",
                  d.consultationFunnel.returningVisitors,
                  "airy",
                )}
              />
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Product"
            title="Diamond Studio Intelligence"
            note={d.diamondStudio.sectionNote}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <MetricCard
                {...metricCardProps("Studio Visits", d.diamondStudio.studioVisits)}
              />
              <MetricCard
                {...metricCardProps(
                  "Most Selected Shape",
                  d.diamondStudio.mostSelectedShape,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Fastest Growing Shape",
                  d.diamondStudio.fastestGrowingShape,
                  "airy",
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Avg Carat Cluster",
                  d.diamondStudio.avgCaratCluster,
                  "tight",
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Coverage Zone",
                  d.diamondStudio.mostCommonCoverageZone,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Mobile vs Desktop",
                  d.diamondStudio.mobileVsDesktop,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "East / West Interest",
                  d.diamondStudio.eastWestInterest,
                  "airy",
                )}
              />
              <MetricCard
                {...metricCardProps("Return Usage", d.diamondStudio.returnUsage)}
              />
              <MetricCard
                {...metricCardProps("Session Depth", d.diamondStudio.sessionDepth)}
              />
              <MetricCard
                {...metricCardProps(
                  "High-Intent Sessions",
                  d.diamondStudio.highIntentSessions,
                )}
              />
              <MetricCard
                {...metricCardProps("Repeat Users (7d)", d.diamondStudio.repeatUsers7d)}
              />
              <MetricCard
                {...metricCardProps("CTA Pathing", d.diamondStudio.ctaPathing)}
              />
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Organic"
            title="Content Performance"
            note={d.content.sectionNote}
          >
            <div className="grid gap-6 lg:grid-cols-3 lg:gap-7">
              <ListPanel title="Top Articles">
                {d.content.topArticles.map((row, i) => (
                  <ListRow
                    key={`top-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Fastest Growing Pages">
                {d.content.fastestGrowingPages.map((row, i) => (
                  <ListRow
                    key={`grow-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Pages To Upgrade">
                {d.content.pagesToUpgrade.map((row, i) => (
                  <ListRow
                    key={`up-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Local"
            title="Local Authority"
            note={d.localAuthority.sectionNote}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <MetricCard
                {...metricCardProps("Google Reviews", d.localAuthority.googleReviews)}
              />
              <MetricCard
                {...metricCardProps("Profile Views", d.localAuthority.profileViews)}
              />
              <MetricCard
                {...metricCardProps(
                  "Website Clicks (GBP)",
                  d.localAuthority.websiteClicksFromGbp,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Direction Requests",
                  d.localAuthority.directionRequests,
                  "airy",
                )}
              />
              <MetricCard
                {...metricCardProps("Calls", d.localAuthority.calls, "tight")}
              />
              <MetricCard
                {...metricCardProps(
                  "Review Velocity",
                  d.localAuthority.reviewVelocity,
                )}
              />
              <MetricCard
                {...metricCardProps(
                  "Unanswered Items",
                  d.localAuthority.unansweredItems,
                )}
              />
              <MetricCard
                {...metricCardProps("Post Cadence", d.localAuthority.postCadence)}
              />
              <MetricCard
                {...metricCardProps("Map Pack Trend", d.localAuthority.mapPackTrend)}
              />
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Paths"
            title="Assisted Conversion Paths"
            note={d.assistedPaths.sectionNote}
          >
            <div className="mb-8 max-w-md">
              <MetricCard
                {...metricCardProps(
                  "Studio-Assisted Conversion",
                  d.assistedPaths.studioAssistedConversion,
                )}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
              <ListPanel title="Before Concierge Visit">
                {d.assistedPaths.pathsBeforeConcierge.map((row, i) => (
                  <ListRow
                    key={`pc-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Before Consultation CTA">
                {d.assistedPaths.pathsBeforeCtaClick.map((row, i) => (
                  <ListRow
                    key={`cta-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Paths to Form Submit">
                {d.assistedPaths.pathsToFormSubmit.map((row, i) => (
                  <ListRow
                    key={`form-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Assisting Pages & Tools">
                {d.assistedPaths.assistingPages.map((row, i) => (
                  <ListRow
                    key={`assist-${row.title}-${i}`}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
            </div>
          </SectionPanel>

          {d.recommendations.items.length > 0 ? (
            <SectionPanel
              eyebrow="Actions"
              title="Recommendation Engine"
              note={d.recommendations.sectionNote}
            >
              <div className="grid gap-5 md:grid-cols-2 lg:gap-6">
                {d.recommendations.items.map((item) => (
                  <InsightBlock
                    key={item.title}
                    label={`${item.priority} · ${item.actionType ?? "ops"}`}
                    body={`${item.title} — ${item.rationale}${item.confidence ? ` (${item.confidence} confidence)` : ""}`}
                  />
                ))}
              </div>
            </SectionPanel>
          ) : null}

          <SectionPanel
            eyebrow="Macro"
            title="Ledger / Market Tone"
            note={d.ledger.sectionNote}
          >
            <div className="grid gap-5 md:grid-cols-1 lg:grid-cols-3 lg:gap-6">
              <InsightBlock
                label="Current Environment"
                body={d.ledger.currentEnvironment}
              />
              <InsightBlock
                label="Messaging Guidance"
                body={d.ledger.messagingGuidance}
              />
              <InsightBlock
                label="Consumer Sentiment Notes"
                body={d.ledger.consumerSentiment}
              />
            </div>
          </SectionPanel>
        </div>

        <p
          className={`mt-24 border-t border-[#e4dbcf]/50 pt-10 text-center text-[11px] leading-[1.78] ${MUTED_FOOTER} md:mt-28 md:pt-11`}
        >
          {footer}
        </p>
      </div>
    </div>
  );
}
