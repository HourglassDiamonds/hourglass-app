/**
 * Founder-approved Gmail attachment COPY-IN into private Project Artifacts.
 * Does not export live Gmail adapters — import those from `./server`.
 */

export { GMAIL_COPY_APPROVAL } from "./constants";
export {
  copyGmailAttachmentToProject,
  GMAIL_COPY_ERROR_CODES,
} from "./copy";
export type {
  CopyGmailAttachmentToProjectDeps,
  CopyGmailAttachmentToProjectInput,
  CopyGmailAttachmentToProjectResult,
  GmailCopyErrorCode,
} from "./copy";
export { presentGmailCopyPreview } from "./preview";
export type { GmailCopyPreview } from "./preview";
export { mapGmailCopyArtifactKind } from "./kind";
export {
  gmailCopyIdentityPrefix,
  packGmailCopySourceRef,
  parseGmailCopySourceRef,
} from "./source-ref";
