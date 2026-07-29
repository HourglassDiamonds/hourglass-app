/**
 * Privacy / redaction for Client Attention audits and founder output.
 */

import { containsLikelyPiiOrSecret, redactSecretsAndPii } from "../../redaction";
import type {
  ClientAttentionAudit,
  ClientAttentionSignal,
  ClientSignalEvidence,
} from "./types";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const CRM_ID_RE =
  /\b(?:fixture-)?(?:contact|deal|task|thread|submission)-[a-z0-9-]+\b/gi;
const HUBSPOT_ID_RE = /\b(?:hs-)?(?:contact|deal)[_-]?\d+\b/gi;

export function redactText(value: string): string {
  return redactSecretsAndPii(
    value
      .replace(EMAIL_RE, "[redacted-email]")
      .replace(PHONE_RE, "[redacted-phone]")
      .replace(CRM_ID_RE, "[redacted-id]")
      .replace(HUBSPOT_ID_RE, "[redacted-id]"),
  );
}

export function stripInternalIdsFromSignal(
  signal: ClientAttentionSignal,
): ClientAttentionSignal {
  return {
    id: signal.id,
    displayName: signal.displayName,
    subjectKey: signal.subjectKey,
    sourceTypes: signal.sourceTypes,
    signalType: signal.signalType,
    urgency: signal.urgency,
    confidence: signal.confidence,
    firstSeenAt: signal.firstSeenAt,
    lastInboundAt: signal.lastInboundAt,
    lastOutboundAt: signal.lastOutboundAt,
    lastActivityAt: signal.lastActivityAt,
    nextActivityAt: signal.nextActivityAt,
    targetDate: signal.targetDate,
    summary: redactText(signal.summary),
    whyItMatters: redactText(signal.whyItMatters),
    recommendedAction: redactText(signal.recommendedAction),
    evidence: signal.evidence.map(redactEvidence),
    discrepancyClass: signal.discrepancyClass,
    isPattern: signal.isPattern,
    founderRankable: signal.founderRankable,
    suppressReason: signal.suppressReason,
  };
}

function redactEvidence(ev: ClientSignalEvidence): ClientSignalEvidence {
  return {
    id: ev.id,
    sourceType: ev.sourceType,
    kind: ev.kind,
    observedAt: ev.observedAt,
    observation: redactText(ev.observation),
    reliability: ev.reliability,
    redactionStatus: "redacted",
  };
}

/** Deep-safe audit for CLI / persistence — no raw emails, phones, CRM ids, bodies. */
export function redactClientAttentionAudit(
  audit: ClientAttentionAudit,
): ClientAttentionAudit {
  return {
    ...audit,
    redacted: true,
    signals: audit.signals.map(stripInternalIdsFromSignal),
    rankedSignals: audit.rankedSignals.map((r) => ({
      ...r,
      signal: stripInternalIdsFromSignal(r.signal),
      outranksReason: redactText(r.outranksReason),
    })),
    backlogCandidates: audit.backlogCandidates.map((c) => ({
      ...c,
      title: redactText(c.title),
      recommendedAction: redactText(c.recommendedAction),
    })),
    facts: audit.facts.map(redactText),
    inferences: audit.inferences.map(redactText),
    dataGaps: audit.dataGaps.map((g) => ({
      ...g,
      scope: redactText(g.scope),
      resolutionPrerequisite: redactText(g.resolutionPrerequisite),
      affectedAnalyses: g.affectedAnalyses.map(redactText),
    })),
    buyerConcerns: audit.buyerConcerns.map((b) => ({
      ...b,
      concern: redactText(b.concern),
    })),
  };
}

export function assertFounderFacingSafe(text: string): boolean {
  if (EMAIL_RE.test(text)) return false;
  if (PHONE_RE.test(text)) return false;
  if (/Bearer\s+\S+/i.test(text)) return false;
  if (containsLikelyPiiOrSecret(text)) return false;
  return true;
}

export function founderFacingTextsAreSafe(texts: string[]): boolean {
  return texts.every(assertFounderFacingSafe);
}
