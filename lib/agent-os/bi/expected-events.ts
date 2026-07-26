/**
 * Bounded expected-event inventory from repository evidence.
 * Static imports / deterministic references only — does not prove events fire in production.
 */

import type { ExpectedEventDefinition } from "./types";

/**
 * Events the Agent OS GA4 adapter currently retrieves (live allowlist).
 * Mirror of lib/integrations/ga4.ts GA4_LIVE_QUERIED_EVENTS.
 */
export const GA4_ADAPTER_QUERIED_EVENTS = [
  "diamond_studio_view",
  "carat_changed",
  "finger_size_changed",
  "shape_selected",
  "skin_tone_selected",
  "orientation_changed",
  "coverage_zone_changed",
  "consultation_cta_clicked",
  "studio_session_engaged",
  "home_clicked",
  "concierge_form_started",
  "concierge_form_submitted",
  "generate_lead",
  "conversation_video_started",
  "conversation_video_progress",
  "conversation_video_completed",
  "conversation_related_resource_clicked",
  "conversation_concierge_clicked",
] as const;

export const AUTHORITATIVE_CONVERSION_EVENT = "generate_lead" as const;

/**
 * Deployment-safe expected instrumentation inventory.
 * Each row cites a repository constant/helper — not live firing proof.
 */
export const EXPECTED_EVENT_INVENTORY: readonly ExpectedEventDefinition[] = [
  {
    stableEventId: "expected:page-view",
    expectedEventName: "page_view",
    category: "page-view",
    route: null,
    journey: "cross-cutting",
    funnelStage: "landing",
    triggerDescription: "App Router client navigation page path update",
    sourceReference: "lib/gtag.ts#pageview",
    expectedParameters: ["page_path"],
    conversionImportance: "low",
    required: true,
    privacySensitivity: "low",
    repositoryConfidence: 0.95,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:consultation-cta-clicked",
    expectedEventName: "consultation_cta_clicked",
    category: "cta-click",
    route: "/concierge",
    journey: "general-consultation",
    funnelStage: "concierge-cta",
    triggerDescription: "Commercial CTA click before navigation to Concierge",
    sourceReference: "lib/consultation-cta.ts#CONSULTATION_CTA_EVENT",
    expectedParameters: ["location", "destination", "page_path"],
    conversionImportance: "high",
    required: true,
    privacySensitivity: "none",
    repositoryConfidence: 0.95,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:concierge-form-started",
    expectedEventName: "concierge_form_started",
    category: "concierge-start",
    route: "/concierge",
    journey: "general-consultation",
    funnelStage: "concierge-start",
    triggerDescription: "Concierge form interaction start",
    sourceReference: "lib/concierge/analytics.ts#trackConciergeFormStarted",
    expectedParameters: ["page_path"],
    conversionImportance: "high",
    required: true,
    privacySensitivity: "none",
    repositoryConfidence: 0.95,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:concierge-form-submitted",
    expectedEventName: "concierge_form_submitted",
    category: "concierge-submit",
    route: "/concierge",
    journey: "general-consultation",
    funnelStage: "concierge-submit",
    triggerDescription:
      "Concierge form accepted by server (accepted === true); non-PII params only",
    sourceReference: "lib/concierge/analytics.ts#trackConciergeFormSubmitted",
    expectedParameters: [
      "project_type",
      "budget_band",
      "timeline",
      "source",
      "originating_tool",
    ],
    conversionImportance: "critical",
    required: true,
    privacySensitivity: "low",
    repositoryConfidence: 0.95,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:generate-lead",
    expectedEventName: AUTHORITATIVE_CONVERSION_EVENT,
    category: "concierge-submit",
    route: "/concierge",
    journey: "general-consultation",
    funnelStage: "authoritative-conversion",
    triggerDescription:
      "GA4 recommended conversion after Concierge soft-accept; no PII",
    sourceReference: "lib/concierge/analytics.ts#trackGenerateLead",
    expectedParameters: [
      "project_type",
      "budget_band",
      "timeline",
      "source",
      "originating_tool",
    ],
    conversionImportance: "critical",
    required: true,
    privacySensitivity: "low",
    repositoryConfidence: 0.95,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:diamond-studio-view",
    expectedEventName: "diamond_studio_view",
    category: "tool-entry",
    route: "/diamond-studio",
    journey: "diamond-studio",
    funnelStage: "tool-entry",
    triggerDescription: "Size Studio (Diamond Studio) session entry",
    sourceReference: "app/diamond-studio/analytics.ts#diamond_studio_view",
    expectedParameters: ["shape", "carat", "deviceType"],
    conversionImportance: "high",
    required: true,
    privacySensitivity: "none",
    repositoryConfidence: 0.95,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:studio-session-engaged",
    expectedEventName: "studio_session_engaged",
    category: "tool-completion",
    route: "/diamond-studio",
    journey: "diamond-studio",
    funnelStage: "meaningful-interaction",
    triggerDescription:
      "Soft completion / meaningful engagement (time or interactions)",
    sourceReference: "app/diamond-studio/analytics.ts#studio_session_engaged",
    expectedParameters: ["engagementTrigger", "deviceType"],
    conversionImportance: "high",
    required: true,
    privacySensitivity: "none",
    repositoryConfidence: 0.9,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:shape-selected",
    expectedEventName: "shape_selected",
    category: "tool-progression",
    route: "/diamond-studio",
    journey: "diamond-studio",
    funnelStage: "tool-progression",
    triggerDescription: "User selects a diamond shape in Size Studio",
    sourceReference: "app/diamond-studio/analytics.ts#shape_selected",
    expectedParameters: ["shape"],
    conversionImportance: "medium",
    required: false,
    privacySensitivity: "none",
    repositoryConfidence: 0.9,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:conversation-concierge-clicked",
    expectedEventName: "conversation_concierge_clicked",
    category: "cta-click",
    route: "/conversations",
    journey: "content-to-conversion",
    funnelStage: "concierge-movement",
    triggerDescription: "Conversation episode Concierge CTA",
    sourceReference: "lib/conversations/analytics.ts",
    expectedParameters: ["episode_slug"],
    conversionImportance: "medium",
    required: false,
    privacySensitivity: "none",
    repositoryConfidence: 0.85,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:conversation-related-resource",
    expectedEventName: "conversation_related_resource_clicked",
    category: "content-engagement",
    route: "/conversations",
    journey: "content-to-conversion",
    funnelStage: "related-guide-or-tool",
    triggerDescription: "Related guide/tool click from a conversation",
    sourceReference: "lib/conversations/analytics.ts",
    expectedParameters: ["episode_slug", "resource"],
    conversionImportance: "medium",
    required: false,
    privacySensitivity: "none",
    repositoryConfidence: 0.85,
    repositoryEvidenceClear: true,
  },
  {
    stableEventId: "expected:home-clicked-dead",
    expectedEventName: "home_clicked",
    category: "outbound-click",
    route: "/diamond-studio",
    journey: "diamond-studio",
    funnelStage: "nav",
    triggerDescription:
      "Typed + GA4 allowlisted but no UI emitter found in repository",
    sourceReference: "app/diamond-studio/analytics.ts#home_clicked",
    expectedParameters: [],
    conversionImportance: "low",
    required: false,
    privacySensitivity: "none",
    repositoryConfidence: 0.7,
    repositoryEvidenceClear: false,
  },
];

