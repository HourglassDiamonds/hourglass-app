/**
 * Information Signal Map — qualitative public view.
 * Numerical score UI archived at ./archived/information-signal-map-numerical-view.tsx
 */
import {
  ISM_CURRENT_DIRECTION,
  ISM_CURRENT_STATE,
  ISM_FOOTER_NOTE,
  ISM_NARRATIVE_MAP,
  ISM_NARRATIVE_SHIFT,
  ISM_SIGNAL_GRID,
  ISM_SNAPSHOT,
  ISM_SOURCE_STACK,
  ISM_SUMMARY,
  ISM_WHAT_TO_WATCH,
  ISM_WHAT_WOULD_CHANGE,
} from "../information-signal-map-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import {
  LedgerMonitorMethodNotice,
  LedgerMonitorStatusLines,
  LedgerQualitativeStatesBlock,
  LedgerSourcesReviewed,
} from "./ledger-monitor-chrome";
import "../information-signal-map.css";

function SignalBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="im-box">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

export default function InformationSignalMapView() {
  return (
    <section
      className={`ledger-index-page ledger-im ${LEDGER_INDEX_PAGE_CLASS}`}
    >
      <LedgerIndexBreadcrumb current="Information Signal Map" />

      <span className="im-kicker ledger-index-kicker">
        The Ledger Intelligence System
      </span>
      <h1 className="im-title ledger-index-title">Information Signal Map</h1>
      <p className="ledger-index-intro">
        A qualitative map of how narratives move through markets, media, policy,
        and institutions — where framing converges, where it diverges, and what
        remains underweighted.
      </p>
      <LedgerMonitorStatusLines />

      <div className="im-card ledger-index-hero-card">
        <div className="ledger-monitor-status-pair">
          <div>
            <p className="ledger-monitor-pair-label">Current State</p>
            <p className="ledger-monitor-pair-value">{ISM_CURRENT_STATE}</p>
          </div>
          <div>
            <p className="ledger-monitor-pair-label">Current Direction</p>
            <p className="ledger-monitor-pair-value">{ISM_CURRENT_DIRECTION}</p>
          </div>
        </div>

        <p className="im-summary ledger-monitor-lead">{ISM_SUMMARY}</p>

        <div className="im-grid-3">
          {ISM_SIGNAL_GRID.map((item) => (
            <SignalBox key={item.title} title={item.title} body={item.body} />
          ))}
        </div>

        <LedgerMonitorMethodNotice />
      </div>

      <div className="im-section ledger-index-section">
        <h3>Source Stack</h3>
        <p className="im-sub">
          How different information layers interpret the same signals.
        </p>
        <div className="im-grid-2">
          {ISM_SOURCE_STACK.map((item) => (
            <SignalBox key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </div>

      <div className="im-section ledger-index-section">
        <h3>Narrative Map</h3>
        <p className="im-sub">What each lens emphasizes and what it tends to miss.</p>
        <div className="im-grid-2">
          {ISM_NARRATIVE_MAP.map((item) => (
            <SignalBox key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </div>

      <div className="im-section ledger-index-section">
        <h3>Narrative shift in this review</h3>
        <div className="im-box">
          <p>{ISM_NARRATIVE_SHIFT}</p>
        </div>
      </div>

      <div className="im-section ledger-index-section">
        <h3>What to Watch Next</h3>
        <div className="im-grid-2">
          {ISM_WHAT_TO_WATCH.map((item) => (
            <SignalBox key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </div>

      <div className="im-section ledger-index-section">
        <h3>What Would Change the Read</h3>
        <div className="im-grid-2">
          {ISM_WHAT_WOULD_CHANGE.map((item) => (
            <SignalBox key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </div>

      <LedgerSourcesReviewed sources={ISM_SNAPSHOT.sources} />
      <LedgerQualitativeStatesBlock />

      <p className="im-footer ledger-index-page-note">{ISM_FOOTER_NOTE}</p>
    </section>
  );
}
