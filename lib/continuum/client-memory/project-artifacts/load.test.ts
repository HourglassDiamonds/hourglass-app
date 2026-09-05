import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadProjectArtifacts } from "./load";

describe("Project Artifacts Supabase load", () => {
  it("returns unavailable when the table is missing instead of inventing none", async () => {
    const client = {
      from(table: string) {
        assert.equal(table, "continuum_project_artifacts");
        return {
          select() {
            return Promise.resolve({
              data: null,
              error: {
                code: "42P01",
                message: 'relation "continuum_project_artifacts" does not exist',
              },
            });
          },
        };
      },
    };
    const rows = await loadProjectArtifacts(client as never);
    assert.equal(rows, null);
  });

  it("maps valid rows and drops invalid kinds and public buckets", async () => {
    const client = {
      from() {
        return {
          select() {
            return Promise.resolve({
              data: [
                {
                  artifact_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  project_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                  kind: "render",
                  title: "Render 1",
                  original_filename: "render.png",
                  mime_type: "image/png",
                  byte_size: 12,
                  storage_bucket: "continuum-project-artifacts",
                  storage_path:
                    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/file.png",
                  created_at: "2026-09-05T16:00:00.000Z",
                  created_by: "justin",
                  source_system: "concierge-manual",
                  source_ref: null,
                  created_mutation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                },
                {
                  artifact_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  project_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                  kind: "moodboard",
                  title: "Not a kind",
                  original_filename: "x.png",
                  mime_type: "image/png",
                  byte_size: 12,
                  storage_bucket: "continuum-project-artifacts",
                  storage_path:
                    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/dddddddd-dddd-4ddd-8ddd-dddddddddddd/file.png",
                  created_at: "2026-09-05T16:00:00.000Z",
                  created_by: "justin",
                  source_system: "concierge-manual",
                  created_mutation_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                },
                {
                  artifact_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
                  project_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                  kind: "cad",
                  title: "Public CAD",
                  original_filename: "cad.png",
                  mime_type: "image/png",
                  byte_size: 12,
                  storage_bucket: "shape-studio-captures",
                  storage_path:
                    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/ffffffff-ffff-4fff-8fff-ffffffffffff/file.png",
                  created_at: "2026-09-05T16:00:00.000Z",
                  created_by: "justin",
                  source_system: "continuum",
                  created_mutation_id: "99999999-9999-4999-8999-999999999999",
                },
              ],
              error: null,
            });
          },
        };
      },
    };
    const rows = await loadProjectArtifacts(client as never);
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0]?.title, "Render 1");
    assert.equal(rows?.[0]?.storageBucket, "continuum-project-artifacts");
  });
});