/**
 * Known journey measurement gaps (no expected gtag emitter in repository).
 * These are funnel-stage gaps, not expected-event rows claiming emitters exist.
 */
export const UNMEASURED_JOURNEY_STAGES = [
  {
    journey: "see-it-on-your-hand" as const,
    route: "/diamond-shape-studio",
    stage: "tool-entry",
    note: "See It On Your Hand has Concierge CTA tracking only — no tool start/completion gtag",
    sourceReference: "docs/analytics-tracking-preflight-2026-07.md",
  },
  {
    journey: "see-it-on-your-hand" as const,
    route: "/diamond-shape-studio",
    stage: "preview-completion",
    note: "No preview-completion event in repository",
    sourceReference: "docs/analytics-tracking-preflight-2026-07.md",
  },
  {
    journey: "analyze-sparkle" as const,
    route: "/diamond-intelligence",
    stage: "tool-entry",
    note: "Analyze Sparkle has Concierge CTA tracking only — no upload/analysis events",
    sourceReference: "docs/analytics-tracking-preflight-2026-07.md",
  },
  {
    journey: "analyze-sparkle" as const,
    route: "/diamond-intelligence",
    stage: "analysis-completion",
    note: "No analysis-completion event in repository",
    sourceReference: "docs/analytics-tracking-preflight-2026-07.md",
  },
] as const;

export function listExpectedEventNames(): string[] {
  return EXPECTED_EVENT_INVENTORY.map((e) => e.expectedEventName);
}

export function getExpectedEventByName(
  name: string,
): ExpectedEventDefinition | undefined {
  return EXPECTED_EVENT_INVENTORY.find((e) => e.expectedEventName === name);
}
