import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRelationshipContextLayer } from "../contracts";
import { RELATIONSHIP_CONTEXT_LAYERS } from "../types";
import { suggestRelationshipContextLayer } from "./context";

describe("Relationship context layer allowlist", () => {
  it("accepts only client, networking, and personal", () => {
    assert.deepEqual([...RELATIONSHIP_CONTEXT_LAYERS], [
      "client",
      "networking",
      "personal",
    ]);
    assert.equal(isRelationshipContextLayer("client"), true);
    assert.equal(isRelationshipContextLayer("networking"), true);
    assert.equal(isRelationshipContextLayer("personal"), true);
    for (const invalid of ["business", "friend", "private", "", "Client"]) {
      assert.equal(isRelationshipContextLayer(invalid), false, invalid);
    }
  });
});

describe("Add Note default context from Person roles", () => {
  it("suggests client for client or prospect roles", () => {
    assert.equal(suggestRelationshipContextLayer(["client"]), "client");
    assert.equal(suggestRelationshipContextLayer(["prospect"]), "client");
  });

  it("suggests networking for business-contact or vendor-contact", () => {
    assert.equal(
      suggestRelationshipContextLayer(["business-contact"]),
      "networking",
    );
    assert.equal(
      suggestRelationshipContextLayer(["vendor-contact"]),
      "networking",
    );
  });

  it("suggests personal for personal, family, or friend", () => {
    assert.equal(suggestRelationshipContextLayer(["friend"]), "personal");
    assert.equal(suggestRelationshipContextLayer(["family"]), "personal");
    assert.equal(suggestRelationshipContextLayer(["personal"]), "personal");
  });

  it("uses documented mixed-role priority: client, then networking, then personal", () => {
    assert.equal(
      suggestRelationshipContextLayer(["friend", "client"]),
      "client",
    );
    assert.equal(
      suggestRelationshipContextLayer(["prospect", "business-contact"]),
      "client",
    );
    assert.equal(
      suggestRelationshipContextLayer(["friend", "business-contact"]),
      "networking",
    );
    assert.equal(suggestRelationshipContextLayer([]), null);
  });
});
