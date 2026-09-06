/**
 * App Router entry for founder Gmail → Project Artifact copy-in.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export { copyGmailAttachmentToProject, GMAIL_COPY_APPROVAL } from "./copy";
export type {
  CopyGmailAttachmentToProjectDeps,
  CopyGmailAttachmentToProjectInput,
  CopyGmailAttachmentToProjectResult,
} from "./copy";
export { presentGmailCopyPreview } from "./preview";
export {
  createLiveKnownArtifactGmailApi,
  MockKnownArtifactGmailApi,
} from "@/lib/continuum/gmail/known-artifact-gmail";
