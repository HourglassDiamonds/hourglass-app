import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGlobalSiteJsonLd, globalEntityGraph } from "./entities";
import { serializeJsonLd } from "./json-ld";

function isLocalBusiness(node: unknown): boolean {
  const type = (node as { "@type"?: string | string[] })["@type"];
  return Array.isArray(type)
    ? type.includes("LocalBusiness")
    : type === "LocalBusiness";
}

describe("LocalBusiness Charlotte NAP", () => {
  it("exposes approved office address, phone, and weekday hours", () => {
    const store = globalEntityGraph().find(isLocalBusiness) as
      | Record<string, unknown>
      | undefined;

    assert.ok(store);
    assert.equal(store.telephone, "+19802599485");
    assert.deepEqual(store.address, {
      "@type": "PostalAddress",
      streetAddress: "15720 Brixham Hill Ave, Suite 300",
      addressLocality: "Charlotte",
      addressRegion: "NC",
      postalCode: "28277",
      addressCountry: "US",
    });
    assert.deepEqual(store.openingHoursSpecification, {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "17:00",
    });

    const serialized = serializeJsonLd(buildGlobalSiteJsonLd());
    assert.equal(/streetAddress[^}]*Waxhaw/i.test(serialized), false);
    assert.equal(serialized.includes("28173"), false);
  });
});
