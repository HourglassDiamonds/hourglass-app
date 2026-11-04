import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONCIERGE_PREVIEW_ACCEPTANCE_FLAG,
  CONCIERGE_PREVIEW_INTEGRATION_FLAG,
  conciergePreviewAcceptanceEnabled,
} from "./preview-gate";

const isolated = {
  [CONCIERGE_PREVIEW_INTEGRATION_FLAG]: "true",
  [CONCIERGE_PREVIEW_ACCEPTANCE_FLAG]: "true",
  CONTINUUM_ENV: "preview",
  VERCEL_ENV: "preview",
  SUPABASE_URL: "https://hrmpzplffuhhvbtxxhnt.supabase.co",
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF: "hrmpzplffuhhvbtxxhnt",
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF: "bnafadfgrrriblppeubp",
};

describe("Concierge Preview acceptance gate", () => {
  it("requires both flags and the exact isolated Preview project", () => {
    assert.equal(conciergePreviewAcceptanceEnabled(isolated), true);
    assert.equal(conciergePreviewAcceptanceEnabled({ ...isolated, [CONCIERGE_PREVIEW_ACCEPTANCE_FLAG]: "false" }), false);
    assert.equal(conciergePreviewAcceptanceEnabled({ ...isolated, CONTINUUM_ENV: "production" }), false);
    assert.equal(conciergePreviewAcceptanceEnabled({ ...isolated, VERCEL_ENV: "production" }), false);
    assert.equal(conciergePreviewAcceptanceEnabled({ ...isolated, SUPABASE_URL: "https://bnafadfgrrriblppeubp.supabase.co" }), false);
  });
});
