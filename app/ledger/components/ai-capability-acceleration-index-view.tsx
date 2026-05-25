import type { AcaiFillVariant } from "../ai-capability-acceleration-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import {
  ACAI_ABOVE_85,
  ACAI_CALCULATION_ROWS,
  ACAI_CALCULATION_TOTAL,
  ACAI_CAPABILITY_BANDS,
  ACAI_CAPABILITY_BENCHMARKS,
  ACAI_CAPABILITY_READINGS,
  ACAI_FOOTER_NOTE,
  ACAI_FRONTIER_WATCHLIST,
  ACAI_INTRO,
  ACAI_METHOD_PILLS,
  ACAI_MILESTONES,
  ACAI_READING,
  ACAI_RECENT_READINGS,
  ACAI_SCALE_LABELS,
  ACAI_SECTION_SUBTITLES,
  ACAI_SOURCES,
  ACAI_SUMMARY,
  ACAI_UPDATED_LABEL,
  ACAI_WEEKLY_SIGNAL,
  ACAI_WHAT_MOVED,
} from "../ai-capability-acceleration-data";
import "../ai-capability-acceleration-index.css";

function formatWeeklyDelta(change: number): string {
  if (change > 0) return `↑ +${change} Weekly Read`;
  if (change < 0) return `↓ ${change} Weekly Read`;
  return "Unchanged Weekly Read";
}

