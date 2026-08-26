/**
 * App Router entry for the Project Desk reader.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseProjectDeskReader,
  SupabaseProjectDeskReader,
} from "./supabase";
