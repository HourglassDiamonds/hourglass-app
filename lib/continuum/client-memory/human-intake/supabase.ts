/**
 * Supabase protected human-source adapter.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Service-role only. Never writes Persons, facts, notes, wishes, projects,
 * Open Jobs, CoS attention, or kernel Event/Evidence/Observation.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { EntityKind } from "../../contracts/types";
import { isRelationshipContextLayer } from "../contracts";
import { ingestHumanSource } from "./ingest";
import { HUMAN_SOURCES_BUCKET } from "./storage";
import type { HumanSourceStore } from "./store";
import {
  HUMAN_COMMUNICATION_TYPES,
  HUMAN_LINK_ENTITY_KINDS,
  HUMAN_LINK_STATUSES,
  HUMAN_PARSE_STATUSES,
  HUMAN_REVIEW_STATUSES,
  HUMAN_SOURCE_AUTHOR_JUSTIN,
  HUMAN_SOURCE_TYPES,
  type HumanSource,
  type HumanSourceLink,
  type IngestHumanSourceInput,
  type IngestHumanSourceResult,
} from "./types";

const SOURCE_COLUMNS =
  "id, source_type, external_source_id, content_sha256, captured_at, ingested_at, raw_storage_path, raw_mime_type, raw_byte_size, raw_text, parsed_text, source_author, reported_communication_type, parser_version, parse_status, review_status, context_layer_proposed, context_layer_confirmed, created_at, updated_at";

const LINK_COLUMNS =
  "source_id, entity_id, entity_kind, link_status, created_at";

const UNIQUE_VIOLATION = "23505";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function optionalContext(
  value: unknown,
): HumanSource["contextLayerProposed"] {
  if (value == null) return null;
  if (!isRelationshipContextLayer(value)) {
    throw new Error("invalid-context-layer");
  }
  return value;
}

function rowToSource(row: Record<string, unknown>): HumanSource {
  if (
    typeof row.source_type !== "string" ||
    !(HUMAN_SOURCE_TYPES as readonly string[]).includes(row.source_type)
  ) {
    throw new Error("invalid-source-type");
  }
  if (
    typeof row.reported_communication_type !== "string" ||
    !(HUMAN_COMMUNICATION_TYPES as readonly string[]).includes(
      row.reported_communication_type,
    )
  ) {
    throw new Error("invalid-communication-type");
  }
  if (
    typeof row.parse_status !== "string" ||
    !(HUMAN_PARSE_STATUSES as readonly string[]).includes(row.parse_status)
  ) {
    throw new Error("invalid-parse-status");
  }
  if (
    typeof row.review_status !== "string" ||
    !(HUMAN_REVIEW_STATUSES as readonly string[]).includes(row.review_status)
  ) {
    throw new Error("invalid-review-status");
  }
  if (row.source_author !== HUMAN_SOURCE_AUTHOR_JUSTIN) {
    throw new Error("invalid-source-author");
  }
  return {
    id: String(row.id),
    sourceType: row.source_type as HumanSource["sourceType"],
    externalSourceId: optionalText(row.external_source_id),
    contentSha256: String(row.content_sha256),
    capturedAt: optionalText(row.captured_at),
    ingestedAt: String(row.ingested_at),
    rawStoragePath: optionalText(row.raw_storage_path),
    rawMimeType: optionalText(row.raw_mime_type),
    rawByteSize:
      row.raw_byte_size == null ? null : Number(row.raw_byte_size),
    rawText: optionalText(row.raw_text),
    parsedText: optionalText(row.parsed_text),
    sourceAuthor: HUMAN_SOURCE_AUTHOR_JUSTIN,
    reportedCommunicationType:
      row.reported_communication_type as HumanSource["reportedCommunicationType"],
    parserVersion: optionalText(row.parser_version),
    parseStatus: row.parse_status as HumanSource["parseStatus"],
    reviewStatus: row.review_status as HumanSource["reviewStatus"],
    contextLayerProposed: optionalContext(row.context_layer_proposed),
    contextLayerConfirmed: optionalContext(row.context_layer_confirmed),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function sourceToRow(row: HumanSource): Record<string, unknown> {
  return {
    id: row.id,
    source_type: row.sourceType,
    external_source_id: row.externalSourceId,
    content_sha256: row.contentSha256,
    captured_at: row.capturedAt,
    ingested_at: row.ingestedAt,
    raw_storage_path: row.rawStoragePath,
    raw_mime_type: row.rawMimeType,
    raw_byte_size: row.rawByteSize,
    raw_text: row.rawText,
    parsed_text: row.parsedText,
    source_author: row.sourceAuthor,
    reported_communication_type: row.reportedCommunicationType,
    parser_version: row.parserVersion,
    parse_status: row.parseStatus,
    review_status: row.reviewStatus,
    context_layer_proposed: row.contextLayerProposed,
    context_layer_confirmed: row.contextLayerConfirmed,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function rowToLink(row: Record<string, unknown>): HumanSourceLink {
  if (
    typeof row.entity_kind !== "string" ||
    !(HUMAN_LINK_ENTITY_KINDS as readonly string[]).includes(row.entity_kind)
  ) {
    throw new Error("invalid-entity-kind");
  }
  if (
    typeof row.link_status !== "string" ||
    !(HUMAN_LINK_STATUSES as readonly string[]).includes(row.link_status)
  ) {
    throw new Error("invalid-link-status");
  }
  return {
    sourceId: String(row.source_id),
    entityId: String(row.entity_id),
    entityKind: row.entity_kind as HumanSourceLink["entityKind"],
    linkStatus: row.link_status as HumanSourceLink["linkStatus"],
    createdAt: String(row.created_at),
  };
}

export class SupabaseHumanSourceStore implements HumanSourceStore {
  constructor(private readonly client: SupabaseClient) {}

  ingest(input: IngestHumanSourceInput): Promise<IngestHumanSourceResult> {
    return ingestHumanSource(
      {
        nowIso: () => new Date().toISOString(),
        newSourceId: () => randomUUID(),
        getEntity: async (id) => {
          const { data, error } = await this.client
            .from("continuum_entities")
            .select("kind")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return { kind: data.kind as EntityKind };
        },
        findByExternalId: async (sourceType, externalSourceId) => {
          const { data, error } = await this.client
            .from("continuum_human_sources")
            .select(SOURCE_COLUMNS)
            .eq("source_type", sourceType)
            .eq("external_source_id", externalSourceId)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return rowToSource(data);
        },
        findByChecksum: async (sourceType, contentSha256) => {
          const { data, error } = await this.client
            .from("continuum_human_sources")
            .select(SOURCE_COLUMNS)
            .eq("source_type", sourceType)
            .eq("content_sha256", contentSha256)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return rowToSource(data);
        },
        listLinks: (sourceId) => this.listLinks(sourceId),
        insertSource: async (row) => {
          const { error } = await this.client
            .from("continuum_human_sources")
            .insert(sourceToRow(row));
          if (error && isUniqueViolation(error)) return "duplicate-key";
          if (error) throw error;
          return "inserted";
        },
        insertLink: async (row) => {
          const { error } = await this.client
            .from("continuum_human_source_links")
            .insert({
              source_id: row.sourceId,
              entity_id: row.entityId,
              entity_kind: row.entityKind,
              link_status: row.linkStatus,
              created_at: row.createdAt,
            });
          if (error && isUniqueViolation(error)) return "duplicate-key";
          if (error) throw error;
          return "inserted";
        },
        putFile: async (object) => {
          const { error } = await this.client.storage
            .from(HUMAN_SOURCES_BUCKET)
            .upload(object.path, object.bytes, {
              contentType: object.mimeType,
              upsert: false,
            });
          if (error) throw error;
        },
      },
      input,
    );
  }

  async getSource(id: string): Promise<HumanSource | null> {
    const { data, error } = await this.client
      .from("continuum_human_sources")
      .select(SOURCE_COLUMNS)
      .eq("id", id.trim())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToSource(data);
  }

  async listSources(): Promise<HumanSource[]> {
    const { data, error } = await this.client
      .from("continuum_human_sources")
      .select(SOURCE_COLUMNS)
      .order("ingested_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => rowToSource(row));
  }

  async listLinks(sourceId: string): Promise<HumanSourceLink[]> {
    const { data, error } = await this.client
      .from("continuum_human_source_links")
      .select(LINK_COLUMNS)
      .eq("source_id", sourceId.trim());
    if (error) throw error;
    return (data ?? []).map((row) => rowToLink(row));
  }

  async getPersonName(id: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("continuum_person_profiles")
      .select("display_name")
      .eq("person_id", id)
      .maybeSingle();
    if (error) throw error;
    const name = data?.display_name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }

  async getProjectTitle(id: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("continuum_project_profiles")
      .select("display_title")
      .eq("project_id", id)
      .maybeSingle();
    if (error) throw error;
    const title = data?.display_title;
    return typeof title === "string" && title.trim() ? title.trim() : null;
  }
}

export function createSupabaseHumanSourceStore(
  client?: SupabaseClient | null,
): SupabaseHumanSourceStore {
  return new SupabaseHumanSourceStore(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
