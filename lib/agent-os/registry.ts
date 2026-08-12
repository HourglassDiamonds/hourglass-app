import type {
  DataSourceId,
  EscalationRule,
  ExecutiveDefinition,
  ExecutiveId,
  ImplementationStatus,
} from "./types";
import { V1_PROHIBITED_ACTIONS } from "./types";

const SHARED_PROHIBITED = [...V1_PROHIBITED_ACTIONS];

const COS_ESCALATION: EscalationRule[] = [
  {
    id: "cos-founder-approval",
    condition: "Recommendation requires founder approval or spend",
    action: "Surface as explicit founder decision; do not self-approve",
  },
  {
    id: "cos-conflicting-roi",
    condition: "Executives recommend conflicting priorities",
    action: "Reconcile by ROI, evidence quality, and dependency readiness",
  },
  {
    id: "cos-data-blocked",
    condition: "Missing or unreliable data blocks a high-ROI action",
    action: "Escalate data gap before recommending irreversible work",
  },
];

const BI_ESCALATION: EscalationRule[] = [
  {
    id: "bi-tracking-failure",
    condition: "Metric drop coincides with incomplete or failed measurement",
    action: "Flag tracking failure before declaring business decline",
  },
  {
    id: "bi-attribution-incomplete",
    condition: "Attribution coverage is incomplete or unverified",
    action: "Separate known facts from inference; lower confidence",
  },
  {
    id: "bi-conversion-measurement",
    condition:
      "Core conversion or funnel measurement is missing, unknown, or decision-blocking",
    action:
      "Surface measurement repair before Opportunity paid/remarketing or channel ROI claims",
  },
];

const SEARCH_ESCALATION: EscalationRule[] = [
  {
    id: "search-gsc-gap",
    condition: "GSC unavailable or incomplete",
    action: "Continue repository authority analysis; do not fabricate GSC metrics",
  },
  {
    id: "search-gbp-gap",
    condition: "GBP metrics unavailable",
    action: "Use GSC local-intent + Charlotte guide registry only; no pack claims",
  },
  {
    id: "search-geo-readiness",
    condition: "GEO readiness findings",
    action: "Label as readiness signals, not confirmed AI citations",
  },
  {
    id: "search-tech-seo-audit-only",
    condition: "Technical SEO / P1-TECH-1 findings",
    action:
      "Standalone audit via agent-os:tech-seo only in V1 — do not auto-apply site edits; YELLOW/RED require founder approval; not wired into recurring Search Strategy briefs yet",
  },
];

const CONTENT_ESCALATION: EscalationRule[] = [
  {
    id: "content-buffer-gap",
    condition: "Buffer / social analytics unavailable",
    action:
      "Continue repository + Search/BI-backed recommendations; do not fabricate social metrics",
  },
  {
    id: "content-vs-search-ownership",
    condition: "Search technical SEO vs Content production overlap",
    action:
      "Keep Search for technical SEO; Content for communication/production framing",
  },
  {
    id: "content-publish-boundary",
    condition: "Recommendation implies publishing or Buffer writes",
    action: "Block — Content V1 is read-only recommendations only",
  },
];

const OPPORTUNITY_ESCALATION: EscalationRule[] = [
  {
    id: "opportunity-external-gap",
    condition: "No verified external opportunity adapter",
    action:
      "Keep category/research-required labels; do not fabricate partners, outlets, CPC, or audiences",
  },
  {
    id: "opportunity-ownership",
    condition: "Overlap with Search technical SEO or Content production",
    action:
      "Defer to the owning executive unless Opportunity adds distinct distribution/partner leverage",
  },
  {
    id: "opportunity-paid-remarketing",
    condition: "Paid-search or remarketing suggested without measurement evidence",
    action:
      "Emit readiness/measurement-blocked assessments only — never launch or configure ads",
  },
];

