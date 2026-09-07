/**
 * App Router entry for the durable Candidate store.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseCandidateStore,
  SupabaseCandidateStore,
} from "./supabase";
