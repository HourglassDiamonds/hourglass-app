import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diamondIntelligenceApplicationNode,
  diamondIntelligenceFaqNode,
  diamondIntelligenceWebPageNode,
} from "./entities";
import { diamondIntelligenceBreadcrumb } from "./breadcrumbs";
import { jsonLdGraph, serializeJsonLd } from "./json-ld";
import {
  DIAMOND_INTELLIGENCE_APP_ID,
  ORGANIZATION_ID,
  PERSON_ID,
  WEBSITE_ID,
} from "./constants";

describe("Analyze Sparkle structured data", () => {
  it("connects the WebPage, application, founder, organization, and website", () => {
    const pageValue = diamondIntelligenceWebPageNode();
    const applicationValue = diamondIntelligenceApplicationNode();
    const page = pageValue as Record<string, unknown>;
    const application = applicationValue as Record<
      string,
      unknown
    >;
    const payload = jsonLdGraph([
      pageValue,
      applicationValue,
      diamondIntelligenceFaqNode(),
      diamondIntelligenceBreadcrumb(),
    ]);
    const serialized = serializeJsonLd(payload);

    assert.equal(page["@type"], "WebPage");
    assert.deepEqual(page.isPartOf, { "@id": WEBSITE_ID });
    assert.deepEqual(page.mainEntity, { "@id": DIAMOND_INTELLIGENCE_APP_ID });
    assert.deepEqual(page.author, { "@id": PERSON_ID });
    assert.deepEqual(page.publisher, { "@id": ORGANIZATION_ID });
    assert.equal(application.applicationCategory, "EducationalApplication");
    assert.deepEqual(application.creator, { "@id": PERSON_ID });
    assert.deepEqual(application.provider, { "@id": ORGANIZATION_ID });
    assert.match(serialized, /Analyze Sparkle/);
    assert.match(serialized, /diamond-intelligence/);
  });
});
