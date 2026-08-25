/**
 * Protected Gmail source-index public surface.
 * Does not export the Supabase adapter — import that from `./server`.
 */

export {
  GMAIL_CHECKPOINT_JOB_KEYS,
  GMAIL_CHECKPOINT_STATUSES,
  GMAIL_INDEX_SCHEMA_VERSION,
  GMAIL_MESSAGE_DIRECTIONS,
  GMAIL_SOURCE_SYSTEM,
} from "./types";
export type {
  GmailCheckpoint,
  GmailCheckpointJobKey,
  GmailCheckpointStatus,
  GmailIndexInput,
  GmailIndexedMessage,
  GmailMessageDirection,
  GmailParticipantHashes,
  GmailSourceRecordPointers,
  IndexGmailMessageResult,
} from "./types";
export {
  assertGmailCheckpoint,
  buildGmailIndexedMessage,
  gmailParticipantHashesFromAddresses,
  gmailSourceRecordPointers,
  isEmailHash,
  isGmailCheckpointJobKey,
  isGmailCheckpointStatus,
  isGmailMessageDirection,
  mergeIndexedGmailMessage,
} from "./record";
export { InMemoryGmailIndexStore } from "./store";
export type { GmailIndexStore } from "./store";
