/**
 * App Router entry for the protected Gmail source-index store.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseGmailIndexStore,
  SupabaseGmailIndexStore,
} from "./supabase";
