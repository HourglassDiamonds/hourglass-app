import type { BusinessIntelligenceOutput } from "./business-intelligence";
import { consolidateDuplicates } from "../recommendation";
import { rankRecommendations } from "../ranking";
import { scaffoldExecutives } from "../registry";
import type {
  AgendaBucket,
  EscalationItem,
  FounderBrief,
  Recommendation,
} from "../types";

export type ChiefOfStaffInput = {
  bi: BusinessIntelligenceOutput;
  reportingPeriod: { start: string; end: string };
  warnings: string[];
  mode?: "fixture" | "live";
};

export type ChiefOfStaffOutput = {
  recommendations: Recommendation[];
  brief: FounderBrief;
  escalationItems: EscalationItem[];
  nonOperationalNote: string[];
};

const REQUIRED_BRIEF_QUESTIONS = [
  "What changed?",
  "Why does it matter?",
  "What needs attention today?",
  "What is the single highest-ROI action?",
  "What can safely wait?",
  "What is blocked?",
  "What decision does the founder need to make?",
  "What data is missing or unreliable?",
] as const;

export { REQUIRED_BRIEF_QUESTIONS };

export function runChiefOfStaff(input: ChiefOfStaffInput): ChiefOfStaffOutput {
  const scaffolds = scaffoldExecutives();
  const nonOperationalNote = scaffolds.map(
    (e) => `${e.displayName} not yet operational`,
  );

  let recommendations = consolidateDuplicates(input.bi.recommendations);
  recommendations = rankRecommendations(
    recommendations.filter((r) => r.status !== "consolidated"),
  );

  // Prevent low-value work from displacing higher-value work
  recommendations = recommendations.map((r) => {
    if (
      r.agendaBucket === "ignore" ||
      (r.rankingFactors.expectedBusinessImpact < 4 &&
        r.effortEstimate === "high")
    ) {
      return {
        ...r,
        agendaBucket: "ignore" as AgendaBucket,
        status: r.status === "blocked" ? r.status : "ignore",
      };
    }
    return r;
  });

  const active = recommendations.filter(
    (r) => r.status !== "blocked" && r.status !== "ignore" && r.status !== "consolidated",
  );
  const blocked = recommendations.filter((r) => r.status === "blocked");
  const doNow = active.filter((r) => r.agendaBucket === "do-now");
  const schedule = active.filter((r) => r.agendaBucket === "schedule-next");
  const monitor = active.filter((r) => r.agendaBucket === "monitor");

  const highest = active[0];
  const founderDecisions = active
    .filter((r) => r.approvalRequired)
    .map((r) => r.title);

  // Escalate measurement gaps that block reliable action
  const escalationItems: EscalationItem[] = [];
  for (const gap of input.bi.dataGaps.slice(0, 6)) {
    escalationItems.push({
      id: `esc-${gap.id}`,
      executiveId: "chief-of-staff",
      title: gap.description,
      reason: gap.impactOnRecommendations,
      requiresFounderDecision: gap.sourceId === "ga4" || gap.id.includes("tracking"),
    });
  }
  if (input.bi.incompleteAttribution) {
    escalationItems.push({
      id: "esc-incomplete-attribution",
      executiveId: "business-intelligence",
      title: "Incomplete attribution",
      reason:
        "Social/channel attribution is incomplete — do not treat GA4 social labels as content ROI proof",
      requiresFounderDecision: false,
    });
  }

  const whatChanged =
    input.bi.keyMetricChanges.slice(0, 4).join("; ") ||
    "Insufficient metric coverage to summarize changes.";

  const whyItMatters = highest
    ? `${highest.whyItMattersNow} (top ranked: ${highest.title})`
    : "No high-confidence action is ready; measurement gaps dominate.";

  const needsAttentionToday = [
    ...doNow.map((r) => r.title),
    ...input.bi.anomalies
      .filter((a) => a.severity === "critical" || a.severity === "high")
      .map((a) => a.title),
  ].slice(0, 5);

  if (needsAttentionToday.length === 0 && input.bi.dataGaps.length) {
    needsAttentionToday.push(
      "Close critical measurement gaps before prioritizing growth experiments",
    );
  }

  const canSafelyWait = [
    ...schedule.map((r) => r.title),
    ...monitor.map((r) => r.title),
    ...recommendations
      .filter((r) => r.agendaBucket === "ignore" && r.status !== "blocked")
      .map((r) => r.title),
  ].slice(0, 5);

  const blockedList = [
    ...blocked.map(
      (r) =>
        `${r.title}${r.blockedReasons?.length ? ` — ${r.blockedReasons[0]}` : ""}`,
    ),
    ...nonOperationalNote,
  ].slice(0, 8);

  const missingOrUnreliableData = input.bi.dataGaps.map(
    (g) => `${g.description}: ${g.impactOnRecommendations}`,
  );

  if (input.bi.incompleteAttribution) {
    missingOrUnreliableData.unshift(
      "Incomplete attribution: social/content ROI cannot be verified without a Buffer (or equivalent) adapter",
    );
  }

  const founderDecisionNeeded =
    founderDecisions.length > 0
      ? founderDecisions
      : active.length > 0
        ? [
            "Whether to spend founder time on the highest-ROI action above before starting new creative or SEO experiments",
          ]
        : criticalGapsNeedDecision(input.bi)
          ? [
              "Whether to prioritize restoring read-only measurement (GA4 / Search Console / weekly intelligence) before asking Agent OS for growth recommendations",
            ]
          : ["None required this cycle"];

  const brief = buildFounderBrief({
    mode: input.mode ?? "fixture",
    whatChanged,
    whyItMatters,
    needsAttentionToday,
    highestRoiAction: highest
      ? `${highest.title} — ${highest.proposedAction} (confidence ${highest.confidence})`
      : "None — resolve data gaps first",
    canSafelyWait,
    blocked: blockedList,
    founderDecisionNeeded,
    missingOrUnreliableData,
    period: input.reportingPeriod,
    facts: input.bi.facts,
    inferences: input.bi.inferences,
  });

  return {
    recommendations,
    brief,
    escalationItems,
    nonOperationalNote,
  };
}

