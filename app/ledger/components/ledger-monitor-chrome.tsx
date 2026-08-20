import Link from "next/link";
import {
  LEDGER_EVIDENCE_CUTOFF_LABEL,
  LEDGER_METHOD_NOTICE,
  LEDGER_QUALITATIVE_STATES,
  type LedgerEvidenceSource,
} from "../ledger-monitor-framework";

type EvidenceCutoffProps = {
  className?: string;
};

/** Evidence cutoff under monitor titles. */
export function LedgerMonitorStatusLines({
  className = "",
}: EvidenceCutoffProps) {
  return (
    <div className={`ledger-monitor-status-lines ${className}`}>
      <p className="ledger-monitor-evidence-cutoff">
        {LEDGER_EVIDENCE_CUTOFF_LABEL}
      </p>
    </div>
  );
}

export function LedgerMonitorMethodNotice({
  className = "",
  notice = LEDGER_METHOD_NOTICE,
}: {
  className?: string;
  notice?: string;
}) {
  return (
    <p className={`ledger-monitor-method-notice ${className}`} role="note">
      {notice}
    </p>
  );
}

type SourcesReviewedProps = {
  sources: readonly LedgerEvidenceSource[];
  className?: string;
};

export function LedgerSourcesReviewed({
  sources,
  className = "",
}: SourcesReviewedProps) {
  if (sources.length === 0) return null;

  return (
    <div className={`ledger-index-section ledger-sources-reviewed ${className}`}>
      <h2 className="ledger-index-section-title">Sources reviewed</h2>
      <p className="ledger-index-section-sub">
        Each entry supports a specific current claim. Reported evidence is
        distinct from the Ledger&apos;s interpretive framing.
      </p>
      <ul className="ledger-sources-list">
        {sources.map((source) => (
          <li key={`${source.institution}-${source.title}`} className="ledger-source-item">
            <p className="ledger-source-institution">{source.institution}</p>
            <p className="ledger-source-title">
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </p>
            <p className="ledger-source-meta">{source.date}</p>
            <p className="ledger-source-supports">Supports: {source.supports}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LedgerQualitativeStatesBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`ledger-index-section ledger-qual-states ${className}`}>
      <h2 className="ledger-index-section-title">Qualitative state framework</h2>
      <p className="ledger-index-section-sub">
        Shared definitions for Ledger monitor language. Monitor-specific wording
        may refine these bands, but states are not assigned arbitrarily.{" "}
        <Link href="#ledger-qualitative-states" className="ledger-inline-link">
          Methodology reference
        </Link>
      </p>
      <p className="ledger-index-section-sub ledger-qual-states-note">
        The five shared states describe system pressure. Category labels used
        within individual monitors may instead describe pace, direction,
        availability, or constraint and should not be read as direct
        equivalents.
      </p>
      <div id="ledger-qualitative-states" className="ledger-qual-states-grid">
        {LEDGER_QUALITATIVE_STATES.map((state) => (
          <article key={state.id} className="ledger-qual-state-card">
            <p className="ledger-qual-state-label">{state.label}</p>
            <p className="ledger-qual-state-def">{state.definition}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
