import Link from "next/link";
import {
  GPM_CURRENT_DIRECTION,
  GPM_CURRENT_DIRECTION_LABEL,
  GPM_CURRENT_STATE,
  GPM_CURRENT_STATE_LABEL,
  GPM_DISPLAY_TITLE,
  GPM_INTRO,
  GPM_KICKER,
  GPM_LEAD,
  GPM_SNAPSHOT,
  GPM_THREAT_PANEL,
  GPM_TRANSMISSION_PANEL,
  GPM_WATCHING_BLOCKS,
  GPM_WATCHING_TITLE,
  GPM_WHAT_CHANGED,
} from "../global-pressure-monitor-data";
import {
  LedgerMonitorMethodNotice,
  LedgerMonitorStatusLines,
  LedgerQualitativeStatesBlock,
  LedgerSourcesReviewed,
} from "./ledger-monitor-chrome";
import "../global-pressure-index.css";

type GlobalPressureMonitorProps = {
  variant?: "compact" | "full";
  className?: string;
};

function StatusPanel({
  title,
  level,
  listLabel,
  items,
}: {
  title: string;
  level: string;
  listLabel: string;
  items: readonly string[];
}) {
  return (
    <article className="gpm-status-panel">
      <p className="gpm-panel-label">{title}</p>
      <p className="gpm-panel-level">{level}</p>
      <p className="gpm-panel-list-label">{listLabel}</p>
      <ul className="gpm-panel-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

export default function GlobalPressureMonitor({
  variant = "full",
  className = "",
}: GlobalPressureMonitorProps) {
  const compact = variant === "compact";
  const headingId = "global-pressure-monitor-title";

  if (compact) {
    return (
      <section
        className={`gpm-surface mx-auto w-full max-w-[920px] text-[#171717] ${className}`}
        aria-labelledby={headingId}
      >
        <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-[#6f6a63]">
          Current status
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2
            id={headingId}
            className="font-serif text-[1.25rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.35rem]"
          >
            {GPM_DISPLAY_TITLE}
          </h2>
          <Link
            href="/ledger/global-pressure-index"
            className="font-sans text-[10px] uppercase tracking-[0.16em] text-[#6f6a63] hover:text-[#4a4540]"
          >
            View full monitor →
          </Link>
        </div>

        <article className="gpm-meter-card mt-8 md:mt-10">
          <div className="gpm-status-pair">
            <div>
              <p className="gpm-pair-label">{GPM_CURRENT_STATE_LABEL}</p>
              <p className="gpm-pair-value">{GPM_CURRENT_STATE}</p>
            </div>
            <div>
              <p className="gpm-pair-label">{GPM_CURRENT_DIRECTION_LABEL}</p>
              <p className="gpm-pair-value">{GPM_CURRENT_DIRECTION}</p>
            </div>
          </div>
          <p className="gpm-lead gpm-lead-compact">{GPM_LEAD}</p>
          <LedgerMonitorMethodNotice className="gpm-methodology-notice" />
        </article>

        <LedgerMonitorStatusLines className="mt-5" />
      </section>
    );
  }

  return (
    <section
      className={`gpm-surface w-full text-[#171717] ${className}`}
      aria-labelledby={headingId}
    >
      <span className="ledger-index-kicker">{GPM_KICKER}</span>
      <h1 id={headingId} className="ledger-index-title">
        {GPM_DISPLAY_TITLE}
      </h1>
      <p className="ledger-index-intro">{GPM_INTRO}</p>
      <LedgerMonitorStatusLines />

      <div className="gpi-meter-hero-wrap">
        <article className="gpm-meter-card">
          <div className="gpm-status-pair">
            <div>
              <p className="gpm-pair-label">{GPM_CURRENT_STATE_LABEL}</p>
              <p className="gpm-pair-value">{GPM_CURRENT_STATE}</p>
            </div>
            <div>
              <p className="gpm-pair-label">{GPM_CURRENT_DIRECTION_LABEL}</p>
              <p className="gpm-pair-value">{GPM_CURRENT_DIRECTION}</p>
            </div>
          </div>

          <p className="gpm-lead">{GPM_LEAD}</p>

          <div className="ledger-changed-section">
            <p className="ledger-changed-label">
              What changed since the previous review
            </p>
            <p className="ledger-changed-body">{GPM_WHAT_CHANGED}</p>
          </div>

          <div className="gpm-panel-grid">
            <StatusPanel {...GPM_THREAT_PANEL} />
            <StatusPanel {...GPM_TRANSMISSION_PANEL} />
          </div>

          <LedgerMonitorMethodNotice className="gpm-methodology-notice" />
        </article>
      </div>

      <div className="gpi-watching">
        <h2 className="gpi-watching-title">{GPM_WATCHING_TITLE}</h2>
        <div className="gpi-watching-grid">
          {GPM_WATCHING_BLOCKS.map((block) => (
            <article key={block.title} className="gpi-watching-card">
              <h3>{block.title}</h3>
              <p>{block.body}</p>
            </article>
          ))}
        </div>
      </div>

      <LedgerSourcesReviewed sources={GPM_SNAPSHOT.sources} />
      <LedgerQualitativeStatesBlock />
    </section>
  );
}
