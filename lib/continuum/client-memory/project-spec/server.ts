/**
 * App Router entry for the Client Memory project-spec writer.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseClientMemoryProjectSpecWriter,
  SupabaseClientMemoryProjectSpecWriter,
} from "./supabase";
