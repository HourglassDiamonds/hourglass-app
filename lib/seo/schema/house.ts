import {
  HOUSE_CLOSER_LOOK_CAPTION_SRC,
  HOUSE_CLOSER_LOOK_DURATION_ISO,
  HOUSE_CLOSER_LOOK_NAME,
  HOUSE_CLOSER_LOOK_VIDEO_SRC,
} from "@/lib/the-house/media";
import {
  absoluteUrl,
  ORGANIZATION_ID,
  PERSON_ID,
  WEBSITE_ID,
} from "./constants";
import {
  organizationPublisherReference,
  personAuthorReference,
} from "./entities";
import type { JsonLdValue } from "./json-ld";
import { jsonLdGraph } from "./json-ld";

export const HOUSE_PATH = "/the-house";
export const HOUSE_PAGE_ID = `${absoluteUrl(HOUSE_PATH)}#webpage`;
export const HOUSE_CLOSER_LOOK_VIDEO_ID = `${absoluteUrl(HOUSE_PATH)}#closer-look`;

export const HOUSE_PAGE_DESCRIPTION =
  "Charlotte's personal jeweler for refined engagement design. Founder-led guidance from Graduate Gemologist Justin Smith, and a calmer alternative to traditional retail.";

export function houseAboutPageNode(): JsonLdValue {
  return {
    "@type": "AboutPage",
    "@id": HOUSE_PAGE_ID,
    name: "The House",
    description: HOUSE_PAGE_DESCRIPTION,
    url: absoluteUrl(HOUSE_PATH),
    isPartOf: { "@id": WEBSITE_ID },
    about: [{ "@id": ORGANIZATION_ID }, { "@id": PERSON_ID }],
    mainEntity: { "@id": ORGANIZATION_ID },
    publisher: organizationPublisherReference(),
    author: personAuthorReference(),
  };
}

export function houseCloserLookVideoObject(): JsonLdValue {
  return {
    "@type": "VideoObject",
    "@id": HOUSE_CLOSER_LOOK_VIDEO_ID,
    name: HOUSE_CLOSER_LOOK_NAME,
    description:
      "A closer look at Hourglass Diamonds, from Charlotte jewelry heritage to the present house of engagement design.",
    contentUrl: HOUSE_CLOSER_LOOK_VIDEO_SRC,
    encodingFormat: "video/mp4",
    inLanguage: "en",
    duration: HOUSE_CLOSER_LOOK_DURATION_ISO,
    caption: {
      "@type": "MediaObject",
      contentUrl: absoluteUrl(HOUSE_CLOSER_LOOK_CAPTION_SRC),
      encodingFormat: "text/vtt",
      inLanguage: "en",
    },
    url: absoluteUrl(HOUSE_PATH),
    mainEntityOfPage: { "@id": HOUSE_PAGE_ID },
    publisher: organizationPublisherReference(),
    creator: personAuthorReference(),
    isPartOf: { "@id": HOUSE_PAGE_ID },
  };
}

export function buildHousePageJsonLd(): JsonLdValue {
  return jsonLdGraph([
    houseAboutPageNode(),
    houseCloserLookVideoObject(),
  ]);
}
