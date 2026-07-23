/**
 * Repository-backed journey surface inventory.
 * Describes intended/available journey structure — not observed user behavior.
 */

import type { JourneySurface } from "./types";

/** Minimal stable inventory of Hourglass journey surfaces. */
export const JOURNEY_SURFACE_DEFINITIONS: Omit<
  JourneySurface,
  "observability" | "measurementSource" | "confidence"
>[] = [
  {
    id: "surface-homepage",
    route: "/",
    label: "Homepage",
    stage: "discovery",
    surfaceType: "homepage",
    role: "discovery",
    intendedNextSteps: ["/engagement-rings", "/our-approach", "/concierge"],
    linkedTools: [],
    linkedTrustSurfaces: ["/our-approach", "/whispered-praise"],
    conversionDestinations: ["/concierge"],
    repositoryEvidence:
      "app/page.tsx — brand hero with Concierge CTA and commercial/trust links",
  },
  {
    id: "surface-engagement-rings",
    route: "/engagement-rings",
    label: "Engagement Rings",
    stage: "consideration",
    surfaceType: "commercial",
    role: "commercial",
    intendedNextSteps: ["/diamond-studio", "/concierge"],
    linkedTools: ["/diamond-studio"],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence:
      "engagement-rings page + closing CTA → Concierge; Studio section links",
  },
  {
    id: "surface-custom-design",
    route: "/custom-design",
    label: "Custom Design",
    stage: "consideration",
    surfaceType: "commercial",
    role: "commercial",
    intendedNextSteps: ["/concierge"],
    linkedTools: [],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence: "custom-design closing CTA → Concierge",
  },
  {
    id: "surface-diamond-guide",
    route: "/diamond-guide",
    label: "Diamond Guide",
    stage: "education",
    surfaceType: "guide",
    role: "guide",
    intendedNextSteps: [
      "/diamond-studio",
      "/diamond-shape-studio",
      "/diamond-intelligence",
      "/concierge",
    ],
    linkedTools: [
      "/diamond-studio",
      "/diamond-shape-studio",
      "/diamond-intelligence",
    ],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence:
      "Diamond Guide hub + article CTAs to Studio suite and Concierge",
  },
  {
    id: "surface-charlotte-advisor-guide",
    route: "/diamond-guide/charlotte-diamond-advisor-guide",
    label: "Charlotte Diamond Advisor Guide",
    stage: "education",
    surfaceType: "local-guide",
    role: "guide",
    intendedNextSteps: ["/concierge", "/our-approach", "/the-house"],
    linkedTools: ["/diamond-studio"],
    linkedTrustSurfaces: ["/our-approach", "/the-house"],
    conversionDestinations: ["/concierge"],
    repositoryEvidence: "Charlotte Guides article with local advisor + Concierge links",
  },
  {
    id: "surface-charlotte-engagement-guide",
    route: "/diamond-guide/charlotte-engagement-ring-guide",
    label: "Charlotte Engagement Ring Guide",
    stage: "education",
    surfaceType: "local-guide",
    role: "guide",
    intendedNextSteps: ["/concierge", "/engagement-rings", "/diamond-studio"],
    linkedTools: ["/diamond-studio"],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence: "Charlotte engagement guide → rings / Studio / Concierge",
  },
  {
    id: "surface-diamond-studio",
    route: "/diamond-studio",
    label: "Diamond Studio (Size Studio)",
    stage: "visualization",
    surfaceType: "tool",
    role: "tool",
    intendedNextSteps: [
      "/diamond-shape-studio",
      "/diamond-intelligence",
      "/concierge",
    ],
    linkedTools: ["/diamond-shape-studio", "/diamond-intelligence"],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence:
      "Size Studio tool + suite nav + consultation_cta_clicked → Concierge",
  },
  {
    id: "surface-see-it-on-your-hand",
    route: "/diamond-shape-studio",
    label: "See It On Your Hand",
    stage: "visualization",
    surfaceType: "tool",
    role: "tool",
    intendedNextSteps: ["/concierge", "/diamond-studio"],
    linkedTools: ["/diamond-studio"],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence:
      "diamond-shape-studio route; mid-funnel events unsupported in measurement inventory",
  },
  {
    id: "surface-analyze-sparkle",
    route: "/diamond-intelligence",
    label: "Analyze Sparkle",
    stage: "visualization",
    surfaceType: "tool",
    role: "tool",
    intendedNextSteps: ["/concierge", "/diamond-guide", "/diamond-studio"],
    linkedTools: ["/diamond-studio"],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence:
      "diamond-intelligence route; mid-funnel events unsupported in measurement inventory",
  },
  {
    id: "surface-whispered-praise",
    route: "/whispered-praise",
    label: "Whispered Praise",
    stage: "trust",
    surfaceType: "trust",
    role: "trust",
    intendedNextSteps: ["/diamond-studio", "/concierge"],
    linkedTools: ["/diamond-studio"],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence: "Whispered Praise trust surface CTA → Diamond Studio",
  },
  {
    id: "surface-our-approach",
    route: "/our-approach",
    label: "Our Approach",
    stage: "trust",
    surfaceType: "brand",
    role: "trust",
    intendedNextSteps: [
      "/diamond-guide/charlotte-diamond-advisor-guide",
      "/concierge",
    ],
    linkedTools: [],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence: "Brand philosophy / trust with Charlotte advisor mention",
  },
  {
    id: "surface-the-house",
    route: "/the-house",
    label: "The House",
    stage: "trust",
    surfaceType: "brand",
    role: "trust",
    intendedNextSteps: ["/concierge", "/our-approach"],
    linkedTools: [],
    linkedTrustSurfaces: ["/our-approach"],
    conversionDestinations: ["/concierge"],
    repositoryEvidence: "Brand / founder house nav destination",
  },
  {
    id: "surface-conversations",
    route: "/conversations",
    label: "Conversations",
    stage: "education",
    surfaceType: "editorial",
    role: "editorial",
    intendedNextSteps: ["/diamond-guide", "/concierge"],
    linkedTools: ["/diamond-studio"],
    linkedTrustSurfaces: [],
    conversionDestinations: ["/concierge"],
    repositoryEvidence:
      "Founder editorial/video conversations — education/brand narrative only; not an inquiry form or conversion event. Related-resource and Concierge links are destinations, not submit/appointment proof.",
  },
  {
    id: "surface-concierge",
    route: "/concierge",
    label: "Concierge",
    stage: "conversation-intent",
    surfaceType: "inquiry",
    role: "inquiry-conversion",
    intendedNextSteps: [],
    linkedTools: [],
    linkedTrustSurfaces: ["/whispered-praise"],
    conversionDestinations: ["/concierge"],
    repositoryEvidence:
      "Primary inquiry/contact form surface (Start Your Project / HubSpot soft-accept). Visiting Concierge is conversation-intent / inquiry destination — not a completed conversion, submit, or verified appointment booking event.",
  },
];

