/**
 * App Router entry for the Client Memory Person writer.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseClientMemoryPersonWriter,
  SupabaseClientMemoryPersonWriter,
} from "./supabase";
