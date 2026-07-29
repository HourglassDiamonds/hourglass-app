/**
 * CLI / inspection report for Client Attention (default redacted).
 */

import type { ClientAttentionAudit } from "./types";
import type { ClientAttentionRunResult } from "./resilience";

export function formatClientAttentionReport(
  result: ClientAttentionRunResult,
  options: { redacted?: boolean } = {},
): string {
  const redacted = options.redacted !== false;
  const audit = result.audit;
  const lines: string[] = [];

  lines.push("Client Attention — inspection report");
  lines.push(`Redaction enabled: ${redacted && audit.redacted ? "yes" : "yes (forced)"}`);
  lines.push(`Mode: ${audit.mode}`);
  lines.push(`Collected: ${audit.collectedAt}`);
  lines.push("");
  lines.push("Source status");
  lines.push(`  Gmail: ${audit.sourceAvailability.gmail}`);
  lines.push(`  HubSpot: ${audit.sourceAvailability.hubspot}`);
  lines.push(`  Concierge: ${audit.sourceAvailability.concierge}`);
  lines.push("");
  lines.push("Counts");
  lines.push(`  Threads inspected: ${audit.counts.threadsInspected}`);
  lines.push(`  Contacts inspected: ${audit.counts.contactsInspected}`);
  lines.push(`  Deals inspected: ${audit.counts.dealsInspected}`);
  lines.push(`  Submissions inspected: ${audit.counts.submissionsInspected}`);
  lines.push(`  Identities resolved: ${audit.counts.identitiesResolved}`);
  lines.push(`  Unresolved identities: ${audit.counts.unresolvedIdentities}`);
  lines.push(`  Suppressed signals: ${audit.counts.suppressedSignalCount}`);
  lines.push("");
  lines.push("Signals by type");
  for (const [type, count] of Object.entries(audit.counts.signalsByType)) {
    lines.push(`  ${type}: ${count}`);
  }
  if (!Object.keys(audit.counts.signalsByType).length) {
    lines.push("  (none)");
  }
  lines.push("");
  lines.push("Top ranked signals");
  for (const [i, ranked] of audit.rankedSignals.slice(0, 5).entries()) {
    const s = ranked.signal;
    lines.push(
      `  ${i + 1}. ${s.displayName || "Client"} — ${s.signalType} (score ${ranked.totalScore}, ${s.urgency}, conf ${s.confidence})`,
    );
    lines.push(`     ${s.summary}`);
    lines.push(`     Action: ${s.recommendedAction}`);
    if (ranked.outranksReason) {
      lines.push(`     Rank note: ${ranked.outranksReason}`);
    }
    lines.push(
      `     Dimensions: delay=${ranked.dimensions.responseDelay} deadline=${ranked.dimensions.deadlineProximity} urgency=${ranked.dimensions.explicitUrgency} corroboration=${ranked.dimensions.sourceCorroboration}`,
    );
  }
  if (!audit.rankedSignals.length) lines.push("  (none)");

  lines.push("");
  lines.push("Founder-facing recommendations");
  for (const [i, rec] of result.recommendations.slice(0, 2).entries()) {
    lines.push(`  ${i + 1}. ${rec.title}`);
    lines.push(`     ${rec.proposedAction}`);
  }
  if (!result.recommendations.length) lines.push("  (none)");

  lines.push("");
  lines.push("Buyer-concern patterns");
  for (const c of audit.buyerConcerns.slice(0, 3)) {
    lines.push(
      `  - ${c.concern} (n=${c.evidenceCount}, conf=${c.confidence}, sources=${c.sourceTypes.join(",")})`,
    );
  }
  if (!audit.buyerConcerns.length) lines.push("  (none above threshold)");

  lines.push("");
  lines.push("Backlog candidates (read-only; not written to operating backlog)");
  for (const c of audit.backlogCandidates) {
    lines.push(`  - ${c.title} [${c.dedupeKey}]`);
  }
  if (!audit.backlogCandidates.length) lines.push("  (none)");

  lines.push("");
  lines.push("DataGaps");
  for (const g of audit.dataGaps) {
    if (g.suppressFromFounderRanking && g.founderRelevance === "suppressed") continue;
    lines.push(`  - [${g.founderRelevance}] ${g.scope}`);
  }
  if (!audit.dataGaps.length) lines.push("  (none)");

  lines.push("");
  lines.push(
    "Recently Completed: deferred — no reliable deployment-completion source without broad new persistence.",
  );

  return lines.join("\n");
}

export function summarizeAuditJson(audit: ClientAttentionAudit): unknown {
  return {
    mode: audit.mode,
    redacted: audit.redacted,
    sourceAvailability: audit.sourceAvailability,
    counts: audit.counts,
    topSignalId: audit.topSignalId,
    rankedCount: audit.rankedSignals.length,
    recommendationReady: audit.rankedSignals
      .slice(0, 2)
      .map((r) => ({
        id: r.signal.id,
        type: r.signal.signalType,
        score: r.totalScore,
        displayName: r.signal.displayName,
      })),
    buyerConcerns: audit.buyerConcerns,
    dataGapCount: audit.dataGaps.length,
    backlogCandidateCount: audit.backlogCandidates.length,
  };
}
