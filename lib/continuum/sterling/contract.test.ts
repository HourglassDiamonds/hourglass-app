import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  STERLING_DIRECT_WRITE_CAPABILITIES,
  STERLING_TOOL_REGISTRY,
} from "./tools";

describe("Sterling capability boundary", () => {
  it("exposes no direct-write capability", () => {
    assert.deepEqual(STERLING_DIRECT_WRITE_CAPABILITIES, []);
    assert.ok(STERLING_TOOL_REGISTRY.length > 0);
    assert.ok(STERLING_TOOL_REGISTRY.every((tool) => tool.canonicalWrite === false));
  });

  it("keeps the orchestration layer free of canonical writers", () => {
    const source = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    for (const forbidden of [
      "mutateJob",
      "createProjectJob",
      "updateProjectJob",
      "sendEmail",
      "createCalendarEvent",
      "from(\"continuum_jobs\").insert",
      "from(\"continuum_jobs\").update",
    ]) {
      assert.equal(source.includes(forbidden), false, `server.ts must not contain ${forbidden}`);
    }
  });

  it("limits declared tools to reads and review-required proposals", () => {
    assert.ok(
      STERLING_TOOL_REGISTRY.every((tool) => tool.mode === "read" || tool.mode === "proposal"),
    );
  });
});
