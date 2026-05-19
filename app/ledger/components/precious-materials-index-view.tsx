import {
  PMI_CALCULATION_ROWS,
  PMI_CROSS_SYSTEM_BRIDGE,
  PMI_CROSS_SYSTEM_PRESSURE,
  PMI_DIAMOND_SPLIT,
  PMI_FOOTER_METHOD_NOTE,
  PMI_INTRO,
  PMI_JEWELRY_DEMAND,
  PMI_MARKET_PRESSURE,
  PMI_METALS_PRESSURE,
  PMI_RECENT_READINGS,
  PMI_SOURCES_NOTE,
  PMI_UPDATED_LABEL,
  PMI_WHAT_MOVED,
  PMI_WHAT_TO_WATCH,
} from "../precious-materials-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import "../precious-materials-index.css";

function MapBar({ score }: { score: number }) {
  return (
    <div className="pmi-map-bar-track" aria-hidden>
      <div
        className="pmi-map-bar-fill"
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

function formatWeeklyDelta(change: number): string {
  if (change > 0) return `↑ +${change} Weekly Read`;
  if (change < 0) return `↓ ${change} Weekly Read`;
  return "Unchanged Weekly Read";
}

export default function PreciousMaterialsIndexView() {
  const { score, status, weeklyChange } = PMI_MARKET_PRESSURE;

  return (
    <section className={`ledger-index-page ledger-pmi ${LEDGER_INDEX_PAGE_CLASS}`}>
      <LedgerIndexBreadcrumb current="Precious Materials Index" />

      <span className="pmi-kicker ledger-index-kicker">The Ledger Intelligence System</span>
      <h1 className="pmi-title ledger-index-title">Precious Materials Index</h1>
      <p className="pmi-intro ledger-index-intro">{PMI_INTRO}</p>
      <p className="pmi-updated ledger-index-updated">
        <em>{PMI_UPDATED_LABEL}</em>
      </p>

      <div className="pmi-hero">
        <div className="pmi-card ledger-index-hero-card">
          <div className="pmi-main-row">
            <div className="pmi-main-score">
              <p className="pmi-main-number">
                {score}
                <span className="pmi-max">/100</span>
              </p>
              <p className="pmi-main-label">Market Pressure</p>
            </div>
            <div className="pmi-delta-wrap">
              <span className="pmi-delta ledger-index-delta">{formatWeeklyDelta(weeklyChange)}</span>
              <p className="pmi-delta-note">{status}</p>
            </div>
          </div>

          <div className="pmi-maps-grid">
            <div className="pmi-map-block">
              <span className="pmi-section-title">Metals Pressure Map</span>
              {PMI_METALS_PRESSURE.map((row) => (
                <div key={row.metal} className="pmi-map-row">
                  <div className="pmi-map-row-header">
                    <span className="pmi-map-label">{row.metal}</span>
                    <span className="pmi-map-score">{row.score}/100</span>
                  </div>
                  <MapBar score={row.score} />
                  <p className="pmi-map-state">{row.state}</p>
                </div>
              ))}
            </div>

            <div className="pmi-map-block">
              <span className="pmi-section-title">Diamond Market Split</span>
              <div className="pmi-split-grid">
                {PMI_DIAMOND_SPLIT.map((item) => (
                  <div key={item.segment} className="pmi-split-item">
                    <p className="pmi-split-segment">{item.segment}</p>
                    <p className="pmi-split-score">{item.score}/100</p>
                    <p className="pmi-split-note">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pmi-map-block">
              <span className="pmi-section-title">Jewelry Demand Read</span>
              <div className="pmi-demand-grid">
                {PMI_JEWELRY_DEMAND.map((item) => (
                  <div key={item.channel} className="pmi-demand-item">
                    <p className="pmi-demand-channel">{item.channel}</p>
                    <p className="pmi-demand-read">{item.read}</p>
                    <p className="pmi-demand-note">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pmi-map-block">
              <span className="pmi-section-title">Recent Weekly Readings</span>
              <div className="pmi-split-grid">
                {PMI_RECENT_READINGS.map((item) => (
                  <div key={item.week} className="pmi-split-item">
                    <p className="pmi-split-segment">{item.week}</p>
                    <p className="pmi-split-score">{item.score}/100</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
        <span className="pmi-editorial-kicker">What Moved the Index</span>
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

      <div className="pmi-table-wrap">
        <span className="pmi-editorial-kicker">How the Index Is Calculated</span>
        <table className="pmi-table">
          <thead>
            <tr>
              <th className="pmi-table-th">Component</th>
              <th className="pmi-table-th">Weight</th>
              <th className="pmi-table-th">Notes</th>
            </tr>
          </thead>
          <tbody>
            {PMI_CALCULATION_ROWS.map((row) => (
              <tr key={row.component}>
                <td>{row.component}</td>
                <td>{row.weight}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pmi-sources-block">
        <span className="pmi-sources-kicker">Sources &amp; Method Note</span>
        <p className="pmi-sources-body">{PMI_SOURCES_NOTE}</p>
      </div>

      <span className="pmi-footer-note ledger-index-page-note">{PMI_FOOTER_METHOD_NOTE}</span>
    </section>
  );
}

