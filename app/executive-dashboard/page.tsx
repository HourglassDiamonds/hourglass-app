import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "../shared-components/Header";

export const metadata: Metadata = {
  title: "Executive Dashboard",
  description:
    "Internal overview of business momentum, consumer behavior, and authority signals.",
  robots: { index: false, follow: false },
};

/** Shared surface tokens — borders ~12% softer than prior pass */
const SURFACE_BORDER = "border-[#e4dbcf]/62";
const SURFACE_BG = "bg-white/32";
const MUTED_LABEL = "text-[#948a80]";
const MUTED_TREND = "text-[#7a7268]";
const MUTED_BODY = "text-[#5f5851]";
const MUTED_FOOTER = "text-[#847a70]";

type MetricRhythm = "default" | "airy" | "tight";

const PLACEHOLDER = {
  weeklySignal: {
    status: "Emerging",
    insight:
      "Elongated shapes continue to lead interaction depth, while east/west orientation interest is rising on mobile.",
    note: "Use this week’s content to reinforce proportion guidance, visual reassurance, and calm confidence around larger face-up presence.",
  },
  businessPulse: {
    sectionNote:
      "Momentum remains steady; subscriber growth is outpacing inquiry growth.",
    weeklyTraffic: {
      value: "4,280",
      trendLine: "+12% vs prior week",
      status: "Accelerating",
    },
    subscribers: {
      value: "1,847",
      trendLine: "+38 net adds this week",
      status: "Accelerating",
    },
    conciergeInquiries: {
      value: "14",
      trendLine: "+3 vs prior week",
      status: "Stable",
    },
    consultationConversion: {
      value: "68%",
      trendLine: "+4 pts vs prior week",
      status: "Accelerating",
    },
    returningVisitors: {
      value: "31%",
      trendLine: "−2 pts vs prior week",
      status: "Cooling",
    },
  },
  diamondStudio: {
    sectionNote:
      "Preference signals continue to cluster around elongated silhouettes and balanced coverage.",
    mostSelectedShape: {
      value: "Oval",
      trendLine: "Most session depth",
      status: "Stable",
    },
    fastestGrowingShape: {
      value: "Emerald",
      trendLine: "+24% week over week",
      status: "Accelerating",
    },
    avgCaratCluster: {
      value: "1.8 – 2.5 ct",
      trendLine: "Stable cluster",
      status: "Stable",
    },
    mostCommonCoverageZone: {
      value: "Balanced",
      trendLine: "Understated zones rising slightly",
      status: "Emerging",
    },
    mobileVsDesktop: {
      value: "58% / 42%",
      trendLine: "Mobile-led exploration",
      status: "Stable",
    },
    eastWestInterest: {
      value: "Rising",
      trendLine: "E/W +11% week over week on oval",
      status: "Emerging",
    },
  },
  content: {
    sectionNote:
      "Upgrade pages where high visibility is not yet converting into deeper engagement.",
    topArticles: [
      { title: "Diamond Size on Finger", note: "1,240 sessions · strong depth" },
      { title: "Oval vs Round Presence", note: "890 sessions" },
      { title: "GIA Certification Guide", note: "720 sessions" },
    ],
    fastestGrowingPages: [
      { title: "/diamond-studio", note: "+34% vs prior week · Accelerating" },
      { title: "/diamond-guide/diamond-shapes", note: "+18% vs prior week" },
      { title: "/concierge", note: "+9% vs prior week" },
    ],
    pagesToUpgrade: [
      {
        title: "/diamond-guide/diamond-clarity",
        note: "Declining CTR · Watch",
      },
      { title: "/engagement-rings", note: "High exit rate" },
      { title: "/custom-design", note: "Thin time on page" },
    ],
  },
  localAuthority: {
    sectionNote:
      "Review velocity and profile engagement remain important local trust indicators.",
    googleReviews: {
      value: "4.9",
      trendLine: "142 total · +2 this week",
      status: "Stable",
    },
    directionRequests: {
      value: "86",
      trendLine: "+6% vs prior week",
      status: "Accelerating",
    },
    calls: { value: "34", trendLine: "Stable", status: "Stable" },
    gmbEngagement: {
      value: "Rising",
      trendLine: "Profile views +9%",
      status: "Accelerating",
    },
  },
  ledger: {
    sectionNote:
      "Maintain calm authority; avoid urgency-led luxury messaging.",
    currentEnvironment: "Measured caution with selective confidence",
    messagingGuidance:
      "Lead with calm guidance and permanence; avoid urgency framing",
    consumerSentiment:
      "Quiet luxury and process clarity resonate; information fatigue elevated in macro indices",
  },
};

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
  status,
  rhythm = "default",
}: {
  label: string;
  value: string;
  trendLine?: string;
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

export default function ExecutiveDashboardPage() {
  const d = PLACEHOLDER;

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1140px] px-6 pb-28 md:px-12 md:pb-36 lg:px-14">
        <Header />

        <header className="border-b border-[#e4dbcf]/75 pb-14 pt-10 md:pb-16 md:pt-14">
          <p className="text-[10px] uppercase tracking-[0.38em] text-[#8a8176]">
            Internal · Placeholder data
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
            eyebrow="Overview"
            title="Business Pulse"
            note={d.businessPulse.sectionNote}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <MetricCard
                label="Weekly Traffic"
                value={d.businessPulse.weeklyTraffic.value}
                trendLine={d.businessPulse.weeklyTraffic.trendLine}
                status={d.businessPulse.weeklyTraffic.status}
                rhythm="airy"
              />
              <MetricCard
                label="Subscribers"
                value={d.businessPulse.subscribers.value}
                trendLine={d.businessPulse.subscribers.trendLine}
                status={d.businessPulse.subscribers.status}
              />
              <MetricCard
                label="Concierge Inquiries"
                value={d.businessPulse.conciergeInquiries.value}
                trendLine={d.businessPulse.conciergeInquiries.trendLine}
                status={d.businessPulse.conciergeInquiries.status}
                rhythm="tight"
              />
              <MetricCard
                label="Consultation Conversion"
                value={d.businessPulse.consultationConversion.value}
                trendLine={d.businessPulse.consultationConversion.trendLine}
                status={d.businessPulse.consultationConversion.status}
              />
              <MetricCard
                label="Returning Visitors"
                value={d.businessPulse.returningVisitors.value}
                trendLine={d.businessPulse.returningVisitors.trendLine}
                status={d.businessPulse.returningVisitors.status}
                rhythm="airy"
              />
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Product"
            title="Diamond Studio Intelligence"
            note={d.diamondStudio.sectionNote}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
              <MetricCard
                label="Most Selected Shape"
                value={d.diamondStudio.mostSelectedShape.value}
                trendLine={d.diamondStudio.mostSelectedShape.trendLine}
                status={d.diamondStudio.mostSelectedShape.status}
              />
              <MetricCard
                label="Fastest Growing Shape"
                value={d.diamondStudio.fastestGrowingShape.value}
                trendLine={d.diamondStudio.fastestGrowingShape.trendLine}
                status={d.diamondStudio.fastestGrowingShape.status}
                rhythm="airy"
              />
              <MetricCard
                label="Avg Carat Cluster"
                value={d.diamondStudio.avgCaratCluster.value}
                trendLine={d.diamondStudio.avgCaratCluster.trendLine}
                status={d.diamondStudio.avgCaratCluster.status}
                rhythm="tight"
              />
              <MetricCard
                label="Most Common Coverage Zone"
                value={d.diamondStudio.mostCommonCoverageZone.value}
                trendLine={d.diamondStudio.mostCommonCoverageZone.trendLine}
                status={d.diamondStudio.mostCommonCoverageZone.status}
              />
              <MetricCard
                label="Mobile vs Desktop"
                value={d.diamondStudio.mobileVsDesktop.value}
                trendLine={d.diamondStudio.mobileVsDesktop.trendLine}
                status={d.diamondStudio.mobileVsDesktop.status}
              />
              <MetricCard
                label="East / West Interest"
                value={d.diamondStudio.eastWestInterest.value}
                trendLine={d.diamondStudio.eastWestInterest.trendLine}
                status={d.diamondStudio.eastWestInterest.status}
                rhythm="airy"
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
                {d.content.topArticles.map((row) => (
                  <ListRow
                    key={row.title}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Fastest Growing Pages">
                {d.content.fastestGrowingPages.map((row) => (
                  <ListRow
                    key={row.title}
                    primary={row.title}
                    secondary={row.note}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Pages To Upgrade">
                {d.content.pagesToUpgrade.map((row) => (
                  <ListRow
                    key={row.title}
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
            <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
              <MetricCard
                label="Google Reviews"
                value={d.localAuthority.googleReviews.value}
                trendLine={d.localAuthority.googleReviews.trendLine}
                status={d.localAuthority.googleReviews.status}
              />
              <MetricCard
                label="Direction Requests"
                value={d.localAuthority.directionRequests.value}
                trendLine={d.localAuthority.directionRequests.trendLine}
                status={d.localAuthority.directionRequests.status}
                rhythm="airy"
              />
              <MetricCard
                label="Calls"
                value={d.localAuthority.calls.value}
                trendLine={d.localAuthority.calls.trendLine}
                status={d.localAuthority.calls.status}
                rhythm="tight"
              />
              <MetricCard
                label="GMB Engagement"
                value={d.localAuthority.gmbEngagement.value}
                trendLine={d.localAuthority.gmbEngagement.trendLine}
                status={d.localAuthority.gmbEngagement.status}
              />
            </div>
          </SectionPanel>

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
          Scaffold only — metrics are placeholders until live integrations are
          connected. See docs/executive-dashboard-system.md.
        </p>
      </div>
    </div>
  );
}
