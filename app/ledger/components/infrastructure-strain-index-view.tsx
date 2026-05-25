import {
  ISI_BENCHMARKS,
  ISI_CALCULATION_ROWS,
  ISI_CALCULATION_TOTAL,
  ISI_CATEGORIES,
  ISI_FOOTER_NOTE,
  ISI_INTRO,
  ISI_READING,
  ISI_RECENT_READINGS,
  ISI_SOURCES,
  ISI_SUMMARY,
  ISI_UPDATED_LABEL,
  ISI_WEEKLY_SIGNAL,
  ISI_WHAT_WATCHING,
  ISI_WHAT_WOULD_EASE,
} from "../infrastructure-strain-data";
import type { BenchmarkTier } from "../ledger-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import "../infrastructure-strain-index.css";

function formatWeeklyDelta(change: number): string {
  if (change > 0) return `↑ +${change} Weekly Read`;
  if (change < 0) return `↓ ${change} Weekly Read`;
  return "Unchanged Weekly Read";
}

function benchTierClass(tier: BenchmarkTier): string {
  return `isi-benchmark-card isi-bench-${tier}`;
}

function CategoryBar({ score }: { score: number }) {
  return (
    <div className="isi-bar-track" aria-hidden>
      <div
        className="isi-bar-fill"
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

function WatchCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="isi-watch-card">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

export default function InfrastructureStrainIndexView() {
  const { score, label, status, weeklyChange } = ISI_READING;

  return (
    <section className={`ledger-index-page ledger-isi ${LEDGER_INDEX_PAGE_CLASS}`}>
      <LedgerIndexBreadcrumb current="Infrastructure Strain Index" />

      <span className="isi-kicker ledger-index-kicker">The Ledger Intelligence System</span>
      <h1 className="isi-title ledger-index-title">Infrastructure Strain Index</h1>
      <p className="isi-intro ledger-index-intro">{ISI_INTRO}</p>
      <p className="isi-updated ledger-index-updated">
        <em>{ISI_UPDATED_LABEL}</em>
      </p>

      <div className="isi-hero">
        <div className="isi-card ledger-index-hero-card">
          <div className="isi-main-row">
            <div>
              <p className="isi-main-number">
                {score}
                <span className="isi-max">/100</span>
              </p>
              <p className="isi-main-label">{label}</p>
            </div>
            <div className="isi-delta-wrap">
              <span className="isi-delta ledger-index-delta">
                {formatWeeklyDelta(weeklyChange)}
              </span>
              <p className="isi-delta-note">{status}</p>
            </div>
          </div>

          <p className="isi-summary">{ISI_SUMMARY}</p>

          <p className="isi-weekly-signal">
            <strong>This week&apos;s signal:</strong>{" "}
            {ISI_WEEKLY_SIGNAL.replace(/^This week'?s signal:\s*/i, "")}
          </p>

          <div className="isi-categories-block">
            <div className="isi-category-grid">
              {ISI_CATEGORIES.map((cat) => (
                <div key={cat.name} className="isi-category-card">
                  <div className="isi-category-header">
                    <span className="isi-category-name">{cat.name}</span>
                    <span className="isi-category-score">{cat.score}/100</span>
                  </div>
                  <CategoryBar score={cat.score} />
                  <p className="isi-category-state">{cat.state}</p>
                  <p className="isi-category-body">{cat.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="isi-recent-block">
            <span className="isi-section-title">Recent Weekly Readings</span>
            <div className="isi-recent-grid">
              {ISI_RECENT_READINGS.map((item) => (
                <div key={item.week} className="isi-recent-item">
                  <p className="isi-recent-week">{item.week}</p>
                  <p className="isi-recent-score">{item.score}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="isi-benchmark-block">
            <span className="isi-benchmark-kicker">Historical Benchmark Readings</span>
            <div className="isi-benchmark-grid">
              {ISI_BENCHMARKS.map((bench) => (
                <div
                  key={bench.name}
                  className={benchTierClass(bench.tier)}
                >
                  <p className="isi-benchmark-name">{bench.name}</p>
                  <p className="isi-benchmark-score">{bench.score}</p>
                  <p className="isi-benchmark-note">{bench.note}</p>
                </div>
              ))}
            </div>
          </div>
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

      <div className="isi-section isi-section--calc ledger-index-section">
        <h2 className="isi-section-heading ledger-index-section-title">
          How the Index Is Calculated
        </h2>
        <div className="isi-table-wrap">
          <table className="isi-table">
            <thead>
              <tr>
                <th className="isi-table-th">Category</th>
                <th className="isi-table-th">Weight</th>
                <th className="isi-table-th">Score</th>
                <th className="isi-table-th">Contribution</th>
                <th className="isi-table-th">Reason</th>
              </tr>
            </thead>
            <tbody>
              {ISI_CALCULATION_ROWS.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td className="isi-nowrap">{row.weight}</td>
                  <td className="isi-nowrap">{row.score}</td>
                  <td className="isi-nowrap">{row.contribution}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="isi-nowrap">100%</td>
                <td className="isi-nowrap">Weight</td>
                <td className="isi-nowrap">{ISI_CALCULATION_TOTAL.contribution}</td>
                <td>{ISI_CALCULATION_TOTAL.reason}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="isi-section isi-section--sources ledger-index-section">
        <h2 className="isi-section-heading ledger-index-section-title">
          Sources &amp; Method Note
        </h2>
        <div className="isi-sources">
          {ISI_SOURCES.map((source) => (
            <div key={source.name} className="isi-source">
              <span className="isi-source-name">{source.name}</span>
              <p>{source.body}</p>
            </div>
          ))}
        </div>
      </div>

      <span className="isi-footer-note ledger-index-page-note">{ISI_FOOTER_NOTE}</span>
    </section>
  );
}
