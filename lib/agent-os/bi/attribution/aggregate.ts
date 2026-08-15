/**
 * Aggregate sanitized accepted-inquiry origin evidence.
 * No PII rows. No deal amounts. No GA4 identity join.
 */

import type { ConciergeAdapterResult } from "../client-attention/adapters/types";
import { classifyInquiryOrigin, classifySampleStrength } from "./classify";
import {
  ATTRIBUTION_COMPARISON_LOOKBACK_DAYS,
  ATTRIBUTION_COVERAGE_COLLAPSE_RATE,
  ATTRIBUTION_FUNNEL_STAGES,
  ATTRIBUTION_JOIN_STATUS,
  ATTRIBUTION_MATERIAL_SAMPLE_MIN,
  ATTRIBUTION_PRIMARY_LOOKBACK_DAYS,
  type AcceptedInquiryAttributionSnapshot,
  type AttributionCountBucket,
  type AttributionLookbackCompleteness,
  type AttributionOriginClass,
  type AttributionSampleStrengthOrUnevaluated,
  type AttributionWindowSnapshot,
  type Ga4UnjoinedSanity,
} from "./types";

export type Ga4AttributionCounts = {
  generateLeadCount?: number;
  conciergeFormStarted?: number;
  conciergeFormSubmitted?: number;
  consultationCtaClicks?: number;
};

export type RunAcceptedInquiryAttributionInput = {
  mode: "fixture" | "live";
  nowIso: string;
  concierge?: ConciergeAdapterResult | null;
  /** Actual HubSpot search window that produced the reconstructions. */
  crmReadLookbackDays: number;
  /** HubSpot deal search cap used for this reconstruction (default 40). */
  crmRecordCap?: number | null;
  /** Deals returned by that search — used to detect cap truncation. */
  crmRecordsReturned?: number | null;
  ga4Available: boolean;
  ga4Current?: Ga4AttributionCounts | null;
};

const EMPTY_BY_CLASS: Record<AttributionOriginClass, number> = {
  "explicit-tool-origin": 0,
  "explicit-cta-surface": 0,
  "landing-campaign-context": 0,
  unknown: 0,
};

export function emptyAcceptedInquiryAttributionSnapshot(
  note = "Accepted-inquiry attribution not executed",
): AcceptedInquiryAttributionSnapshot {
  const now = "1970-01-01T00:00:00.000Z";
  const emptyWindow = windowSnapshot(now, ATTRIBUTION_PRIMARY_LOOKBACK_DAYS, 0, 0);
  return {
    acceptedInquiryCount: 0,
    explicitOriginCount: 0,
    unknownOriginCount: 0,
    originCoverageRate: null,
    byOriginatingTool: [],
    byCtaSurface: [],
    byLandingPath: [],
    byUtmSource: [],
    byUtmMedium: [],
    byUtmCampaign: [],
    byReferrerHost: [],
    byOriginClass: { ...EMPTY_BY_CLASS },
    lookback: {
      requestedDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS,
      actualCrmCoverageDays: 0,
      start: emptyWindow.start,
      end: emptyWindow.end,
      completeness: "unavailable",
      recordCap: null,
      truncatedByRecordCap: false,
      note,
    },
    optionalComparison: null,
    sourceStatus: "unavailable",
    epistemicClass: "unknown",
    sampleStrength: null,
    ga4Sanity: unavailableGa4Sanity(),
    funnel: ATTRIBUTION_FUNNEL_STAGES,
    coverageIntegrityFinding: false,
    founderRecommendationEmitted: false,
    facts: [note],
    inferences: [
      "Missing CRM reconstruction is UNKNOWN, not an automatic capture failure",
    ],
  };
}

