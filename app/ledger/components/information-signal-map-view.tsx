import {
  ISM_FOOTER_NOTE,
  ISM_NARRATIVE_MAP,
  ISM_NARRATIVE_SHIFT,
  ISM_READING,
  ISM_SIGNAL_GRID,
  ISM_SOURCE_STACK,
  ISM_SUMMARY,
  ISM_UPDATED_LABEL,
  ISM_WHAT_TO_WATCH,
  ISM_WHAT_WOULD_CHANGE,
} from "../information-signal-map-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import "../information-signal-map.css";

function formatWeeklyDelta(change: number): string {
  if (change > 0) return `↑ +${change} Weekly Read`;
  if (change < 0) return `↓ ${change} Weekly Read`;
  return "Unchanged Weekly Read";
}

function SignalBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="im-box">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

export default function InformationSignalMapView() {
  const { score, label, status, weeklyChange } = ISM_READING;

  return (
    <section className={`ledger-index-page ledger-im ${LEDGER_INDEX_PAGE_CLASS}`}>
      <LedgerIndexBreadcrumb current="Information Signal Map" />

      <span className="im-kicker ledger-index-kicker">The Ledger Intelligence System</span>
      <h1 className="im-title ledger-index-title">Information Signal Map</h1>
      <p className="im-updated ledger-index-updated">
        <em>{ISM_UPDATED_LABEL}</em>
      </p>

      <div className="im-card ledger-index-hero-card">
        <div className="im-main">
          <div>
            <div className="im-score">
              {score}
              <span>/100</span>
            </div>
            <div className="im-label">{label}</div>
          </div>
          <div>
            <div className="im-delta ledger-index-delta">{formatWeeklyDelta(weeklyChange)}</div>
            <div className="im-label">{status}</div>
          </div>
        </div>

        <p className="im-summary">{ISM_SUMMARY}</p>

        <div className="im-grid-3">
          {ISM_SIGNAL_GRID.map((item) => (
            <SignalBox key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
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
        <h3>Narrative Shift This Week</h3>
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

      <p className="im-footer ledger-index-page-note">{ISM_FOOTER_NOTE}</p>
    </section>
  );
}


