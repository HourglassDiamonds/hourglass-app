import type { JsonLdValue } from "./json-ld";
import {
  absoluteUrl,
  CHARLOTTE_METRO_AREA_SERVED,
  DIAMOND_STUDIO_APP_ID,
  DIAMOND_STUDIO_DESCRIPTION,
  DIAMOND_STUDIO_NAME,
  JEWELRY_STORE_ID,
  LOGO_PATH,
  ORGANIZATION_DESCRIPTION,
  ORGANIZATION_ID,
  ORGANIZATION_NAME,
  PERSON_ID,
  PERSON_JOB_TITLE,
  PERSON_NAME,
  SCHEMA_CONTEXT,
  WEBSITE_ID,
} from "./constants";

function organizationNode(): JsonLdValue {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: ORGANIZATION_NAME,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(LOGO_PATH),
    },
    description: ORGANIZATION_DESCRIPTION,
    founder: { "@id": PERSON_ID },
  };
}

function personNode(): JsonLdValue {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: PERSON_NAME,
    jobTitle: PERSON_JOB_TITLE,
    description:
      "Founder of Hourglass Diamonds and author of the Diamond Guide educational library.",
    worksFor: { "@id": ORGANIZATION_ID },
  };
}

function websiteNode(): JsonLdValue {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: ORGANIZATION_NAME,
    url: absoluteUrl("/"),
    publisher: { "@id": ORGANIZATION_ID },
  };
}

function cityAreaServed(name: string, region: string): JsonLdValue {
  return {
    "@type": "City",
    name,
    containedInPlace: {
      "@type": "State",
      name: region,
    },
  };
}

function jewelryStoreNode(): JsonLdValue {
  const charlotteMetroAreas = CHARLOTTE_METRO_AREA_SERVED.map((area) =>
    cityAreaServed(area.name, area.region),
  );

  return {
    "@type": ["LocalBusiness", "JewelryStore"],
    "@id": JEWELRY_STORE_ID,
    name: ORGANIZATION_NAME,
    url: absoluteUrl("/"),
    description: ORGANIZATION_DESCRIPTION,
    image: absoluteUrl(LOGO_PATH),
    parentOrganization: { "@id": ORGANIZATION_ID },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Charlotte",
      addressRegion: "NC",
      addressCountry: "US",
    },
    areaServed: [
      {
        "@type": "AdministrativeArea",
        name: "Charlotte Metro",
      },
      ...charlotteMetroAreas,
      {
        "@type": "Country",
        name: "United States",
      },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: absoluteUrl("/concierge"),
    },
  };
}

export function globalEntityGraph(): JsonLdValue[] {
  return [organizationNode(), personNode(), websiteNode(), jewelryStoreNode()];
}

export function buildGlobalSiteJsonLd(): JsonLdValue {
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": globalEntityGraph(),
  };
}

export function diamondStudioApplicationNode(): JsonLdValue {
  return {
    "@type": "SoftwareApplication",
    "@id": DIAMOND_STUDIO_APP_ID,
    name: DIAMOND_STUDIO_NAME,
    description: DIAMOND_STUDIO_DESCRIPTION,
    url: absoluteUrl("/diamond-studio"),
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    provider: { "@id": ORGANIZATION_ID },
  };
}

export function buildDiamondStudioApplicationJsonLd(): JsonLdValue {
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [diamondStudioApplicationNode()],
  };
}

/** Reserved for a future Diamond Intelligence launch — not emitted until routed. */
export function buildDiamondIntelligenceApplicationJsonLd(): JsonLdValue {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SoftwareApplication",
    "@id": `${absoluteUrl("/diamond-intelligence")}#software`,
    name: "Diamond Intelligence",
    description:
      "Proprietary diamond report interpretation and light-performance guidance from Hourglass Diamonds.",
    url: absoluteUrl("/diamond-intelligence"),
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    provider: { "@id": ORGANIZATION_ID },
  };
}

export function organizationPublisherReference(): JsonLdValue {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: ORGANIZATION_NAME,
  };
}

export function personAuthorReference(): JsonLdValue {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: PERSON_NAME,
  };
}
