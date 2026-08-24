/**
 * App Router entry for the Client Memory structured-fact writer.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseClientMemoryFactWriter,
  SupabaseClientMemoryFactWriter,
} from "./supabase";