function ReadingBar({ score, fill }: { score: number; fill: AcaiFillVariant }) {
  return (
    <div className="acai-reading-bar" aria-hidden>
      <div
        className={`acai-reading-fill fill-${fill}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

export default function AICapabilityAccelerationIndexView() {
  const { score, status, weeklyChange, markerPosition, readingLabel } =
    ACAI_READING;

  const weeklySignalBody = ACAI_WEEKLY_SIGNAL.replace(
    /^This week's signal:\s*/i,
    "",
  );
  const footerBody = ACAI_FOOTER_NOTE.replace(/^Method note:\s*/i, "");

  return (
    <section className={`ledger-index-page ledger-acai ${LEDGER_INDEX_PAGE_CLASS}`}>
      <LedgerIndexBreadcrumb current="AI Capability Acceleration Index" />

      <span className="acai-kicker ledger-index-kicker">The Ledger Intelligence System</span>
      <h1 className="acai-title ledger-index-title">AI Capability Acceleration Index</h1>
      <p className="acai-intro ledger-index-intro">{ACAI_INTRO}</p>
      <p className="acai-updated ledger-index-updated">
        <em>{ACAI_UPDATED_LABEL}</em>
      </p>

      <div className="acai-hero">
        <div className="acai-card ledger-index-hero-card">
          <div className="acai-main-row">
            <div className="acai-main-score-wrap">
              <div className="acai-main-score">
                {score}
                <span className="unit">/100</span>
              </div>
              <div className="acai-main-label">{readingLabel}</div>
            </div>
            <div className="acai-delta-wrap">
              <div className="acai-delta ledger-index-delta">{formatWeeklyDelta(weeklyChange)}</div>
              <p className="acai-delta-note">{status}</p>
            </div>
          </div>

          <div className="acai-scale">
            <div className="acai-scale-bar">
              <div
                className="acai-marker"
                style={{ left: `${markerPosition}%` }}
                aria-hidden
              />
            </div>
            <div className="acai-scale-labels">
              {ACAI_SCALE_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>

          <p className="acai-summary">{ACAI_SUMMARY}</p>

          <p className="acai-note">
            <strong>This week&apos;s signal:</strong> {weeklySignalBody}
          </p>

          <div className="acai-method-compact">
            {ACAI_METHOD_PILLS.map((pill) => (
              <div key={pill.label} className="acai-method-pill">
                <span className="acai-method-label">{pill.label}</span>
                <p className="acai-method-value">{pill.value}</p>
              </div>
            ))}
          </div>

          <div className="acai-recent">
            <h3 className="acai-recent-title">Recent Weekly Readings</h3>
            <div className="acai-recent-grid">
              {ACAI_RECENT_READINGS.map((item) => (
                <div key={item.week} className="acai-recent-item">
                  <p className="acai-recent-week">{item.week}</p>
                  <p className="acai-recent-score">{item.score}</p>
                  <p className="acai-recent-state">{item.state}</p>
                </div>
              ))}
            </div>

            <div className="acai-benchmark-section">
              <span className="acai-benchmark-kicker">
                Capability Benchmark Readings
              </span>
              <div className="acai-benchmark-grid">
                {ACAI_CAPABILITY_BENCHMARKS.map((item) => (
                  <div key={item.name} className="acai-benchmark-card">
                    <p className="acai-benchmark-name">{item.name}</p>
                    <p className="acai-benchmark-score">{item.score}</p>
                    <p className="acai-benchmark-note">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="acai-card">
          <h3 className="acai-side-title">Capability Readings</h3>
          <div className="acai-readings">
            {ACAI_CAPABILITY_READINGS.map((reading) => (
              <div key={reading.name} className="acai-reading">
                <div className="acai-reading-top">
                  <div>
                    <div className="acai-reading-name">{reading.name}</div>
                    <div className="acai-reading-weight">{reading.weight}</div>
                  </div>
                  <div className="acai-reading-score">
                    {reading.score} / {reading.band}
                  </div>
                </div>
                <ReadingBar score={reading.score} fill={reading.fill} />
                <p className="acai-reading-text">{reading.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="acai-section ledger-index-section">
        <h3 className="acai-section-title ledger-index-section-title">
          What Moved the Index
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
        <p className="acai-section-subtitle">{ACAI_SECTION_SUBTITLES.milestones}</p>
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
        <h3 className="acai-section-title">What Would Push It Above 85</h3>
        <p className="acai-section-subtitle">
          The reading is accelerating but not yet disruptive. These developments
          would justify a higher score.
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

      <div className="acai-section ledger-index-section">
        <h3 className="acai-section-title">How the Index Is Calculated</h3>
        <p className="acai-section-subtitle">{ACAI_SECTION_SUBTITLES.calculated}</p>
        <div className="acai-table-wrap">
          <table className="acai-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Weight</th>
                <th>Score</th>
                <th>Contribution</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {ACAI_CALCULATION_ROWS.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td className="acai-nowrap">{row.weight}</td>
                  <td className="acai-nowrap">{row.score}</td>
                  <td className="acai-nowrap">{row.contribution}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="acai-nowrap">
                  <strong>100%</strong>
                </td>
                <td className="acai-nowrap">
                  <strong>Weight</strong>
                </td>
                <td className="acai-nowrap">
                  <strong>{ACAI_CALCULATION_TOTAL.contribution}</strong>
                </td>
                <td>
                  <strong>{ACAI_CALCULATION_TOTAL.reason}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="acai-section ledger-index-section">
        <h3 className="acai-section-title">Capability Bands</h3>
        <p className="acai-section-subtitle">
          {ACAI_SECTION_SUBTITLES.capabilityBands}
        </p>
        <div className="acai-table-wrap">
          <table className="acai-table">
            <thead>
              <tr>
                <th>Band</th>
                <th>Condition</th>
                <th>Meaning</th>
                <th>Trigger Examples</th>
              </tr>
            </thead>
            <tbody>
              {ACAI_CAPABILITY_BANDS.map((row) => (
                <tr key={row.band}>
                  <td className="acai-nowrap">{row.band}</td>
                  <td>
                    <span className="acai-tag">{row.condition}</span>
                  </td>
                  <td>{row.meaning}</td>
                  <td>{row.examples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="acai-section ledger-index-section">
        <h3 className="acai-section-title">Sources &amp; Method Note</h3>
        <p className="acai-section-subtitle">{ACAI_SECTION_SUBTITLES.sources}</p>
        <div className="acai-sources">
          {ACAI_SOURCES.map((source) => (
            <div key={source.name} className="acai-source">
              <span className="acai-source-name">{source.name}</span>
              <p>{source.body}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="acai-footer ledger-index-page-note">
        <em>Method note:</em> {footerBody}
      </p>
    </section>
  );
}


