import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import type { ConditionalHoldCondition, ResumeEvidence } from "./types";

export function matchHoldCondition(input: { condition: ConditionalHoldCondition; activatedAt: string; events: readonly SourceCommunicationEvent[]; now: Date }): ResumeEvidence | null {
  if (input.condition.kind === "until_business_event") return null;
  if (input.condition.kind === "until_time") return input.now.getTime() >= Date.parse(input.condition.resumeAt)
    ? { sourceRef: "clock", observedAt: input.now.toISOString(), summary: `Hold time reached (${input.condition.resumeAt}).` } : null;
  const condition = input.condition;
  const events = input.events.filter((event) => Date.parse(event.timestamp) > Date.parse(input.activatedAt))
    .filter((event) => condition.observableSources.includes(event.sourceType))
    .filter((event) => inScope(event, condition.scope)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const event = events.find((row) => {
    if (condition.kind === "until_founder_contact") return row.direction === "outbound" && row.actor === "founder" && row.semanticClass !== "unknown_communication";
    if (condition.kind === "until_external_reply") return row.direction === "inbound" && (row.actor === "client" || row.actor === "vendor_shop") && !["unknown_communication", "client_replies_nonblocking", "vendor_acknowledges"].includes(row.semanticClass);
    return row.semanticClass === condition.semanticClass && (!condition.scope.cadId || row.cadIds.includes(condition.scope.cadId));
  });
  return event ? { sourceRef: event.sourceRef, observedAt: event.timestamp, summary: event.evidenceExcerpt || event.semanticClass } : null;
}
function inScope(event: SourceCommunicationEvent, scope: { projectId: string | null; personLabel: string | null; threadId: string | null }) {
  if (scope.projectId && event.projectId !== scope.projectId) return false;
  if (scope.threadId && event.threadId !== scope.threadId) return false;
  if (scope.personLabel && event.personLabel?.toLowerCase() !== scope.personLabel.toLowerCase()) return false;
  return Boolean(scope.projectId || scope.threadId || scope.personLabel);
}
