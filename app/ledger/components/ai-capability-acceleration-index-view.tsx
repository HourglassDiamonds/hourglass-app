/**
 * AI Capability Monitor — qualitative public view.
 * Numerical model archived at ./archived/ai-capability-numerical-view.tsx
 */
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import {
  LedgerMonitorMethodNotice,
  LedgerMonitorStatusLines,
  LedgerQualitativeStatesBlock,
  LedgerSourcesReviewed,
} from "./ledger-monitor-chrome";
import {
  ACAI_ABOVE_85,
  ACAI_ASSESSMENT,
  ACAI_CAPABILITY_READINGS,
  ACAI_FOOTER_NOTE,
  ACAI_FRONTIER_WATCHLIST,
  ACAI_LAYERS,
  ACAI_MILESTONES,
  ACAI_SECTION_SUBTITLES,
  ACAI_SNAPSHOT,
  ACAI_SUMMARY,
  ACAI_WEEKLY_SIGNAL,
  ACAI_WHAT_MOVED,
} from "../ai-capability-acceleration-data";
import "../ai-capability-acceleration-index.css";

const DISPLAY_TITLE = "AI Capability Monitor";
const INTRO =
  "A qualitative monitor of how AI capability, deployment, and physical infrastructure move together — across models, agents, enterprise integration, power, and grid constraints. The purpose is not to forecast AGI. It is to track an industrial buildout: where software progress meets operational friction, energy limits, and organizational adaptation lag.";

/** Public qualitative labels (override archived band labels where specified). */
const QUALITATIVE_STATES: Record<string, string> = {
  "Frontier Models": "Elevated",
  "Agents & Tool Use": "Rising",
  "Coding & Software": "Accelerating",
  "Enterprise Deployment": "Uneven",
  "Infrastructure Demand": "High",
  "Labor Substitution": "Widening",
  "Governance & Risk": "Lagging",
};

export default function AICapabilityAccelerationIndexView() {
  const footerBody = ACAI_FOOTER_NOTE.replace(/^Method note:\s*/i, "").replace(
    /AI Capability Acceleration Index/g,
    "AI Capability Monitor",
  );

  return (
    <section
      className={`ledger-index-page ledger-acai ${LEDGER_INDEX_PAGE_CLASS}`}
    >
      <LedgerIndexBreadcrumb current={DISPLAY_TITLE} />

      <span className="acai-kicker ledger-index-kicker">
        The Ledger Intelligence System
      </span>
      <h1 className="acai-title ledger-index-title">{DISPLAY_TITLE}</h1>
      <p className="acai-intro ledger-index-intro">{INTRO}</p>
      <LedgerMonitorStatusLines />

      <div className="acai-hero">
        <div className="acai-card ledger-index-hero-card">
          <div className="ledger-monitor-status-pair">
            <div>
              <p className="ledger-monitor-pair-label">Current State</p>
              <p className="ledger-monitor-pair-value">
                {ACAI_SNAPSHOT.currentState}
              </p>
            </div>
            <div>
              <p className="ledger-monitor-pair-label">Deployment Condition</p>
              <p className="ledger-monitor-pair-value">
                {ACAI_SNAPSHOT.currentDirection}
              </p>
            </div>
          </div>

          <p className="acai-summary ledger-monitor-lead">{ACAI_SUMMARY}</p>
          <p className="acai-assessment ledger-monitor-lead">{ACAI_ASSESSMENT}</p>

          <div className="ledger-monitor-state-grid">
            {ACAI_LAYERS.map((layer) => (
              <article key={layer.name} className="ledger-monitor-state-card">
                <p className="ledger-monitor-state-name">{layer.name}</p>
                <p className="ledger-monitor-state-level">{layer.level}</p>
                <p className="ledger-monitor-state-body">{layer.body}</p>
              </article>
            ))}
          </div>

          <div className="ledger-signal-block">
            <p className="ledger-changed-label">This week&apos;s signal</p>
            <p className="ledger-changed-body">{ACAI_WEEKLY_SIGNAL}</p>
          </div>

          <div className="ledger-monitor-state-grid ledger-monitor-state-grid--wide3 ledger-monitor-state-grid--seven">
            {ACAI_CAPABILITY_READINGS.map((reading) => (
              <article key={reading.name} className="ledger-monitor-state-card">
                <p className="ledger-monitor-state-name">{reading.name}</p>
                <p className="ledger-monitor-state-level">
                  {QUALITATIVE_STATES[reading.name] ?? reading.band}
                </p>
                <p className="ledger-monitor-state-body">{reading.text}</p>
              </article>
            ))}
          </div>

          <LedgerMonitorMethodNotice notice="Current readings use qualitative states, documented evidence and defined change triggers." />
        </div>
      </div>

      <div className="acai-section ledger-index-section">
        <h3 className="acai-section-title ledger-index-section-title">
          What Moved
        </h3>
        <p className="acai-section-subtitle">{ACAI_SECTION_SUBTITLES.whatMoved}</p>
        <div className="acai-grid-3">
          {ACAI_WHAT_MOVED.map((card) => (
            <div key={card.title} className="acai-driver-card">
              <h4>{card.title}</h4>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="acai-section ledger-index-section">
        <h3 className="acai-section-title">Major Milestones to Watch</h3>
        <p className="acai-section-subtitle">
          {ACAI_SECTION_SUBTITLES.milestones}
        </p>
        <div className="acai-grid-3">
          {ACAI_MILESTONES.map((card) => (
            <div key={card.title} className="acai-trigger-card">
              <span className="acai-trigger-label">{card.label}</span>
              <h4>{card.title}</h4>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="acai-section ledger-index-section">
        <h3 className="acai-section-title">Current Frontier Watchlist</h3>
        <p className="acai-section-subtitle">
          {ACAI_SECTION_SUBTITLES.frontierWatchlist}
        </p>
        <div className="acai-grid-2">
          {ACAI_FRONTIER_WATCHLIST.map((card) => (
            <div key={card.title} className="acai-trigger-card">
              <span className="acai-trigger-label">{card.label}</span>
              <h4>{card.title}</h4>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="acai-section ledger-index-section">
        <h3 className="acai-section-title">What Would Raise the Read</h3>
        <p className="acai-section-subtitle">
          {ACAI_SECTION_SUBTITLES.above85}
        </p>
        <div className="acai-grid-3">
          {ACAI_ABOVE_85.map((card) => (
            <div key={card.title} className="acai-trigger-card">
              <span className="acai-trigger-label">{card.label}</span>
              <h4>{card.title}</h4>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <LedgerSourcesReviewed sources={ACAI_SNAPSHOT.sources} />
      <LedgerQualitativeStatesBlock />

      <p className="acai-footer ledger-index-page-note">
        <em>Editorial note:</em> {footerBody}
      </p>
    </section>
  );
}
