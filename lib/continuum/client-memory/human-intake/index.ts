/**
 * Protected human-source inbox public surface.
 * Does not export the Supabase adapter — import that from `./server`.
 */

export {
  HUMAN_COMMUNICATION_TYPES,
  HUMAN_INTAKE_SCHEMA_VERSION,
  HUMAN_LINK_ENTITY_KINDS,
  HUMAN_LINK_STATUSES,
  HUMAN_PARSE_STATUSES,
  HUMAN_PROVENANCE_CLASSES,
  HUMAN_REVIEW_STATUSES,
  HUMAN_SOURCE_AUTHOR_JUSTIN,
  HUMAN_SOURCE_FILE_MAX_BYTES,
  HUMAN_SOURCE_PARSE_STATUS_STORED,
  HUMAN_SOURCE_PREVIEW_MAX_LENGTH,
  HUMAN_SOURCE_REVIEW_STATUS_PENDING,
  HUMAN_SOURCE_TEXT_MAX_LENGTH,
  HUMAN_SOURCE_TYPES,
  PLAUD_SOURCE_TYPE,
} from "./types";
export type {
  HumanCommunicationType,
  HumanLinkEntityKind,
  HumanLinkStatus,
  HumanParseStatus,
  HumanProvenanceClass,
  HumanReviewStatus,
  HumanSource,
  HumanSourceAuthor,
  HumanSourceLink,
  HumanSourceType,
  IngestHumanSourceInput,
  IngestHumanSourceInvalidCode,
  IngestHumanSourceResult,
} from "./types";
export { sha256Utf8, isContentSha256 } from "./hash";
export {
  assertHumanSourceTextLength,
  canonicalizeHumanSourceText,
  decodeUtf8Bytes,
  extractPlaudRawText,
  isAllowedPlaudMime,
  plaudFileKindFromName,
  PLAUD_FILE_EXTENSIONS,
} from "./text";
export {
  isFounderReportedProvenance,
  provenanceClassForCommunication,
} from "./provenance";
export {
  HUMAN_SOURCES_BUCKET,
  HUMAN_SOURCES_SIGNED_URL_TTL_SECONDS,
  humanSourceObjectPath,
} from "./storage";
export { ingestHumanSource } from "./ingest";
export {
  InMemoryHumanSourceStore,
  createInMemoryHumanSourceStore,
  sourcePreview,
} from "./store";
export type { HumanSourceStore } from "./store";
export { composeInboxViews, composeSourceDetail } from "./view";
export type { HumanSourceDetailView, InboxSourceView } from "./view";