export function runAcceptedInquiryAttribution(
  input: RunAcceptedInquiryAttributionInput,
): AcceptedInquiryAttributionSnapshot {
  const nowMs = Date.parse(input.nowIso);
  const nowIso = Number.isNaN(nowMs) ? new Date().toISOString() : input.nowIso;
  const ga4Sanity = buildGa4Sanity(input.ga4Available, input.ga4Current);

  if (!input.concierge || input.concierge.status === "not-configured") {
    return unavailableSnapshot(
      input,
      nowIso,
      ga4Sanity,
      "HubSpot Concierge reconstruction unavailable — accepted-inquiry origin evidence unknown",
    );
  }

  if (input.concierge.status === "failed") {
    return unavailableSnapshot(
      input,
      nowIso,
      ga4Sanity,
      "HubSpot Concierge reconstruction failed — accepted-inquiry origin evidence unknown",
    );
  }

  const requestedDays = ATTRIBUTION_PRIMARY_LOOKBACK_DAYS;
  const actualCoverageDays = Math.max(
    0,
    Math.min(input.crmReadLookbackDays, requestedDays),
  );
  const truncatedByRecordCap = isTruncatedByRecordCap(input);
  const lookback = buildLookback({
    nowIso,
    requestedDays,
    actualCoverageDays,
    truncatedByRecordCap,
    recordCap: input.crmRecordCap ?? null,
    completenessOverride: null,
  });
  const coverageStartMs = Date.parse(nowIso) - daysMs(actualCoverageDays);
  const nowMsResolved = Date.parse(nowIso);

  const accepted = input.concierge.submissions.filter((s) => {
    if (s.accepted !== true) return false;
    const t = Date.parse(s.submittedAt);
    if (Number.isNaN(t)) return false;
    return t >= coverageStartMs && t <= nowMsResolved;
  });

  const origins = accepted.map(classifyInquiryOrigin);
  const explicit = origins.filter((o) => o.originClass !== "unknown");
  const unknown = origins.length - explicit.length;
  const coverage = origins.length ? explicit.length / origins.length : null;

  const byOriginClass: Record<AttributionOriginClass, number> = { ...EMPTY_BY_CLASS };
  for (const origin of origins) {
    byOriginClass[origin.originClass] += 1;
  }

  const comparisonAvailable =
    lookback.completeness !== "unavailable" &&
    actualCoverageDays >= ATTRIBUTION_COMPARISON_LOOKBACK_DAYS * 2 &&
    !truncatedByRecordCap;

  const current28StartMs =
    Date.parse(nowIso) - daysMs(ATTRIBUTION_COMPARISON_LOOKBACK_DAYS);
  const prior28StartMs =
    Date.parse(nowIso) - daysMs(ATTRIBUTION_COMPARISON_LOOKBACK_DAYS * 2);

  const current28 = comparisonAvailable
    ? accepted.filter((s) => Date.parse(s.submittedAt) >= current28StartMs)
    : [];
  const prior28 = comparisonAvailable
    ? input.concierge.submissions.filter((s) => {
        if (s.accepted !== true) return false;
        const t = Date.parse(s.submittedAt);
        if (Number.isNaN(t)) return false;
        return t >= prior28StartMs && t < current28StartMs;
      })
    : [];

  const current28Origins = current28.map(classifyInquiryOrigin);
  const prior28Origins = prior28.map(classifyInquiryOrigin);

  const sampleStrength = classifySampleStrength(accepted.length);
  const coverageIntegrityFinding = detectCoverageCollapse({
    primaryCount: accepted.length,
    primaryCoverage: coverage,
    comparisonAvailable,
    current28Count: current28.length,
    current28Coverage: coverageRate(current28Origins),
    prior28Count: prior28.length,
    prior28Coverage: coverageRate(prior28Origins),
  });

  const sourceStatus =
    input.mode === "fixture"
      ? "fixture"
      : input.concierge.status === "empty" || accepted.length === 0
        ? "empty"
        : "ok";

  const facts = buildFacts({
    acceptedCount: accepted.length,
    explicitCount: explicit.length,
    unknownCount: unknown,
    coverage,
    sampleStrength,
    byTool: countBy(origins.map((o) => o.originatingTool)),
    coverageIntegrityFinding,
    ga4Sanity,
    lookback,
    sourceObserved: true,
  });

  const inferences = [
    "CRM reconstructed Concierge inquiries are the source of truth for accepted identified origin evidence",
    "GA4 event counts are an unjoined parallel track and do not identify the same people",
    "Accepted Concierge inquiry is not a qualified opportunity — qualification is not defined",
    "Origin UNKNOWN means Hourglass did not capture a reliable origin field, not an inferred channel",
    "Landing path or campaign context is not inferred as a named tool origin",
  ];

  if (sampleStrength !== "MATERIAL_SIGNAL") {
    inferences.push(
      "Sample too small to change product or acquisition strategy",
    );
  }

  return {
    acceptedInquiryCount: accepted.length,
    explicitOriginCount: explicit.length,
    unknownOriginCount: unknown,
    originCoverageRate: coverage,
    byOriginatingTool: countBy(origins.map((o) => o.originatingTool)),
    byCtaSurface: countBy(origins.map((o) => o.ctaSurface)),
    byLandingPath: countBy(origins.map((o) => o.landingPath)),
    byUtmSource: countBy(origins.map((o) => o.utmSource)),
    byUtmMedium: countBy(origins.map((o) => o.utmMedium)),
    byUtmCampaign: countBy(origins.map((o) => o.utmCampaign)),
    byReferrerHost: countBy(origins.map((o) => o.referrerHost)),
    byOriginClass,
    lookback,
    optionalComparison: comparisonAvailable
      ? {
          current28: toWindowSnapshot(
            nowIso,
            ATTRIBUTION_COMPARISON_LOOKBACK_DAYS,
            current28Origins,
          ),
          prior28: toWindowSnapshot(
            isoDaysAgo(nowIso, ATTRIBUTION_COMPARISON_LOOKBACK_DAYS),
            ATTRIBUTION_COMPARISON_LOOKBACK_DAYS,
            prior28Origins,
          ),
        }
      : null,
    sourceStatus,
    epistemicClass: accepted.length ? "derived" : "unknown",
    sampleStrength,
    ga4Sanity,
    funnel: ATTRIBUTION_FUNNEL_STAGES,
    coverageIntegrityFinding,
    founderRecommendationEmitted: coverageIntegrityFinding,
    facts,
    inferences,
  };
}

