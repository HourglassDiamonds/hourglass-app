/**
 * Bounded repository local-entity inventory.
 * Static imports / deterministic constants only — no filesystem walks.
 *
 * Proves repository intent/readiness only — never GBP acceptance or map-pack.
 */

import { articles } from "@/app/diamond-guide/articles";
import { SITE_URL } from "@/lib/seo/site-metadata";
import {
  CHARLOTTE_METRO_AREA_SERVED,
  ORGANIZATION_DESCRIPTION,
  ORGANIZATION_NAME,
  PERSON_JOB_TITLE,
  PERSON_NAME,
} from "@/lib/seo/schema/constants";
import { articleCategorySegment } from "@/lib/seo/schema/category-map";
import type { LocalEntityField, LocalEntityInventory } from "./types";

const CHARLOTTE_GUIDE_SLUGS = articles
  .filter((a) => a.category === "Charlotte Guides")
  .map((a) => `/diamond-guide/${a.slug}`);

const LOCAL_LANDING_ROUTES = [
  "/engagement-rings",
  "/custom-design",
  "/concierge",
  "/whispered-praise",
  "/diamond-guide/charlotte-diamond-advisor-guide",
] as const;

export function inspectLocalEntityInventory(): LocalEntityInventory {
  const serviceAreaNames = CHARLOTTE_METRO_AREA_SERVED.map((a) => a.name);
  const charlotteHubMapped =
    articleCategorySegment("Charlotte Guides") !== null;

  const fields: LocalEntityField[] = [
    field({
      key: "business-name",
      present: true,
      normalizedValue: ORGANIZATION_NAME,
      sourceRouteOrFile: "lib/seo/schema/constants.ts#ORGANIZATION_NAME",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: true,
    }),
    field({
      key: "founder-name",
      present: true,
      normalizedValue: PERSON_NAME,
      sourceRouteOrFile: "lib/seo/schema/constants.ts#PERSON_NAME",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "founder-credentials",
      present: true,
      normalizedValue: PERSON_JOB_TITLE,
      sourceRouteOrFile: "lib/seo/schema/constants.ts#PERSON_JOB_TITLE",
      consistencyStatus: "consistent",
      confidence: 0.92,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "primary-location",
      present: true,
      normalizedValue:
        "15720 Brixham Hill Ave, Suite 300, Charlotte, NC 28277",
      sourceRouteOrFile: "lib/seo/schema/constants.ts#BUSINESS_*",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: true,
    }),
    field({
      key: "service-areas",
      present: serviceAreaNames.length > 0,
      normalizedValue: [...serviceAreaNames, "United States"].join(", "),
      sourceRouteOrFile: "lib/seo/schema/constants.ts#CHARLOTTE_METRO_AREA_SERVED",
      consistencyStatus: "complementary",
      confidence: 0.9,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: true,
    }),
    field({
      key: "phone",
      present: true,
      normalizedValue: "980-259-9485",
      sourceRouteOrFile: "lib/seo/schema/constants.ts#BUSINESS_TELEPHONE_DISPLAY",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: true,
    }),
    field({
      key: "email",
      present: false,
      normalizedValue: null,
      sourceRouteOrFile: "lib/seo/schema/entities.ts",
      consistencyStatus: "missing",
      confidence: 0.8,
      sensitivity: "sensitive",
      public: false,
      externalVerificationRequired: true,
    }),
    field({
      key: "address",
      present: true,
      normalizedValue: "15720 Brixham Hill Ave, Suite 300",
      sourceRouteOrFile: "lib/seo/schema/constants.ts#businessStreetAddressLine",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: true,
    }),
    field({
      key: "locality",
      present: true,
      normalizedValue: "Charlotte",
      sourceRouteOrFile: "lib/seo/schema/entities.ts#addressLocality",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: true,
    }),
    field({
      key: "region",
      present: true,
      normalizedValue: "NC",
      sourceRouteOrFile: "lib/seo/schema/entities.ts#addressRegion",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: true,
    }),
    field({
      key: "postal-code",
      present: true,
      normalizedValue: "28277",
      sourceRouteOrFile: "lib/seo/schema/constants.ts#BUSINESS_POSTAL_CODE",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: true,
    }),
    field({
      key: "country",
      present: true,
      normalizedValue: "US",
      sourceRouteOrFile: "lib/seo/schema/entities.ts#addressCountry",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "website-url",
      present: true,
      normalizedValue: SITE_URL,
      sourceRouteOrFile: "lib/seo/site-metadata.ts#SITE_URL",
      consistencyStatus: "consistent",
      confidence: 0.98,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "primary-service-description",
      present: true,
      normalizedValue: ORGANIZATION_DESCRIPTION,
      sourceRouteOrFile: "lib/seo/schema/constants.ts#ORGANIZATION_DESCRIPTION",
      consistencyStatus: "complementary",
      confidence: 0.9,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "local-business-schema",
      present: true,
      normalizedValue: "LocalBusiness,JewelryStore",
      sourceRouteOrFile: "lib/seo/schema/entities.ts#jewelryStoreNode",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "organization-schema",
      present: true,
      normalizedValue: "Organization",
      sourceRouteOrFile: "lib/seo/schema/entities.ts#organizationNode",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "social-profile-links",
      present: false,
      normalizedValue: null,
      sourceRouteOrFile: "lib/seo/schema/entities.ts",
      consistencyStatus: "missing",
      confidence: 0.7,
      sensitivity: "public",
      public: false,
      externalVerificationRequired: true,
    }),
    field({
      key: "contact-concierge-route",
      present: true,
      normalizedValue: "/concierge",
      sourceRouteOrFile: "lib/seo/schema/entities.ts#contactPoint",
      consistencyStatus: "consistent",
      confidence: 0.95,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "review-testimonial-route",
      present: true,
      normalizedValue: "/whispered-praise",
      sourceRouteOrFile: "app/whispered-praise/page.tsx",
      consistencyStatus: "consistent",
      confidence: 0.9,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "charlotte-guide-routes",
      present: CHARLOTTE_GUIDE_SLUGS.length > 0,
      normalizedValue: CHARLOTTE_GUIDE_SLUGS.join(", "),
      sourceRouteOrFile: "app/diamond-guide/articles.ts#Charlotte Guides",
      consistencyStatus: charlotteHubMapped ? "consistent" : "ambiguous",
      confidence: 0.92,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "local-metadata-titles",
      present: true,
      normalizedValue:
        "engagement-rings + custom-design Charlotte NC titles; homepage nationwide framing",
      sourceRouteOrFile: "app/engagement-rings/page.tsx; app/page.tsx",
      consistencyStatus: "complementary",
      confidence: 0.8,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
    field({
      key: "local-internal-links",
      present: true,
      normalizedValue: LOCAL_LANDING_ROUTES.join(", "),
      sourceRouteOrFile: "app/diamond-guide/articles.ts related[] + Concierge",
      consistencyStatus: "consistent",
      confidence: 0.85,
      sensitivity: "public",
      public: true,
      externalVerificationRequired: false,
    }),
  ];

  return {
    fields,
    charlotteGuideRoutes: CHARLOTTE_GUIDE_SLUGS,
    serviceAreaSignals: [
      ...serviceAreaNames,
      "Charlotte-based",
      "nationwide",
      "United States",
    ],
    schemaTypesPresent: [
      "Organization",
      "LocalBusiness",
      "JewelryStore",
      "PostalAddress",
      "Person",
    ],
    hasAggregateRatingSchema: false,
    hasReviewSchema: false,
    hasStreetAddress: true,
    hasPostalCode: true,
    hasTelephoneInSchema: true,
  };
}

function field(
  input: LocalEntityField,
): LocalEntityField {
  return input;
}
