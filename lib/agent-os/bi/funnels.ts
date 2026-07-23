/**
 * Explicit typed funnels from repository routes + verified analytics stages.
 * Unsupported stages are measurement gaps — never invented as observed facts.
 */

import type { FunnelDefinition } from "./types";

export const FUNNEL_DEFINITIONS: readonly FunnelDefinition[] = [
  {
    funnelId: "general-consultation",
    label: "General consultation",
    stages: [
      {
        stageId: "qualified-landing",
        label: "Qualified landing page",
        expectedEventName: "page_view",
        route: null,
        evidenceBasis: "both",
      },
      {
        stageId: "concierge-cta",
        label: "Concierge CTA",
        expectedEventName: "consultation_cta_clicked",
        route: "/concierge",
        evidenceBasis: "both",
      },
      {
        stageId: "concierge-start",
        label: "Concierge start",
        expectedEventName: "concierge_form_started",
        route: "/concierge",
        evidenceBasis: "repository",
      },
      {
        stageId: "concierge-submit",
        label: "Concierge submit",
        expectedEventName: "concierge_form_submitted",
        route: "/concierge",
        evidenceBasis: "repository",
      },
      {
        stageId: "authoritative-conversion",
        label: "Authoritative conversion (generate_lead)",
        expectedEventName: "generate_lead",
        route: "/concierge",
        evidenceBasis: "repository",
      },
    ],
  },
  {
    funnelId: "diamond-studio",
    label: "Diamond Studio (Size Studio)",
    stages: [
      {
        stageId: "studio-entry",
        label: "Studio landing/entry",
        expectedEventName: "diamond_studio_view",
        route: "/diamond-studio",
        evidenceBasis: "both",
      },
      {
        stageId: "meaningful-interaction",
        label: "Meaningful interaction",
        expectedEventName: "studio_session_engaged",
        route: "/diamond-studio",
        evidenceBasis: "both",
      },
      {
        stageId: "studio-cta",
        label: "Concierge CTA from Studio",
        expectedEventName: "consultation_cta_clicked",
        route: "/diamond-studio",
        evidenceBasis: "both",
      },
      {
        stageId: "concierge-start-submit",
        label: "Concierge start/submit",
        expectedEventName: "generate_lead",
        route: "/concierge",
        evidenceBasis: "repository",
      },
    ],
  },
  {
    funnelId: "see-it-on-your-hand",
    label: "See It On Your Hand",
    stages: [
      {
        stageId: "route-entry",
        label: "Route entry",
        expectedEventName: null,
        route: "/diamond-shape-studio",
        evidenceBasis: "repository",
      },
      {
        stageId: "capture-session",
        label: "Capture/session start",
        expectedEventName: null,
        route: "/diamond-shape-studio",
        evidenceBasis: "unsupported",
      },
      {
        stageId: "preview-completion",
        label: "Preview completion",
        expectedEventName: null,
        route: "/diamond-shape-studio",
        evidenceBasis: "unsupported",
      },
      {
        stageId: "concierge-movement",
        label: "Concierge movement",
        expectedEventName: "consultation_cta_clicked",
        route: "/diamond-shape-studio",
        evidenceBasis: "repository",
      },
    ],
  },
  {
    funnelId: "analyze-sparkle",
    label: "Analyze Sparkle",
    stages: [
      {
        stageId: "route-entry",
        label: "Route entry",
        expectedEventName: null,
        route: "/diamond-intelligence",
        evidenceBasis: "repository",
      },
      {
        stageId: "upload-start",
        label: "Upload start",
        expectedEventName: null,
        route: "/diamond-intelligence",
        evidenceBasis: "unsupported",
      },
      {
        stageId: "analysis-completion",
        label: "Analysis completion",
        expectedEventName: null,
        route: "/diamond-intelligence",
        evidenceBasis: "unsupported",
      },
      {
        stageId: "concierge-movement",
        label: "Concierge movement",
        expectedEventName: "consultation_cta_clicked",
        route: "/diamond-intelligence",
        evidenceBasis: "repository",
      },
    ],
  },
  {
    funnelId: "content-to-conversion",
    label: "Content-to-conversion",
    stages: [
      {
        stageId: "conversation-entry",
        label: "Conversation/content entry",
        expectedEventName: "page_view",
        route: "/conversations",
        evidenceBasis: "repository",
      },
      {
        stageId: "related-resource",
        label: "Related guide/tool click",
        expectedEventName: "conversation_related_resource_clicked",
        route: "/conversations",
        evidenceBasis: "repository",
      },
      {
        stageId: "concierge-movement",
        label: "Concierge movement",
        expectedEventName: "conversation_concierge_clicked",
        route: "/concierge",
        evidenceBasis: "repository",
      },
    ],
  },
];

export function getFunnelDefinition(funnelId: string): FunnelDefinition | undefined {
  return FUNNEL_DEFINITIONS.find((f) => f.funnelId === funnelId);
}