export function buildJourneySurfaceInventory(): JourneySurface[] {
  return JOURNEY_SURFACE_DEFINITIONS.map((def) => ({
    ...def,
    observability:
      def.surfaceType === "tool" || def.surfaceType === "inquiry"
        ? ("partial" as const)
        : ("unobservable" as const),
    measurementSource: "repository" as const,
    confidence: 0.9,
  }));
}

export function findSurfaceByRoute(
  surfaces: JourneySurface[],
  route: string,
): JourneySurface | undefined {
  const normalized = normalizeRoute(route);
  return (
    surfaces.find((s) => s.route === normalized) ??
    surfaces.find(
      (s) =>
        normalized.startsWith(s.route) &&
        s.route !== "/" &&
        (s.surfaceType === "guide" || s.surfaceType === "local-guide"),
    )
  );
}

export function normalizeRoute(raw: string): string {
  try {
    if (raw.startsWith("http")) {
      const u = new URL(raw);
      raw = u.pathname;
    }
  } catch {
    // keep raw
  }
  const path = raw.split("?")[0]?.split("#")[0] ?? raw;
  if (!path || path === "") return "/";
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

/** Repository-available links between inventoried surfaces (not observed behavior). */
export function buildRepositoryTransitions(
  surfaces: JourneySurface[],
): Array<{ fromRoute: string; toRoute: string; note: string }> {
  const out: Array<{ fromRoute: string; toRoute: string; note: string }> = [];
  for (const s of surfaces) {
    const destinations = [
      ...s.intendedNextSteps,
      ...s.linkedTools,
      ...s.linkedTrustSurfaces,
      ...s.conversionDestinations,
    ];
    for (const dest of new Set(destinations)) {
      if (dest === s.route) continue;
      out.push({
        fromRoute: s.route,
        toRoute: dest,
        note: `Repository link/CTA from ${s.label} → ${dest}`,
      });
    }
  }
  return out;
}

/** Stable Content handoff root keys — persist across routes. */
export const CONTENT_HANDOFF_GUIDE_TO_TOOL_KEY =
  "content-handoff:guide-to-tool" as const;
export const CONTENT_HANDOFF_TRUST_NARRATIVE_KEY =
  "content-handoff:trust-narrative" as const;
