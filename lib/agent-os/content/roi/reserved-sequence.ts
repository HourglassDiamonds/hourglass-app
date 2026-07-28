/**
 * Content ROI reserved-sequence accessors.
 * Canonical data lives in `../editorial-sequence` — do not duplicate titles here.
 */

export {
  RESERVED_CONVERSATION_CYCLES,
  PLANNED_CONVERSATION_TOPICS,
  RESERVE_BACKLOG_CONVERSATION_TOPICS,
  getCanonicalReservedSequenceTitles,
  getCanonicalReservedTasteTitles,
  type ReservedConversationCycle,
  type PlannedConversationTopic,
} from "../editorial-sequence";

/** Inspectability note — conflict resolved; older themes live in reserve-backlog. */
export const EDITORIAL_SEQUENCE_SOURCE_NOTE =
  "Canonical reserved Conversation sequence is lib/agent-os/content/editorial-sequence.ts (re-exported via themes.ts and Content ROI). Older planned themes remain in RESERVE_BACKLOG_CONVERSATION_TOPICS.";
