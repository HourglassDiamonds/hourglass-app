/**
 * Global Water Stress Monitor — qualitative public view.
 * No degree score. Not a System Temperature channel.
 */
import {
  GWS_CATEGORIES,
  GWS_FOOTER_NOTE,
  GWS_INTRO,
  GWS_REGIONS,
  GWS_SNAPSHOT,
  GWS_SUMMARY,
  GWS_WEEKLY_SIGNAL,
  GWS_WHAT_WATCHING,
} from "../global-water-stress-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import {
  LedgerMonitorMethodNotice,
  LedgerMonitorStatusLines,
  LedgerQualitativeStatesBlock,
  LedgerSourcesReviewed,
} from "./ledger-monitor-chrome";
import "../global-water-stress.css";

const DISPLAY_TITLE = "Global Water Stress Monitor";

export default function GlobalWaterStressView() {
  return (
    <section
      className={`ledger-index-page ledger-gws ${LEDGER_INDEX_PAGE_CLASS}`}
    >
      <LedgerIndexBreadcrumb current={DISPLAY_TITLE} />

      <span className="gws-kicker ledger-index-kicker">
        The Ledger Intelligence System
      </span>
      <h1 className="gws-title ledger-index-title">{DISPLAY_TITLE}</h1>
      <p className="gws-intro ledger-index-intro">{GWS_INTRO}</p>
      <LedgerMonitorStatusLines />

      <div className="gws-hero">
        <div className="gws-card ledger-index-hero-card">
          <div className="ledger-monitor-status-pair">
            <div>
              <p className="ledger-monitor-pair-label">Current State</p>
              <p className="ledger-monitor-pair-value">
                {GWS_SNAPSHOT.currentState}
              </p>
            </div>
            <div>
              <p className="ledger-monitor-pair-label">Current Direction</p>
              <p className="ledger-monitor-pair-value">
                {GWS_SNAPSHOT.currentDirection}
              </p>
            </div>
          </div>

          <p className="gws-summary ledger-monitor-lead">{GWS_SUMMARY}</p>

          <div className="ledger-signal-block">
            <p className="ledger-changed-label">This week&apos;s signal</p>
            <p className="ledger-changed-body">{GWS_WEEKLY_SIGNAL}</p>
          </div>

          <div className="ledger-monitor-state-grid">
            {GWS_CATEGORIES.map((cat) => (
              <article key={cat.name} className="ledger-monitor-state-card">
                <p className="ledger-monitor-state-name">{cat.name}</p>
                <p className="ledger-monitor-state-level">{cat.level}</p>
                <p className="ledger-monitor-state-body">{cat.body}</p>
              </article>
            ))}
          </div>

          <LedgerMonitorMethodNotice notice="Water is a qualitative evidence layer and does not publish a degree score." />
        </div>
      </div>

      <div className="gws-section ledger-index-section">
        <h2 className="gws-section-heading ledger-index-section-title">
          Regional assessment
        </h2>
        <p className="ledger-index-section-sub">
          Improving basins are shown with worsening ones.
        </p>
        <div className="gws-region-grid">
          {GWS_REGIONS.map((region) => (
            <article key={region.name} className="gws-region-card">
              <p className="gws-region-name">{region.name}</p>
              <p className="gws-region-level">{region.level}</p>
              <p className="gws-region-meta">{region.direction}</p>
              <p className="gws-region-meta">{region.transmission}</p>
              <p className="gws-region-body">{region.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="gws-section ledger-index-section">
        <h2 className="gws-section-heading ledger-index-section-title">
          What We&apos;re Watching
        </h2>
        <div className="gws-watch-grid">
          {GWS_WHAT_WATCHING.map((item) => (
            <article key={item.title} className="gws-watch-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>

      <LedgerSourcesReviewed sources={GWS_SNAPSHOT.sources} />
      <LedgerQualitativeStatesBlock />

      <p className="gws-footer-note ledger-index-page-note">{GWS_FOOTER_NOTE}</p>
    </section>
  );
}
