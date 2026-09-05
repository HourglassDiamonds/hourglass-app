/**
 * Supabase Project Artifacts founder writer.
 * Private bucket only. Does not write Gmail, Shape Studio, DI, CoS, or Lifecycle.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { EntityKind } from "../../contracts/types";
import { createProjectArtifact } from "./create";
import type {
  CreateProjectArtifactApplyResult,
  CreateProjectArtifactInput,
  CreateProjectArtifactResult,
} from "./create";
import { PROJECT_ARTIFACT_COLUMNS, projectArtifactToRow, rowToProjectArtifact } from "./rows";
import type { ProjectArtifact } from "./types";
import { PROJECT_ARTIFACTS_BUCKET } from "./types";
import type { ProjectProfile } from "../types";
import { projectKindFromUnknown } from "../project-kind";
import type { ProjectArtifactBytes, ProjectArtifactWriter } from "./writer";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function writeReason(message: string): Error {
  if (message.includes("project-not-found")) return new Error("project-not-found");
  if (message.includes("entity-kind-mismatch")) {
    return new Error("entity-kind-mismatch");
  }
  return new Error(message || "create-project-artifact-failed");
}

export class SupabaseProjectArtifactWriter implements ProjectArtifactWriter {
  constructor(private readonly client: SupabaseClient) {}

  private async getEntityKind(
    id: string,
  ): Promise<{ kind: EntityKind } | null> {
    const { data, error } = await this.client
      .from("continuum_entities")
      .select("kind")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { kind: data.kind as EntityKind };
  }

  private async getProjectProfile(
    projectId: string,
  ): Promise<ProjectProfile | null> {
    const { data, error } = await this.client
      .from("continuum_project_profiles")
      .select(
        "project_id, display_title, visibility, import_row_key, source_system, created_at, updated_at, project_kind",
      )
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      projectId: String(data.project_id),
      displayTitle: String(data.display_title),
      visibility: data.visibility as ProjectProfile["visibility"],
      importRowKey:
        data.import_row_key == null ? null : String(data.import_row_key),
      sourceSystem: data.source_system as ProjectProfile["sourceSystem"],
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
      projectKind: projectKindFromUnknown(data.project_kind),
    };
  }

  private async loadArtifact(artifactId: string): Promise<ProjectArtifact | null> {
    const { data, error } = await this.client
      .from("continuum_project_artifacts")
      .select(PROJECT_ARTIFACT_COLUMNS)
      .eq("artifact_id", artifactId)
      .maybeSingle();
    if (error) throw writeReason(error.message ?? "");
    return rowToProjectArtifact((data ?? null) as Record<string, unknown> | null);
  }

  async getArtifact(
    projectId: string,
    artifactId: string,
  ): Promise<ProjectArtifact | null> {
    const artifact = await this.loadArtifact(artifactId);
    if (!artifact || artifact.projectId !== projectId) return null;
    return artifact;
  }

  async getArtifactBytes(
    projectId: string,
    artifactId: string,
  ): Promise<ProjectArtifactBytes | null> {
    const artifact = await this.getArtifact(projectId, artifactId);
    if (!artifact) return null;
    const downloaded = await this.client.storage
      .from(artifact.storageBucket)
      .download(artifact.storagePath);
    if (downloaded.error || !downloaded.data) return null;
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    return { artifact, bytes };
  }

  private async applyCreate(
    artifact: ProjectArtifact,
    bytes: Uint8Array,
  ): Promise<CreateProjectArtifactApplyResult> {
    const existingMutation = await this.client
      .from("continuum_project_artifacts")
      .select(PROJECT_ARTIFACT_COLUMNS)
      .eq("created_mutation_id", artifact.createdMutationId)
      .maybeSingle();
    if (existingMutation.error) throw writeReason(existingMutation.error.message);
    const existing = rowToProjectArtifact(
      (existingMutation.data ?? null) as Record<string, unknown> | null,
    );
    if (existing) return { status: "already-present", artifact: existing };

    const uploaded = await this.client.storage
      .from(PROJECT_ARTIFACTS_BUCKET)
      .upload(artifact.storagePath, bytes, {
        contentType: artifact.mimeType,
        upsert: false,
      });
    if (uploaded.error) throw writeReason(uploaded.error.message);

    const inserted = await this.client
      .from("continuum_project_artifacts")
      .insert(projectArtifactToRow(artifact))
      .select(PROJECT_ARTIFACT_COLUMNS)
      .maybeSingle();
    if (inserted.error) throw writeReason(inserted.error.message);
    const mapped = rowToProjectArtifact(
      (inserted.data ?? null) as Record<string, unknown> | null,
    );
    if (!mapped) throw new Error("unavailable");
    return { status: "created", artifact: mapped };
  }

  createArtifact(
    input: CreateProjectArtifactInput,
  ): Promise<CreateProjectArtifactResult> {
    return createProjectArtifact(
      {
        nowIso: () => new Date().toISOString(),
        newArtifactId: () => randomUUID(),
        getEntity: (id) => this.getEntityKind(id),
        getProjectProfile: (projectId) => this.getProjectProfile(projectId),
        applyCreate: (artifact, bytes) => this.applyCreate(artifact, bytes),
      },
      input,
    );
  }
}

export function createSupabaseProjectArtifactWriter(
  client?: SupabaseClient | null,
): ProjectArtifactWriter {
  return new SupabaseProjectArtifactWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
