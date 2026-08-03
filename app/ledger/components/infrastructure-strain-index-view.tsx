/**
 * Infrastructure Strain Monitor — qualitative public view.
 * Numerical model archived at ./archived/infrastructure-strain-numerical-view.tsx
 */
import {
  ISI_CATEGORIES,
  ISI_FOOTER_NOTE,
  ISI_SNAPSHOT,
  ISI_SUMMARY,
  ISI_WEEKLY_SIGNAL,
  ISI_WHAT_WATCHING,
  ISI_WHAT_WOULD_EASE,
} from "../infrastructure-strain-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import {
  LedgerMonitorMethodNotice,
  LedgerMonitorStatusLines,
  LedgerQualitativeStatesBlock,
  LedgerSourcesReviewed,
} from "./ledger-monitor-chrome";
import "../infrastructure-strain-index.css";

const DISPLAY_TITLE = "Infrastructure Strain Monitor";
const INTRO =
  "A qualitative monitor of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics. The purpose is not to predict failure. It is to track a capacity expansion race — where capital deploys quickly, buildout timing stays uneven, and flexibility narrows beneath functioning systems.";

/** Public qualitative states (override archived labels where specified). */
const QUALITATIVE_STATES: Record<string, string> = {
  "Grid & Transmission": "High",
  "Data-Center Load": "High",
  "Transformer Supply": "Constrained",
  "Semiconductor Capacity": "Elevated",
  "Skilled Labor": "Elevated",
  "Water & Cooling": "Rising",
};

function WatchCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="isi-watch-card">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

export default function InfrastructureStrainIndexView() {
  return (
    <section
      className={`ledger-index-page ledger-isi ${LEDGER_INDEX_PAGE_CLASS}`}
    >
      <LedgerIndexBreadcrumb current={DISPLAY_TITLE} />

      <span className="isi-kicker ledger-index-kicker">
        The Ledger Intelligence System
      </span>
      <h1 className="isi-title ledger-index-title">{DISPLAY_TITLE}</h1>
      <p className="isi-intro ledger-index-intro">{INTRO}</p>
      <LedgerMonitorStatusLines />

      <div className="isi-hero">
        <div className="isi-card ledger-index-hero-card">
          <div className="ledger-monitor-status-pair">
            <div>
              <p className="ledger-monitor-pair-label">Current State</p>
              <p className="ledger-monitor-pair-value">
                {ISI_SNAPSHOT.currentState}
              </p>
            </div>
            <div>
              <p className="ledger-monitor-pair-label">Operating Condition</p>
              <p className="ledger-monitor-pair-value">
                {ISI_SNAPSHOT.currentDirection}
              </p>
            </div>
          </div>

          <p className="isi-summary ledger-monitor-lead">{ISI_SUMMARY}</p>

          <div className="ledger-signal-block">
            <p className="ledger-changed-label">This week&apos;s signal</p>
            <p className="ledger-changed-body">{ISI_WEEKLY_SIGNAL}</p>
          </div>

          <div className="ledger-monitor-state-grid">
            {ISI_CATEGORIES.map((cat) => (
              <article key={cat.name} className="ledger-monitor-state-card">
                <p className="ledger-monitor-state-name">{cat.name}</p>
                <p className="ledger-monitor-state-level">
                  {QUALITATIVE_STATES[cat.name] ?? cat.state}
                </p>
                <p className="ledger-monitor-state-body">{cat.body}</p>
              </article>
            ))}
          </div>

          <LedgerMonitorMethodNotice />
        </div>
      </div>

      <div className="isi-section isi-section--editorial ledger-index-section">
        <h2 className="isi-section-heading ledger-index-section-title">
          What We&apos;re Watching
        </h2>
        <div className="isi-watch-grid">
          {ISI_WHAT_WATCHING.map((item) => (
            <WatchCard key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </div>

      <div className="isi-section isi-section--editorial ledger-index-section">
        <h2 className="isi-section-heading ledger-index-section-title">
          What Would Ease the Read
        </h2>
        <div className="isi-watch-grid">
          {ISI_WHAT_WOULD_EASE.map((item) => (
            <WatchCard key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </div>

      <LedgerSourcesReviewed sources={ISI_SNAPSHOT.sources} />
      <LedgerQualitativeStatesBlock />

      <p className="isi-footer-note ledger-index-page-note">{ISI_FOOTER_NOTE}</p>
    </section>
  );
}
