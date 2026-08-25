/**
 * App Router entry for the protected human-source store.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseHumanSourceStore,
  SupabaseHumanSourceStore,
} from "./supabase";
