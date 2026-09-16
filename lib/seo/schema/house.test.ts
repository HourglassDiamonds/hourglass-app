import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { globalEntityGraph } from "./entities";
import {
  buildHousePageJsonLd,
  HOUSE_CLOSER_LOOK_VIDEO_ID,
  HOUSE_PAGE_ID,
  houseAboutPageNode,
  houseCloserLookVideoObject,
} from "./house";
import { serializeJsonLd } from "./json-ld";
import { HOUSE_CLOSER_LOOK_VIDEO_SRC } from "@/lib/the-house/media";
import {
  ORGANIZATION_ID,
  PERSON_ID,
  PERSON_JOB_TITLE,
} from "./constants";

function graphNodes(data: unknown): Record<string, unknown>[] {
  if (
    typeof data === "object" &&
    data !== null &&
    "@graph" in data &&
    Array.isArray((data as { "@graph": unknown[] })["@graph"])
  ) {
    return (data as { "@graph": Record<string, unknown>[] })["@graph"];
  }
  return typeof data === "object" && data !== null
    ? [data as Record<string, unknown>]
    : [];
}

describe("House page structured data", () => {
  it("emits AboutPage for The House about Hourglass and Justin", () => {
    const node = houseAboutPageNode() as Record<string, unknown>;
    assert.equal(node["@type"], "AboutPage");
    assert.equal(node["@id"], HOUSE_PAGE_ID);
    assert.equal(node.url, "https://www.hourglassdiamonds.com/the-house");
    assert.deepEqual(node.about, [
      { "@id": ORGANIZATION_ID },
      { "@id": PERSON_ID },
    ]);
    assert.deepEqual(node.mainEntity, { "@id": ORGANIZATION_ID });
  });

  it("emits VideoObject for the first-party House film with captions", () => {
    const node = houseCloserLookVideoObject() as Record<string, unknown>;
    const serialized = serializeJsonLd(node);

    assert.equal(node["@type"], "VideoObject");
    assert.equal(node["@id"], HOUSE_CLOSER_LOOK_VIDEO_ID);
    assert.equal(node.contentUrl, HOUSE_CLOSER_LOOK_VIDEO_SRC);
    assert.equal(node.name, "A Closer Look");
    assert.ok(!("uploadDate" in node));
    assert.ok(!("thumbnailUrl" in node));
    assert.match(serialized, /a-closer-look\.en\.vtt/);
    assert.match(serialized, /text\/vtt/);
  });

  it("does not invent sameAs profiles or a Donald Haack parent organization", () => {
    const payload = buildHousePageJsonLd();
    const serialized = serializeJsonLd(payload);
    const types = graphNodes(payload).map((node) => node["@type"]);

    assert.ok(types.includes("AboutPage"));
    assert.ok(types.includes("VideoObject"));
    assert.equal(serialized.includes("sameAs"), false);
    assert.equal(/Donald Haack/i.test(serialized), false);
    assert.equal(serialized.includes("parentOrganization"), false);
  });
});

describe("House heritage copy", () => {
  const heritageCopy = readFileSync(
    join(process.cwd(), "lib/the-house/heritage-copy.ts"),
    "utf8",
  );
  const housePage = readFileSync(
    join(process.cwd(), "app/the-house/the-house-page-client.tsx"),
    "utf8",
  );

  it("surfaces Charlotte heritage without implying corporate succession", () => {
    assert.match(housePage, /HOUSE_INTRO_PARAGRAPHS/);
    assert.match(heritageCopy, /Charlotte's personal jeweler/);
    assert.match(heritageCopy, /We don't sell inventory/);
    assert.match(heritageCopy, /We sell discernment/);
    assert.match(heritageCopy, /Donald Haack/);
    assert.match(heritageCopy, /British Guiana/);
    assert.match(heritageCopy, /Rupununi/);
    assert.match(heritageCopy, /approximately thirteen years/);
    assert.match(heritageCopy, /Lead Graduate Gemologist/);
    assert.match(heritageCopy, /Global Head of Sales/);
    assert.match(heritageCopy, /The tradition is inherited/);
    assert.match(heritageCopy, /The business model is not/);
    assert.doesNotMatch(heritageCopy, /acquired Donald Haack/i);
    assert.doesNotMatch(heritageCopy, /renamed/i);
    assert.doesNotMatch(heritageCopy, /inherited the business/i);
    assert.doesNotMatch(heritageCopy, /parent company/i);
    assert.doesNotMatch(heritageCopy, /successor to Donald/i);
  });
});

describe("global founder entity", () => {
  it("keeps Justin as founder and Graduate Gemologist of Hourglass only", () => {
    const graph = globalEntityGraph();
    const person = graph.find((node) => {
      return (node as { "@id"?: string })["@id"] === PERSON_ID;
    }) as Record<string, unknown> | undefined;
    const organization = graph.find((node) => {
      return (node as { "@id"?: string })["@id"] === ORGANIZATION_ID;
    }) as Record<string, unknown> | undefined;

    assert.ok(person);
    assert.ok(organization);
    assert.equal(person.jobTitle, PERSON_JOB_TITLE);
    assert.match(String(person.description), /Graduate Gemologist/);
    assert.match(String(person.description), /Founder of Hourglass Diamonds/);
    assert.deepEqual(organization.founder, { "@id": PERSON_ID });
    assert.equal(JSON.stringify(graph).includes("Donald Haack"), false);
  });
});
