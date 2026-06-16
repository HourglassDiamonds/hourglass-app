import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS,
  CLIENT_GIA_DIAGRAM_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS,
  CLIENT_INTERPRET_FETCH_TIMEOUT_MS,
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";

describe("CLIENT_INTERPRET_FETCH_TIMEOUT_MS", () => {
  it("exceeds both interpret route budgets", () => {
    assert.ok(
      CLIENT_INTERPRET_FETCH_TIMEOUT_MS > CLIENT_GIA_DIAGRAM_INTERPRET_ROUTE_TIMEOUT_MS,
    );
    assert.ok(
      CLIENT_INTERPRET_FETCH_TIMEOUT_MS > CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
    );
  });

  it("does not exceed Vercel interpret maxDuration (120s)", () => {
    assert.ok(CLIENT_INTERPRET_FETCH_TIMEOUT_MS <= 120_000);
  });
});

describe("CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS", () => {
  it("fits within GIA diagram pipeline and route budgets", () => {
    assert.ok(CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS >= 30_000);
    assert.ok(
      CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS <
        CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS,
    );
    assert.ok(
      CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS <
        CLIENT_GIA_DIAGRAM_INTERPRET_ROUTE_TIMEOUT_MS,
    );
  });
});
