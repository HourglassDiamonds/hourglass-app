/**
 * Domain ingest for protected human sources.
 * SOURCE CAPTURE only. Does not parse candidates or write canonical memory.
 */

import { isRelationshipContextLayer } from "../contracts";
import type { ClientMemoryEntity } from "../types";
import { sha256Utf8 } from "./hash";
import { humanSourceObjectPath } from "./storage";
import {
  HUMAN_COMMUNICATION_TYPES,
  HUMAN_SOURCE_AUTHOR_JUSTIN,
  HUMAN_SOURCE_FILE_MAX_BYTES,
  HUMAN_SOURCE_PARSE_STATUS_STORED,
  HUMAN_SOURCE_REVIEW_STATUS_PENDING,
  HUMAN_SOURCE_TYPES,
  type HumanSource,
  type HumanSourceFileObject,
  type HumanSourceLink,
  type IngestHumanSourceInput,
  type IngestHumanSourceResult,
} from "./types";
import { assertHumanSourceTextLength, canonicalizeHumanSourceText } from "./text";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HumanSourceIngestStatus = "inserted" | "duplicate-key";

export type HumanSourceIngestDeps = {
  nowIso: () => string;
  newSourceId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  findByExternalId: (
    sourceType: HumanSource["sourceType"],
    externalSourceId: string,
  ) => Promise<HumanSource | null>;
  findByChecksum: (
    sourceType: HumanSource["sourceType"],
    contentSha256: string,
  ) => Promise<HumanSource | null>;
  listLinks: (sourceId: string) => Promise<HumanSourceLink[]>;
  insertSource: (row: HumanSource) => Promise<HumanSourceIngestStatus>;
  insertLink: (row: HumanSourceLink) => Promise<HumanSourceIngestStatus>;
  putFile?: (object: HumanSourceFileObject) => Promise<void>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeExternalId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isCommunicationType(
  value: unknown,
): value is HumanSource["reportedCommunicationType"] {
  return (
    typeof value === "string" &&
    (HUMAN_COMMUNICATION_TYPES as readonly string[]).includes(value)
  );
}

function isSourceType(value: unknown): value is HumanSource["sourceType"] {
  return (
    typeof value === "string" &&
    (HUMAN_SOURCE_TYPES as readonly string[]).includes(value)
  );
}

function confirmedEntityIds(links: HumanSourceLink[]): string[] {
  return links
    .filter((row) => row.linkStatus === "confirmed")
    .map((row) => row.entityId)
    .sort();
}

function sameIdSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export async function ingestHumanSource(
  deps: HumanSourceIngestDeps,
  input: IngestHumanSourceInput,
): Promise<IngestHumanSourceResult> {
  if (!isSourceType(input.sourceType)) {
    return { ok: false, reason: "invalid-input", code: "invalid-type" };
  }
  if (!isCommunicationType(input.reportedCommunicationType)) {
    return { ok: false, reason: "invalid-input", code: "invalid-communication" };
  }
  if (
    input.contextLayerProposed != null &&
    !isRelationshipContextLayer(input.contextLayerProposed)
  ) {
    return { ok: false, reason: "invalid-input", code: "invalid-context" };
  }
  if (
    input.contextLayerConfirmed != null &&
    !isRelationshipContextLayer(input.contextLayerConfirmed)
  ) {
    return { ok: false, reason: "invalid-input", code: "invalid-context" };
  }

  const rawText = canonicalizeHumanSourceText(input.rawText);
  const length = assertHumanSourceTextLength(rawText);
  if (length !== "ok") {
    return { ok: false, reason: "invalid-input", code: length };
  }

  const capturedAt = normalizeOptionalId(input.capturedAt);
  if (capturedAt && Number.isNaN(Date.parse(capturedAt))) {
    return { ok: false, reason: "invalid-input", code: "invalid-captured-at" };
  }

  const personId = normalizeOptionalId(input.personId);
  const projectId = normalizeOptionalId(input.projectId);
  if (personId && !isUuid(personId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }
  if (projectId && !isUuid(projectId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }

  const file = input.rawFile ?? null;
  if (file && file.bytes.byteLength > HUMAN_SOURCE_FILE_MAX_BYTES) {
    return { ok: false, reason: "invalid-input", code: "oversized-file" };
  }

  const contentSha256 = sha256Utf8(rawText);
  const externalSourceId = normalizeExternalId(input.externalSourceId);

  try {
    if (personId) {
      const person = await deps.getEntity(personId);
      if (!person) return { ok: false, reason: "entity-not-found" };
      if (person.kind !== "person") {
        return { ok: false, reason: "entity-kind-mismatch" };
      }
    }
    if (projectId) {
      const project = await deps.getEntity(projectId);
      if (!project) return { ok: false, reason: "entity-not-found" };
      if (project.kind !== "project") {
        return { ok: false, reason: "entity-kind-mismatch" };
      }
    }

    const existing = await findExistingSource(deps, {
      sourceType: input.sourceType,
      externalSourceId,
      contentSha256,
    });
    if (existing.status === "conflict") {
      return { ok: false, reason: "idempotency-conflict" };
    }
    if (existing.record) {
      const linksOk = await incomingLinksCompatible(deps, existing.record.id, {
        personId,
        projectId,
      });
      if (!linksOk) return { ok: false, reason: "idempotency-conflict" };
      return {
        ok: true,
        sourceId: existing.record.id,
        status: "already-present",
      };
    }

    const now = deps.nowIso();
    const sourceId = deps.newSourceId();
    if (!isUuid(sourceId)) {
      return { ok: false, reason: "unavailable" };
    }

    let rawStoragePath: string | null = null;
    if (file) {
      rawStoragePath = humanSourceObjectPath(sourceId, file.fileName);
      if (!rawStoragePath) {
        return { ok: false, reason: "invalid-input", code: "invalid-type" };
      }
    }

    const row: HumanSource = {
      id: sourceId,
      sourceType: input.sourceType,
      externalSourceId,
      contentSha256,
      capturedAt,
      ingestedAt: now,
      rawStoragePath,
      rawMimeType: file?.mimeType ?? null,
      rawByteSize: file ? file.bytes.byteLength : null,
      rawText,
      parsedText: null,
      sourceAuthor: HUMAN_SOURCE_AUTHOR_JUSTIN,
      reportedCommunicationType: input.reportedCommunicationType,
      parserVersion: null,
      parseStatus: HUMAN_SOURCE_PARSE_STATUS_STORED,
      reviewStatus: HUMAN_SOURCE_REVIEW_STATUS_PENDING,
      contextLayerProposed: input.contextLayerProposed ?? null,
      contextLayerConfirmed: input.contextLayerConfirmed ?? null,
      createdAt: now,
      updatedAt: now,
    };

    if (file && rawStoragePath && deps.putFile) {
      await deps.putFile({
        path: rawStoragePath,
        bytes: file.bytes,
        mimeType: file.mimeType,
      });
    }

    const inserted = await deps.insertSource(row);
    if (inserted === "duplicate-key") {
      const raced = await deps.findByChecksum(input.sourceType, contentSha256);
      if (!raced) return { ok: false, reason: "unavailable" };
      return { ok: true, sourceId: raced.id, status: "already-present" };
    }

    const linkNow = now;
    if (personId) {
      const status = await deps.insertLink({
        sourceId,
        entityId: personId,
        entityKind: "person",
        linkStatus: "confirmed",
        createdAt: linkNow,
      });
      if (status === "duplicate-key") {
        return { ok: false, reason: "unavailable" };
      }
    }
    if (projectId) {
      const status = await deps.insertLink({
        sourceId,
        entityId: projectId,
        entityKind: "project",
        linkStatus: "confirmed",
        createdAt: linkNow,
      });
      if (status === "duplicate-key") {
        return { ok: false, reason: "unavailable" };
      }
    }

    return { ok: true, sourceId, status: "inserted" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

async function findExistingSource(
  deps: HumanSourceIngestDeps,
  input: {
    sourceType: HumanSource["sourceType"];
    externalSourceId: string | null;
    contentSha256: string;
  },
): Promise<
  | { status: "ok"; record: HumanSource | null }
  | { status: "conflict" }
> {
  if (input.externalSourceId) {
    const byExternal = await deps.findByExternalId(
      input.sourceType,
      input.externalSourceId,
    );
    if (byExternal) {
      if (byExternal.contentSha256 !== input.contentSha256) {
        return { status: "conflict" };
      }
      return { status: "ok", record: byExternal };
    }
    const byChecksum = await deps.findByChecksum(
      input.sourceType,
      input.contentSha256,
    );
    if (byChecksum) {
      return { status: "conflict" };
    }
    return { status: "ok", record: null };
  }

  const byChecksum = await deps.findByChecksum(
    input.sourceType,
    input.contentSha256,
  );
  return { status: "ok", record: byChecksum };
}

async function incomingLinksCompatible(
  deps: HumanSourceIngestDeps,
  sourceId: string,
  incoming: { personId: string | null; projectId: string | null },
): Promise<boolean> {
  const requested = [incoming.personId, incoming.projectId].filter(
    (value): value is string => Boolean(value),
  );
  if (requested.length === 0) return true;
  const existing = confirmedEntityIds(await deps.listLinks(sourceId));
  return sameIdSet([...requested].sort(), existing);
}
