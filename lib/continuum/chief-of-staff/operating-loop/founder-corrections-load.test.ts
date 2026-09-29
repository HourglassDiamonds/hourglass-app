import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFounderCorrectionEvents } from "./founder-corrections-load";
import {
  correctionNote,
  proposeFounderOperation,
} from "@/lib/continuum/concierge-sol/founder-command";

describe("founder correction source loader", () => {
  it("paginates canonical notes, retains source provenance and excludes deleted/unassigned notes", async () => {
    const operation = proposeFounderOperation("Flora is in manufacturing.");
    assert.ok(operation?.kind === "correct");
    const row = {
      id: "note-1",
      project_id: "flora-project",
      context_layer: "client",
      source_system: "concierge-manual",
      lifecycle_status: "kept",
      note_text: correctionNote(operation),
      created_at: "2026-09-29T14:00:00Z",
    };
    const ranges: number[][] = [];
    const filters: unknown[][] = [];
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        filters.push(args);
        return query;
      },
      like: (...args: unknown[]) => {
        filters.push(args);
        return query;
      },
      order: () => query,
      range: async (start: number, end: number) => {
        ranges.push([start, end]);
        return {
          error: null,
          data:
            start === 0
              ? Array.from({ length: 1000 }, (_, i) => ({
                  ...row,
                  id: "note-" + i,
                }))
              : [
                  { ...row, id: "deleted", deleted_at: "2026-09-29T15:00:00Z" },
                  { ...row, id: "unassigned", project_id: null },
                ],
        };
      },
    };
    const client = {
      from: (table: string) => {
        assert.equal(table, "continuum_source_notes");
        return query;
      },
    } as unknown as SupabaseClient;
    const events = await loadFounderCorrectionEvents(client);
    assert.equal(events.length, 1000);
    assert.equal(events[0].provenance, "founder_correction");
    assert.equal(events[0].timestamp, row.created_at);
    assert.equal(events[0].correction?.stage, "in_production");
    assert.deepEqual(ranges, [
      [0, 999],
      [1000, 1999],
    ]);
    assert.ok(
      filters.some(
        ([column, value]) => column === "lifecycle_status" && value === "kept",
      ),
    );
  });
  it("surfaces read failure instead of silently rebuilding without corrections", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      like: () => query,
      order: () => query,
      range: async () => ({ data: null, error: new Error("unavailable") }),
    };
    await assert.rejects(
      loadFounderCorrectionEvents({
        from: () => query,
      } as unknown as SupabaseClient),
      /unavailable/,
    );
  });
});
