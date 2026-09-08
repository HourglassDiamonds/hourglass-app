import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { collectPagedRows, CANDIDATE_LIST_PAGE_SIZE } from "./page";

describe("Candidate list paging", () => {
  it("walks every page until a short page and does not stop at 1000 logically", async () => {
    assert.equal(CANDIDATE_LIST_PAGE_SIZE, 1000);
    const all = Array.from({ length: 1005 }, (_, i) => `row-${i}`);
    const rows = await collectPagedRows(async (from, to) => all.slice(from, to + 1), 100);
    assert.equal(rows.length, 1005);
    assert.equal(rows[0], "row-0");
    assert.equal(rows[1004], "row-1004");
  });

  it("pages CandidateStore.list past the silent Supabase 1000-row cap", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "supabase.ts"),
      "utf8",
    );
    assert.match(source, /collectPagedRows/);
    assert.match(source, /\.range\(from, to\)/);
  });
});
