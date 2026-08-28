/**
 * App Router entry for Continuum Gmail server-only helpers.
 * Importing this file from a Client Component fails the build.
 * Exact-thread fetch is evidence-only and is not a public route.
 */

import "server-only";

export {
  createSupabaseGmailAttachmentStore,
  createSupabaseGmailConnectionStore,
  SupabaseGmailAttachmentStore,
  SupabaseGmailConnectionStore,
} from "./supabase";
export {
  EXACT_PROJECT_THREAD_FETCH_ERROR_CODES,
  exactThreadOnlyApi,
  lookupFromGetProjectHistory,
  runExactProjectThreadFetch,
} from "./exact-thread";
export type {
  ExactProjectThreadFetchInput,
  ExactProjectThreadFetchResult,
  ExactProjectThreadLookup,
} from "./exact-thread";
export {
  buildExactThreadReconstructionHandoff,
  RECONSTRUCTION_EVIDENCE_KINDS,
} from "./reconstruction-evidence";
export type { ExactThreadReconstructionHandoff } from "./reconstruction-evidence";
export { protectExactThread } from "./exact-thread-payload";
export type { ProtectedExactThread } from "./exact-thread-payload";
