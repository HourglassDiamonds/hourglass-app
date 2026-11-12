import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  NOVEMBER_11_OPERATIONAL_RECONCILIATION_IDENTIFIERS,
  NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS,
} from "./operational-reconciliation-scope";
import { scopeDefinition } from "./scope";

describe("November 11 operational reconciliation scope", () => {
  it("pins unique exact evidence IDs including Hyrum and Zane's payment/supplier threads", () => {
    assert.equal(new Set(NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS).size,
      NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.length);
    assert.ok(NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.includes("1a1c73c88f29a182"));
    assert.ok(NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.includes("1a17f4a8f371d911"));
    assert.ok(NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.includes("1a1847d9ad49e7a4"));
    assert.ok(NOVEMBER_11_OPERATIONAL_RECONCILIATION_IDENTIFIERS.includes("C026732"));
    assert.deepEqual(scopeDefinition("hyrumLower")?.exactThreadIds, ["1a1c73c88f29a182"]);
  });

  it("uses the allowlist for indexed expansion and live retrieval", () => {
    const runner = readFileSync("lib/continuum/today-sterling/server-runner.ts", "utf8");
    const script = readFileSync("scripts/continuum-sterling-today-shadow.ts", "utf8");
    assert.match(runner, /additionalIndexedThreadIds/);
    assert.match(runner, /liveRetrievalThreadAllowlist/);
    assert.match(runner, /not-requested-scope-excluded/);
    assert.match(script, /--november-11-operational-reconciliation/);
    assert.match(script, /--connector-json-stdin/);
    assert.match(script, /connector-stdin-requires-november-11-operational-reconciliation/);
    assert.match(script, /connector-stdin-thread-outside-november-11-allowlist/);
    assert.match(script, /NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS/);
    assert.match(script, /plaintextPersisted: false/);
    assert.match(script, /gmailMutation: false/);
  });
});
