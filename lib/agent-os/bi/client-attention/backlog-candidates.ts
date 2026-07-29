/**
 * Read-only Client Action backlog candidates.
 * Never auto-insert into CURRENT_OPERATING_BACKLOG or create HubSpot tasks.
 *
 * Future persistence path: store dedupeKey + subjectKey + resolvedAt in Agent OS
 * persistence surface-eligibility (similar to recommendation recurrence), then
 * allow founder-affirmed promotion into operating-backlog via explicit edit —
 * not automatic writes.
 */

import type {
  ClientActionBacklogCandidate,
  RankedClientAttentionSignal,
} from "./types";
import { MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES } from "./types";

export function buildClientActionBacklogCandidates(
  ranked: RankedClientAttentionSignal[],
  max = MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
): ClientActionBacklogCandidate[] {
  return ranked
    .filter((r) => r.signal.founderRankable !== false)
    .filter((r) => r.signal.signalType !== "buyer-concern-pattern")
    .slice(0, max)
    .map((r) => {
      const signal = r.signal;
      const title = `${signal.displayName || "Client"} — ${signal.signalType}`;
      const dedupeKey = [
        "client-action",
        signal.signalType,
        signal.subjectKey,
      ].join(":");
      return {
        signalId: signal.id,
        subjectKey: signal.subjectKey,
        title,
        recommendedAction: signal.recommendedAction,
        urgency: signal.urgency,
        dueAt: signal.nextActivityAt || signal.targetDate,
        sourceTypes: signal.sourceTypes,
        confidence: signal.confidence,
        dedupeKey,
      };
    });
}
