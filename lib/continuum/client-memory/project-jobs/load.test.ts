import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadProjectJobs } from "./load";

describe("Open Jobs Supabase load", () => {
  it("returns unavailable when the table is missing instead of inventing none", async () => {
    const client = {
      from(table: string) {
        assert.equal(table, "continuum_project_jobs");
        return {
          select() {
            return Promise.resolve({
              data: null,
              error: {
                code: "42P01",
                message: 'relation "continuum_project_jobs" does not exist',
              },
            });
          },
        };
      },
    };
    const rows = await loadProjectJobs(client as never);
    assert.equal(rows, null);
  });

  it("maps valid rows and drops invalid kinds", async () => {
    const client = {
      from() {
        return {
          select() {
            return Promise.resolve({
              data: [
                {
                  job_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  project_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                  kind: "request",
                  subject: "Need CAD",
                  detail: null,
                  waiting_on_actor: "founder",
                  associated_person_id: null,
                  state: "open",
                  due_at: null,
                  deferred_until: null,
                  resolved_at: null,
                  cancelled_at: null,
                  created_at: "2026-09-05T16:00:00.000Z",
                  updated_at: "2026-09-05T16:00:00.000Z",
                  created_by: "justin",
                  source_system: "concierge-manual",
                  source_ref: "gmail:msg:pointer-only",
                  created_mutation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                },
                {
                  job_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  project_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                  kind: "todo",
                  subject: "Not a job",
                  waiting_on_actor: "founder",
                  state: "open",
                  created_at: "2026-09-05T16:00:00.000Z",
                  updated_at: "2026-09-05T16:00:00.000Z",
                  created_by: "justin",
                  source_system: "concierge-manual",
                  created_mutation_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                },
              ],
              error: null,
            });
          },
        };
      },
    };
    const rows = await loadProjectJobs(client as never);
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0]?.subject, "Need CAD");
    assert.equal(rows?.[0]?.sourceRef, "gmail:msg:pointer-only");
  });
});