function unavailableSnapshot(
  input: RunAcceptedInquiryAttributionInput,
  nowIso: string,
  ga4Sanity: Ga4UnjoinedSanity,
  note: string,
): AcceptedInquiryAttributionSnapshot {
  const snap = emptyAcceptedInquiryAttributionSnapshot(note);
  const lookback = buildLookback({
    nowIso,
    requestedDays: ATTRIBUTION_PRIMARY_LOOKBACK_DAYS,
    actualCoverageDays: 0,
    truncatedByRecordCap: false,
    recordCap: input.crmRecordCap ?? null,
    completenessOverride: "unavailable",
  });
  return {
    ...snap,
    ga4Sanity,
    lookback: { ...lookback, note },
    optionalComparison: null,
    originCoverageRate: null,
    sampleStrength: null,
    facts: [note],
    inferences: [
      "Missing CRM reconstruction is UNKNOWN, not an automatic capture failure",
      "acceptedInquiryCount 0 here is a neutral placeholder, not evidence that there were zero inquiries",
    ],
  };
}

function isTruncatedByRecordCap(
  input: RunAcceptedInquiryAttributionInput,
): boolean {
  const cap = input.crmRecordCap;
  const returned = input.crmRecordsReturned;
  if (cap == null || returned == null) return false;
  if (cap <= 0) return false;
  return returned >= cap;
}

