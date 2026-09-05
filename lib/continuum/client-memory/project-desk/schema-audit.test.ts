import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function walkSql(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkSql(path, found);
    else if (entry.name.endsWith(".sql")) found.push(path);
  }
  return found;
}

describe("Project Desk Slice A schema", () => {
  it("does not introduce operating or artifacts SQL in unrelated files", () => {
    assert.equal(
      existsSync(
        join(ROOT, "lib/supabase/continuum-client-memory-project-operating.sql"),
      ),
      false,
    );
    const jobsSql = join(
      ROOT,
      "lib/supabase/continuum-client-memory-project-jobs.sql",
    );
    assert.equal(existsSync(jobsSql), true);
    assert.equal(
      existsSync(
        join(ROOT, "lib/supabase/continuum-client-memory-project-artifacts.sql"),
      ),
      true,
    );
    const sqlFiles = walkSql(join(ROOT, "lib/supabase"));
    assert.ok(sqlFiles.length > 0);
    for (const file of sqlFiles) {
      const sql = readFileSync(file, "utf8");
      assert.doesNotMatch(sql, /continuum_project_operating/);
      const isJobsSql =
        file.endsWith("continuum-client-memory-project-jobs.sql") ||
        file.endsWith("continuum-client-memory-project-jobs-mutations.sql");
      const isArtifactsSql = file.endsWith(
        "continuum-client-memory-project-artifacts.sql",
      );
      if (!isArtifactsSql) {
        assert.doesNotMatch(sql, /continuum_project_artifacts/);
      }
      if (!isJobsSql) {
        assert.doesNotMatch(sql, /continuum_project_jobs/);
        assert.doesNotMatch(sql, /continuum_project_open_jobs/);
      }
      if (!file.endsWith("continuum-client-memory-project-lifecycle.sql")) {
        assert.doesNotMatch(sql, /continuum_client_memory_set_project_lifecycle/);
      }
    }
  });
});