function criticalGapsNeedDecision(bi: BusinessIntelligenceOutput): boolean {
  return bi.dataGaps.some(
    (g) =>
      g.sourceId === "ga4" ||
      g.sourceId === "gsc" ||
      g.sourceId === "weekly-intelligence" ||
      g.id.includes("live-load"),
  );
}

function buildFounderBrief(input: {
  mode: "fixture" | "live";
  whatChanged: string;
  whyItMatters: string;
  needsAttentionToday: string[];
  highestRoiAction: string;
  canSafelyWait: string[];
  blocked: string[];
  founderDecisionNeeded: string[];
  missingOrUnreliableData: string[];
  period: { start: string; end: string };
  facts: string[];
  inferences: string[];
}): FounderBrief {
  const bullets = (items: string[]) =>
    items.length ? items.map((i) => `- ${i}`).join("\n") : "- None";

  const modeLabel =
    input.mode === "fixture"
      ? "Fixture sample (not live production evidence)"
      : "Live read-only";

  const markdown = `# Hourglass Founder Brief

Mode: ${modeLabel}
Reporting period: ${input.period.start} → ${input.period.end}

## 1. What changed?
${input.whatChanged}

## 2. Why does it matter?
${input.whyItMatters}

## 3. What needs attention today?
${bullets(input.needsAttentionToday)}

## 4. What is the single highest-ROI action?
${input.highestRoiAction}

## 5. What can safely wait?
${bullets(input.canSafelyWait)}

## 6. What is blocked?
${bullets(input.blocked)}

## 7. What decision does the founder need to make?
${bullets(input.founderDecisionNeeded)}

## 8. What data is missing or unreliable?
${bullets(input.missingOrUnreliableData.slice(0, 8))}

### Known facts
${bullets(input.facts.slice(0, 6))}

### Inferences (not facts)
${bullets(input.inferences.slice(0, 4))}

---
Agent OS V1 — read-only. No external writes. Revenue is never inferred from traffic alone.
`.trim();

  return {
    whatChanged: input.whatChanged,
    whyItMatters: input.whyItMatters,
    needsAttentionToday: input.needsAttentionToday,
    highestRoiAction: input.highestRoiAction,
    canSafelyWait: input.canSafelyWait,
    blocked: input.blocked,
    founderDecisionNeeded: input.founderDecisionNeeded,
    missingOrUnreliableData: input.missingOrUnreliableData,
    markdown,
  };
}
