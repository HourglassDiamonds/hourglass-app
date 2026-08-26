/**
 * App Router entry for the digital-card store.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseDigitalCardStore,
  SupabaseDigitalCardStore,
} from "./supabase";
