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
    level: "Elevated / Below September peak",
    body: "Gold closed near $3,975 on November 2 after the September reference price reached $4,176. The pullback is meaningful cooling from the peak, but the level remains historically elevated and jewelry demand remains price-sensitive. The rates and fiscal-confidence channel is counted in Financial Conditions, not again here.",
  },
  {
    name: "Silver",
    level: "Elevated",
    body: "Elevated pressure continues beside gold, with industrial and monetary demand keeping conditions firm rather than soft.",
  },
  {
    name: "Platinum / Palladium",
    level: "Firm / Supply-sensitive",
    body: "Platinum traded near $1,432–$1,444 on November 2. Industrial and jewelry demand remain relevant, but the current evidence does not establish a broad shortage regime.",
  },
  {
    name: "Premium Natural Diamonds",
    level: "Segmented / Better goods firmer",
    body: "Rapaport's November 2 review showed October gains in 0.30-, 0.50-, and headline 1-carat indices, but softer selected higher-quality 1-carat bands and inventory accumulation. Better goods are not uniformly scarce; the market remains segmented.",
  },
  {
    name: "Commercial Natural Diamonds",
    level: "Price-sensitive",
    body: "De Beers reported Q3 production down 11% year over year, sales volume up 71%, average realized price down 45%, and its year-to-date price index down 18%. Lower-value natural goods remain exposed to lab-grown competition and inventory discipline.",
  },
  {
    name: "Lab-Grown Diamonds",
    level: "Continued price compression",
    body: "Caratlytics' November 2 listings showed a much lower median price per carat and wider dispersion than natural listings. These are asking prices, not completed transactions, but they reinforce continued commodity-style compression and uneven retail positioning.",
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
