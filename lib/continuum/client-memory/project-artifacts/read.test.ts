import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { CLIENT_MEMORY_SOURCE_SYSTEM, type ProjectProfile } from "../types";
import { getProjectDeskFromSnapshot } from "../project-desk/compose";
import type { ProjectDeskSnapshot } from "../project-desk/types";
import type { ProjectArtifact } from "./types";
import { rowToProjectArtifact } from "./rows";
import { projectArtifactsReadModel } from "./read";
import { conciergeProjectArtifactFilePath } from "../read/presentation";

const NOW = "2026-09-05T16:00:00.000Z";
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ARTIFACT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ARTIFACT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function profile(title: string, projectId: string): ProjectProfile {
  return {
    projectId,
    displayTitle: title,
    visibility: "internal-only",
    importRowKey: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function artifact(
  extra: Partial<ProjectArtifact> & Pick<ProjectArtifact, "artifactId" | "projectId" | "title">,
): ProjectArtifact {
  return {
    kind: "render",
    originalFilename: "render.png",
    mimeType: "image/png",
    byteSize: 12,
    storageBucket: "continuum-project-artifacts",
    storagePath: `${extra.projectId}/${extra.artifactId}/file.png`,
    createdAt: NOW,
    createdBy: "justin",
    sourceSystem: "concierge-manual",
    sourceRef: null,
    createdMutationId: randomUUID(),
    ...extra,
  };
}

function snapshot(partial: Partial<ProjectDeskSnapshot> = {}): ProjectDeskSnapshot {
  return {
    projectProfiles: [],
    projectHistories: [],
    relationships: [],
    people: [],
    sourceNotes: [],
    ...partial,
  };
}

describe("Project Artifact read model", () => {
  it("treats a missing artifacts load as disconnected, not empty", () => {
    const project = profile("Unknown ring", PROJECT_A);
    const desk = getProjectDeskFromSnapshot(
      snapshot({ projectProfiles: [project] }),
      project.projectId,
      NOW,
    );
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(desk.desk.artifacts.connected, false);
    assert.equal(desk.desk.coverage.files, "not-connected");
    const none = getProjectDeskFromSnapshot(
      snapshot({ projectProfiles: [project], projectArtifacts: [] }),
      project.projectId,
      NOW,
    );
    assert.equal(none.ok, true);
    if (!none.ok) return;
    assert.equal(none.desk.artifacts.connected, true);
    assert.equal(none.desk.artifacts.connected && none.desk.artifacts.count, 0);
    assert.equal(none.desk.coverage.files, "none");
  });

  it("shows one and multiple files without leaking another Project", () => {
    const first = profile("Oval ring", PROJECT_A);
    const second = profile("Band", PROJECT_B);
    const rows = [
      artifact({ artifactId: ARTIFACT_A, projectId: PROJECT_A, title: "Render 1" }),
      artifact({
        artifactId: ARTIFACT_B,
        projectId: PROJECT_A,
        title: "CAD",
        kind: "cad",
        createdAt: "2026-09-04T16:00:00.000Z",
      }),
      artifact({
        artifactId: randomUUID(),
        projectId: PROJECT_B,
        title: "Other render",
      }),
    ];
    const desk = getProjectDeskFromSnapshot(
      snapshot({
        projectProfiles: [first, second],
        projectArtifacts: rows,
      }),
      PROJECT_A,
      NOW,
    );
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(desk.desk.artifacts.connected, true);
    if (!desk.desk.artifacts.connected) return;
    assert.equal(desk.desk.artifacts.count, 2);
    assert.deepEqual(
      desk.desk.artifacts.items.map((row) => row.title),
      ["Render 1", "CAD"],
    );
    assert.equal(
      desk.desk.artifacts.items[0]?.href,
      conciergeProjectArtifactFilePath(PROJECT_A, ARTIFACT_A),
    );
    assert.doesNotMatch(desk.desk.artifacts.items[0]?.href ?? "", /supabase|public|storage\/v1/i);
    assert.equal(desk.desk.coverage.files, "available");
    const other = projectArtifactsReadModel(rows, PROJECT_B);
    assert.equal(other.connected, true);
    if (!other.connected) return;
    assert.equal(other.count, 1);
    assert.equal(other.items[0]?.title, "Other render");
  });

  it("drops rows whose storage path is not the server-generated private object", () => {
    const mapped = rowToProjectArtifact({
      artifact_id: ARTIFACT_A,
      project_id: PROJECT_A,
      kind: "render",
      title: "Render 1",
      original_filename: "render.png",
      mime_type: "image/png",
      byte_size: 12,
      storage_bucket: "continuum-project-artifacts",
      storage_path: "public/render.png",
      created_at: NOW,
      created_by: "justin",
      source_system: "concierge-manual",
      source_ref: null,
      created_mutation_id: randomUUID(),
    });
    assert.equal(mapped, null);
    const valid = rowToProjectArtifact({
      artifact_id: ARTIFACT_A,
      project_id: PROJECT_A,
      kind: "render",
      title: "Render 1",
      original_filename: "render.png",
      mime_type: "image/png",
      byte_size: 12,
      storage_bucket: "continuum-project-artifacts",
      storage_path: `${PROJECT_A}/${ARTIFACT_A}/file.png`,
      created_at: NOW,
      created_by: "justin",
      source_system: "concierge-manual",
      source_ref: "gmail:msg:pointer-only",
      created_mutation_id: randomUUID(),
    });
    assert.equal(valid?.sourceRef, "gmail:msg:pointer-only");
    assert.equal(valid?.storagePath, `${PROJECT_A}/${ARTIFACT_A}/file.png`);

    const longGmail = rowToProjectArtifact({
      artifact_id: ARTIFACT_A,
      project_id: PROJECT_A,
      kind: "cad",
      title: "Pennock CAD",
      original_filename: "Pennock-CAD-finger-render.JPG",
      mime_type: "image/jpeg",
      byte_size: 12,
      storage_bucket: "continuum-project-artifacts",
      storage_path: `${PROJECT_A}/${ARTIFACT_A}/file.jpg`,
      created_at: NOW,
      created_by: "justin",
      source_system: "gmail",
      source_ref: `gm1|19c4f8a2b1e90d3f|${"A".repeat(426)}|19c4f8a2b1e90d40|${NOW}|${"b".repeat(64)}`,
      created_mutation_id: randomUUID(),
    });
    assert.ok(longGmail);
    assert.ok((longGmail?.sourceRef?.length ?? 0) > 240);
    assert.ok((longGmail?.sourceRef?.length ?? 0) <= 2048);

    const longManual = rowToProjectArtifact({
      artifact_id: ARTIFACT_A,
      project_id: PROJECT_A,
      kind: "render",
      title: "Render 1",
      original_filename: "render.png",
      mime_type: "image/png",
      byte_size: 12,
      storage_bucket: "continuum-project-artifacts",
      storage_path: `${PROJECT_A}/${ARTIFACT_A}/file.png`,
      created_at: NOW,
      created_by: "justin",
      source_system: "concierge-manual",
      source_ref: "n".repeat(241),
      created_mutation_id: randomUUID(),
    });
    assert.equal(longManual, null);
  });
});
