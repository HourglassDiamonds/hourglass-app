/**
 * App Router entry for the Open Jobs founder writer.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseProjectJobWriter,
  SupabaseProjectJobWriter,
} from "./supabase-writer";
