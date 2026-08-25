/**
 * App Router entry for the protected Chief of Staff store.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseChiefOfStaffStore,
  SupabaseChiefOfStaffStore,
} from "./supabase";
