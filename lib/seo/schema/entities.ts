import type { JsonLdValue } from "./json-ld";
import { CERTIFICATE_READER_FAQS } from "@/lib/seo/certificate-reader-educational";
import { CLARITY_FAQS } from "@/lib/seo/clarity-educational";
import { COLOR_FAQS } from "@/lib/seo/color-educational";
import { CUT_FAQS } from "@/lib/seo/cut-educational";
import { FLUORESCENCE_FAQS } from "@/lib/seo/fluorescence-educational";
import { LAB_NATURAL_FAQS } from "@/lib/seo/lab-natural-educational";
import { CHARLOTTE_ADVISOR_FAQS } from "@/lib/seo/charlotte-advisor-educational";
import { DIAMOND_INTELLIGENCE_FAQS } from "@/lib/seo/diamond-intelligence-educational";
import { DIAMOND_STUDIO_FAQS } from "@/lib/seo/diamond-studio-educational";
import { ENGAGEMENT_RINGS_FAQS } from "@/lib/seo/engagement-rings-educational";
import {
  absoluteUrl,
  CHARLOTTE_METRO_AREA_SERVED,
  DIAMOND_INTELLIGENCE_APP_ID,
  DIAMOND_INTELLIGENCE_DESCRIPTION,
  DIAMOND_INTELLIGENCE_NAME,
  DIAMOND_SHAPE_STUDIO_APP_ID,
  DIAMOND_SHAPE_STUDIO_DESCRIPTION,
  DIAMOND_SHAPE_STUDIO_NAME,
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
    creator: { "@id": PERSON_ID },
  };
}

export function diamondStudioWebPageNode(): JsonLdValue {
  return {
    "@type": "WebPage",
    "@id": `${absoluteUrl("/diamond-studio")}#webpage`,
    url: absoluteUrl("/diamond-studio"),
    name: `${DIAMOND_STUDIO_NAME} | See Diamond Size on Your Hand | ${ORGANIZATION_NAME}`,
    description: DIAMOND_STUDIO_DESCRIPTION,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": DIAMOND_STUDIO_APP_ID },
    mainEntity: { "@id": DIAMOND_STUDIO_APP_ID },
    author: { "@id": PERSON_ID },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function diamondStudioFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-studio")}#faq`,
    mainEntity: DIAMOND_STUDIO_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildDiamondStudioApplicationJsonLd(): JsonLdValue {
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [diamondStudioApplicationNode()],
  };
}

export function diamondIntelligenceApplicationNode(): JsonLdValue {
  return {
    "@type": "SoftwareApplication",
    "@id": DIAMOND_INTELLIGENCE_APP_ID,
    name: DIAMOND_INTELLIGENCE_NAME,
    description: DIAMOND_INTELLIGENCE_DESCRIPTION,
    url: absoluteUrl("/diamond-intelligence"),
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    provider: { "@id": ORGANIZATION_ID },
  };
}

export function diamondIntelligenceFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-intelligence")}#faq`,
    mainEntity: DIAMOND_INTELLIGENCE_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildDiamondIntelligenceApplicationJsonLd(): JsonLdValue {
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [diamondIntelligenceApplicationNode()],
  };
}

export function diamondShapeStudioApplicationNode(): JsonLdValue {
  return {
    "@type": "SoftwareApplication",
    "@id": DIAMOND_SHAPE_STUDIO_APP_ID,
    name: DIAMOND_SHAPE_STUDIO_NAME,
    description: DIAMOND_SHAPE_STUDIO_DESCRIPTION,
    url: absoluteUrl("/diamond-shape-studio"),
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    provider: { "@id": ORGANIZATION_ID },
  };
}

export function buildDiamondShapeStudioApplicationJsonLd(): JsonLdValue {
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [diamondShapeStudioApplicationNode()],
  };
}

export function engagementRingsFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/engagement-rings")}#faq`,
    mainEntity: ENGAGEMENT_RINGS_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function charlotteAdvisorFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-guide/charlotte-diamond-advisor-guide")}#faq`,
    mainEntity: CHARLOTTE_ADVISOR_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function certificateReaderFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-guide/how-to-read-a-diamond-certificate")}#faq`,
    mainEntity: CERTIFICATE_READER_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function labNaturalFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-guide/natural-vs-lab-diamonds")}#faq`,
    mainEntity: LAB_NATURAL_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function fluorescenceFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-guide/what-is-diamond-fluorescence")}#faq`,
    mainEntity: FLUORESCENCE_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function clarityFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-guide/what-is-diamond-clarity")}#faq`,
    mainEntity: CLARITY_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function colorFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-guide/what-is-diamond-color")}#faq`,
    mainEntity: COLOR_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function cutFaqNode(): JsonLdValue {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/diamond-guide/what-is-diamond-cut")}#faq`,
    mainEntity: CUT_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
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
