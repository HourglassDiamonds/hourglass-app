import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONCIERGE_TOOL_NAMES, CONCIERGE_WRITE_TOOL_NAMES, conciergeToolByName } from "./tools";

describe("Concierge Sol tool catalog", () => {
  it("covers the V1 read surface and exposes no canonical writes", () => {
    const required = [
      "find_person",
      "get_person_summary",
      "get_client_history",
      "get_birthdays",
      "find_project",
      "get_project_summary",
      "get_project_specs",
      "get_project_history",
      "get_project_jobs",
      "get_current_projects",
      "get_waiting_state",
      "search_gmail_evidence",
      "get_recent_project_email",
      "get_source_evidence",
      "get_provenance_summary",
      "get_repair_quote",
      "get_repair_context",
      "get_today_items",
      "get_open_commitments",
      "get_waiting_on_client",
      "get_waiting_on_shop",
      "get_in_production",
      "search_notes",
      "get_project_notes",
    ];
    for (const name of required) {
      assert.ok(CONCIERGE_TOOL_NAMES.includes(name), name);
      assert.equal(conciergeToolByName(name)?.write, false);
    }
    assert.deepEqual([...CONCIERGE_WRITE_TOOL_NAMES], []);
    assert.equal(conciergeToolByName("propose_canonical_change")?.proposal, true);
    assert.equal(conciergeToolByName("propose_canonical_change")?.write, false);
    assert.equal(conciergeToolByName("run_sql"), null);
  });
});
