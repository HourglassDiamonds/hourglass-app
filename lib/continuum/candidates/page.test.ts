import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectPagedRows,
  CANDIDATE_LIST_MAX_ROWS,
  CANDIDATE_LIST_PAGE_SIZE,
} from "./page";

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
    assert.match(source, /\.order\("created_at", \{ ascending: true \}\)/);
    assert.match(source, /\.order\("candidate_id", \{ ascending: true \}\)/);
  });

  it("does not duplicate rows across pages and keeps created_at then id order", async () => {
    const all = Array.from({ length: 250 }, (_, i) => `row-${String(i).padStart(3, "0")}`);
    const seenRanges: Array<[number, number]> = [];
    const rows = await collectPagedRows(async (from, to) => {
      seenRanges.push([from, to]);
      return all.slice(from, to + 1);
    }, 100);
    assert.equal(rows.length, 250);
    assert.deepEqual(rows, all);
    assert.equal(new Set(rows).size, 250);
    assert.deepEqual(seenRanges, [
      [0, 99],
      [100, 199],
      [200, 299],
    ]);
  });

  it("stops at the hard cap even if every page is full", async () => {
    let calls = 0;
    const rows = await collectPagedRows(
      async (from, to) => {
        calls += 1;
        const size = to - from + 1;
        return Array.from({ length: size }, (_, i) => `loop-${from + i}`);
      },
      100,
      250,
    );
    assert.equal(rows.length, 250);
    assert.equal(calls, 3);
    assert.ok(calls < 20);
    assert.equal(CANDIDATE_LIST_MAX_ROWS, 20_000);
  });
});