export const EXECUTIVE_REGISTRY: readonly ExecutiveDefinition[] = [
  {
    id: "chief-of-staff",
    displayName: "Chief of Staff",
    mission:
      "Turn available Hourglass business evidence into a short, ranked founder agenda.",
    ownedDomains: [
      "orchestration",
      "priority ranking",
      "conflict reconciliation",
      "founder brief",
      "dependency tracking",
      "approval surfacing",
      "client journey synthesis",
      "journey prioritization",
      "measurement-before-optimization sequencing",
    ],
    allowedDataSources: [
      "ga4",
      "gsc",
      "weekly-intelligence",
      "executive-dashboard-snapshot",
      "fixture",
    ],
    prohibitedActions: SHARED_PROHIBITED,
    escalationRules: COS_ESCALATION,
    implementationStatus: "operational",
    version: "1.0.0",
  },
  {
    id: "business-intelligence",
    displayName: "Business Intelligence",
    mission:
      "Maintain a trustworthy view of Hourglass performance, conversion measurement integrity, client journey evidence, and detect meaningful movement before recommendations are made.",
    ownedDomains: [
      "performance metrics",
      "anomalies",
      "conversion-funnel health",
      "acquisition movement",
      "landing-page movement",
      "Diamond Studio engagement",
      "Concierge activity signals",
      "measurement gaps",
      "source health",
      "analytics integrity",
      "conversion measurement",
      "funnel coverage",
      "journey progression",
      "client journey analysis",
      "client attention intelligence",
      "journey surface inventory",
      "journey friction detection",
      "conversion-signal availability",
      "attribution quality",
      "event-health monitoring",
      "destination quality",
      "conversion anomalies",
      "measurement regressions",
      "decision-quality safeguards",
      "readiness evidence for Opportunity",
    ],
    allowedDataSources: [
      "ga4",
      "gsc",
      "weekly-intelligence",
      "executive-dashboard-snapshot",
      "hubspot-aggregates",
      "fixture",
    ],
    prohibitedActions: SHARED_PROHIBITED,
    escalationRules: BI_ESCALATION,
    implementationStatus: "operational",
    version: "1.2.0",
  },
  {
    id: "search-strategy",
    displayName: "Search Strategy",
    mission:
      "Maintain and compound Hourglass search authority across traditional search, local search, and AI-assisted discovery without chasing generic SEO activity.",
    ownedDomains: [
      "Google Search Console",
      "organic landing-page performance",
      "branded vs non-branded search",
      "local intent",
      "local organic discovery",
      "local-intent queries",
      "GBP intelligence",
      "location/entity consistency",
      "local authority structure",
      "local content coverage",
      "local search readiness",
      "local schema readiness",
      "review/reputation measurement gaps",
      "service-area clarity",
      "local guide/tool/Concierge handoffs",
      "Diamond Guide structure",
      "content gaps",
      "internal links",
      "schema opportunities",
      "tool/content handoffs",
      "GEO / AI-answer readiness",
      "GBP search visibility when data is available",
      "Search & GEO / Technical SEO specialist",
      "technical SEO audit (canonicals, sitemap, robots, indexability)",
      "duplicate URL / canonical cluster diagnosis",
    ],
    allowedDataSources: ["gsc", "ga4", "gbp", "weekly-intelligence", "fixture"],
    prohibitedActions: SHARED_PROHIBITED,
    escalationRules: SEARCH_ESCALATION,
    implementationStatus: "operational",
    version: "1.1.0",
  },
  {
    id: "content",
    displayName: "Content",
    mission:
      "Develop a coherent founder-led content system that compounds Hourglass authority, expresses the brand clearly, supports search demand, and moves qualified prospects toward trust and conversation without chasing generic social trends.",
    ownedDomains: [
      "founder conversations",
      "long-form video",
      "short-form clips",
      "carousels",
      "social captions",
      "editorial themes",
      "content sequencing",
      "content repurposing",
      "content-to-guide handoffs",
      "content-to-tool handoffs",
      "content-to-Concierge handoffs",
      "audience questions",
      "message repetition and coverage",
      "brand voice consistency",
      "production backlog",
      "distribution recommendations",
      "content performance when verified data exists",
    ],
    allowedDataSources: [
      "ga4",
      "gsc",
      "weekly-intelligence",
      "buffer",
      "fixture",
    ],
    prohibitedActions: SHARED_PROHIBITED,
    escalationRules: CONTENT_ESCALATION,
    implementationStatus: "operational",
    version: "1.0.0",
  },
  {
    id: "opportunity",
    displayName: "Opportunity",
    mission:
      "Continuously identify low-cost, high-ROI growth opportunities that align with Hourglass positioning and can compound authority, qualified demand, referrals, and trust without distracting the business with generic marketing activity.",
    ownedDomains: [
      "underpriced organic demand",
      "high-intent paid-search readiness",
      "local partnership opportunities",
      "referral opportunities",
      "bridal and wedding ecosystem opportunities",
      "community visibility",
      "podcast and newsletter opportunities",
      "earned-media opportunities",
      "strategic content distribution",
      "competitor positioning gaps",
      "remarketing readiness",
      "audience reuse opportunities",
      "channel-fit opportunities",
      "relationship-driven growth",
      "founder-network leverage",
      "low-cost experiments",
      "emerging but brand-aligned opportunities",
      "opportunities surfaced by Search, Content, or BI that lack an owner",
    ],
    allowedDataSources: [
      "gsc",
      "ga4",
      "gbp",
      "hubspot-aggregates",
      "weekly-intelligence",
      "fixture",
    ],
    prohibitedActions: SHARED_PROHIBITED,
    escalationRules: OPPORTUNITY_ESCALATION,
    implementationStatus: "operational",
    version: "1.0.0",
  },
] as const;

const LOCKED_ORDER: ExecutiveId[] = [
  "chief-of-staff",
  "business-intelligence",
  "search-strategy",
  "content",
  "opportunity",
];

export function getExecutive(id: ExecutiveId): ExecutiveDefinition {
  const found = EXECUTIVE_REGISTRY.find((e) => e.id === id);
  if (!found) {
    throw new Error(`Unknown executive: ${id}`);
  }
  return found;
}

export function listExecutives(): ExecutiveDefinition[] {
  return LOCKED_ORDER.map((id) => getExecutive(id));
}

export function operationalExecutives(): ExecutiveDefinition[] {
  return listExecutives().filter((e) => e.implementationStatus === "operational");
}

export function scaffoldExecutives(): ExecutiveDefinition[] {
  return listExecutives().filter((e) => e.implementationStatus === "scaffold");
}

export function isExecutiveOperational(id: ExecutiveId): boolean {
  return getExecutive(id).implementationStatus === "operational";
}

export function assertOperationalForRecommendations(id: ExecutiveId): void {
  if (!isExecutiveOperational(id)) {
    throw new Error(
      `Executive "${id}" is not operational and cannot generate recommendations in Agent OS V1.`,
    );
  }
}

export function executiveAllowsSource(
  id: ExecutiveId,
  source: DataSourceId,
): boolean {
  return getExecutive(id).allowedDataSources.includes(source);
}

export function getImplementationStatus(
  id: ExecutiveId,
): ImplementationStatus {
  return getExecutive(id).implementationStatus;
}
