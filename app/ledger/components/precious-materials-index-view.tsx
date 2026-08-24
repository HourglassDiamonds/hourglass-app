/**
 * Precious Materials Monitor — qualitative public view.
 * Numerical model archived at ./archived/precious-materials-numerical-view.tsx
 */
import {
  PMI_CROSS_SYSTEM_BRIDGE,
  PMI_CROSS_SYSTEM_PRESSURE,
  PMI_FOOTER_METHOD_NOTE,
  PMI_SNAPSHOT,
  PMI_SOURCES_NOTE,
  PMI_WHAT_MOVED,
  PMI_WHAT_TO_WATCH,
} from "../precious-materials-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import {
  LedgerMonitorMethodNotice,
  LedgerMonitorStatusLines,
  LedgerQualitativeStatesBlock,
  LedgerSourcesReviewed,
} from "./ledger-monitor-chrome";
import "../precious-materials-index.css";

const DISPLAY_TITLE = "Precious Materials Monitor";
const INTRO =
  "A qualitative monitor of the material conditions behind fine jewelry — gold, platinum, natural diamonds, and the sourcing environment that shapes quality, availability, and long-term value for clients and makers.";

const MATERIAL_STATES = [
  {
    name: "Gold",
    level: "Monetary demand strengthening / Fiscal-confidence sensitivity rising",
    body: "Spot gold is around ~$4,650 on August 24 — highest since mid-May, with more than a 5% gain in the prior week — as a weaker dollar and concern surrounding Treasury long-bond buybacks / fiscal confidence supported the bid. Jewelry demand remains price-sensitive. This is the same monetary/fiscal event already captured in the Financial System Temperature channel, not a separate materials increment.",
  },
  {
    name: "Silver",
    level: "Elevated",
    body: "Elevated pressure continues beside gold, with industrial and monetary demand keeping conditions firm rather than soft.",
  },
  {
    name: "Platinum / Palladium",
    level: "Firm",
    body: "Industrial and jewelry-linked demand keep the complex firm without a broad regime shift.",
  },
  {
    name: "Premium Natural Diamonds",
    level: "Selectively firm",
    body: "Higher-value / better goods remain relatively firmer in key sizes and cuts. Supply discipline and producer economics matter; this is not generic natural-diamond scarcity.",
  },
  {
    name: "Commercial Natural Diamonds",
    level: "Price-sensitive",
    body: "Commercial / lower-value goods remain price-sensitive as buyers discriminate more carefully across grades and sizes. Rough / polished dynamics stay segmented from the premium complex.",
  },
  {
    name: "Lab-Grown Diamonds",
    level: "Continued price compression",
    body: "Wholesale compression, commodity economics, manufacturing scale, adoption, and retailer margin structure continue. This is an embedded commercial factor, not a new weekly shock.",
  },
  {
    name: "Jewelry Demand",
    level: "Bridal and high jewelry firm",
    body: "Bridal and high-jewelry channels remain comparatively firm beneath a segmented wholesale environment.",
  },
  {
    name: "Colored Gemstones",
    level: "Selective scarcity",
    body: "Key origins remain constrained; scarcity is selective rather than uniform across all colored stones.",
  },
] as const;

export default function PreciousMaterialsIndexView() {
  return (
    <section
      className={`ledger-index-page ledger-pmi ${LEDGER_INDEX_PAGE_CLASS}`}
    >
      <LedgerIndexBreadcrumb current={DISPLAY_TITLE} />

      <span className="pmi-kicker ledger-index-kicker">
        The Ledger Intelligence System
      </span>
      <h1 className="pmi-title ledger-index-title">{DISPLAY_TITLE}</h1>
      <p className="pmi-intro ledger-index-intro">{INTRO}</p>
      <LedgerMonitorStatusLines />

      <div className="pmi-hero">
        <div className="pmi-card ledger-index-hero-card">
          <div className="ledger-monitor-status-pair">
            <div>
              <p className="ledger-monitor-pair-label">Current State</p>
              <p className="ledger-monitor-pair-value">
                {PMI_SNAPSHOT.currentState}
              </p>
            </div>
            <div>
              <p className="ledger-monitor-pair-label">Market Structure</p>
              <p className="ledger-monitor-pair-value">
                {PMI_SNAPSHOT.currentDirection}
              </p>
            </div>
          </div>

          <div className="ledger-monitor-state-grid">
            {MATERIAL_STATES.map((item) => (
              <article key={item.name} className="ledger-monitor-state-card">
                <p className="ledger-monitor-state-name">{item.name}</p>
                <p className="ledger-monitor-state-level">{item.level}</p>
                <p className="ledger-monitor-state-body">{item.body}</p>
              </article>
            ))}
          </div>

          <LedgerMonitorMethodNotice />
        </div>
      </div>

      <div className="pmi-cross-system ledger-index-section">
        <p className="pmi-cross-system-bridge ledger-index-section-sub">
          {PMI_CROSS_SYSTEM_BRIDGE}
        </p>
        <h2 className="ledger-index-section-title">Cross-System Pressure</h2>
        <ul className="pmi-cross-system-list">
          {PMI_CROSS_SYSTEM_PRESSURE.map((item) => (
            <li key={item} className="pmi-cross-system-item">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="pmi-editorial-section ledger-index-section">
        <span className="pmi-editorial-kicker">What Moved</span>
        {PMI_WHAT_MOVED.map((item) => (
          <p key={item} className="pmi-editorial-body">
            {item}
          </p>
        ))}
      </div>

      <div className="pmi-editorial-section ledger-index-section">
        <span className="pmi-editorial-kicker">What to Watch Next</span>
        {PMI_WHAT_TO_WATCH.map((item) => (
          <p key={item} className="pmi-editorial-body">
            {item}
          </p>
        ))}
      </div>

      <LedgerSourcesReviewed sources={PMI_SNAPSHOT.sources} />
      <LedgerQualitativeStatesBlock />

      <div className="pmi-sources-block">
        <span className="pmi-sources-kicker">Editorial note</span>
        <p className="pmi-sources-body">{PMI_SOURCES_NOTE}</p>
      </div>

      <span className="pmi-footer-note ledger-index-page-note">
        {PMI_FOOTER_METHOD_NOTE}
      </span>
    </section>
  );
}
