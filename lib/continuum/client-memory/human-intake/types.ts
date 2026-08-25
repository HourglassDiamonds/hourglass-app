/**
 * Protected human-source inbox contracts.
 * PLAUD / future reMarkable. Not canonical Client Memory.
 */

import type { RelationshipContextLayer } from "../types";

export const HUMAN_INTAKE_SCHEMA_VERSION = 1 as const;

export const HUMAN_SOURCE_TYPES = ["plaud", "remarkable"] as const;

export type HumanSourceType = (typeof HUMAN_SOURCE_TYPES)[number];

export const HUMAN_SOURCE_AUTHOR_JUSTIN = "justin" as const;

export type HumanSourceAuthor = typeof HUMAN_SOURCE_AUTHOR_JUSTIN;

export const HUMAN_COMMUNICATION_TYPES = [
  "call",
  "in-person",
  "voice-memo",
  "reported-text",
  "handwritten",
  "unknown",
] as const;

export type HumanCommunicationType = (typeof HUMAN_COMMUNICATION_TYPES)[number];

export const HUMAN_PARSE_STATUSES = [
  "stored",
  "parsed",
  "no-candidates",
  "failed",
] as const;

export type HumanParseStatus = (typeof HUMAN_PARSE_STATUSES)[number];

export const HUMAN_REVIEW_STATUSES = [
  "pending",
  "in-review",
  "complete",
  "discarded",
] as const;

export type HumanReviewStatus = (typeof HUMAN_REVIEW_STATUSES)[number];

export const HUMAN_LINK_ENTITY_KINDS = ["person", "project"] as const;

export type HumanLinkEntityKind = (typeof HUMAN_LINK_ENTITY_KINDS)[number];

export const HUMAN_LINK_STATUSES = ["candidate", "confirmed"] as const;

export type HumanLinkStatus = (typeof HUMAN_LINK_STATUSES)[number];

export const HUMAN_PROVENANCE_CLASSES = [
  "founder-reported",
  "founder-captured",
  "handwriting-parse",
  "unknown",
] as const;

export type HumanProvenanceClass = (typeof HUMAN_PROVENANCE_CLASSES)[number];

export const HUMAN_SOURCE_TEXT_MAX_LENGTH = 500_000;
export const HUMAN_SOURCE_FILE_MAX_BYTES = 1_048_576;
export const HUMAN_SOURCE_PREVIEW_MAX_LENGTH = 140;

export const PLAUD_SOURCE_TYPE: HumanSourceType = "plaud";

export const HUMAN_SOURCE_PARSE_STATUS_STORED: HumanParseStatus = "stored";
export const HUMAN_SOURCE_REVIEW_STATUS_PENDING: HumanReviewStatus = "pending";

export type HumanSource = {
  id: string;
  sourceType: HumanSourceType;
  externalSourceId: string | null;
  contentSha256: string;
  capturedAt: string | null;
  ingestedAt: string;
  rawStoragePath: string | null;
  rawMimeType: string | null;
  rawByteSize: number | null;
  rawText: string | null;
  parsedText: string | null;
  sourceAuthor: HumanSourceAuthor;
  reportedCommunicationType: HumanCommunicationType;
  parserVersion: string | null;
  parseStatus: HumanParseStatus;
  reviewStatus: HumanReviewStatus;
  contextLayerProposed: RelationshipContextLayer | null;
  contextLayerConfirmed: RelationshipContextLayer | null;
  createdAt: string;
  updatedAt: string;
};

export type HumanSourceLink = {
  sourceId: string;
  entityId: string;
  entityKind: HumanLinkEntityKind;
  linkStatus: HumanLinkStatus;
  createdAt: string;
};

export type IngestHumanSourceInput = {
  sourceType: HumanSourceType;
  externalSourceId?: string | null;
  rawText: string;
  capturedAt?: string | null;
  reportedCommunicationType: HumanCommunicationType;
  contextLayerProposed?: RelationshipContextLayer | null;
  contextLayerConfirmed?: RelationshipContextLayer | null;
  personId?: string | null;
  projectId?: string | null;
  rawFile?: {
    bytes: Uint8Array;
    mimeType: string;
    fileName: string;
  } | null;
};

export type IngestHumanSourceInvalidCode =
  | "empty-text"
  | "oversized-text"
  | "oversized-file"
  | "invalid-id"
  | "invalid-type"
  | "invalid-communication"
  | "invalid-context"
  | "invalid-captured-at";

export type IngestHumanSourceResult =
  | {
      ok: true;
      sourceId: string;
      status: "inserted" | "already-present";
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "entity-not-found"
        | "entity-kind-mismatch"
        | "idempotency-conflict"
        | "unavailable";
      code?: IngestHumanSourceInvalidCode;
    };

export type HumanSourceFileObject = {
  path: string;
  bytes: Uint8Array;
  mimeType: string;
};
