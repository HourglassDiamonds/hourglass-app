/**
 * App Router entry for the founder passkey store.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseFounderPasskeyStore,
  createSupabasePasskeyChallengeLedger,
  SupabaseFounderPasskeyStore,
  SupabasePasskeyChallengeLedger,
} from "./supabase";
