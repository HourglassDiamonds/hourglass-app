/**
 * App Router entry for the Client Memory note writer.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseClientMemoryNoteWriter,
  SupabaseClientMemoryNoteWriter,
} from "./supabase";
