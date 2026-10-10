import Link from "next/link";
import {
  BUFFER_HEALTH_DOMAINS,
  BUFFER_HEALTH_GUARDRAILS,
  BUFFER_HEALTH_SNAPSHOT,
  reserveFillPercent,
  type BufferDomain,
} from "../buffer-health-data";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import { LedgerMonitorStatusLines } from "./ledger-monitor-chrome";

function ReserveChamber({ domain }: { domain: BufferDomain }) {
  const fill = reserveFillPercent(domain.reserveState);
  const isUnassessed = fill === null;

  return (
    <article
      className="buffer-chamber"
      data-buffer-domain={domain.id}
      data-reserve-state={domain.reserveState}
      aria-label={`${domain.label} buffer health: ${domain.reserveState}`}
    >
      <div className={`buffer-reservoir ${isUnassessed ? "is-unassessed" : ""}`}>
        {isUnassessed ? (
          <span className="buffer-unassessed-mark" aria-hidden="true" />
        ) : (
          <span
            className="buffer-reserve-fill"
            style={{ "--buffer-fill": `${fill}%` } as React.CSSProperties}
            aria-hidden="true"
          />
        )}
      </div>
      <h3>{domain.label}</h3>
      <p className="buffer-state-label">
        {isUnassessed ? "Awaiting sourced baseline" : domain.reserveState}
      </p>
    </article>
  );
}

export function BufferHealthVisual({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`buffer-health-surface ${compact ? "is-compact" : ""}`}
      aria-labelledby={compact ? "buffer-health-hub-title" : "buffer-health-title"}
      data-buffer-health-visual="true"
    >
      <div className="buffer-health-heading-row">
        <div>
          <p className="buffer-eyebrow">Buffer Health / Remaining Slack</p>
          <h2 id={compact ? "buffer-health-hub-title" : "buffer-health-title"}>
            How much capacity is left to absorb additional pressure?
          </h2>
        </div>
        {compact ? (
          <Link href="/ledger/buffer-health" className="buffer-detail-link">
            View evidence framework →
          </Link>
        ) : null}
      </div>

      <p className="buffer-intro">
        Pressure and reserve are different questions. High pressure can coexist
        with remaining buffers; less slack does not mean no slack.
      </p>

      <div className="buffer-pressure-gap" aria-label="System pressure and remaining buffer relationship">
        <span>System pressure</span>
        <i aria-hidden="true" />
        <span>Remaining buffer</span>
      </div>

      <div className="buffer-chambers">
        {BUFFER_HEALTH_DOMAINS.map((domain) => (
          <ReserveChamber key={domain.id} domain={domain} />
        ))}
      </div>

      <p className="buffer-guardrail" role="note">
        {BUFFER_HEALTH_GUARDRAILS.rule} Current status: {BUFFER_HEALTH_SNAPSHOT.status}.
      </p>
    </section>
  );
}

export default function BufferHealthView() {
  return (
    <section className={`ledger-index-page ledger-buffer ${LEDGER_INDEX_PAGE_CLASS}`}>
      <LedgerIndexBreadcrumb current="Buffer Health / Remaining Slack" />
      <span className="ledger-index-kicker">The Ledger Intelligence System</span>
      <h1 className="ledger-index-title">Buffer Health / Remaining Slack</h1>
      <p className="ledger-index-intro">{BUFFER_HEALTH_SNAPSHOT.definition}</p>
      <LedgerMonitorStatusLines />

      <div className="ledger-monitor-status-pair">
        <div>
          <p className="ledger-monitor-pair-label">Current State</p>
          <p className="ledger-monitor-pair-value">{BUFFER_HEALTH_SNAPSHOT.currentState}</p>
        </div>
        <div>
          <p className="ledger-monitor-pair-label">Current Direction</p>
          <p className="ledger-monitor-pair-value">{BUFFER_HEALTH_SNAPSHOT.currentDirection}</p>
        </div>
      </div>

      <BufferHealthVisual />

      <div className="ledger-index-section">
        <h2 className="ledger-index-section-title">Domain evidence framework</h2>
        <p className="ledger-index-section-sub">
          October 1 remains the fixed baseline; October 10 updates every domain and moves Labor to Thinning.
          Evidence labels distinguish observed, provisional, forecast, and lagged material.
        </p>
        <div className="buffer-domain-details">
          {BUFFER_HEALTH_DOMAINS.map((domain) => (
            <article key={domain.id} className="buffer-domain-card">
              <div className="buffer-domain-card-heading">
                <h3>{domain.label}</h3>
                <span>{domain.reserveState}</span>
              </div>
              <p>{domain.definition}</p>
              <p><strong>Rationale:</strong> {domain.rationale}</p>
              <div className="buffer-criteria-grid">
                <div>
                  <h4>Escalation criteria</h4>
                  <ul>{domain.escalationCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h4>Easing criteria</h4>
                  <ul>{domain.easingCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
              <div className="buffer-source-list">
                <h4>Sources</h4>
                <ul>
                  {domain.sources.map((source) => (
                    <li key={`${source.institution}-${source.title}`}>
                      {source.url ? (
                        <a href={source.url}>{source.institution} — {source.title}</a>
                      ) : (
                        <span>{source.institution} — {source.title}</span>
                      )}
                      <span className="buffer-evidence-label">{source.evidenceLabel}</span>
                      <span className="buffer-source-meta">
                        Published {source.date} · Data: {source.dataPeriod}
                      </span>
                      <span className="buffer-source-supports">{source.supports}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="buffer-domain-meta">
                Confidence: {domain.confidence} · Last updated: {domain.lastUpdated} · Sources: {domain.sources.length}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