function buildLookback(input: {
  nowIso: string;
  requestedDays: number;
  actualCoverageDays: number;
  truncatedByRecordCap: boolean;
  recordCap: number | null;
  completenessOverride: AttributionLookbackCompleteness | null;
}): AcceptedInquiryAttributionSnapshot["lookback"] {
  const completeness: AttributionLookbackCompleteness =
    input.completenessOverride ??
    (input.actualCoverageDays >= input.requestedDays &&
    !input.truncatedByRecordCap
      ? "complete"
      : "partial");
  const windowDays =
    input.actualCoverageDays > 0 ? input.actualCoverageDays : input.requestedDays;
  const capNote =
    input.recordCap != null
      ? ` Deal search cap is ${input.recordCap}.`
      : "";
  const truncNote = input.truncatedByRecordCap
    ? " Record cap was reached; older deals in the window may be missing. Period is PARTIAL."
    : "";
  let note: string;
  if (completeness === "unavailable") {
    note =
      "HubSpot Concierge reconstruction was not observed. This is not a zero-inquiry finding and not a complete lookback.";
  } else if (completeness === "complete") {
    note = `CRM reconstruction searched last-modified deals over ${input.actualCoverageDays} days.${capNote} Period complete.`;
  } else if (input.actualCoverageDays < input.requestedDays) {
    note = `Requested ${input.requestedDays}-day attribution window; actual CRM coverage is ${input.actualCoverageDays} days. This is not a complete ${input.requestedDays}-day snapshot.${capNote}${truncNote}`;
  } else {
    note = `CRM reconstruction searched ${input.actualCoverageDays} days.${capNote}${truncNote}`;
  }
  return {
    requestedDays: input.requestedDays,
    actualCrmCoverageDays: input.actualCoverageDays,
    start: isoDaysAgo(input.nowIso, windowDays).slice(0, 10),
    end: input.nowIso.slice(0, 10),
    completeness,
    recordCap: input.recordCap,
    truncatedByRecordCap: input.truncatedByRecordCap,
    note,
  };
}

function detectCoverageCollapse(input: {
  primaryCount: number;
  primaryCoverage: number | null;
  comparisonAvailable: boolean;
  current28Count: number;
  current28Coverage: number | null;
  prior28Count: number;
  prior28Coverage: number | null;
}): boolean {
  if (
    input.primaryCount >= ATTRIBUTION_MATERIAL_SAMPLE_MIN &&
    input.primaryCoverage != null &&
    input.primaryCoverage < ATTRIBUTION_COVERAGE_COLLAPSE_RATE
  ) {
    return true;
  }
  if (
    input.comparisonAvailable &&
    input.current28Count >= 4 &&
    input.prior28Count >= 4 &&
    input.current28Coverage != null &&
    input.prior28Coverage != null &&
    input.prior28Coverage >= 0.5 &&
    input.current28Coverage < ATTRIBUTION_COVERAGE_COLLAPSE_RATE
  ) {
    return true;
  }
  return false;
}

function buildFacts(input: {
  acceptedCount: number;
  explicitCount: number;
  unknownCount: number;
  coverage: number | null;
  sampleStrength: AttributionSampleStrengthOrUnevaluated;
  byTool: AttributionCountBucket[];
  coverageIntegrityFinding: boolean;
  ga4Sanity: Ga4UnjoinedSanity;
  lookback: AcceptedInquiryAttributionSnapshot["lookback"];
  sourceObserved: boolean;
}): string[] {
  if (!input.sourceObserved) {
    return [input.lookback.note];
  }
  const windowLabel =
    input.lookback.completeness === "complete"
      ? `${input.lookback.actualCrmCoverageDays}-day complete CRM window`
      : `${input.lookback.actualCrmCoverageDays}-day CRM coverage window (requested ${input.lookback.requestedDays}; ${input.lookback.completeness})`;
  const facts: string[] = [
    `Accepted Concierge inquiries in the ${windowLabel}: ${input.acceptedCount}`,
    `Explicit origin captured: ${input.explicitCount}; unknown origin: ${input.unknownCount}`,
    `Origin coverage: ${formatRate(input.coverage)}; sample strength: ${input.sampleStrength}`,
    `Funnel: accepted Concierge inquiry ≠ qualified opportunity; qualification is not defined; revenue is not attributed`,
    input.lookback.note,
    input.ga4Sanity.note,
  ];

  if (input.sampleStrength !== "INSUFFICIENT_SAMPLE" && input.byTool[0]) {
    const top = input.byTool[0];
    facts.push(
      `${top.count} of ${input.acceptedCount} accepted inquiries explicitly named ${top.key}.`,
    );
  }

  if (input.sampleStrength !== "MATERIAL_SIGNAL") {
    facts.push("Sample too small to change product or acquisition strategy.");
  }

  if (input.coverageIntegrityFinding) {
    facts.push(
      "Attribution capture coverage collapsed on a material sample — one bounded BI integrity finding.",
    );
  }

  return facts;
}

