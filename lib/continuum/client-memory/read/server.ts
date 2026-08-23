/**
 * App Router entry for the Client Memory reader.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseClientMemoryReader,
  SupabaseClientMemoryReader,
} from "./supabase";
