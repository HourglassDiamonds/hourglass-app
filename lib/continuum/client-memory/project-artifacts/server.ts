/**
 * App Router entry for the Project Artifacts founder writer.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseProjectArtifactWriter,
  SupabaseProjectArtifactWriter,
} from "./supabase-writer";
