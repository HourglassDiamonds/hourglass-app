import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import {
  createProjectArtifact,
  type CreateProjectArtifactDeps,
} from "./create";
import { InMemoryProjectArtifactStore } from "./store";
import { createInMemoryProjectArtifactWriter } from "./writer";
import { PROJECT_ARTIFACT_KINDS, PROJECT_ARTIFACT_MAX_BYTES } from "./types";
import { projectArtifactObjectPath } from "./storage";

const NOW = "2026-09-05T16:00:00.000Z";
const ACTOR = "justin";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function seedProject(
  store: InMemoryClientMemoryStore,
  extra: { title?: string } = {},
) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName: "Ada Lovelace",
    givenName: "Ada",
    familyName: "Lovelace",
    organizationName: null,
    email: null,
    phone: null,
    streetAddress: null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: ["client"],
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const project = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: extra.title ?? "Oval ring",
    visibility: "internal-only",
    importRowKey: `continuum-artifacts-14:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    projectKind: null,
  });
  return { personId: person.record.id, projectId: project.record.id };
}

function deps(
  store: InMemoryClientMemoryStore,
  artifacts: InMemoryProjectArtifactStore,
): CreateProjectArtifactDeps {
  return {
    nowIso: () => NOW,
    newArtifactId: () => randomUUID(),
    getEntity: (id) => store.getEntity(id),
    getProjectProfile: (projectId) => store.getProjectProfile(projectId),
    applyCreate: (artifact, bytes) =>
      Promise.resolve(artifacts.insertArtifact(artifact, bytes)),
  };
}

function input(
  projectId: string,
  extra: Record<string, unknown> = {},
) {
  return {
    mutationId: randomUUID(),
    projectId,
    kind: "render",
    title: "Render 1",
    originalFilename: "render-1.png",
    mimeType: "image/png",
    bytes: PNG,
    actor: ACTOR,
    ...extra,
  };
}

describe("Project Artifact create primitive", () => {
  it("accepts every bounded kind and stores Hourglass-owned metadata", async () => {
    const store = new InMemoryClientMemoryStore();
    const artifacts = new InMemoryProjectArtifactStore();
    const seeded = await seedProject(store);
    for (const kind of PROJECT_ARTIFACT_KINDS) {
      const result = await createProjectArtifact(deps(store, artifacts), {
        ...input(seeded.projectId),
        mutationId: randomUUID(),
        kind,
        title: `${kind} file`,
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.artifact.kind, kind);
      assert.equal(result.artifact.storageBucket, "continuum-project-artifacts");
      assert.equal(
        result.artifact.storagePath,
        projectArtifactObjectPath(
          seeded.projectId,
          result.artifact.artifactId,
          "image/png",
        ),
      );
      assert.doesNotMatch(result.artifact.storagePath, /render-1\.png/);
      assert.equal(result.artifact.sourceSystem, "concierge-manual");
    }
    assert.equal(
      artifacts.listArtifacts(seeded.projectId).length,
      PROJECT_ARTIFACT_KINDS.length,
    );
  });

  it("rejects invalid kind, mime, empty bytes, and Gmail copy-in", async () => {
    const store = new InMemoryClientMemoryStore();
    const artifacts = new InMemoryProjectArtifactStore();
    const seeded = await seedProject(store);
    const invalidKind = await createProjectArtifact(deps(store, artifacts), {
      ...input(seeded.projectId),
      kind: "moodboard",
    });
    assert.equal(invalidKind.ok, false);
    if (invalidKind.ok) return;
    assert.equal(invalidKind.code, "invalid-kind");
    const invalidMime = await createProjectArtifact(deps(store, artifacts), {
      ...input(seeded.projectId, { mutationId: randomUUID() }),
      mimeType: "image/svg+xml",
    });
    assert.equal(invalidMime.ok, false);
    if (invalidMime.ok) return;
    assert.equal(invalidMime.code, "invalid-mime");
    const empty = await createProjectArtifact(deps(store, artifacts), {
      ...input(seeded.projectId, { mutationId: randomUUID() }),
      bytes: new Uint8Array(),
    });
    assert.equal(empty.ok, false);
    if (empty.ok) return;
    assert.equal(empty.code, "invalid-bytes");
    const tooLarge = await createProjectArtifact(deps(store, artifacts), {
      ...input(seeded.projectId, { mutationId: randomUUID() }),
      bytes: new Uint8Array(PROJECT_ARTIFACT_MAX_BYTES + 1),
    });
    assert.equal(tooLarge.ok, false);
    const gmail = await createProjectArtifact(deps(store, artifacts), {
      ...input(seeded.projectId, { mutationId: randomUUID() }),
      sourceSystem: "gmail",
      sourceRef: "gmail:msg:abc",
    });
    assert.equal(gmail.ok, false);
    if (gmail.ok) return;
    assert.equal(gmail.code, "invalid-source");
    assert.equal(artifacts.listArtifacts().length, 0);
  });

  it("keeps files inside the requested Project and allows the same filename on another Project", async () => {
    const store = new InMemoryClientMemoryStore();
    const artifacts = new InMemoryProjectArtifactStore();
    const first = await seedProject(store, { title: "Oval ring" });
    const second = await seedProject(store, { title: "Band" });
    const writer = createInMemoryProjectArtifactWriter(store, artifacts, () => NOW);
    const created = await writer.createArtifact(
      input(first.projectId, { originalFilename: "final.png" }),
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const otherProject = await writer.getArtifact(
      second.projectId,
      created.artifact.artifactId,
    );
    assert.equal(otherProject, null);
    const otherBytes = await writer.getArtifactBytes(
      second.projectId,
      created.artifact.artifactId,
    );
    assert.equal(otherBytes, null);
    const sameName = await writer.createArtifact(
      input(second.projectId, { originalFilename: "final.png" }),
    );
    assert.equal(sameName.ok, true);
    if (!sameName.ok) return;
    assert.equal(sameName.artifact.originalFilename, "final.png");
    assert.notEqual(sameName.artifact.storagePath, created.artifact.storagePath);
    assert.match(created.artifact.storagePath, new RegExp(first.projectId));
    assert.match(sameName.artifact.storagePath, new RegExp(second.projectId));
    const asPerson = await createProjectArtifact(deps(store, artifacts), {
      ...input(first.personId, { mutationId: randomUUID() }),
    });
    assert.equal(asPerson.ok, false);
    if (asPerson.ok) return;
    assert.equal(asPerson.reason, "entity-kind-mismatch");
  });

  it("is idempotent on created_mutation_id and does not delete", async () => {
    const store = new InMemoryClientMemoryStore();
    const artifacts = new InMemoryProjectArtifactStore();
    const seeded = await seedProject(store);
    const mutationId = randomUUID();
    const first = await createProjectArtifact(deps(store, artifacts), {
      ...input(seeded.projectId),
      mutationId,
    });
    const second = await createProjectArtifact(deps(store, artifacts), {
      ...input(seeded.projectId),
      mutationId,
      title: "Render 1 retry",
    });
    assert.equal(first.ok && first.status, "created");
    assert.equal(second.ok && second.status, "already-present");
    if (!first.ok || !second.ok) return;
    assert.equal(second.artifact.artifactId, first.artifact.artifactId);
    assert.equal(second.artifact.title, "Render 1");
    assert.equal(artifacts.listArtifacts().length, 1);
    assert.equal("deleteArtifact" in artifacts, false);
    assert.equal(typeof artifacts.insertArtifact, "function");
    assert.equal(
      Object.getOwnPropertyNames(Object.getPrototypeOf(artifacts)).includes(
        "deleteArtifact",
      ),
      false,
    );
  });
});
