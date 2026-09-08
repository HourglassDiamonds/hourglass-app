import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { warnPossibleExistingProject } from "./duplicate";

describe("possible existing Project warning", () => {
  it("does not auto-block a one-token overlap", () => {
    const warning = warnPossibleExistingProject({
      title: "Dagger & Pearls Pendant / Necklace",
      existing: [
        {
          projectId: "old-ring",
          title: "Dagger wedding ring",
          projectKind: "custom_new_jewelry",
        },
      ],
    });
    assert.equal(warning, null);
  });

  it("warns when two distinctive tokens overlap on a different title", () => {
    const warning = warnPossibleExistingProject({
      title: "Dagger & Pearls Pendant / Necklace",
      existing: [
        {
          projectId: "old-necklace",
          title: "Dagger pearls necklace",
          projectKind: "custom_new_jewelry",
        },
      ],
    });
    assert.equal(warning?.kind, "possible-existing");
    assert.match(warning?.message ?? "", /Possible existing project/);
    assert.equal(warning?.title, "Dagger pearls necklace");
  });

  it("does not treat an exact title as a fuzzy warning", () => {
    const warning = warnPossibleExistingProject({
      title: "Matching Marquise Earrings",
      existing: [
        {
          projectId: "same",
          title: "Matching Marquise Earrings",
          projectKind: "custom_new_jewelry",
        },
      ],
    });
    assert.equal(warning, null);
  });
});
