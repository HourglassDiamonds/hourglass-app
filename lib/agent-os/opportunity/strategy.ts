/**
 * Bounded repository strategy signals for Opportunity Executive.
 * Static imports / constants only — no filesystem crawling, no worktree paths,
 * no customer/contact lists, no marketing-sprint scans.
 */

import { MESSAGE_TERRITORIES, PLANNED_CONVERSATION_TOPICS } from "../content/themes";

/** Known conversion / product routes Opportunity may reference. */
export const KNOWN_CONVERSION_ROUTES = [
  "/concierge",
  "/diamond-shape-studio",
  "/diamond-studio",
  "/diamond-intelligence",
  "/diamond-guide",
] as const;

/** Charlotte-metro location tokens aligned with Search Strategy classify.ts */
export const LOCAL_GEOGRAPHY_TOKENS = [
  "charlotte",
  "waxhaw",
  "fort mill",
  "south charlotte",
  "ballantyne",
] as const;

/**
 * Category-level partner / referral ecosystems — not verified targets.
 * Specific businesses must never be named as confirmed opportunities.
 */
export const PARTNER_CATEGORY_STRATEGY = [
  {
    id: "wedding-planners",
    label: "Wedding planners",
    audienceMoment: "Couples planning the engagement-to-wedding journey",
    trustTransfer:
      "Planners already hold relational trust when ring education still matters",
    hourglassAsset: "Guides, Shape Studio, and Concierge as calm buyer education",
    mutualValue: "Clients get discernment help without inventory pressure",
    brandRisk: "Transactional vendor spam would damage quiet-luxury positioning",
    founderNeeded: true as const,
  },
  {
    id: "engagement-photographers",
    label: "Engagement photographers",
    audienceMoment: "Proposal and early engagement documentation",
    trustTransfer: "Photographers meet couples at a high-emotion decision window",
    hourglassAsset: "Ring design education and Studio tools for shape/style clarity",
    mutualValue: "Useful education asset partners can share without hard selling",
    brandRisk: "Commission-style outreach framing conflicts with brand",
    founderNeeded: true as const,
  },
  {
    id: "venues-bridal-adjacent",
    label: "Venues and bridal-adjacent spaces",
    audienceMoment: "Local wedding planning research",
    trustTransfer: "Venue relationships often precede jewelry finalization",
    hourglassAsset: "Local Charlotte authority guides + Concierge path",
    mutualValue: "Shared client value through education, not sponsorship theater",
    brandRisk: "Broad sponsorships without fit dilute discernment brand",
    founderNeeded: true as const,
  },
  {
    id: "estate-family-advisors",
    label: "Estate / family advisors (category research)",
    audienceMoment: "Heirloom and family-conversation jewelry decisions",
    trustTransfer: "Advisors influence high-trust family purchases",
    hourglassAsset: "Graduate Gemologist guidance + appraisal/education content",
    mutualValue: "Clear standards language without volume retail pressure",
    brandRisk: "Cold outreach to professionals without shared clients",
    founderNeeded: true as const,
  },
] as const;

/**
 * Internal positioning advantages — not verified competitor weaknesses.
 */
export const POSITIONING_LEVERAGE = [
  {
    id: "no-inventory-pressure",
    claim: "No inventory pressure — discernment over volume theater",
    label: "positioning leverage",
  },
  {
    id: "warmth-not-inspection",
    claim: "Buyer treated with warmth rather than inspection",
    label: "differentiation territory",
  },
  {
    id: "gg-led-guidance",
    claim: "Graduate Gemologist-led guidance with education tools",
    label: "positioning leverage",
  },
  {
    id: "tech-serves-humanity",
    claim: "Technology serving the human moment (Studio tools)",
    label: "differentiation territory",
  },
] as const;

/** Media / community research angles grounded in founder message territories. */
export function listMediaResearchAngles(): Array<{
  id: string;
  angle: string;
  credibility: string;
  audience: string;
  supportingThemeId: string;
}> {
  return MESSAGE_TERRITORIES.slice(0, 6).map((t) => ({
    id: t.id,
    angle: t.label,
    credibility: t.summary,
    audience: "Buyers seeking calm education, not commodity tips",
    supportingThemeId: t.id,
  }));
}

export function listPlannedContentAssets(): Array<{
  id: string;
  title: string;
  relatedGuideSlug?: string;
  relatedToolPath?: string;
}> {
  return PLANNED_CONVERSATION_TOPICS.map((t) => ({
    id: t.id,
    title: t.title,
    relatedGuideSlug: t.relatedGuideSlug,
    relatedToolPath: t.relatedToolPath,
  }));
}

export type RepositoryStrategySnapshot = {
  conversionRoutes: readonly string[];
  partnerCategories: typeof PARTNER_CATEGORY_STRATEGY;
  positioningLeverage: typeof POSITIONING_LEVERAGE;
  mediaAngles: ReturnType<typeof listMediaResearchAngles>;
  plannedContentAssets: ReturnType<typeof listPlannedContentAssets>;
  paidSearchTelemetryAvailable: false;
  remarketingAudienceEvidenceAvailable: false;
  cpcEvidenceAvailable: false;
  verifiedExternalTargetsAvailable: false;
  gbpAvailable: boolean;
  bufferAvailable: boolean;
  hubspotAggregatesAvailable: boolean;
};

export function inspectRepositoryStrategy(input?: {
  gbpAvailable?: boolean;
  bufferAvailable?: boolean;
  hubspotAggregatesAvailable?: boolean;
}): RepositoryStrategySnapshot {
  return {
    conversionRoutes: KNOWN_CONVERSION_ROUTES,
    partnerCategories: PARTNER_CATEGORY_STRATEGY,
    positioningLeverage: POSITIONING_LEVERAGE,
    mediaAngles: listMediaResearchAngles(),
    plannedContentAssets: listPlannedContentAssets(),
    paidSearchTelemetryAvailable: false,
    remarketingAudienceEvidenceAvailable: false,
    cpcEvidenceAvailable: false,
    verifiedExternalTargetsAvailable: false,
    gbpAvailable: Boolean(input?.gbpAvailable),
    bufferAvailable: Boolean(input?.bufferAvailable),
    hubspotAggregatesAvailable: Boolean(input?.hubspotAggregatesAvailable),
  };
}
