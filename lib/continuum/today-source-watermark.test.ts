import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectEvidenceAssociationWatermarkToken } from "./today-source-watermark";

describe("Today Project-evidence association watermark", () => {
  it("changes on trusted association creation or update", () => {
    const before = projectEvidenceAssociationWatermarkToken("0", "");
    const created = projectEvidenceAssociationWatermarkToken("1", "2026-11-06T15:50:25.560Z");
    const reviewed = projectEvidenceAssociationWatermarkToken("1", "2026-11-06T15:50:31.888Z");
    assert.notEqual(created, before);
    assert.notEqual(reviewed, created);
  });
});
