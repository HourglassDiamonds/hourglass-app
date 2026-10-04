import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFounderCorrectionEvents } from "./founder-corrections-load";
import {
  correctionNote,
  proposeFounderOperation,
  proposeTodayFounderOperation,
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
  it("reconstructs a person-backed scoped CAD correction without requiring a Project", async () => {
    const operation = proposeTodayFounderOperation("This job is in production. Move it accordingly.", {
      itemId: "brief:cad:C025610", displayName: "Dylon D.", entityType: "client", briefingKind: "generic",
      projectName: null, projectId: null, personId: null, organizationLabel: null, vendorContactName: null,
      identifiers: [{ value: "C025610", role: "cadId", current: true }], lifecycle: null,
      latestMeaningfulExternalEvent: null, latestMeaningfulFounderAction: null, ballHolder: "founder",
      unresolvedFounderObligation: "Review CAD", externalCommitment: null, nextExpectedEvent: null,
      candidateNextAction: "Review CAD", uncertainty: [], mustNotState: [], sourceRefs: ["gc1|dylan"],
    });
    assert.equal(operation?.kind, "correct");
    const row = {
      id: "dylan-correction", person_id: "dylan-person", project_id: null, context_layer: "client",
      source_system: "concierge-manual", lifecycle_status: "kept", note_text: correctionNote(operation!),
      created_at: "2026-10-04T14:00:00Z",
    };
    const query = {
      select: () => query, eq: () => query, like: () => query, order: () => query,
      range: async () => ({ data: [row], error: null }),
    };
    const events = await loadFounderCorrectionEvents({ from: () => query } as unknown as SupabaseClient);
    assert.equal(events.length, 1);
    assert.equal(events[0].workLoopId, "cad:C025610");
    assert.deepEqual(events[0].cadIds, ["C025610"]);
    assert.equal(events[0].correction?.stage, "in_production");
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