function buildGa4Sanity(
  available: boolean,
  current?: Ga4AttributionCounts | null,
): Ga4UnjoinedSanity {
  if (!available || !current) return unavailableGa4Sanity();
  const generateLeadCount = current.generateLeadCount ?? 0;
  const conciergeFormSubmitted = current.conciergeFormSubmitted ?? 0;
  const conciergeFormStarted = current.conciergeFormStarted ?? 0;
  const consultationCtaClicked = current.consultationCtaClicks ?? 0;
  return {
    joinStatus: ATTRIBUTION_JOIN_STATUS,
    status: "ok",
    generateLeadCount,
    conciergeFormSubmitted,
    conciergeFormStarted,
    consultationCtaClicked,
    identityJoinPerformed: false,
    reconciliationClaim: false,
    note: "GA4 generate_lead / concierge form / consultation CTA counts are an UNJOINED parallel evidence track. Counts that differ across unjoined systems are not a missing-lead claim.",
  };
}

function unavailableGa4Sanity(): Ga4UnjoinedSanity {
  return {
    joinStatus: ATTRIBUTION_JOIN_STATUS,
    status: "unavailable",
    generateLeadCount: null,
    conciergeFormSubmitted: null,
    conciergeFormStarted: null,
    consultationCtaClicked: null,
    identityJoinPerformed: false,
    reconciliationClaim: false,
    note: "GA4 conversion counts unavailable — still an UNJOINED parallel track, not a CRM identity gap.",
  };
}

function countBy(values: Array<string | undefined>): AttributionCountBucket[] {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function coverageRate(
  origins: Array<{ originClass: AttributionOriginClass }>,
): number | null {
  if (!origins.length) return null;
  const explicit = origins.filter((o) => o.originClass !== "unknown").length;
  return explicit / origins.length;
}

function toWindowSnapshot(
  endIso: string,
  lookbackDays: number,
  origins: Array<{ originClass: AttributionOriginClass }>,
): AttributionWindowSnapshot {
  const explicit = origins.filter((o) => o.originClass !== "unknown").length;
  return windowSnapshot(endIso, lookbackDays, origins.length, explicit);
}

function windowSnapshot(
  endIso: string,
  lookbackDays: number,
  accepted: number,
  explicit: number,
): AttributionWindowSnapshot {
  return {
    lookbackDays,
    start: isoDaysAgo(endIso, lookbackDays).slice(0, 10),
    end: endIso.slice(0, 10),
    acceptedInquiryCount: accepted,
    explicitOriginCount: explicit,
    unknownOriginCount: accepted - explicit,
    originCoverageRate: accepted ? explicit / accepted : null,
  };
}

function formatRate(rate: number | null): string {
  if (rate == null) return "n/a";
  return `${Math.round(rate * 100)}%`;
}

function daysMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function isoDaysAgo(nowIso: string, days: number): string {
  const t = Date.parse(nowIso);
  if (Number.isNaN(t)) return nowIso;
  return new Date(t - daysMs(days)).toISOString();
}
