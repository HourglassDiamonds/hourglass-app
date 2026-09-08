/**
 * App Router entry for the Calendar association writer.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseCalendarAssociationWriter,
  SupabaseCalendarAssociationWriter,
} from "./supabase";
