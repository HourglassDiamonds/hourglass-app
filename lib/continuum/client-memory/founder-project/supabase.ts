/**
 * Supabase founder Project writer.
 * App Router entry: import from `./server`.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { createSupabaseClientMemoryStore } from "../persistence/supabase";
import { createSupabaseClientMemoryProjectSpecWriter } from "../project-spec/supabase";
import { createSupabaseProjectJobWriter } from "../project-jobs/supabase-writer";
import { FOUNDER_PROJECT_SOURCE_SYSTEM } from "./create";
import {
  createFounderProject,
  type CreateFounderProjectInput,
  type CreateFounderProjectResult,
  type FounderLinkedProject,
} from "./create";
import type { FounderProjectWriter } from "./writer";
import { projectKindFromUnknown } from "../project-kind";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

async function listLinkedProjects(
  client: SupabaseClient,
  personId: string,
): Promise<FounderLinkedProject[]> {
  const { data, error } = await client
    .from("continuum_relationships")
    .select("from_entity_id, to_entity_id")
    .eq("kind", "client-project")
    .eq("status", "active");
  if (error) throw new Error("read-relationships-failed");
  const projectIds = (data ?? []).flatMap((row) => {
    if (row.from_entity_id === personId) return [String(row.to_entity_id)];
    if (row.to_entity_id === personId) return [String(row.from_entity_id)];
    return [];
  });
  if (projectIds.length === 0) return [];
  const { data: profiles, error: profileError } = await client
    .from("continuum_project_profiles")
    .select("project_id, display_title, project_kind")
    .in("project_id", projectIds);
  if (profileError) throw new Error("read-project-profiles-failed");
  return (profiles ?? []).map((row) => ({
    projectId: String(row.project_id),
    title: String(row.display_title),
    projectKind: projectKindFromUnknown(row.project_kind),
  }));
}

export class SupabaseFounderProjectWriter implements FounderProjectWriter {
  constructor(private readonly client: SupabaseClient) {}

  createProject(
    input: CreateFounderProjectInput,
  ): Promise<CreateFounderProjectResult> {
    const store = createSupabaseClientMemoryStore(this.client);
    const spec = createSupabaseClientMemoryProjectSpecWriter(this.client);
    const jobs = createSupabaseProjectJobWriter(this.client);
    return createFounderProject(
      {
        nowIso: () => new Date().toISOString(),
        newRelationshipId: () => randomUUID(),
        getEntity: (id) => store.getEntity(id),
        getPersonProfile: (personId) => store.getPersonProfile(personId),
        getProjectProfile: (projectId) => store.getProjectProfile(projectId),
        findProjectByImportRowKey: (row) =>
          store.findProjectByImportRowKey({
            sourceSystem: FOUNDER_PROJECT_SOURCE_SYSTEM,
            importRowKey: row.importRowKey,
          }),
        listActiveClientProjects: (personId) =>
          listLinkedProjects(this.client, personId),
        insertEntity: (row) => store.insertEntity(row),
        insertProjectProfile: (profile) => store.insertProjectProfile(profile),
        insertProjectHistory: (history) => store.insertProjectHistory(history),
        insertRelationship: (row) => store.insertRelationship(row),
        correctProjectKind: (row) => spec.correctProjectKind(row),
        setProjectLifecycle: (row) => spec.setProjectLifecycle(row),
        createProjectJob: (row) => jobs.createJob(row),
      },
      input,
    );
  }

  listActiveClientProjects(personId: string): Promise<FounderLinkedProject[]> {
    return listLinkedProjects(this.client, personId);
  }
}

export function createSupabaseFounderProjectWriter(
  client?: SupabaseClient | null,
): SupabaseFounderProjectWriter {
  return new SupabaseFounderProjectWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
